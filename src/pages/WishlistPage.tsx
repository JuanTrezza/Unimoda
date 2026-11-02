import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { ProductGrid } from '../components/product/ProductCard'
import { useAsync } from '../hooks/useAsync'
import { getProductsByIds } from '../services/catalog'
import { useWishlist } from '../store/wishlist'

export function WishlistPage() {
  const ids = useWishlist((s) => s.productIds)
  const { data, loading } = useAsync(`wishlist:${ids.join(',')}`, () => getProductsByIds(ids), { keepPrevious: true })
  // Respeta el orden en que se guardaron (los más recientes primero)
  const products = data && [...data].sort((a, b) => ids.indexOf(b.id) - ids.indexOf(a.id))

  return (
    <div className="container-site pb-20 pt-8 md:pt-12">
      <Seo title="Favoritos" description="Las prendas que guardaste en Unimoda." />
      <p className="eyebrow">Tu selección</p>
      <h1 className="mt-2 font-serif text-4xl md:text-5xl">Favoritos</h1>

      {ids.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-sm bg-crema-200/60 px-6 py-20 text-center">
          <p className="font-serif text-3xl">Todavía no guardaste nada</p>
          <p className="mt-3 max-w-sm text-tinta-soft">
            Tocá el corazón en cualquier prenda para guardarla y encontrarla después.
          </p>
          <Link to="/tienda" className="btn-primary mt-8">
            Explorar la tienda
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <p className="mb-6 text-sm text-tinta-muted" aria-live="polite">
            {ids.length} {ids.length === 1 ? 'prenda guardada' : 'prendas guardadas'}
          </p>
          <ProductGrid products={products} loading={loading && !data} count={ids.length} />
        </div>
      )}
    </div>
  )
}
