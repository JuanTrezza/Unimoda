export type CategoryId = 'vestidos' | 'blusas' | 'pantalones' | 'faldas' | 'abrigos' | 'tejidos'

export interface Category {
  id: CategoryId
  name: string
  description: string
}

export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL'

export interface Color {
  id: string
  name: string
  hex: string
}

export interface Variant {
  /** SKU único: lo único que guarda el carrito junto con la cantidad. */
  id: string
  productId: string
  size: Size
  colorId: string
  stock: number
}

/** Silueta usada por el placeholder mientras no haya foto real. */
export type Silhouette = 'vestido' | 'blusa' | 'pantalon' | 'falda' | 'abrigo' | 'tejido'

export type ImageView = 'frente' | 'espalda' | 'detalle'

export interface ProductImage {
  /** Nombre de archivo esperado en public/images/products/ */
  file: string
  alt: string
  view: ImageView
  /** Pasar a true cuando la foto esté en public/images/products/ */
  ready: boolean
}

export interface Product {
  id: string
  slug: string
  name: string
  category: CategoryId
  /** Precio en pesos argentinos, sin decimales */
  price: number
  compareAtPrice?: number
  description: string
  details: string[]
  material: string
  care: string
  colors: Color[]
  sizes: Size[]
  variants: Variant[]
  images: ProductImage[]
  silhouette: Silhouette
  isNew: boolean
  /** ISO date, se usa para ordenar por novedades */
  createdAt: string
  /** 0–100, se usa para ordenar por relevancia */
  popularity: number
}

export type SortOption = 'relevancia' | 'precio-asc' | 'precio-desc' | 'novedades'

export interface ProductQuery {
  category?: CategoryId
  sizes?: Size[]
  colors?: string[]
  minPrice?: number
  maxPrice?: number
  search?: string
  sort?: SortOption
}

export interface FilterOptions {
  categories: Category[]
  sizes: Size[]
  colors: Color[]
  priceRange: { min: number; max: number }
}

export interface ResolvedVariant {
  product: Product
  variant: Variant
  color: Color
}
