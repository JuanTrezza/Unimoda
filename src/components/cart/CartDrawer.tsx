import { Link } from 'react-router-dom'
import { useCart } from '../../store/cart'
import { useCartLines } from '../../hooks/useCartLines'
import { formatPrice } from '../../lib/format'
import { Drawer } from '../ui/Drawer'
import { CartLineItem } from './CartLineItem'
import { FreeShippingBar } from './FreeShippingBar'

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen)
  const close = useCart((s) => s.close)
  const { lines, count, subtotal } = useCartLines()

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      title={`Tu carrito${count ? ` (${count})` : ''}`}
      footer={
        lines.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm">Subtotal</span>
              <span className="text-lg font-medium tabular-nums" data-testid="drawer-subtotal">
                {formatPrice(subtotal)}
              </span>
            </div>
            <p className="text-xs text-tinta-muted">El envío se calcula en el carrito.</p>
            <Link to="/carrito" onClick={close} className="btn-primary w-full">
              Ver carrito y finalizar
            </Link>
            <button type="button" onClick={close} className="btn-ghost w-full">
              Seguir comprando
            </button>
          </div>
        )
      }
    >
      {/* Anuncia cambios de total para lectores de pantalla */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {count} {count === 1 ? 'producto' : 'productos'} en el carrito. Subtotal {formatPrice(subtotal)}.
      </p>
      {lines.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <p className="font-serif text-2xl">Tu carrito está vacío</p>
          <p className="text-sm text-tinta-muted">Descubrí las novedades de la temporada.</p>
          <Link to="/tienda" onClick={close} className="btn-primary mt-2">
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="px-5">
          <div className="border-b border-tinta/10 py-4">
            <FreeShippingBar subtotal={subtotal} />
          </div>
          <ul className="divide-y divide-tinta/10">
            {lines.map((line) => (
              <CartLineItem key={line.variant.id} line={line} onNavigate={close} />
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  )
}
