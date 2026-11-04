import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OrderStatusBadge } from '../../components/account/OrderStatusBadge'
import { ErrorState } from '../../components/ui/ErrorState'
import { Icon } from '../../components/ui/Icon'
import { useAsync } from '../../hooks/useAsync'
import { formatDate, formatPrice } from '../../lib/format'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { toast } from '../../store/toast'
import type { OrderStatus } from '../../types'
import { ConfirmDialog, DataTable, Panel } from '../components'
import { getAdminOrder, NEXT_STATUS, setOrderStatus } from '../services'

const ACTION_LABEL: Record<OrderStatus, string> = {
  pendiente_pago: 'Volver a pendiente',
  pagado: 'Marcar como pagado',
  enviado: 'Marcar como enviado',
  cancelado: 'Cancelar pedido',
}

export function OrderPage() {
  const { id = '' } = useParams()
  const order = useAsync(`admin:order:${id}`, () => getAdminOrder(id))
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)

  if (order.loading) return <div className="h-80" aria-busy="true" />
  if (order.error) return <ErrorState what="el pedido" onRetry={order.retry} />
  if (!order.data) return <NotFoundPage />
  const o = order.data
  const a = o.address

  const change = async (status: OrderStatus) => {
    setBusy(true)
    try {
      await setOrderStatus(o.id, status)
      toast(status === 'cancelado' ? 'Pedido cancelado. El stock volvió al catálogo.' : 'Actualizamos el estado del pedido.')
      setConfirmCancel(false)
      order.retry()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No pudimos cambiar el estado.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Link to="/admin/pedidos" className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4">
        <Icon name="chevronLeft" size={16} /> Pedidos
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <h1 className="font-serif text-4xl md:text-5xl">Pedido #{o.number}</h1>
        <OrderStatusBadge status={o.status} />
      </div>
      <p className="mt-2 text-sm text-tinta-muted">{formatDate(o.createdAt)}</p>

      {NEXT_STATUS[o.status].length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3" role="group" aria-label="Cambiar estado">
          {NEXT_STATUS[o.status].map((next) =>
            next === 'cancelado' ? (
              <button key={next} type="button" className="btn-outline" onClick={() => setConfirmCancel(true)} disabled={busy}>
                {ACTION_LABEL[next]}
              </button>
            ) : (
              <button key={next} type="button" className="btn-primary" onClick={() => change(next)} disabled={busy}>
                {ACTION_LABEL[next]}
              </button>
            ),
          )}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <Panel title="Productos" className="lg:col-span-8">
          <DataTable
            caption="Productos del pedido"
            rows={o.items}
            rowKey={(i) => i.id}
            empty="Sin productos."
            columns={[
              { key: 'producto', label: 'Producto', render: (i) => i.productName },
              { key: 'variante', label: 'Variante', render: (i) => `${i.colorName} · ${i.size}` },
              { key: 'sku', label: 'SKU', render: (i) => <code className="text-xs">{i.sku}</code> },
              { key: 'cantidad', label: 'Cant.', className: 'text-right tabular-nums', render: (i) => i.quantity },
              { key: 'total', label: 'Subtotal', className: 'text-right tabular-nums', render: (i) => formatPrice(i.lineTotal) },
            ]}
          />
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(o.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Envío</dt>
              <dd className="tabular-nums">{o.shipping === 0 ? 'Gratis' : formatPrice(o.shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-tinta/15 pt-2 text-base font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(o.total)}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Envío" className="lg:col-span-4">
          <address className="space-y-1 text-sm not-italic">
            {a.recipient && <p className="font-medium">{a.recipient}</p>}
            {a.phone && <p>{a.phone}</p>}
            <p>
              {a.street} {a.number}
              {a.apartment ? `, ${a.apartment}` : ''}
            </p>
            <p>
              {a.city}, {a.province} ({a.postal_code})
            </p>
          </address>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="¿Cancelar el pedido?"
        confirmLabel="Sí, cancelar pedido"
        busy={busy}
        onConfirm={() => change('cancelado')}
        onClose={() => setConfirmCancel(false)}
      >
        El stock de los productos vuelve al catálogo. No se puede deshacer.
      </ConfirmDialog>
    </>
  )
}
