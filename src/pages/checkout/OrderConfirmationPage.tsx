import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Seo } from '../../components/Seo'
import { DemoPaymentNotice } from '../../components/account/OrderStatusBadge'
import { OrderSummary } from '../../components/account/OrderSummary'
import { ErrorState } from '../../components/ui/ErrorState'
import { Icon } from '../../components/ui/Icon'
import { useAsync } from '../../hooks/useAsync'
import { getOrder, orderNumber } from '../../services/orders'
import { useSession } from '../../store/session'
import { NotFoundPage } from '../NotFoundPage'

export function OrderConfirmationPage() {
  const { id = '' } = useParams()
  const userId = useSession((s) => s.user?.id ?? '')
  const order = useAsync(`order:${userId}:${id}`, () => getOrder(id))
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (order.data) headingRef.current?.focus()
  }, [order.data])

  if (order.loading) return <div className="container-site h-80 py-16" aria-busy="true" />
  if (order.error) {
    return (
      <div className="container-site py-10">
        <ErrorState what="el pedido" onRetry={order.retry} />
      </div>
    )
  }
  if (!order.data) return <NotFoundPage />

  return (
    <div className="container-site pb-20 pt-8 md:pt-12">
      <Seo title="Pedido confirmado" />
      <div className="flex flex-col items-start">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-terracota text-white">
          <Icon name="check" />
        </span>
        <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-serif text-4xl outline-none md:text-5xl">
          ¡Gracias! Recibimos tu pedido
        </h1>
        <p className="mt-3 text-lg">
          Número de pedido: <strong data-testid="order-number">#{orderNumber(order.data.id)}</strong>
        </p>
        <div className="mt-6 w-full max-w-2xl">
          <DemoPaymentNotice />
        </div>
      </div>

      <div className="mt-12">
        <OrderSummary order={order.data} />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to={`/cuenta/pedidos/${order.data.id}`} className="btn-primary">
          Ver el pedido
        </Link>
        <Link to="/tienda" className="btn-outline">
          Seguir comprando
        </Link>
      </div>
    </div>
  )
}
