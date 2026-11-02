import { Link } from 'react-router-dom'
import type { Product } from '../../types'
import { ProductImage } from './ProductImage'
import { Price } from './Price'
import { WishlistButton } from './WishlistButton'

interface Props {
  product: Product
  priority?: boolean
}

export function ProductCard({ product, priority }: Props) {
  const firstColor = product.colors[0]!
  const [front, back] = product.images
  const soldOut = product.variants.every((v) => v.stock === 0)

  return (
    <article className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-crema-200">
        <Link
          to={`/producto/${product.slug}`}
          className="block h-full w-full focus-visible:outline-offset-[-3px]"
          aria-label={product.name}
          tabIndex={-1}
        >
          {front && (
            <ProductImage
              image={front}
              silhouette={product.silhouette}
              colorHex={firstColor.hex}
              priority={priority}
              className="transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
            />
          )}
          {back && (
            <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true">
              <ProductImage image={back} silhouette={product.silhouette} colorHex={firstColor.hex} />
            </div>
          )}
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          {product.isNew && <span className="badge bg-crema-50 text-tinta">Nuevo</span>}
          {product.compareAtPrice && <span className="badge bg-terracota text-white">Oferta</span>}
          {soldOut && <span className="badge bg-tinta text-crema-50">Agotado</span>}
        </div>
        <WishlistButton product={product} className="absolute right-2 top-2" />
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="text-sm leading-snug">
          <Link to={`/producto/${product.slug}`} className="hover:underline hover:underline-offset-4">
            {product.name}
          </Link>
        </h3>
        <Price price={product.price} compareAtPrice={product.compareAtPrice} />
        <ul className="flex gap-1.5 pt-1" aria-label={`Colores: ${product.colors.map((c) => c.name).join(', ')}`}>
          {product.colors.map((c) => (
            <li key={c.id} className="h-3 w-3 rounded-full ring-1 ring-tinta/15" style={{ backgroundColor: c.hex }} title={c.name} />
          ))}
        </ul>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="aspect-[4/5] animate-pulse rounded-sm bg-crema-200" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-crema-200" />
      <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-crema-200" />
    </div>
  )
}

export function ProductGrid({ products, loading, count = 8 }: { products?: Product[]; loading?: boolean; count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {loading || !products
        ? Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)
        : products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
    </div>
  )
}
