import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Seo } from '../../components/Seo'
import { DemoPaymentNotice, OrderStatusBadge } from '../../components/account/OrderStatusBadge'
import { OrderSummary } from '../../components/account/OrderSummary'
import { ErrorState } from '../../components/ui/ErrorState'
import { Icon } from '../../components/ui/Icon'
import { Modal } from '../../components/ui/Modal'
import { useAsync } from '../../hooks/useAsync'
import { formatDate } from '../../lib/format'
import { cancelOrder, getOrder, orderNumber } from '../../services/orders'
import { useSession } from '../../store/session'
import { toast } from '../../store/toast'
import { NotFoundPage } from '../NotFoundPage'

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const userId = useSession((s) => s.user?.id ?? '')
  const order = useAsync(`order:${userId}:${id}`, () => getOrder(id))
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  if (order.loading) return <div className="container-site h-80 py-16" aria-busy="true" />
  if (order.error) {
    return (
      <div className="container-site py-10">
        <ErrorState what="el pedido" onRetry={order.retry} />
      </div>
    )
  }
  if (!order.data) return <NotFoundPage />
  const o = order.data

  const onCancel = async () => {
    setCancelling(true)
    try {
      await cancelOrder(o.id)
      toast('Cancelamos el pedido y liberamos el stock.')
      setConfirming(false)
      order.retry()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No pudimos cancelar el pedido.', { tone: 'error' })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="container-site pb-20 pt-8 md:pt-12">
      <Seo title={`Pedido #${orderNumber(o.id)}`} description="Detalle de tu pedido en Unimoda." noindex />
      <Link to="/cuenta/pedidos" className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4">
        <Icon name="chevronLeft" size={16} /> Mis pedidos
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <h1 className="font-serif text-4xl md:text-5xl">Pedido #{orderNumber(o.id)}</h1>
        <OrderStatusBadge status={o.status} />
      </div>
      <p className="mt-2 text-sm text-tinta-muted">Hecho el {formatDate(o.createdAt)}</p>

      {o.status === 'pendiente_pago' && (
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <DemoPaymentNotice />
          </div>
          <button type="button" className="btn-outline" onClick={() => setConfirming(true)}>
            Cancelar pedido
          </button>
        </div>
      )}

      <div className="mt-10">
        <OrderSummary order={o} />
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="¿Cancelar el pedido?">
        <p className="text-tinta-soft">Las prendas vuelven a estar disponibles para otras personas. No se puede deshacer.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={onCancel} disabled={cancelling}>
            {cancelling ? 'Cancelando…' : 'Sí, cancelar pedido'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
            Volver
          </button>
        </div>
      </Modal>
    </div>
  )
}
