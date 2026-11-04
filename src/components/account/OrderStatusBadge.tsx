import { cn } from '../../lib/format'
import { ORDER_STATUS_LABEL } from '../../services/orders'
import type { OrderStatus } from '../../types'

const TONE: Record<OrderStatus, string> = {
  pendiente_pago: 'bg-crema-200 text-tinta',
  pagado: 'bg-salvia/20 text-tinta',
  enviado: 'bg-tinta text-crema-50',
  cancelado: 'bg-terracota-50 text-terracota-dark',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn('badge', TONE[status])}>{ORDER_STATUS_LABEL[status]}</span>
}

/** Pago simulado: se muestra en el checkout, la confirmación y el detalle del pedido */
export function DemoPaymentNotice() {
  return (
    <p role="note" className="rounded-sm border border-dashed border-tinta/30 p-4 text-sm text-tinta-soft">
      <strong className="text-tinta">Proyecto demo:</strong> no se cobra nada. El pedido queda “pendiente de pago” y el
      stock se reserva hasta que lo canceles.
    </p>
  )
}
