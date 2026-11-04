import { Link } from 'react-router-dom'
import { Seo } from '../../components/Seo'
import { AccountNav } from '../../components/account/AccountNav'
import { OrderStatusBadge } from '../../components/account/OrderStatusBadge'
import { ErrorState } from '../../components/ui/ErrorState'
import { useAsync } from '../../hooks/useAsync'
import { formatDate, formatPrice } from '../../lib/format'
import { getOrders, orderNumber } from '../../services/orders'
import { useSession } from '../../store/session'

export function OrdersPage() {
  const userId = useSession((s) => s.user?.id ?? '')
  const orders = useAsync(`orders:${userId}`, getOrders, { keepPrevious: true })

  return (
    <div className="container-site pb-20 pt-8 md:pt-12">
      <Seo title="Mis pedidos" />
      <p className="eyebrow">Tu cuenta</p>
      <h1 className="mt-2 font-serif text-4xl md:text-5xl">Mis pedidos</h1>
      <div className="mt-6">
        <AccountNav />
      </div>

      {orders.error ? (
        <ErrorState what="tus pedidos" onRetry={orders.retry} />
      ) : !orders.data ? (
        <div className="h-40 animate-pulse rounded-sm bg-crema-200" aria-busy="true" />
      ) : orders.data.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm bg-crema-200/60 px-6 py-20 text-center">
          <p className="font-serif text-3xl">Todavía no hiciste pedidos</p>
          <Link to="/tienda" className="btn-primary mt-8">
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-tinta/10 border-y border-tinta/10">
          {orders.data.map((o) => {
            const units = o.items.reduce((sum, i) => sum + i.quantity, 0)
            return (
              <li key={o.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-5">
                <div className="min-w-0 flex-1">
                  <Link to={`/cuenta/pedidos/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                    Pedido #{orderNumber(o.id)}
                  </Link>
                  <p className="mt-1 text-sm text-tinta-muted">
                    {formatDate(o.createdAt)} · {units} {units === 1 ? 'prenda' : 'prendas'}
                  </p>
                </div>
                <OrderStatusBadge status={o.status} />
                <p className="w-28 text-right tabular-nums">{formatPrice(o.total)}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
