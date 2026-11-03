import type { Product, ProductImage } from '../types'

/**
 * Fotos para un color: primero las de ese color; si no tiene, las que sirven para todos
 * (sin colorId). Si el producto no tiene ninguna, un placeholder en SVG con la silueta.
 */
export function imagesForColor(product: Product, colorId: string): ProductImage[] {
  const own = product.images.filter((img) => img.colorId === colorId)
  if (own.length) return own
  const shared = product.images.filter((img) => !img.colorId)
  if (shared.length) return shared
  return [{ file: `${product.slug}-placeholder`, alt: product.name, view: 'frente', ready: false }]
}
