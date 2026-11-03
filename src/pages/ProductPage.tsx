import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { ProductImage } from '../components/product/ProductImage'
import { Price } from '../components/product/Price'
import { ProductGrid } from '../components/product/ProductCard'
import { QuantityInput } from '../components/product/QuantityInput'
import { SizeGuideModal } from '../components/product/SizeGuideModal'
import { WishlistButton } from '../components/product/WishlistButton'
import { ErrorState } from '../components/ui/ErrorState'
import { Icon } from '../components/ui/Icon'
import { useAsync } from '../hooks/useAsync'
import { getProductBySlug, getRelatedProducts } from '../services/catalog'
import { MAX_PER_ITEM, useCart } from '../store/cart'
import { toast } from '../store/toast'
import { CATEGORIES } from '../data/categories'
import { cn, formatPrice, FREE_SHIPPING_FROM } from '../lib/format'
import { imagesForColor } from '../lib/productImages'
import type { Product, Size } from '../types'
import { NotFoundPage } from './NotFoundPage'

export function ProductPage() {
  const { slug = '' } = useParams()
  const { data: product, loading, error, retry } = useAsync(`product:${slug}`, () => getProductBySlug(slug))

  if (loading) {
    return (
      <div className="container-site grid gap-10 py-10 md:grid-cols-2" aria-busy="true">
        <div className="aspect-[4/5] animate-pulse rounded-sm bg-crema-200" />
        <div className="space-y-4">
          <div className="h-10 w-3/4 animate-pulse rounded bg-crema-200" />
          <div className="h-6 w-1/3 animate-pulse rounded bg-crema-200" />
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="container-site py-10">
        <ErrorState what="esta prenda" onRetry={retry} />
      </div>
    )
  }
  if (!product) return <NotFoundPage />
  // key: reinicia la selección al navegar a otro producto
  return <ProductDetail key={product.id} product={product} />
}

