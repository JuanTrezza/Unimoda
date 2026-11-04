import { formatPrice } from '../../lib/format'
import type { Order } from '../../types'
import { formatAddress } from './AddressForm'

/** Ítems, totales y dirección de un pedido (detalle y confirmación) */
export function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <section aria-labelledby="items-title" className="lg:col-span-7">
        <h2 id="items-title" className="font-serif text-2xl">
          Productos
        </h2>
        <ul className="mt-4 divide-y divide-tinta/10 border-y border-tinta/10">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-4 text-sm">
              <div>
                <p className="font-medium">{i.productName}</p>
                <p className="mt-0.5 text-tinta-muted">
                  {i.colorName} · Talle {i.size} · {i.quantity} × {formatPrice(i.unitPrice)}
                </p>
              </div>
              <p className="shrink-0 tabular-nums">{formatPrice(i.lineTotal)}</p>
            </li>
          ))}
        </ul>
      </section>
      <aside aria-label="Totales y envío" className="space-y-6 lg:col-span-5">
        <dl className="space-y-3 rounded-sm bg-crema-200/70 p-6 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Envío</dt>
            <dd className="tabular-nums">{order.shipping === 0 ? 'Gratis' : formatPrice(order.shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-tinta/15 pt-3 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="order-total">
              {formatPrice(order.total)}
            </dd>
          </div>
        </dl>
        <div className="text-sm">
          <h3 className="font-medium">Envío a</h3>
          {order.address.recipient && <p className="mt-1">{order.address.recipient}</p>}
          <p className="mt-1 text-tinta-soft">{formatAddress(order.address)}</p>
        </div>
      </aside>
    </div>
  )
}
