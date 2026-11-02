import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { ProductGrid } from '../components/product/ProductCard'
import { EditorialPicture } from '../components/ui/EditorialPicture'
import { Icon, type IconName } from '../components/ui/Icon'
import { Newsletter } from '../components/Newsletter'
import { useAsync } from '../hooks/useAsync'
import { getCategories, getNewArrivals } from '../services/catalog'
import { EDITORIAL } from '../data/editorial'
import { formatPrice, FREE_SHIPPING_FROM, INSTALLMENTS } from '../lib/format'

const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'truck', title: 'Envíos a todo el país', text: `Gratis desde ${formatPrice(FREE_SHIPPING_FROM)}. CABA y GBA en 2 a 4 días hábiles.` },
  { icon: 'card', title: `${INSTALLMENTS} cuotas sin interés`, text: 'Con todas las tarjetas de crédito. También Mercado Pago y transferencia.' },
  { icon: 'refresh', title: 'Cambios gratis', text: 'Tenés 30 días para cambiar tu prenda, sin costo de envío.' },
]

export function HomePage() {
  const newArrivals = useAsync('new-arrivals', () => getNewArrivals(4))
  const categories = useAsync('categories', getCategories)

  return (
    <>
      <Seo />

      {/* Hero editorial */}
      <section className="container-site grid gap-8 pb-16 pt-6 md:grid-cols-12 md:items-center md:gap-10 md:pt-10 lg:pb-24">
        <div className="order-2 md:order-1 md:col-span-5 motion-safe:animate-fade-up">
          <p className="eyebrow">Colección Primavera–Verano 2027</p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Lino, sol y <em className="font-light italic text-terracota">calma</em>.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-tinta-soft lg:text-lg">
            Prendas livianas en colores de tierra, pensadas para durar más de una temporada.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/tienda?orden=novedades" className="btn-primary">
              Ver novedades
            </Link>
            <Link to="/tienda?categoria=vestidos" className="btn-outline">
              Vestidos
            </Link>
          </div>
        </div>
        <div className="order-1 md:order-2 md:col-span-7">
          <div className="aspect-[4/5] overflow-hidden rounded-sm md:aspect-[5/6] lg:aspect-[6/7]">
            <EditorialPicture image={EDITORIAL.hero} priority />
          </div>
        </div>
      </section>

      {/* Categorías destacadas */}
      <section aria-labelledby="cat-title" className="container-site pb-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 id="cat-title" className="font-serif text-3xl md:text-4xl">
            Categorías
          </h2>
          <Link to="/tienda" className="inline-flex min-h-11 items-center gap-1 text-sm underline-offset-4 hover:underline">
            Ver todo <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {(categories.data ?? []).map((c) => (
            <li key={c.id}>
              <Link to={`/tienda?categoria=${c.id}`} className="group block">
                <div className="aspect-[3/4] overflow-hidden rounded-sm">
                  <EditorialPicture
                    image={EDITORIAL[c.id]}
                    className="transition-transform duration-700 motion-safe:group-hover:scale-105"
                  />
                </div>
                <p className="mt-3 flex items-center justify-between font-serif text-lg">
                  {c.name}
                  <Icon name="arrowRight" size={16} className="transition-transform motion-safe:group-hover:translate-x-1" />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Novedades */}
      <section aria-labelledby="new-title" className="container-site pb-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Recién llegado</p>
            <h2 id="new-title" className="mt-2 font-serif text-3xl md:text-4xl">
              Novedades
            </h2>
          </div>
          <Link
            to="/tienda?orden=novedades"
            className="inline-flex min-h-11 items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            Ver todas <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        <ProductGrid products={newArrivals.data} loading={newArrivals.loading} count={4} />
      </section>

      {/* Banner de temporada */}
      <section aria-labelledby="season-title" className="bg-tinta text-crema-50">
        <div className="container-site grid gap-0 md:grid-cols-2">
          <div className="-mx-4 aspect-[4/3] sm:-mx-6 md:mx-0 md:aspect-auto md:min-h-[520px]">
            <EditorialPicture image={EDITORIAL.temporada} />
          </div>
          <div className="flex flex-col justify-center py-14 md:px-12 lg:px-20">
            <p className="eyebrow text-arena">Temporada</p>
            <h2 id="season-title" className="mt-4 font-serif text-4xl leading-tight lg:text-5xl">
              Texturas naturales para los días largos
            </h2>
            <p className="mt-5 max-w-md text-crema-300">
              Lino lavado, algodón y viscosa en una paleta de arena, salvia y terracota. Combinables entre sí, de la mañana
              a la noche.
            </p>
            <div className="mt-8">
              <Link to="/tienda?orden=novedades" className="btn bg-crema-50 text-tinta hover:bg-arena">
                Descubrir la colección
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section aria-label="Beneficios" className="container-site py-16 md:py-20">
        <ul className="grid gap-10 md:grid-cols-3">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terracota-50 text-terracota-dark">
                <Icon name={b.icon} size={22} />
              </span>
              <div>
                <h3 className="font-serif text-xl">{b.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-tinta-soft">{b.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Newsletter />
    </>
  )
}
