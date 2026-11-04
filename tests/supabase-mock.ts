/**
 * Mock de Supabase (PostgREST + GoTrue) con page.route: los tests no dependen de la red ni de
 * la base real. El catálogo sale de scripts/catalog-rows.ts, igual que supabase/seed.sql.
 *
 * Implementa solo lo que usa src/services:
 *   - REST del catálogo con eq / neq / gt / gte / lte / in / ilike, el embed `match`, order y limit
 *   - newsletter_subscribers / contact_messages (POST)
 *   - profiles, addresses, orders (+ order_items) filtrados por el usuario del token, como RLS
 *   - rpc/create_order y rpc/cancel_order con las mismas validaciones y códigos que la función SQL
 *   - auth/v1: signup, token (password / refresh), user, logout, recover
 */
import { randomUUID } from 'node:crypto'
import type { Page, Request, Route } from '@playwright/test'
import { buildCatalogRows } from '../scripts/catalog-rows'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, apikey, content-type, prefer, range, accept, accept-profile, content-profile, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': '*',
}

// Mismas reglas que private.checkout_rules() (centavos)
const RULES = { shipping: 850000, freeFrom: 15000000, maxLines: 20, maxQuantity: 10, maxPendingPerHour: 5 }

type Row = Record<string, unknown>

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function buildDb() {
  const rows = buildCatalogRows()
  const categoryBySlug = new Map(rows.categories.map((c) => [c.slug, c]))
  const colors = rows.colors.map((c, i) => ({ id: i + 1, ...c }))
  const colorId = (product: string, slug: string | null) =>
    slug === null ? null : colors.find((c) => c.product_slug === product && c.slug === slug)!.id
  let variantSeq = 0

  const products = rows.products
    .filter((p) => p.is_active)
    .map((p) => {
      const own = colors.filter((c) => c.product_slug === p.slug)
      const category = categoryBySlug.get(p.category_slug)!
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        details: p.details,
        care: p.care,
        material: p.material,
        price_cents: p.price_cents,
        compare_at_cents: p.compare_at_cents,
        is_new: p.is_new,
        popularity: p.popularity,
        created_at: `${p.created_at}T00:00:00+00:00`,
        search_text: normalize([p.name, p.description, p.material, category.slug, category.name, ...own.map((c) => c.name)].join(' ')),
        category: { slug: p.category_slug },
        colors: own.map(({ id, slug, name, hex, sort_order }) => ({ id, slug, name, hex, sort_order })),
        images: rows.images
          .filter((img) => img.product_slug === p.slug)
          .map(({ product_slug, color_slug, ...img }) => ({ ...img, color_id: colorId(product_slug, color_slug) })),
        variants: rows.variants
          .filter((v) => v.product_slug === p.slug)
          .map((v) => ({ id: ++variantSeq, color_id: colorId(v.product_slug, v.color_slug)!, size: v.size, sku: v.sku, stock: v.stock })),
      }
    })

  const activeSlugs = new Set(products.map((p) => p.slug))
  return {
    categories: rows.categories,
    products,
    colors: colors.filter((c) => activeSlugs.has(c.product_slug)),
  }
}

type Db = ReturnType<typeof buildDb>
type ProductJson = Db['products'][number]

function get(row: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (value as Row | undefined)?.[key], row)
}

function parseList(raw: string): string[] {
  return raw
    .replace(/^\(|\)$/g, '')
    .split(',')
    .map((v) => v.replace(/^"|"$/g, ''))
}

