/**
 * Mock de la Data API de Supabase (PostgREST) con page.route: los tests no dependen de la red
 * ni de la base real. Los datos salen de scripts/catalog-rows.ts, igual que supabase/seed.sql.
 *
 * Implementa solo lo que usa src/services: GET de las tablas del catálogo con los filtros
 * eq / neq / gt / gte / lte / in / ilike, el embed `match` (filtro por talle/color con stock),
 * order y limit; y POST a newsletter_subscribers / contact_messages.
 */
import type { Page, Route } from '@playwright/test'
import { buildCatalogRows } from '../scripts/catalog-rows'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-expose-headers': '*',
}

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
          .map((v) => ({ color_id: colorId(v.product_slug, v.color_slug)!, size: v.size, sku: v.sku, stock: v.stock })),
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
        const x = get(a, col) as string | number
        const y = get(b, col) as string | number
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

export interface SupabaseMock {
  newsletter: string[]
  contactMessages: { name: string; email: string; message: string }[]
  /**
   * Simula una caída de red hacia Supabase hasta que se vuelva a llamar con false.
   * supabase-js reintenta los GET 3 veces (1 s, 2 s, 4 s) antes de devolver el error.
   */
  setOffline: (offline: boolean) => void
}

export async function mockSupabase(page: Page): Promise<SupabaseMock> {
  const db = buildDb()
  let offline = false
  const mock: SupabaseMock = {
    newsletter: [],
    contactMessages: [],
    setOffline: (value) => {
      offline = value
    },
  }

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })

  await page.route(
    (url) => url.pathname.includes('/rest/v1/'),
    async (route) => {
      const request = route.request()
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
      if (offline) return route.abort('internetdisconnected')

      const url = new URL(request.url())
      const table = url.pathname.split('/rest/v1/')[1]
      const params = url.searchParams

      if (request.method() === 'POST') {
        const body = request.postDataJSON() as Row
        if (table === 'newsletter_subscribers') {
          const email = String(body.email)
          if (mock.newsletter.includes(email)) {
            return json(
              route,
              {
                code: '23505',
                message: 'duplicate key value violates unique constraint "newsletter_subscribers_email_key"',
                details: null,
                hint: null,
              },
              409,
            )
          }
          mock.newsletter.push(email)
          return route.fulfill({ status: 201, headers: CORS })
        }
        if (table === 'contact_messages') {
          mock.contactMessages.push(body as SupabaseMock['contactMessages'][number])
          return route.fulfill({ status: 201, headers: CORS })
        }
        return json(route, { code: '42501', message: `permission denied for table ${table}` }, 401)
      }

      switch (table) {
        case 'categories':
          return json(route, orderAndLimit(filterRows(db.categories, params), params))
        case 'products':
          return json(route, orderAndLimit(filterRows(db.products, params, variantMatch), params))
        case 'product_colors':
          return json(route, orderAndLimit(filterRows(db.colors, params), params))
        case 'variants': {
          const rows = db.products.flatMap((product) => product.variants.map((v) => ({ ...v, product })))
          const filtered = orderAndLimit(filterRows(rows, params), params)
          return json(
            route,
            params.has('sku') ? filtered.map((v) => ({ sku: v.sku, product: v.product })) : filtered.map((v) => ({ size: v.size })),
          )
        }
        default:
          return json(route, { code: '42P01', message: `relation "public.${table}" does not exist` }, 404)
      }
    },
  )

  return mock
}
