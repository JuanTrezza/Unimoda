/**
 * Capa de acceso al catálogo.
 *
 * Los componentes solo hablan con estas funciones async. Hoy leen el archivo
 * local src/data/products.ts; en la etapa 2 se reemplaza la implementación
 * por consultas a Supabase sin tocar a quien las llama.
 */
import { CATEGORIES, PRODUCTS } from '../data/products'
import type {
  Category,
  CategoryId,
  Color,
  FilterOptions,
  Product,
  ProductQuery,
  ResolvedVariant,
  Size,
} from '../types'

const SIZE_ORDER: Size[] = ['XS', 'S', 'M', 'L', 'XL']

/** Simula la latencia de red para que los estados de carga se vean igual que en producción. */
function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export async function getCategories(): Promise<Category[]> {
  return delay(CATEGORIES)
}

export async function getCategory(id: CategoryId): Promise<Category | undefined> {
  return delay(CATEGORIES.find((c) => c.id === id))
}

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const { category, sizes, colors, minPrice, maxPrice, search, sort = 'relevancia' } = query
  const terms = search ? normalize(search).split(/\s+/).filter(Boolean) : []

  const result = PRODUCTS.filter((p) => {
    if (category && p.category !== category) return false
    if (minPrice !== undefined && p.price < minPrice) return false
    if (maxPrice !== undefined && p.price > maxPrice) return false
    // Talle y color filtran por variantes con stock
    if (sizes?.length || colors?.length) {
      const match = p.variants.some(
        (v) =>
          v.stock > 0 &&
          (!sizes?.length || sizes.includes(v.size)) &&
          (!colors?.length || colors.includes(v.colorId)),
      )
      if (!match) return false
    }
    if (terms.length) {
      const haystack = normalize(
        [p.name, p.description, p.material, p.category, ...p.colors.map((c) => c.name)].join(' '),
      )
      if (!terms.every((t) => haystack.includes(t))) return false
    }
    return true
  })

  const sorted = [...result]
  switch (sort) {
    case 'precio-asc':
      sorted.sort((a, b) => a.price - b.price)
      break
    case 'precio-desc':
      sorted.sort((a, b) => b.price - a.price)
      break
    case 'novedades':
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      break
    default:
      sorted.sort((a, b) => b.popularity - a.popularity)
  }
  return delay(sorted)
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  const products = await getProducts({ sort: 'novedades' })
  return products.filter((p) => p.isNew).slice(0, limit)
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  return delay(PRODUCTS.find((p) => p.slug === slug))
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const set = new Set(ids)
  return delay(PRODUCTS.filter((p) => set.has(p.id)))
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const sameCategory = PRODUCTS.filter((p) => p.id !== product.id && p.category === product.category)
  const others = PRODUCTS.filter((p) => p.id !== product.id && p.category !== product.category).sort(
    (a, b) => b.popularity - a.popularity,
  )
  return delay([...sameCategory, ...others].slice(0, limit))
}

/** Resuelve ids de variante a producto + variante + color. Ignora los ids que ya no existen. */
export async function getVariantsByIds(variantIds: string[]): Promise<ResolvedVariant[]> {
  const resolved: ResolvedVariant[] = []
  for (const id of variantIds) {
    for (const product of PRODUCTS) {
      const variant = product.variants.find((v) => v.id === id)
      if (variant) {
        const color = product.colors.find((c) => c.id === variant.colorId)
        if (color) resolved.push({ product, variant, color })
        break
      }
    }
  }
  return delay(resolved, 60)
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const sizeSet = new Set<Size>()
  const colorMap = new Map<string, Color>()
  let min = Infinity
  let max = 0
  for (const p of PRODUCTS) {
    p.sizes.forEach((s) => sizeSet.add(s))
    p.colors.forEach((c) => colorMap.set(c.id, c))
    min = Math.min(min, p.price)
    max = Math.max(max, p.price)
  }
  return delay({
    categories: CATEGORIES,
    sizes: SIZE_ORDER.filter((s) => sizeSet.has(s)),
    colors: [...colorMap.values()],
    priceRange: { min, max },
  })
}