/** Evalúa un filtro de PostgREST ("gte.5000", "in.(S,M)", "ilike.%lino%") contra un valor. */
function matches(actual: unknown, filter: string): boolean {
  const dot = filter.indexOf('.')
  const op = filter.slice(0, dot)
  const raw = filter.slice(dot + 1)
  const num = Number(raw)
  const cmp = typeof actual === 'number' ? num : raw
  switch (op) {
    case 'eq':
      return String(actual) === raw
    case 'neq':
      return String(actual) !== raw
    case 'gt':
      return (actual as number) > (cmp as number)
    case 'gte':
      return (actual as number) >= (cmp as number)
    case 'lt':
      return (actual as number) < (cmp as number)
    case 'lte':
      return (actual as number) <= (cmp as number)
    case 'in':
      return parseList(raw).includes(String(actual))
    case 'ilike': {
      const re = new RegExp(`^${raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*')}$`, 'i')
      return re.test(String(actual))
    }
    default:
      throw new Error(`Operador no soportado por el mock: ${op}`)
  }
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns'])

function filterRows<T>(rows: T[], params: URLSearchParams, special?: (row: T, filters: [string, string][]) => boolean): T[] {
  const filters = [...params.entries()].filter(([key]) => !RESERVED.has(key))
  const plain = filters.filter(([key]) => !key.startsWith('match.'))
  const match = filters.filter(([key]) => key.startsWith('match.'))
  return rows.filter(
    (row) => plain.every(([key, f]) => matches(get(row, key), f)) && (!match.length || special?.(row, match) !== false),
  )
}

function orderAndLimit<T>(rows: T[], params: URLSearchParams): T[] {
  const order = params.get('order')
  const sorted = [...rows]
  if (order) {
    const keys = order.split(',').map((part) => {
      const [col, dir = 'asc'] = part.split('.')
      return { col: col!, desc: dir === 'desc' }
    })
    sorted.sort((a, b) => {
      for (const { col, desc } of keys) {
        const x = get(a, col) as string | number | boolean
        const y = get(b, col) as string | number | boolean
        if (x === y) continue
        return (x < y ? -1 : 1) * (desc ? -1 : 1)
      }
      return 0
    })
  }
  const limit = params.get('limit')
  return limit ? sorted.slice(0, Number(limit)) : sorted
}

/** Embed `match:variants!inner(...)`: alguna variante cumple todos los filtros match.* a la vez. */
function variantMatch(product: ProductJson, filters: [string, string][]): boolean {
  return product.variants.some((v) => {
    const color = product.colors.find((c) => c.id === v.color_id)
    const row = { ...v, color: { slug: color?.slug } }
    return filters.every(([key, f]) => matches(get(row, key.slice('match.'.length)), f))
  })
}

// --- Auth ----------------------------------------------------------------------

interface MockUser {
  id: string
  email: string
  password: string
  fullName: string
  confirmed: boolean
}

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** JWT sin firma válida: alcanza para auth-js (no verifica) y para que el mock sepa quién es */
function accessToken(user: MockUser) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.firma`
}

function userJson(u: MockUser) {
  const now = new Date().toISOString()
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.confirmed ? now : null,
    user_metadata: { full_name: u.fullName },
    app_metadata: { provider: 'email', providers: ['email'] },
    identities: [{ id: u.id, user_id: u.id, provider: 'email', identity_data: { email: u.email, sub: u.id } }],
    created_at: now,
    updated_at: now,
  }
}

function sessionJson(u: MockUser) {
  return {
    access_token: accessToken(u),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `refresh-${u.id}`,
    user: userJson(u),
  }
}

// --- Mock --------------------------------------------------------------------

interface AddressRow {
  id: string
  user_id: string
  street: string
  number: string
  apartment: string | null
  city: string
  province: string
  postal_code: string
  is_default: boolean
  created_at: string
}

interface OrderRow {
  id: string
  user_id: string
  status: string
  subtotal_cents: number
  shipping_cents: number
  total_cents: number
  shipping_address: Row
  created_at: string
  items: Row[]
}

export interface SupabaseMock {
  newsletter: string[]
  contactMessages: { name: string; email: string; message: string }[]
  /** Cuerpos recibidos en rpc/create_order (para verificar que el front no manda precios) */
  createOrderCalls: unknown[]
  orders: OrderRow[]
  /** Si es false, signup devuelve sesión directamente (proyecto sin confirmación de email) */
  confirmEmail: boolean
  addUser: (user: { email: string; password: string; fullName: string }) => void
  stockOf: (sku: string) => number
  setStock: (sku: string, stock: number) => void
  variantId: (sku: string) => number
  /**
   * El link que Supabase mandaría por email (confirmación o recuperación): el redirect_to que
   * pidió el cliente + ?code=. Al abrirlo, auth-js canjea el código en /token?grant_type=pkce.
   */
  emailLink: (email: string) => string
  /**
   * Simula una caída de red hacia Supabase hasta que se vuelva a llamar con false.
   * supabase-js reintenta los GET 3 veces (1 s, 2 s, 4 s) antes de devolver el error.
   */
  setOffline: (offline: boolean) => void
}

export async function mockSupabase(page: Page): Promise<SupabaseMock> {
  const db = buildDb()
  const users = new Map<string, MockUser>()
  const profiles = new Map<string, { full_name: string; phone: string | null }>()
  const addresses: AddressRow[] = []
  const sentEmails: { email: string; redirectTo: string }[] = []
  const authCodes = new Map<string, MockUser>()
  let offline = false

  const allVariants = () => db.products.flatMap((product) => product.variants.map((v) => ({ v, product })))
  const findSku = (sku: string) => {
    const found = allVariants().find((x) => x.v.sku === sku)
    if (!found) throw new Error(`SKU inexistente en el mock: ${sku}`)
    return found.v
  }

  const mock: SupabaseMock = {
    newsletter: [],
    contactMessages: [],
    createOrderCalls: [],
    orders: [],
    confirmEmail: true,
    addUser: ({ email, password, fullName }) => {
      const user = { id: randomUUID(), email, password, fullName, confirmed: true }
      users.set(email, user)
      profiles.set(user.id, { full_name: fullName, phone: null })
    },
    stockOf: (sku) => findSku(sku).stock,
    setStock: (sku, stock) => {
      findSku(sku).stock = stock
    },
    variantId: (sku) => findSku(sku).id,
    emailLink: (email) => {
      const sent = sentEmails.filter((e) => e.email === email).at(-1)
      if (!sent) throw new Error(`No se mandó ningún email a ${email}`)
      const code = randomUUID()
      authCodes.set(code, users.get(email)!)
      const link = new URL(sent.redirectTo)
      link.searchParams.set('code', code)
      return link.toString()
    },
    setOffline: (value) => {
      offline = value
    },
  }

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const pgError = (route: Route, status: number, code: string, message: string, details: string | null = null) =>
    json(route, { code, message, details, hint: null }, status)
  /** Con .single() / .maybeSingle() PostgREST devuelve un objeto */
  const rows = (route: Route, request: Request, list: unknown[]) =>
    request.headers()['accept']?.includes('vnd.pgrst.object') ? json(route, list[0] ?? null) : json(route, list)

  /** Usuario del Authorization: Bearer <jwt> (como auth.uid()) */
  function currentUser(request: Request): MockUser | undefined {
    const token = request.headers()['authorization']?.replace(/^Bearer /, '') ?? ''
    const payload = token.split('.')[1]
    if (!payload) return undefined
    try {
      const { sub } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: string }
      return [...users.values()].find((u) => u.id === sub)
    } catch {
      return undefined
    }
  }

  // --- GoTrue ---
  async function handleAuth(route: Route, request: Request, path: string, url: URL) {
    const body = (request.postData() ? request.postDataJSON() : {}) as Row
    switch (`${request.method()} ${path}`) {
      case 'POST signup': {
        const email = String(body.email).toLowerCase()
        const data = (body.data ?? {}) as { full_name?: string }
        let user = users.get(email)
        if (!user) {
          user = { id: randomUUID(), email, password: String(body.password), fullName: data.full_name ?? '', confirmed: !mock.confirmEmail }
          users.set(email, user)
          // El trigger handle_new_user crea el perfil
          profiles.set(user.id, { full_name: user.fullName, phone: null })
        } else if (!mock.confirmEmail) {
          return json(route, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' }, 422)
        }
        if (mock.confirmEmail) sentEmails.push({ email, redirectTo: url.searchParams.get('redirect_to') ?? '' })
        return json(route, mock.confirmEmail ? userJson(user) : sessionJson(user))
      }
      case 'POST token': {
        const grant = url.searchParams.get('grant_type')
        if (grant === 'pkce') {
          const user = authCodes.get(String(body.auth_code))
          authCodes.delete(String(body.auth_code))
          if (!user || !body.code_verifier) {
            return json(route, { code: 400, error_code: 'flow_state_not_found', msg: 'invalid flow state' }, 400)
          }
          user.confirmed = true
          return json(route, sessionJson(user))
        }
        if (grant === 'refresh_token') {
          const id = String(body.refresh_token).replace(/^refresh-/, '')
          const user = [...users.values()].find((u) => u.id === id)
          return user
            ? json(route, sessionJson(user))
            : json(route, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, 400)
        }
        const user = users.get(String(body.email).toLowerCase())
        if (!user || user.password !== body.password) {
          return json(route, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400)
        }
        if (!user.confirmed) return json(route, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' }, 400)
        return json(route, sessionJson(user))
      }
      case 'GET user':
      case 'PUT user': {
        const user = currentUser(request)
        if (!user) return json(route, { code: 401, error_code: 'session_not_found', msg: 'Session not found' }, 401)
        if (request.method() === 'PUT' && typeof body.password === 'string') user.password = body.password
        return json(route, userJson(user))
      }
      case 'POST logout':
        return route.fulfill({ status: 204, headers: CORS })
      case 'POST recover': {
        const email = String(body.email).toLowerCase()
        if (users.has(email)) sentEmails.push({ email, redirectTo: url.searchParams.get('redirect_to') ?? '' })
        return json(route, {})
      }
      default:
        return json(route, { code: 404, error_code: 'not_found', msg: `Mock sin ${request.method()} ${path}` }, 404)
    }
  }

  // --- RPC ---
  function createOrder(route: Route, user: MockUser | undefined, body: Row) {
    mock.createOrderCalls.push(body)
    if (!user) return pgError(route, 401, '28000', 'Tenés que ingresar a tu cuenta para comprar.')
    const items = body.items as { variant_id: unknown; quantity: unknown }[]
    if (!Array.isArray(items) || items.length < 1 || items.length > RULES.maxLines) {
      return pgError(route, 400, '22023', 'Formato de items inválido.')
    }
    const bad = items.some(
      (i) =>
        Object.keys(i).sort().join() !== 'quantity,variant_id' ||
        !Number.isInteger(i.variant_id) ||
        !Number.isInteger(i.quantity) ||
        (i.quantity as number) < 1 ||
        (i.quantity as number) > RULES.maxQuantity,
    )
    if (bad || new Set(items.map((i) => i.variant_id)).size !== items.length) {
      return pgError(route, 400, '22023', 'Formato de items inválido.')
    }
    const address = addresses.find((a) => a.id === body.address_id && a.user_id === user.id)
    if (!address) return pgError(route, 400, 'UM003', 'La dirección de envío no es válida.')
    const hourAgo = Date.now() - 3600_000
    const pending = mock.orders.filter(
      (o) => o.user_id === user.id && o.status === 'pendiente_pago' && Date.parse(o.created_at) > hourAgo,
    )
    if (pending.length >= RULES.maxPendingPerHour) {
      return pgError(route, 400, 'UM004', 'Tenés demasiados pedidos pendientes de pago. Probá de nuevo más tarde.')
    }

    const lines = items
      .map((i) => ({ found: allVariants().find((x) => x.v.id === i.variant_id), quantity: i.quantity as number, id: i.variant_id }))
      .sort((a, b) => (a.id as number) - (b.id as number))
    const missing = lines.filter((l) => !l.found).map((l) => l.id)
    if (missing.length) return pgError(route, 400, 'UM002', 'Algunos productos ya no existen.', JSON.stringify(missing))

    const problems = lines
      .filter((l) => l.found!.v.stock < l.quantity)
      .map(({ found, quantity }) => ({
        sku: found!.v.sku,
        product_name: found!.product.name,
        color_name: found!.product.colors.find((c) => c.id === found!.v.color_id)!.name,
        size: found!.v.size,
        requested: quantity,
        available: found!.v.stock,
      }))
    if (problems.length) return pgError(route, 400, 'UM001', 'No hay stock suficiente.', JSON.stringify(problems))

    const orderId = randomUUID()
    const orderItems = lines.map(({ found, quantity }, i) => ({
      id: mock.orders.length * 100 + i + 1,
      variant_id: found!.v.id,
      sku: found!.v.sku,
      product_name: found!.product.name,
      color_name: found!.product.colors.find((c) => c.id === found!.v.color_id)!.name,
      size: found!.v.size,
      unit_price_cents: found!.product.price_cents,
      quantity,
      line_total_cents: found!.product.price_cents * quantity,
    }))
    const subtotal = orderItems.reduce((sum, i) => sum + i.line_total_cents, 0)
    const shipping = subtotal >= RULES.freeFrom ? 0 : RULES.shipping
    const profile = profiles.get(user.id)
    mock.orders.push({
      id: orderId,
      user_id: user.id,
      status: 'pendiente_pago',
      subtotal_cents: subtotal,
      shipping_cents: shipping,
      total_cents: subtotal + shipping,
      shipping_address: {
        recipient: profile?.full_name ?? '',
        phone: profile?.phone ?? null,
        street: address.street,
        number: address.number,
        apartment: address.apartment,
        city: address.city,
        province: address.province,
        postal_code: address.postal_code,
      },
      created_at: new Date().toISOString(),
      items: orderItems,
    })
    for (const { found, quantity } of lines) found!.v.stock -= quantity
    return json(route, orderId)
  }

  function cancelOrder(route: Route, user: MockUser | undefined, body: Row) {
    if (!user) return pgError(route, 401, '28000', 'Tenés que ingresar a tu cuenta.')
    const order = mock.orders.find((o) => o.id === body.order_id && o.user_id === user.id)
    if (!order) return pgError(route, 400, 'UM005', 'No encontramos ese pedido.')
    if (order.status !== 'pendiente_pago') return pgError(route, 400, 'UM006', 'Este pedido ya no se puede cancelar.')
    for (const item of order.items) {
      const v = allVariants().find((x) => x.v.id === item.variant_id)?.v
      if (v) v.stock += item.quantity as number
    }
    order.status = 'cancelado'
    return route.fulfill({ status: 204, headers: CORS })
  }

  // --- Tablas con RLS por usuario ---
  async function handleAccountTable(route: Route, request: Request, table: string, params: URLSearchParams, user: MockUser | undefined) {
    const method = request.method()
    if (!user) return pgError(route, 401, '42501', `permission denied for table ${table}`)
    const body = (request.postData() ? request.postDataJSON() : {}) as Row

    if (table === 'profiles') {
      const profile = profiles.get(user.id)!
      if (method === 'PATCH') {
        Object.assign(profile, body)
        return route.fulfill({ status: 204, headers: CORS })
      }
      return rows(route, request, [profile])
    }

    if (table === 'addresses') {
      const own = addresses.filter((a) => a.user_id === user.id)
      const unsetOthers = (keep: string) => own.forEach((a) => a.id !== keep && (a.is_default = false))
      if (method === 'GET') return rows(route, request, orderAndLimit(filterRows(own, params), params))
      if (method === 'POST') {
        const created: AddressRow = {
          ...(body as unknown as AddressRow),
          id: randomUUID(),
          user_id: user.id,
          created_at: new Date().toISOString(),
        }
        if (created.is_default) unsetOthers(created.id)
        addresses.push(created)
        return rows(route, request, [created])
      }
      const targets = filterRows(own, params)
      if (method === 'PATCH') {
        for (const a of targets) {
          Object.assign(a, body)
          if (a.is_default) unsetOthers(a.id)
        }
        return route.fulfill({ status: 204, headers: CORS })
      }
      if (method === 'DELETE') {
        for (const a of targets) addresses.splice(addresses.indexOf(a), 1)
        return route.fulfill({ status: 204, headers: CORS })
      }
    }

    if (table === 'orders' && method === 'GET') {
      const own = mock.orders.filter((o) => o.user_id === user.id)
      return rows(route, request, orderAndLimit(filterRows(own, params), params))
    }
    return pgError(route, 401, '42501', `permission denied for table ${table}`)
  }

  await page.route(
    (url) => url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/'),
    async (route) => {
      const request = route.request()
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
      if (offline) return route.abort('internetdisconnected')

      const url = new URL(request.url())
      if (url.pathname.includes('/auth/v1/')) {
        return handleAuth(route, request, url.pathname.split('/auth/v1/')[1]!, url)
      }

      const path = url.pathname.split('/rest/v1/')[1]!
      const params = url.searchParams
      const user = currentUser(request)

      if (path.startsWith('rpc/')) {
        const body = request.postDataJSON() as Row
        if (path === 'rpc/create_order') return createOrder(route, user, body)
        if (path === 'rpc/cancel_order') return cancelOrder(route, user, body)
        return pgError(route, 404, 'PGRST202', `Could not find the function public.${path.slice(4)}`)
      }

      if (['profiles', 'addresses', 'orders'].includes(path)) return handleAccountTable(route, request, path, params, user)

      if (request.method() === 'POST') {
        const body = request.postDataJSON() as Row
        if (path === 'newsletter_subscribers') {
          const email = String(body.email)
          if (mock.newsletter.includes(email)) {
            return pgError(route, 409, '23505', 'duplicate key value violates unique constraint "newsletter_subscribers_email_key"')
          }
          mock.newsletter.push(email)
          return route.fulfill({ status: 201, headers: CORS })
        }
        if (path === 'contact_messages') {
          mock.contactMessages.push(body as SupabaseMock['contactMessages'][number])
          return route.fulfill({ status: 201, headers: CORS })
        }
        return pgError(route, 401, '42501', `permission denied for table ${path}`)
      }

      switch (path) {
        case 'categories':
          return json(route, orderAndLimit(filterRows(db.categories, params), params))
        case 'products':
          return json(route, orderAndLimit(filterRows(db.products, params, variantMatch), params))
        case 'product_colors':
          return json(route, orderAndLimit(filterRows(db.colors, params), params))
        case 'variants': {
          const list = allVariants().map(({ v, product }) => ({ ...v, product }))
          const filtered = orderAndLimit(filterRows(list, params), params)
          return json(
            route,
            params.has('sku') ? filtered.map((v) => ({ sku: v.sku, product: v.product })) : filtered.map((v) => ({ size: v.size })),
          )
        }
        default:
          return pgError(route, 404, '42P01', `relation "public.${path}" does not exist`)
      }
    },
  )

  return mock
}
