/**
 * Mock de Supabase (PostgREST + GoTrue + Storage) con page.route: los tests no dependen de
 * la red ni de la base real. El catálogo sale de scripts/catalog-rows.ts, igual que seed.sql.
 *
 * Emula lo que usa la app, con las mismas reglas que las migraciones:
 *   - tablas normalizadas (categories, products, product_colors, product_images, variants) y
 *     los embeds que pide el front, con filtros eq / neq / gt / gte / lt / lte / in / like /
 *     ilike, order, offset / limit y Prefer: count=exact
 *   - RLS: anónimos y clientes ven solo productos activos; el admin (app_metadata.role) ve
 *     todo y es el único que escribe el catálogo, lee pedidos ajenos, mensajes y suscriptores
 *   - rpc: create_order, cancel_order, admin_set_order_status, admin_dashboard
 *   - auth/v1: signup, token (password / refresh / pkce), user, logout, recover
 *   - storage/v1: subir, borrar y servir archivos públicos del bucket product-images
 */
import { randomUUID } from 'node:crypto'
import type { Page, Request, Route } from '@playwright/test'
import { buildCatalogRows } from '../scripts/catalog-rows'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, apikey, content-type, prefer, range, accept, accept-profile, content-profile, x-client-info, x-supabase-api-version, x-upsert, cache-control',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': '*',
}

// Mismas reglas que private.checkout_rules() (centavos)
const RULES = { shipping: 850000, freeFrom: 15000000, maxLines: 20, maxQuantity: 10, maxPendingPerHour: 5 }
const BUCKET = 'product-images'

type Row = Record<string, unknown>

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// --- Datos ---------------------------------------------------------------------

interface CategoryRow {
  id: number
  slug: string
  name: string
  description: string
  sort_order: number
}
interface ProductRow {
  id: string
  slug: string
  name: string
  description: string
  details: string[]
  care: string[]
  material: string
  category_id: number
  price_cents: number
  compare_at_cents: number | null
  is_new: boolean
  is_active: boolean
  popularity: number
  created_at: string
  updated_at: string
}
interface ColorRow {
  id: number
  product_id: string
  slug: string
  name: string
  hex: string
  sort_order: number
}
interface ImageRow {
  id: number
  product_id: string
  color_id: number | null
  view: string
  path: string
  width: number
  height: number
  alt: string
  sort_order: number
  source: 'static' | 'storage'
}
interface VariantRow {
  id: number
  product_id: string
  color_id: number
  size: string
  sku: string
  stock: number
  updated_at: string
}

function buildDb() {
  const rows = buildCatalogRows()
  const now = new Date().toISOString()
  const categories: CategoryRow[] = rows.categories.map((c, i) => ({ id: i + 1, ...c }))
  const products: ProductRow[] = rows.products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    details: p.details,
    care: p.care,
    material: p.material,
    category_id: categories.find((c) => c.slug === p.category_slug)!.id,
    price_cents: p.price_cents,
    compare_at_cents: p.compare_at_cents,
    is_new: p.is_new,
    is_active: p.is_active,
    popularity: p.popularity,
    created_at: `${p.created_at}T00:00:00+00:00`,
    updated_at: now,
  }))
  const productId = (slug: string) => products.find((p) => p.slug === slug)!.id
  const colors: ColorRow[] = rows.colors.map((c, i) => ({
    id: i + 1,
    product_id: productId(c.product_slug),
    slug: c.slug,
    name: c.name,
    hex: c.hex,
    sort_order: c.sort_order,
  }))
  const colorId = (product: string, slug: string | null) =>
    slug === null ? null : colors.find((c) => c.product_id === productId(product) && c.slug === slug)!.id
  const images: ImageRow[] = rows.images.map((img, i) => ({
    id: i + 1,
    product_id: productId(img.product_slug),
    color_id: colorId(img.product_slug, img.color_slug),
    view: img.view,
    path: img.path,
    width: img.width,
    height: img.height,
    alt: img.alt,
    sort_order: img.sort_order,
    source: 'static',
  }))
  const variants: VariantRow[] = rows.variants.map((v, i) => ({
    id: i + 1,
    product_id: productId(v.product_slug),
    color_id: colorId(v.product_slug, v.color_slug)!,
    size: v.size,
    sku: v.sku,
    stock: v.stock,
    updated_at: now,
  }))
  return { categories, products, colors, images, variants }
}