function ProductDetail({ product }: { product: Product }) {
  const firstAvailableColor =
    product.colors.find((c) => product.variants.some((v) => v.colorId === c.id && v.stock > 0)) ?? product.colors[0]!
  const [colorId, setColorId] = useState(firstAvailableColor.id)
  const [size, setSize] = useState<Size | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)
  const [sizeError, setSizeError] = useState(false)
  const addToCart = useCart((s) => s.add)
  const openCart = useCart((s) => s.open)
  const related = useAsync(`related:${product.id}`, () => getRelatedProducts(product))

  const color = product.colors.find((c) => c.id === colorId)!
  const category = CATEGORIES.find((c) => c.id === product.category)
  const variant = useMemo(
    () => (size ? product.variants.find((v) => v.colorId === colorId && v.size === size) : undefined),
    [product, colorId, size],
  )
  const stockFor = (s: Size) => product.variants.find((v) => v.colorId === colorId && v.size === s)?.stock ?? 0
  const maxQty = variant ? Math.min(variant.stock, MAX_PER_ITEM) : MAX_PER_ITEM

  // Si el talle elegido no tiene stock en el nuevo color, se deselecciona; la galería vuelve a la primera foto
  useEffect(() => {
    if (size && stockFor(size) === 0) setSize(null)
    setQuantity(1)
    setActiveImage(0)
  }, [colorId])

  const onAdd = () => {
    if (!variant) {
      setSizeError(true)
      document.getElementById('size-picker')?.focus()
      return
    }
    addToCart(variant.id, quantity, variant.stock)
    toast(`Agregaste ${product.name} (${color.name}, ${variant.size}) al carrito`)
    openCart()
  }

  // Fotos del color elegido o, si no tiene, las que sirven para todos los colores
  const images = useMemo(() => imagesForColor(product, colorId), [product, colorId])
  const image = images[activeImage] ?? images[0]!

  return (
    <div className="pb-20">
      <Seo title={product.name} description={`${product.name} en ${color.name}. ${product.description}`} />

      <nav aria-label="Ruta de navegación" className="container-site py-4 text-xs text-tinta-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to="/" className="inline-flex min-h-11 items-center hover:text-tinta">
              Inicio
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to={`/tienda?categoria=${product.category}`} className="inline-flex min-h-11 items-center hover:text-tinta">
              {category?.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-tinta">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="container-site grid gap-8 md:grid-cols-2 lg:grid-cols-12 lg:gap-14">
        {/* Galería */}
        <section aria-label="Galería de imágenes" className="lg:col-span-7">
          <div className="flex flex-col-reverse gap-3 lg:flex-row">
            {/* Miniaturas solo si hay más de una imagen */}
            {images.length > 1 && (
              <ul className="flex gap-3 lg:w-20 lg:flex-col">
                {images.map((img, i) => (
                  <li key={img.file} className="w-20">
                    <button
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`Ver imagen ${i + 1}: ${img.alt}`}
                      aria-current={i === activeImage}
                      className={cn(
                        'block aspect-[4/5] w-full overflow-hidden rounded-sm ring-offset-2 ring-offset-crema transition',
                        i === activeImage ? 'ring-2 ring-tinta' : 'opacity-70 hover:opacity-100',
                      )}
                    >
                      <ProductImage image={img} silhouette={product.silhouette} colorHex={color.hex} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="relative aspect-[4/5] flex-1 overflow-hidden rounded-sm bg-crema-200">
              <ProductImage
                // El placeholder se re-tiñe con el color elegido; la foto real cambia si el color tiene fotos propias
                key={image.ready ? image.file : `${image.file}-${color.id}`}
                image={image}
                silhouette={product.silhouette}
                colorHex={color.hex}
                priority
                fetchPriority="high"
                className="motion-safe:animate-fade-in"
              />
              {product.isNew && <span className="badge absolute left-4 top-4 bg-crema-50">Nuevo</span>}
            </div>
          </div>
        </section>

        {/* Información y compra */}
        <section aria-labelledby="product-title" className="lg:col-span-5">
          <div className="flex items-start justify-between gap-4">
            <h1 id="product-title" className="font-serif text-3xl leading-tight md:text-4xl">
              {product.name}
            </h1>
            <WishlistButton product={product} variant="outline" className="shrink-0" />
          </div>
          <div className="mt-4">
            <Price price={product.price} compareAtPrice={product.compareAtPrice} size="lg" showInstallments />
          </div>
          <p className="mt-6 leading-relaxed text-tinta-soft">{product.description}</p>

          {/* Color */}
          <fieldset className="mt-8">
            <legend className="text-sm">
              Color: <span className="font-medium">{color.name}</span>
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.colors.map((c) => {
                const available = product.variants.some((v) => v.colorId === c.id && v.stock > 0)
                return (
                  <label
                    key={c.id}
                    className={cn(
                      'relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full',
                      'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-terracota',
                    )}
                    title={c.name}
                  >
                    <input
                      type="radio"
                      name="color"
                      value={c.id}
                      checked={c.id === colorId}
                      onChange={() => setColorId(c.id)}
                      className="sr-only"
                    />
                    <span className="sr-only">
                      {c.name}
                      {!available && ' (sin stock)'}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-8 w-8 rounded-full ring-1 ring-tinta/20',
                        c.id === colorId && 'ring-2 ring-tinta ring-offset-2 ring-offset-crema',
                        !available && 'opacity-40',
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* Talle */}
          <fieldset className="mt-6" aria-describedby={sizeError ? 'size-error' : undefined}>
            <div className="flex items-center justify-between">
              <legend className="text-sm">
                Talle: <span className="font-medium">{size ?? 'elegí uno'}</span>
              </legend>
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm underline underline-offset-4"
                aria-haspopup="dialog"
              >
                <Icon name="ruler" size={16} /> Guía de talles
              </button>
            </div>
            <div id="size-picker" tabIndex={-1} className="mt-2 flex flex-wrap gap-2 outline-none">
              {product.sizes.map((s) => {
                const stock = stockFor(s)
                const selected = s === size
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={stock === 0}
                    aria-pressed={selected}
                    aria-label={stock === 0 ? `${s}, sin stock` : s}
                    onClick={() => {
                      setSize(s)
                      setSizeError(false)
                      setQuantity((q) => Math.min(q, Math.max(1, Math.min(stock, MAX_PER_ITEM))))
                    }}
                    className={cn(
                      'h-12 min-w-14 rounded-full border px-4 text-sm transition-colors',
                      selected ? 'border-tinta bg-tinta text-crema-50' : 'border-tinta/25 hover:border-tinta',
                      stock === 0 && 'cursor-not-allowed border-dashed text-tinta-muted line-through hover:border-tinta/25',
                    )}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 min-h-5 text-sm" aria-live="polite">
              {sizeError ? (
                <span id="size-error" className="text-terracota-dark">
                  Elegí un talle para continuar.
                </span>
              ) : variant && variant.stock <= 3 ? (
                <span className="text-terracota-dark">¡Quedan solo {variant.stock}!</span>
              ) : variant ? (
                <span className="text-tinta-muted">En stock</span>
              ) : null}
            </p>
          </fieldset>

          {/* Cantidad + agregar */}
          <div className="mt-4 flex gap-3">
            <QuantityInput value={quantity} max={maxQty} onChange={setQuantity} label="Cantidad" />
            <button type="button" onClick={onAdd} className="btn-primary flex-1">
              <Icon name="bag" size={18} />
              Agregar al carrito
            </button>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-tinta-soft">
            <li className="flex items-center gap-2">
              <Icon name="truck" size={18} /> Envío gratis desde {formatPrice(FREE_SHIPPING_FROM)}
            </li>
            <li className="flex items-center gap-2">
              <Icon name="refresh" size={18} /> Cambios gratis dentro de los 30 días
            </li>
          </ul>

          <div className="mt-8 divide-y divide-tinta/10 border-y border-tinta/10">
            <details className="group" open>
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-medium">
                Detalles
                <Icon name="chevronDown" size={18} className="transition-transform group-open:rotate-180" />
              </summary>
              <ul className="list-disc space-y-1 pb-5 pl-5 text-sm text-tinta-soft">
                {product.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </details>
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-medium">
                Material y cuidados
                <Icon name="chevronDown" size={18} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2 pb-5 text-sm text-tinta-soft">
                <p>
                  <strong className="font-medium text-tinta">Composición:</strong> {product.material}
                </p>
                <p>{product.care}</p>
              </div>
            </details>
          </div>
        </section>
      </div>

      <section aria-labelledby="related-title" className="container-site mt-20">
        <h2 id="related-title" className="mb-8 font-serif text-3xl">
          También te puede gustar
        </h2>
        <ProductGrid products={related.data} loading={related.loading} count={4} />
      </section>

      <SizeGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
