/**
 * Capa de acceso al catálogo.
 *
 * Los componentes solo hablan con estas funciones async. Leen de Supabase (Data API);
 * filtros, orden y búsqueda se resuelven en la consulta. RLS ya oculta los productos
 * inactivos, así que acá no se filtra por is_active.
 */
import { supabase } from '../lib/supabase'
import type {
  Category,
  CategoryId,
  Color,
  FilterOptions,
  ImageView,
  Product,
  ProductImage,
  ProductQuery,
  ResolvedVariant,
  Silhouette,
  Size,
  Variant,
} from '../types'

const SIZE_ORDER: Size[] = ['XS', 'S', 'M', 'L', 'XL']
const IMAGE_DIR = 'images/products/'

// La silueta del placeholder depende solo de la categoría
const SILHOUETTE_BY_CATEGORY: Record<CategoryId, Silhouette> = {
  vestidos: 'vestido',
  blusas: 'blusa',
  pantalones: 'pantalon',
  faldas: 'falda',
  abrigos: 'abrigo',
  tejidos: 'tejido',
}

/**
 * Producto con todo lo que necesita la UI. `category` es !inner para poder filtrar por
 * category.slug; colors lleva hint porque product_colors también se alcanza vía variants.
 */
const PRODUCT_SELECT = `
  id, slug, name, description, details, care, material, price_cents, compare_at_cents,
  is_new, popularity, created_at,
  category:categories!inner(slug),
  colors:product_colors!product_colors_product_id_fkey(id, slug, name, hex, sort_order),
  images:product_images(color_id, view, path, width, height, alt, sort_order),
  variants(color_id, size, sku, stock)
`

interface ProductRow {
  id: string
  slug: string
  name: string
  description: string
  details: string[]
  care: string[]
  material: string
  price_cents: number
  compare_at_cents: number | null
  is_new: boolean
  popularity: number
  created_at: string
  category: { slug: CategoryId }
  colors: { id: number; slug: string; name: string; hex: string; sort_order: number }[]
  images: {
    color_id: number | null
    view: ImageView
    path: string
    width: number
    height: number
    alt: string
    sort_order: number
  }[]
  variants: { color_id: number; size: Size; sku: string; stock: number }[]
}