type Db = ReturnType<typeof buildDb>

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
  const pattern = (flags: string) =>
    new RegExp(`^${raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*')}$`, flags)
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
    case 'like':
      return pattern('').test(String(actual))
    case 'ilike':
      return pattern('i').test(String(actual))
    default:
      throw new Error(`Operador no soportado por el mock: ${op}`)
  }
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'])

function filterRows<T>(rows: T[], params: URLSearchParams, special?: (row: T, filters: [string, string][]) => boolean): T[] {
  const filters = [...params.entries()].filter(([key]) => !RESERVED.has(key))
  const plain = filters.filter(([key]) => !key.startsWith('match.'))
  const match = filters.filter(([key]) => key.startsWith('match.'))
  return rows.filter(
    (row) => plain.every(([key, f]) => matches(get(row, key), f)) && (!match.length || special?.(row, match) !== false),
  )
}

function sortRows<T>(rows: T[], params: URLSearchParams): T[] {
  const order = params.get('order')
  const sorted = [...rows]
  if (!order) return sorted
  const keys = order.split(',').map((part) => {
    const [col, dir = 'asc'] = part.split('.')
    return { col: col!, desc: dir === 'desc' }
  })
  return sorted.sort((a, b) => {
    for (const { col, desc } of keys) {
      const x = get(a, col) as string | number | boolean
      const y = get(b, col) as string | number | boolean
      if (x === y) continue
      return (x < y ? -1 : 1) * (desc ? -1 : 1)
    }
    return 0
  })
}

// --- Auth ----------------------------------------------------------------------

interface MockUser {
  id: string
  email: string
  password: string
  fullName: string
  confirmed: boolean
  admin: boolean
}

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const appMetadata = (u: MockUser) => ({ provider: 'email', providers: ['email'], ...(u.admin && { role: 'admin' }) })

