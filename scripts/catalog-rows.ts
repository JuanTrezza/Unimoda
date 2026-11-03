/**
 * Convierte src/data/products.ts en filas con la forma de las tablas de Supabase.
 * Lo usan scripts/generate-seed.ts (para escribir supabase/seed.sql) y los mocks de
 * Playwright (tests/supabase-mock.ts), así el seed y los tests parten de los mismos datos.
 */
import { createHash } from 'node:crypto'
import { CATEGORIES, PRODUCTS } from '../src/data/products'
import type { ImageView, Size } from '../src/types'

export const IMAGE_WIDTH = 1024
export const IMAGE_HEIGHT = 1280

export interface CategoryRow {
  slug: string
  name: string
  description: string
  sort_order: number
}

export interface ProductRow {
  id: string
  slug: string
  name: string
  description: string
  details: string[]
  care: string[]
  material: string
  category_slug: string
  price_cents: number
  compare_at_cents: number | null
  is_new: boolean
  is_active: boolean
  popularity: number
  created_at: string
}

export interface ColorRow {
  product_slug: string
  slug: string
  name: string
  hex: string
  sort_order: number
}

export interface ImageRow {
  product_slug: string
  /** null = sirve para todos los colores */
  color_slug: string | null
  view: ImageView
  path: string
  width: number
  height: number
  alt: string
  sort_order: number
}

export interface VariantRow {
  product_slug: string
  color_slug: string
  size: Size
  sku: string
  stock: number
}

/** UUID estable a partir del slug: el mismo en el seed, en los tests y entre re-seeds. */
export function productUuid(slug: string): string {
  const h = createHash('md5').update(`unimoda:${slug}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** "Lavar a mano. No usar secarropas." → ["Lavar a mano.", "No usar secarropas."] */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function buildCatalogRows() {
  const categories: CategoryRow[] = CATEGORIES.map((c, i) => ({
    slug: c.id,
    name: c.name,
    description: c.description,
    sort_order: (i + 1) * 10,
  }))

  const products: ProductRow[] = PRODUCTS.map((p) => ({
    id: productUuid(p.slug),
    slug: p.slug,
    name: p.name,
    description: p.description,
    details: p.details,
    care: splitSentences(p.care),
    material: p.material,
    category_slug: p.category,
    price_cents: p.price * 100,
    compare_at_cents: p.compareAtPrice ? p.compareAtPrice * 100 : null,
    is_new: p.isNew,
    is_active: true,
    popularity: p.popularity,
    created_at: p.createdAt,
  }))

  const colors: ColorRow[] = PRODUCTS.flatMap((p) =>
    p.colors.map((c, i) => ({ product_slug: p.slug, slug: c.id, name: c.name, hex: c.hex, sort_order: i })),
  )

  // Una foto por producto (frente), compartida por todos los colores
  const images: ImageRow[] = PRODUCTS.map((p) => ({
    product_slug: p.slug,
    color_slug: null,
    view: 'frente',
    path: `images/products/${p.slug}-1.jpg`,
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    alt: `${p.name}, vista de frente`,
    sort_order: 0,
  }))

  const variants: VariantRow[] = PRODUCTS.flatMap((p) =>
    p.variants.map((v) => ({ product_slug: p.slug, color_slug: v.colorId, size: v.size, sku: v.id, stock: v.stock })),
  )

  return { categories, products, colors, images, variants }
}

export type CatalogRows = ReturnType<typeof buildCatalogRows>
