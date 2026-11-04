import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Seo } from '../../components/Seo'
import { AddressForm, formatAddress } from '../../components/account/AddressForm'
import { DemoPaymentNotice } from '../../components/account/OrderStatusBadge'
import { ErrorState } from '../../components/ui/ErrorState'
import { Icon } from '../../components/ui/Icon'
import { useAsync } from '../../hooks/useAsync'
import { useCartLines } from '../../hooks/useCartLines'
import { cn, formatPrice } from '../../lib/format'
import { createAddress, getAddresses } from '../../services/account'
import { CheckoutError, createOrder, type StockProblem } from '../../services/orders'
import { useCart } from '../../store/cart'
import { useSession } from '../../store/session'

function stockMessage(p: StockProblem) {
  const base = `Sin stock: ${p.productName}, talle ${p.size}`
  return p.available > 0 ? `${base} (quedan ${p.available})` : base
}

/**
 * Carrito → dirección → resumen → confirmar. Se manda solo variant_id y cantidad: precios,
 * envío, total y stock los valida create_order en la base.
 */
export function CheckoutPage() {
  const userId = useSession((s) => s.user?.id ?? '')
  const navigate = useNavigate()
  const { lines, count, subtotal, shipping, total, loading, error: cartError, retry: retryCart } = useCartLines()
  const addresses = useAsync(`addresses:${userId}`, getAddresses, { keepPrevious: true })
  const clearCart = useCart((s) => s.clear)
  const setQuantity = useCart((s) => s.setQuantity)
  const [chosen, setChosen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<CheckoutError | null>(null)
  const alertRef = useRef<HTMLDivElement>(null)

  const list = addresses.data ?? []
  const selected = list.find((a) => a.id === chosen) ?? list.find((a) => a.isDefault) ?? list[0]
  const problems = new Map((error?.stock ?? []).map((p) => [p.sku, p]))

  const showError = (err: CheckoutError) => {
    setError(err)
    requestAnimationFrame(() => alertRef.current?.focus())
  }

  const onConfirm = async () => {
    if (!selected) return showError(new CheckoutError('Elegí o agregá una dirección de envío.', 'address'))
    const items = lines.map((l) => ({ variantId: l.variant.dbId, quantity: l.quantity }))
    if (items.some((i) => i.variantId === undefined)) {
      return showError(new CheckoutError('Algunos productos del carrito ya no existen. Actualizá el carrito.', 'not-found'))
    }
    setPlacing(true)
    setError(null)
    try {
      const id = await createOrder(items as { variantId: number; quantity: number }[], selected.id)
      navigate(`/checkout/confirmado/${id}`, { replace: true })
      clearCart()
    } catch (err) {
      showError(err instanceof CheckoutError ? err : new CheckoutError('No pudimos confirmar el pedido.', 'other'))
      setPlacing(false)
    }
  }

  const fitToStock = () => {
    for (const p of error?.stock ?? []) setQuantity(p.sku, p.available)
    setError(null)
  }

  if (loading) return <div className="container-site h-80 py-16" aria-busy="true" />
  if (cartError) {
    return (
      <div className="container-site py-10">
        <ErrorState what="tu carrito" onRetry={retryCart} />
      </div>
    )
  }
  if (lines.length === 0) {
    return (
      <div className="container-site flex flex-col items-center py-24 text-center">
        <Seo title="Checkout" description="Tu carrito de Unimoda." noindex />
        <h1 className="font-serif text-4xl">Tu carrito está vacío</h1>
        <Link to="/tienda" className="btn-primary mt-8">
          Ir a la tienda
        </Link>
      </div>
    )
  }

  return (
    <div className="container-site pb-20 pt-8 md:pt-12">
      <Seo title="Checkout" description="Confirmá tu pedido en Unimoda." noindex />
      <Link to="/carrito" className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4">
        <Icon name="chevronLeft" size={16} /> Volver al carrito
      </Link>
      <h1 className="mt-2 font-serif text-4xl md:text-5xl">Finalizar compra</h1>

      {error && (
        <div ref={alertRef} tabIndex={-1} role="alert" className="mt-6 rounded-sm bg-terracota-50 p-5 text-terracota-dark outline-none">
          <p className="flex items-center gap-2 font-medium">
            <Icon name="info" size={18} /> {error.message}
          </p>
          {error.stock.length > 0 && (
            <>
              <ul className="mt-2 list-disc pl-6 text-sm">
                {error.stock.map((p) => (
                  <li key={p.sku}>{stockMessage(p)}</li>
                ))}
              </ul>
              <button type="button" className="btn-outline mt-4 border-terracota-dark" onClick={fitToStock}>
                Ajustar al stock disponible
              </button>
            </>
          )}
          {error.kind === 'auth' && (
            <Link to="/ingresar?volver=%2Fcheckout" className="btn-outline mt-4">
              Volver a ingresar
            </Link>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="space-y-12 lg:col-span-7">
          <section aria-labelledby="envio-title">
            <h2 id="envio-title" className="font-serif text-2xl">
              1. Dirección de envío
            </h2>
            <div className="mt-5">
              {addresses.error ? (
                <ErrorState what="tus direcciones" onRetry={addresses.retry} />
              ) : !addresses.data ? (
                <div className="h-32 animate-pulse rounded-sm bg-crema-200" aria-busy="true" />
              ) : (
                <>
                  {list.length > 0 && (
                    <fieldset>
                      <legend className="sr-only">Elegí una dirección</legend>
                      <div className="space-y-3">
                        {list.map((a) => (
                          <label
                            key={a.id}
                            className={cn(
                              'flex min-h-14 cursor-pointer items-start gap-3 rounded-sm border p-4 text-sm',
                              selected?.id === a.id ? 'border-tinta bg-crema-50' : 'border-tinta/15',
                            )}
                          >
                            <input
                              type="radio"
                              name="direccion"
                              value={a.id}
                              checked={selected?.id === a.id}
                              onChange={() => setChosen(a.id)}
                              className="mt-0.5 h-5 w-5 accent-tinta"
                            />
                            <span>
                              {formatAddress(a)}
                              {a.isDefault && <span className="ml-2 text-tinta-muted">(predeterminada)</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  {adding || list.length === 0 ? (
                    <div className="mt-4 rounded-sm bg-crema-50 p-5">
                      <h3 className="mb-4 font-medium">Nueva dirección</h3>
                      <AddressForm
                        forceDefault={list.length === 0}
                        submitLabel="Usar esta dirección"
                        onCancel={list.length ? () => setAdding(false) : undefined}
                        onSubmit={async (input) => {
                          const created = await createAddress(input)
                          setChosen(created.id)
                          setAdding(false)
                          addresses.retry()
                        }}
                      />
                    </div>
                  ) : (
                    <button type="button" className="btn-outline mt-4" onClick={() => setAdding(true)}>
                      Agregar otra dirección
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          <section aria-labelledby="resumen-title">
            <h2 id="resumen-title" className="font-serif text-2xl">
              2. Revisá tu pedido
            </h2>
            <ul className="mt-5 divide-y divide-tinta/10 border-y border-tinta/10">
              {lines.map((l) => {
                const problem = problems.get(l.variant.id)
                return (
                  <li key={l.variant.id} className="py-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="font-medium">{l.product.name}</p>
                        <p className="mt-0.5 text-tinta-muted">
                          {l.color.name} · Talle {l.variant.size} · {l.quantity} × {formatPrice(l.unitPrice)}
                        </p>
                      </div>
                      <p className="shrink-0 tabular-nums">{formatPrice(l.lineTotal)}</p>
                    </div>
                    {problem && (
                      <p className="mt-2 flex items-center gap-1.5 text-terracota-dark">
                        <Icon name="info" size={16} /> {stockMessage(problem)}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <aside aria-labelledby="total-title" className="lg:col-span-5">
          <div className="space-y-5 rounded-sm bg-crema-200/70 p-6 lg:sticky lg:top-28">
            <h2 id="total-title" className="font-serif text-2xl">
              Total
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt>
                  Subtotal ({count} {count === 1 ? 'prenda' : 'prendas'})
                </dt>
                <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Envío</dt>
                <dd className="tabular-nums">{shipping === 0 ? 'Gratis' : formatPrice(shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-tinta/15 pt-3 text-base font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums" data-testid="checkout-total">
                  {formatPrice(total)}
                </dd>
              </div>
            </dl>
            <DemoPaymentNotice />
            <button type="button" className="btn-primary w-full" onClick={onConfirm} disabled={placing || !addresses.data}>
              {placing ? 'Confirmando…' : 'Confirmar pedido'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