/** JWT sin firma válida: alcanza para auth-js (no verifica) y para que el mock sepa quién es */
function accessToken(user: MockUser) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    aud: 'authenticated',
    app_metadata: appMetadata(user),
    exp,
  })}.firma`
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
    app_metadata: appMetadata(u),
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

/** Extrae el archivo de un multipart/form-data (storage-js manda el Blob así) */
function fileFromMultipart(body: Buffer, contentType: string): { type: string; bytes: Buffer } | null {
  const boundary = /boundary=(.+)$/.exec(contentType)?.[1]
  if (!boundary) return null
  const delimiter = Buffer.from(`--${boundary}`)
  let start = body.indexOf(delimiter)
  while (start !== -1) {
    const next = body.indexOf(delimiter, start + delimiter.length)
    if (next === -1) break
    const part = body.subarray(start + delimiter.length, next)
    const headerEnd = part.indexOf('\r\n\r\n')
    const headers = part.subarray(0, headerEnd).toString()
    const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]
    if (type && /filename=/i.test(headers)) return { type, bytes: part.subarray(headerEnd + 4, part.length - 2) }
    start = next
  }
  return null
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
  db: Db
  newsletter: string[]
  contactMessages: { name: string; email: string; message: string }[]
  /** Cuerpos recibidos en rpc/create_order (para verificar que el front no manda precios) */
  createOrderCalls: unknown[]
  orders: OrderRow[]
  /** Archivos del bucket product-images (path → contenido) */
  storage: Map<string, { type: string; bytes: Buffer }>
  /** Si es false, signup devuelve sesión directamente (proyecto sin confirmación de email) */
  confirmEmail: boolean
  addUser: (user: { email: string; password: string; fullName: string; admin?: boolean }) => void
  addSubscriber: (email: string) => void
  /** Pedido creado como lo haría create_order (con dirección), para tests del panel */
  seedOrder: (email: string, lines: { sku: string; quantity: number }[]) => OrderRow
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
  const newsletterDates: string[] = []
  const contactDates: string[] = []
  let offline = false
  let seq = 10_000

  const findSku = (sku: string) => {
    const found = db.variants.find((v) => v.sku === sku)
    if (!found) throw new Error(`SKU inexistente en el mock: ${sku}`)
    return found
  }

  // --- Embeds del catálogo (lo que devuelve PostgREST con los select del front) ---
  const categoryOf = (p: ProductRow) => db.categories.find((c) => c.id === p.category_id)!
  function productJson(p: ProductRow) {
    const category = categoryOf(p)
    const colors = db.colors.filter((c) => c.product_id === p.id)
    return {
      ...p,
      search_text: normalize([p.name, p.description, p.material, category.slug, category.name, ...colors.map((c) => c.name)].join(' ')),
      category: { id: category.id, slug: category.slug, name: category.name },
      colors,
      images: db.images.filter((i) => i.product_id === p.id),
      variants: db.variants.filter((v) => v.product_id === p.id),
    }
  }
  type ProductJson = ReturnType<typeof productJson>

  /** Embed `match:variants!inner(...)`: alguna variante cumple todos los filtros match.* a la vez. */
  function variantMatch(product: ProductJson, filters: [string, string][]): boolean {
    return product.variants.some((v) => {
      const color = product.colors.find((c) => c.id === v.color_id)
      const row = { ...v, color: { slug: color?.slug } }
      return filters.every(([key, f]) => matches(get(row, key.slice('match.'.length)), f))
    })
  }

  // --- Pedidos ---
  function insertOrder(user: MockUser, lines: { variant: VariantRow; quantity: number }[], address: AddressRow): OrderRow {
    const orderItems = lines.map(({ variant, quantity }) => {
      const product = db.products.find((p) => p.id === variant.product_id)!
      return {
        id: ++seq,
        variant_id: variant.id,
        sku: variant.sku,
        product_name: product.name,
        color_name: db.colors.find((c) => c.id === variant.color_id)!.name,
        size: variant.size,
        unit_price_cents: product.price_cents,
        quantity,
        line_total_cents: product.price_cents * quantity,
      }
    })
    const subtotal = orderItems.reduce((sum, i) => sum + i.line_total_cents, 0)
    const shipping = subtotal >= RULES.freeFrom ? 0 : RULES.shipping
    const profile = profiles.get(user.id)
    const order: OrderRow = {
      id: randomUUID(),
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
    }
    mock.orders.push(order)
    for (const { variant, quantity } of lines) variant.stock -= quantity
    return order
  }

  /** Igual que el trigger orders_status_change: valida la transición y devuelve stock al cancelar */
  function changeStatus(order: OrderRow, status: string): string | null {
    if (order.status === status) return null
    const ok =
      (order.status === 'pendiente_pago' && ['pagado', 'cancelado'].includes(status)) ||
      (order.status === 'pagado' && ['enviado', 'cancelado'].includes(status))
    if (!ok) return `No se puede pasar un pedido de ${order.status} a ${status}.`
    if (status === 'cancelado') {
      for (const item of order.items) {
        const v = db.variants.find((x) => x.id === item.variant_id)
        if (v) v.stock += item.quantity as number
      }
    }
    order.status = status
    return null
  }

  const orderJson = (o: OrderRow) => ({ ...o, number: o.id.slice(0, 8).toUpperCase() })

  const mock: SupabaseMock = {
    db,
    newsletter: [],
    contactMessages: [],
    createOrderCalls: [],
    orders: [],
    storage: new Map(),
    confirmEmail: true,
    addUser: ({ email, password, fullName, admin = false }) => {
      const user = { id: randomUUID(), email, password, fullName, confirmed: true, admin }
      users.set(email, user)
      profiles.set(user.id, { full_name: fullName, phone: null })
    },
    addSubscriber: (email) => {
      mock.newsletter.push(email)
      newsletterDates.push(new Date().toISOString())
    },
    seedOrder: (email, lines) => {
      const user = users.get(email)!
      const address: AddressRow = {
        id: randomUUID(),
        user_id: user.id,
        street: 'Av. Siempre Viva',
        number: '742',
        apartment: null,
        city: 'Rosario',
        province: 'Santa Fe',
        postal_code: '2000',
        is_default: true,
        created_at: new Date().toISOString(),
      }
      addresses.push(address)
      return insertOrder(user, lines.map((l) => ({ variant: findSku(l.sku), quantity: l.quantity })), address)
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

  // --- Respuestas ---
  const json = (route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) =>
    route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const pgError = (route: Route, status: number, code: string, message: string, details: string | null = null) =>
    json(route, { code, message, details, hint: null }, status)
  const noContent = (route: Route, status = 204) => route.fulfill({ status, headers: CORS })
  const prefer = (request: Request) => request.headers()['prefer'] ?? ''

  /** Orden, offset / limit y Content-Range (count=exact), como PostgREST */
  function list(route: Route, request: Request, rows: unknown[], params: URLSearchParams) {
    const sorted = sortRows(rows, params)
    const offset = Number(params.get('offset') ?? 0)
    const limit = params.has('limit') ? Number(params.get('limit')) : sorted.length
    const page = sorted.slice(offset, offset + limit)
    const headers: Record<string, string> = {}
    if (prefer(request).includes('count=exact')) {
      headers['content-range'] = page.length ? `${offset}-${offset + page.length - 1}/${sorted.length}` : `*/${sorted.length}`
    }
    if (request.headers()['accept']?.includes('vnd.pgrst.object')) return json(route, page[0] ?? null, 200, headers)
    return json(route, page, 200, headers)
  }

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
          user = {
            id: randomUUID(),
            email,
            password: String(body.password),
            fullName: data.full_name ?? '',
            confirmed: !mock.confirmEmail,
            admin: false,
          }
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
        return noContent(route)
      case 'POST recover': {
        const email = String(body.email).toLowerCase()
        if (users.has(email)) sentEmails.push({ email, redirectTo: url.searchParams.get('redirect_to') ?? '' })
        return json(route, {})
      }
      default:
        return json(route, { code: 404, error_code: 'not_found', msg: `Mock sin ${request.method()} ${path}` }, 404)
    }
  }

  // --- Storage ---
  async function handleStorage(route: Route, request: Request, path: string) {
    const method = request.method()
    const publicPrefix = `object/public/${BUCKET}/`
    if (method === 'GET' && path.startsWith(publicPrefix)) {
      const file = mock.storage.get(decodeURIComponent(path.slice(publicPrefix.length)))
      if (!file) return json(route, { statusCode: '404', error: 'not_found', message: 'Object not found' }, 400)
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': file.type }, body: file.bytes })
    }
    const user = currentUser(request)
    const denied = () => json(route, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }, 400)
    if (method === 'POST' && path.startsWith(`object/${BUCKET}/`)) {
      if (!user?.admin) return denied()
      const objectPath = decodeURIComponent(path.slice(`object/${BUCKET}/`.length))
      const file = fileFromMultipart(request.postDataBuffer() ?? Buffer.alloc(0), request.headers()['content-type'] ?? '')
      if (!file) return json(route, { statusCode: '400', error: 'invalid', message: 'No file' }, 400)
      if (!['image/jpeg', 'image/webp', 'image/png'].includes(file.type)) {
        return json(route, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${file.type} is not supported` }, 400)
      }
      if (file.bytes.length > 5 * 1024 * 1024) return json(route, { statusCode: '413', error: 'Payload too large', message: 'too large' }, 400)
      mock.storage.set(objectPath, file)
      return json(route, { Key: `${BUCKET}/${objectPath}`, Id: randomUUID() })
    }
    if (method === 'DELETE' && path === `object/${BUCKET}`) {
      if (!user?.admin) return denied()
      const { prefixes } = request.postDataJSON() as { prefixes: string[] }
      const removed = prefixes.filter((p) => mock.storage.delete(p))
      return json(route, removed.map((name) => ({ name, bucket_id: BUCKET })))
    }
    return json(route, { statusCode: '404', error: 'not_found', message: `Mock sin ${method} ${path}` }, 400)
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
      .map((i) => ({ variant: db.variants.find((v) => v.id === i.variant_id), quantity: i.quantity as number, id: i.variant_id as number }))
      .sort((a, b) => a.id - b.id)
    const missing = lines.filter((l) => !l.variant).map((l) => l.id)
    if (missing.length) return pgError(route, 400, 'UM002', 'Algunos productos ya no existen.', JSON.stringify(missing))

    const problems = lines
      .map(({ variant, quantity }) => ({ variant: variant!, quantity, product: db.products.find((p) => p.id === variant!.product_id)! }))
      .filter(({ variant, quantity, product }) => !product.is_active || variant.stock < quantity)
      .map(({ variant, quantity, product }) => ({
        sku: variant.sku,
        product_name: product.name,
        color_name: db.colors.find((c) => c.id === variant.color_id)!.name,
        size: variant.size,
        requested: quantity,
        available: product.is_active ? variant.stock : 0,
      }))
    if (problems.length) return pgError(route, 400, 'UM001', 'No hay stock suficiente.', JSON.stringify(problems))

    const order = insertOrder(user, lines.map((l) => ({ variant: l.variant!, quantity: l.quantity })), address)
    return json(route, order.id)
  }

  function rpc(route: Route, user: MockUser | undefined, name: string, body: Row) {
    switch (name) {
      case 'create_order':
        return createOrder(route, user, body)
      case 'cancel_order': {
        if (!user) return pgError(route, 401, '28000', 'Tenés que ingresar a tu cuenta.')
        const order = mock.orders.find((o) => o.id === body.order_id && o.user_id === user.id)
        if (!order) return pgError(route, 400, 'UM005', 'No encontramos ese pedido.')
        if (order.status !== 'pendiente_pago') return pgError(route, 400, 'UM006', 'Este pedido ya no se puede cancelar.')
        changeStatus(order, 'cancelado')
        return noContent(route)
      }
      case 'admin_set_order_status': {
        if (!user?.admin) return pgError(route, 403, '42501', 'Solo para administradores.')
        const order = mock.orders.find((o) => o.id === body.order_id)
        if (!order) return pgError(route, 400, 'UM005', 'No encontramos ese pedido.')
        const error = changeStatus(order, String(body.status))
        return error ? pgError(route, 400, 'UM007', error) : noContent(route)
      }
      case 'admin_dashboard': {
        if (!user?.admin) return pgError(route, 403, '42501', 'Solo para administradores.')
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
        const sold = mock.orders.filter((o) => ['pagado', 'enviado'].includes(o.status) && Date.parse(o.created_at) >= monthStart)
        const top = new Map<string, { name: string; slug: string | null; units: number; revenue_cents: number }>()
        for (const item of sold.flatMap((o) => o.items)) {
          const product = db.products.find((p) => p.id === db.variants.find((v) => v.id === item.variant_id)?.product_id)
          const name = product?.name ?? String(item.product_name)
          const entry = top.get(name) ?? { name, slug: product?.slug ?? null, units: 0, revenue_cents: 0 }
          entry.units += item.quantity as number
          entry.revenue_cents += item.line_total_cents as number
          top.set(name, entry)
        }
        const lowStock = db.variants
          .filter((v) => v.stock <= 2)
          .map((v) => {
            const product = db.products.find((p) => p.id === v.product_id)!
            return {
              sku: v.sku,
              size: v.size,
              stock: v.stock,
              product_id: product.id,
              product_name: product.name,
              is_active: product.is_active,
              color_name: db.colors.find((c) => c.id === v.color_id)!.name,
            }
          })
          .sort((a, b) => a.stock - b.stock || a.product_name.localeCompare(b.product_name) || a.sku.localeCompare(b.sku))
          .slice(0, 50)
        return json(route, {
          month_sales_cents: sold.reduce((sum, o) => sum + o.total_cents, 0),
          month_orders: sold.length,
          pending_orders: mock.orders.filter((o) => o.status === 'pendiente_pago').length,
          top_products: [...top.values()].sort((a, b) => b.units - a.units).slice(0, 5),
          low_stock: lowStock,
        })
      }
      default:
        return pgError(route, 404, 'PGRST202', `Could not find the function public.${name}`)
    }
  }

  // --- Escritura del catálogo (solo admin), con unicidad y cascadas como en la base ---
  interface TableSpec {
    rows: Row[]
    create: (body: Row) => Row
    unique: string[][]
    /** ON DELETE CASCADE de las tablas hijas */
    cascade?: (ids: Set<unknown>) => void
  }
  const now = () => new Date().toISOString()
  // Siempre en el lugar: db.* y tables.*.rows son el mismo array
  const removeWhere = <T,>(arr: T[], pred: (x: T) => boolean) => {
    for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i]!)) arr.splice(i, 1)
  }
  const tables: Record<string, TableSpec> = {
    products: {
      rows: db.products as unknown as Row[],
      create: (b) => ({
        id: randomUUID(),
        description: '',
        details: [],
        care: [],
        material: '',
        compare_at_cents: null,
        is_new: false,
        is_active: true,
        popularity: 0,
        created_at: now(),
        updated_at: now(),
        ...b,
      }),
      unique: [['slug']],
      cascade: (ids) => {
        removeWhere(db.images, (i) => ids.has(i.product_id))
        removeWhere(db.variants, (v) => ids.has(v.product_id))
        removeWhere(db.colors, (c) => ids.has(c.product_id))
      },
    },
    product_colors: {
      rows: db.colors as unknown as Row[],
      create: (b) => ({ id: ++seq, sort_order: 0, ...b }),
      unique: [['product_id', 'slug']],
      cascade: (ids) => {
        removeWhere(db.images, (i) => ids.has(i.color_id))
        removeWhere(db.variants, (v) => ids.has(v.color_id))
      },
    },
    product_images: {
      rows: db.images as unknown as Row[],
      create: (b) => ({ id: ++seq, color_id: null, sort_order: 0, source: 'static', ...b }),
      unique: [['product_id', 'path']],
    },
    variants: {
      rows: db.variants as unknown as Row[],
      create: (b) => ({ id: ++seq, stock: 0, updated_at: now(), ...b }),
      unique: [['sku'], ['product_id', 'color_id', 'size']],
    },
  }

  function writeCatalog(route: Route, request: Request, name: string, params: URLSearchParams, user: MockUser | undefined) {
    if (!user?.admin) return pgError(route, 403, '42501', `new row violates row-level security policy for table "${name}"`)
    const spec = tables[name]!
    const method = request.method()
    const representation = prefer(request).includes('return=representation')
    const conflict = (candidate: Row, ignore?: Row) =>
      spec.unique.some((cols) => spec.rows.some((r) => r !== ignore && cols.every((c) => r[c] === candidate[c])))

    if (method === 'POST') {
      const raw = request.postDataJSON() as Row | Row[]
      const bodies = Array.isArray(raw) ? raw : [raw]
      const upsertOn = prefer(request).includes('merge-duplicates') ? params.get('on_conflict')?.split(',') : undefined
      const result: Row[] = []
      for (const body of bodies) {
        const existing = upsertOn && spec.rows.find((r) => upsertOn.every((c) => r[c] === body[c]))
        if (existing) {
          Object.assign(existing, body, 'updated_at' in existing ? { updated_at: now() } : {})
          result.push(existing)
          continue
        }
        const row = spec.create(body)
        if (conflict(row)) return pgError(route, 409, '23505', `duplicate key value violates unique constraint on ${name}`)
        spec.rows.push(row)
        result.push(row)
      }
      return representation ? json(route, result, 201) : noContent(route, 201)
    }

    const targets = filterRows(spec.rows, params)
    if (method === 'PATCH') {
      const body = request.postDataJSON() as Row
      for (const row of targets) {
        if (conflict({ ...row, ...body }, row)) return pgError(route, 409, '23505', `duplicate key value violates unique constraint on ${name}`)
      }
      for (const row of targets) Object.assign(row, body, 'updated_at' in row ? { updated_at: now() } : {})
      return representation ? json(route, targets) : noContent(route)
    }
    if (method === 'DELETE') {
      spec.cascade?.(new Set(targets.map((t) => t.id)))
      removeWhere(spec.rows, (r) => targets.includes(r))
      return representation ? json(route, targets) : noContent(route)
    }
    return pgError(route, 405, 'PGRST000', 'Método no soportado por el mock')
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
        return noContent(route)
      }
      return list(route, request, [profile], params)
    }

    if (table === 'addresses') {
      const own = addresses.filter((a) => a.user_id === user.id)
      const unsetOthers = (keep: string) => own.forEach((a) => a.id !== keep && (a.is_default = false))
      if (method === 'GET') return list(route, request, filterRows(own, params), params)
      if (method === 'POST') {
        const created: AddressRow = {
          ...(body as unknown as AddressRow),
          id: randomUUID(),
          user_id: user.id,
          created_at: new Date().toISOString(),
        }
        if (created.is_default) unsetOthers(created.id)
        addresses.push(created)
        return list(route, request, [created], params)
      }
      const targets = filterRows(own, params)
      if (method === 'PATCH') {
        for (const a of targets) {
          Object.assign(a, body)
          if (a.is_default) unsetOthers(a.id)
        }
        return noContent(route)
      }
      if (method === 'DELETE') {
        for (const a of targets) addresses.splice(addresses.indexOf(a), 1)
        return noContent(route)
      }
    }

    if (table === 'orders' && method === 'GET') {
      const visible = mock.orders.filter((o) => user.admin || o.user_id === user.id).map(orderJson)
      return list(route, request, filterRows(visible, params), params)
    }

    if ((table === 'contact_messages' || table === 'newsletter_subscribers') && method === 'GET') {
      // Sin política de SELECT para clientes: PostgREST devuelve [] (RLS filtra), no un error
      if (!user.admin) return list(route, request, [], params)
      const rows =
        table === 'contact_messages'
          ? mock.contactMessages.map((m, i) => ({ id: i + 1, ...m, created_at: contactDates[i] }))
          : mock.newsletter.map((email, i) => ({ id: i + 1, email, created_at: newsletterDates[i] }))
      return list(route, request, filterRows(rows, params), params)
    }
    return pgError(route, 401, '42501', `permission denied for table ${table}`)
  }

  await page.route(
    (url) => ['/rest/v1/', '/auth/v1/', '/storage/v1/'].some((p) => url.pathname.includes(p)),
    async (route) => {
      const request = route.request()
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
      if (offline) return route.abort('internetdisconnected')

      const url = new URL(request.url())
      if (url.pathname.includes('/auth/v1/')) return handleAuth(route, request, url.pathname.split('/auth/v1/')[1]!, url)
      if (url.pathname.includes('/storage/v1/')) return handleStorage(route, request, url.pathname.split('/storage/v1/')[1]!)

      const path = url.pathname.split('/rest/v1/')[1]!
      const params = url.searchParams
      const user = currentUser(request)
      const method = request.method()

      if (path.startsWith('rpc/')) return rpc(route, user, path.slice(4), (request.postDataJSON() ?? {}) as Row)

      if (['profiles', 'addresses', 'orders'].includes(path)) return handleAccountTable(route, request, path, params, user)
      if (['contact_messages', 'newsletter_subscribers'].includes(path) && method === 'GET') {
        return handleAccountTable(route, request, path, params, user)
      }

      if (method === 'POST' && path === 'newsletter_subscribers') {
        const email = String((request.postDataJSON() as Row).email)
        if (mock.newsletter.includes(email)) {
          return pgError(route, 409, '23505', 'duplicate key value violates unique constraint "newsletter_subscribers_email_key"')
        }
        mock.newsletter.push(email)
        newsletterDates.push(new Date().toISOString())
        return noContent(route, 201)
      }
      if (method === 'POST' && path === 'contact_messages') {
        mock.contactMessages.push(request.postDataJSON() as SupabaseMock['contactMessages'][number])
        contactDates.push(new Date().toISOString())
        return noContent(route, 201)
      }

      if (method !== 'GET') {
        if (path in tables) return writeCatalog(route, request, path, params, user)
        return pgError(route, 401, '42501', `permission denied for table ${path}`)
      }

      // RLS de lectura: el admin ve también lo inactivo
      const isAdmin = Boolean(user?.admin)
      const visibleProducts = db.products.filter((p) => isAdmin || p.is_active)
      const visibleIds = new Set(visibleProducts.map((p) => p.id))
      switch (path) {
        case 'categories':
          return list(route, request, filterRows(db.categories, params), params)
        case 'products':
          return list(route, request, filterRows(visibleProducts.map(productJson), params, variantMatch), params)
        case 'product_colors': {
          const rows = db.colors
            .filter((c) => visibleIds.has(c.product_id))
            .map((c) => ({ ...c, product: { is_active: db.products.find((p) => p.id === c.product_id)!.is_active } }))
          return list(route, request, filterRows(rows, params), params)
        }
        case 'variants': {
          const rows = db.variants
            .filter((v) => visibleIds.has(v.product_id))
            .map((v) => ({ ...v, product: productJson(db.products.find((p) => p.id === v.product_id)!) }))
          return list(route, request, filterRows(rows, params), params)
        }
        default:
          return pgError(route, 404, '42P01', `relation "public.${path}" does not exist`)
      }
    },
  )

  return mock
}
