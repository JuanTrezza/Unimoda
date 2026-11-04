import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { CartLineItem } from '../components/cart/CartLineItem'
import { FreeShippingBar } from '../components/cart/FreeShippingBar'
import { ErrorState } from '../components/ui/ErrorState'
import { Icon } from '../components/ui/Icon'
import { useCartLines } from '../hooks/useCartLines'
import { formatPrice, installment, INSTALLMENTS } from '../lib/format'

export function CartPage() {
  const { lines, count, subtotal, shipping, total, loading, error, retry } = useCartLines()

  return (
    <div className="container-site pb-20 pt-8 md:pt-12">
      <Seo title="Carrito" description="Revisá los productos de tu carrito de Unimoda." />
      <h1 className="font-serif text-4xl md:text-5xl">Carrito</h1>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {count} {count === 1 ? 'producto' : 'productos'}. Total {formatPrice(total)}.
      </p>

      {loading ? (
        <div className="mt-10 h-40 animate-pulse rounded-sm bg-crema-200" aria-busy="true" />
      ) : error ? (
        <div className="mt-10">
          <ErrorState what="tu carrito" onRetry={retry} />
        </div>
      ) : lines.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-sm bg-crema-200/60 px-6 py-20 text-center">
          <p className="font-serif text-3xl">Tu carrito está vacío</p>
          <p className="mt-3 text-tinta-soft">Sumá tus prendas favoritas y volvé por acá.</p>
          <Link to="/tienda" className="btn-primary mt-8">
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14">
          <section aria-label="Productos" className="lg:col-span-8">
            <p className="text-sm text-tinta-muted">
              {count} {count === 1 ? 'producto' : 'productos'}
            </p>
            <ul className="mt-2 divide-y divide-tinta/10 border-y border-tinta/10">
              {lines.map((line) => (
                <CartLineItem key={line.variant.id} line={line} />
              ))}
            </ul>
            <Link to="/tienda" className="mt-6 inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4">
              <Icon name="chevronLeft" size={16} /> Seguir comprando
            </Link>
          </section>

          <aside aria-labelledby="summary-title" className="lg:col-span-4">
            <div className="rounded-sm bg-crema-200/70 p-6 lg:sticky lg:top-28">
              <h2 id="summary-title" className="font-serif text-2xl">
                Resumen
              </h2>
              <div className="mt-5">
                <FreeShippingBar subtotal={subtotal} />
              </div>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Envío</dt>
                  <dd className="tabular-nums">{shipping === 0 ? 'Gratis' : formatPrice(shipping)}</dd>
                </div>
                <div className="flex justify-between border-t border-tinta/15 pt-3 text-base font-medium">
                  <dt>Total</dt>
                  <dd className="tabular-nums" data-testid="cart-total">
                    {formatPrice(total)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-tinta-muted">
                o {INSTALLMENTS} cuotas sin interés de {installment(total)}
              </p>
              {/* Sin sesión, RequireAuth manda a Ingresar y vuelve acá con el carrito intacto */}
              <Link to="/checkout" className="btn-primary mt-6 w-full">
                Finalizar compra
              </Link>
              <ul className="mt-6 space-y-2 text-xs text-tinta-soft">
                <li className="flex items-center gap-2">
                  <Icon name="card" size={16} /> Tarjetas, Mercado Pago y transferencia
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="refresh" size={16} /> Cambios gratis dentro de los 30 días
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