interface CategoryRow {
  slug: CategoryId
  name: string
  description: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SKU_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Error de Supabase → Error de JS, para que useAsync lo muestre como estado de error. */
function check<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

/** Igual que private.normalize_search en la base: minúsculas y sin tildes. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const fromCents = (cents: number) => Math.round(cents / 100)
const toCents = (pesos: number) => Math.round(pesos * 100)

function toProduct(row: ProductRow): Product {
  const colorRows = [...row.colors].sort((a, b) => a.sort_order - b.sort_order)
  const slugById = new Map(colorRows.map((c) => [c.id, c.slug]))
  const colors: Color[] = colorRows.map((c) => ({ id: c.slug, name: c.name, hex: c.hex }))

  const variants: Variant[] = row.variants.map((v) => ({
    id: v.sku,
    productId: row.id,
    size: v.size,
    colorId: slugById.get(v.color_id) ?? '',
    stock: v.stock,
  }))

  const images: ProductImage[] = [...row.images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((img) => ({
      file: img.path.startsWith(IMAGE_DIR) ? img.path.slice(IMAGE_DIR.length) : img.path,
      alt: img.alt,
      view: img.view,
      ready: true,
      colorId: img.color_id === null ? undefined : slugById.get(img.color_id),
      width: img.width,
      height: img.height,
    }))

  const compareAt = row.compare_at_cents === null ? undefined : fromCents(row.compare_at_cents)

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category.slug,
    price: fromCents(row.price_cents),
    ...(compareAt !== undefined && { compareAtPrice: compareAt }),
    description: row.description,
    details: row.details,
    material: row.material,
    care: row.care.join(' '),
    colors,
    sizes: SIZE_ORDER.filter((s) => variants.some((v) => v.size === s)),
    variants,
    images,
    silhouette: SILHOUETTE_BY_CATEGORY[row.category.slug] ?? 'vestido',
    isNew: row.is_new,
    createdAt: row.created_at,
    popularity: row.popularity,
  }
}

function products(extraSelect = '') {
  return supabase.from('products').select(PRODUCT_SELECT + extraSelect)
}

async function fetchProducts(query: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  return check<ProductRow[]>(await query).map(toProduct)
}

export async function getCategories(): Promise<Category[]> {
  const rows = check<CategoryRow[]>(
    await supabase.from('categories').select('slug, name, description').order('sort_order'),
  )
  return rows.map((c) => ({ id: c.slug, name: c.name, description: c.description }))
}

export async function getCategory(id: CategoryId): Promise<Category | undefined> {
  const rows = check<CategoryRow[]>(
    await supabase.from('categories').select('slug, name, description').eq('slug', id).limit(1),
  )
  const c = rows[0]
  return c && { id: c.slug, name: c.name, description: c.description }
}

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const { category, sizes, colors, minPrice, maxPrice, search, sort = 'relevancia' } = query
  const bySize = Boolean(sizes?.length)
  const byColor = Boolean(colors?.length)

  // Talle y color filtran por variantes con stock: un embed aparte (`match`) con !inner deja
  // solo los productos que tienen al menos una variante que cumple todo a la vez.
  const match =
    bySize || byColor
      ? `, match:variants!inner(size, stock${byColor ? ', color:product_colors!inner(slug)' : ''})`
      : ''

  let q = products(match)
  if (category) q = q.eq('category.slug', category)
  if (minPrice !== undefined) q = q.gte('price_cents', toCents(minPrice))
  if (maxPrice !== undefined) q = q.lte('price_cents', toCents(maxPrice))
  if (match) q = q.gt('match.stock', 0)
  if (bySize) q = q.in('match.size', sizes!)
  if (byColor) q = q.in('match.color.slug', colors!)

  // Cada palabra tiene que aparecer en search_text (nombre, descripción, material, categoría, colores)
  const terms = search ? normalize(search).replace(/[^a-z0-9ñ]+/g, ' ').split(' ').filter(Boolean) : []
  for (const term of terms) q = q.ilike('search_text', `%${term}%`)

  switch (sort) {
    case 'precio-asc':
      q = q.order('price_cents', { ascending: true })
      break
    case 'precio-desc':
      q = q.order('price_cents', { ascending: false })
      break
    case 'novedades':
      q = q.order('created_at', { ascending: false })
      break
    default:
      q = q.order('popularity', { ascending: false })
  }
  return fetchProducts(q.order('slug'))
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  return fetchProducts(products().eq('is_new', true).order('created_at', { ascending: false }).limit(limit))
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const [product] = await fetchProducts(products().eq('slug', slug).limit(1))
  return product
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  // Favoritos guardados antes de la migración tienen ids viejos ("p01"): no son uuid y se ignoran
  const valid = ids.filter((id) => UUID_RE.test(id))
  if (!valid.length) return []
  return fetchProducts(products().in('id', valid))
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const sameCategory = await fetchProducts(
    products()
      .eq('category.slug', product.category)
      .neq('id', product.id)
      .order('popularity', { ascending: false })
      .limit(limit),
  )
  if (sameCategory.length >= limit) return sameCategory
  const others = await fetchProducts(
    products()
      .neq('category.slug', product.category)
      .order('popularity', { ascending: false })
      .limit(limit - sameCategory.length),
  )
  return [...sameCategory, ...others]
}

/** Resuelve ids de variante (SKU) a producto + variante + color. Ignora los ids que ya no existen. */
export async function getVariantsByIds(variantIds: string[]): Promise<ResolvedVariant[]> {
  const skus = [...new Set(variantIds)].filter((id) => SKU_RE.test(id))
  if (!skus.length) return []
  const rows = check<{ sku: string; product: ProductRow }[]>(
    await supabase
      .from('variants')
      .select(`sku, product:products!inner(${PRODUCT_SELECT})`)
      .in('sku', skus),
  )
  const bySku = new Map<string, ResolvedVariant>()
  for (const row of rows) {
    const product = toProduct(row.product)
    const variant = product.variants.find((v) => v.id === row.sku)
    const color = variant && product.colors.find((c) => c.id === variant.colorId)
    if (variant && color) bySku.set(row.sku, { product, variant, color })
  }
  // Mismo orden en que llegaron los ids
  return variantIds.flatMap((id) => bySku.get(id) ?? [])
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const [categories, colorRows, sizeRows, cheapest, priciest] = await Promise.all([
    getCategories(),
    supabase.from('product_colors').select('slug, name, hex').order('slug'),
    supabase.from('variants').select('size'),
    supabase.from('products').select('price_cents').order('price_cents', { ascending: true }).limit(1),
    supabase.from('products').select('price_cents').order('price_cents', { ascending: false }).limit(1),
  ])

  // product_colors tiene una fila por producto: se deduplica por slug
  const colorMap = new Map<string, Color>()
  for (const c of check<{ slug: string; name: string; hex: string }[]>(colorRows)) {
    if (!colorMap.has(c.slug)) colorMap.set(c.slug, { id: c.slug, name: c.name, hex: c.hex })
  }
  const sizeSet = new Set(check<{ size: Size }[]>(sizeRows).map((r) => r.size))
  const min = check<{ price_cents: number }[]>(cheapest)[0]?.price_cents ?? 0
  const max = check<{ price_cents: number }[]>(priciest)[0]?.price_cents ?? 0

  return {
    categories,
    sizes: SIZE_ORDER.filter((s) => sizeSet.has(s)),
    colors: [...colorMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    priceRange: { min: fromCents(min), max: fromCents(max) },
  }
}
