import { FREE_SHIPPING_FROM, formatPrice } from '../../lib/format'

export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const progress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_FROM) * 100))
  const missing = FREE_SHIPPING_FROM - subtotal
  return (
    <div>
      <p className="text-sm">
        {missing > 0 ? (
          <>
            Te faltan <strong className="font-semibold">{formatPrice(missing)}</strong> para el envío gratis
          </>
        ) : (
          <strong className="font-semibold text-terracota-dark">¡Tenés envío gratis!</strong>
        )}
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-crema-300"
        role="progressbar"
        aria-label="Progreso hacia el envío gratis"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div className="h-full rounded-full bg-terracota transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
