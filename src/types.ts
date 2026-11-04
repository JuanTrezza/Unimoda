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
  /** variants.id en la base: lo que se manda a create_order */
  dbId?: number
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
  /** Color al que corresponde la foto; sin definir = sirve para todos los colores */
  colorId?: string
  /** URL completa (foto estática o de Storage). Sin definir: images/products/{file} */
  url?: string
  /** srcset con la versión de 640 px (solo fotos estáticas, ver scripts/generate-images.ts) */
  srcSet?: string
  /** Medidas reales del archivo (por defecto 1024×1280) */
  width?: number
  height?: number
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

export interface Profile {
  fullName: string
  phone: string | null
  email: string
}

export interface AddressInput {
  street: string
  number: string
  apartment: string | null
  city: string
  province: string
  postalCode: string
  isDefault: boolean
}

export interface Address extends AddressInput {
  id: string
}

export type OrderStatus = 'pendiente_pago' | 'pagado' | 'enviado' | 'cancelado'

/** Copia de la dirección guardada en el pedido */
export interface OrderAddress {
  recipient: string
  phone: string | null
  street: string
  number: string
  apartment: string | null
  city: string
  province: string
  postalCode: string
}

export interface OrderItem {
  id: number
  variantId: number | null
  sku: string
  productName: string
  colorName: string
  size: string
  /** En pesos, copiado al momento de la compra */
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface Order {
  id: string
  status: OrderStatus
  subtotal: number
  shipping: number
  total: number
  address: OrderAddress
  createdAt: string
  items: OrderItem[]
}
