import { useEffect, useMemo, useState } from 'react'
import { getVariantsByIds } from '../services/catalog'
import { useCart } from '../store/cart'
import { FREE_SHIPPING_FROM, SHIPPING_COST } from '../lib/format'
import type { ResolvedVariant } from '../types'

export interface CartLine extends ResolvedVariant {
  quantity: number
  /** Precio unitario leído del catálogo */
  unitPrice: number
  lineTotal: number
}

/** Cruza el carrito (id + cantidad) con el catálogo para obtener precios y datos actuales. */
export function useCartLines() {
  const items = useCart((s) => s.items)
  const remove = useCart((s) => s.remove)
  const [resolved, setResolved] = useState<Map<string, ResolvedVariant>>(new Map())
  const [loading, setLoading] = useState(true)

  const idsKey = items.map((i) => i.variantId).join('|')

  useEffect(() => {
    let cancelled = false
    const ids = idsKey ? idsKey.split('|') : []
    getVariantsByIds(ids).then(
      (list) => {
        if (cancelled) return
        setResolved(new Map(list.map((r) => [r.variant.id, r])))
        setLoading(false)
        // Variantes que ya no existen en el catálogo se sacan del carrito
        const found = new Set(list.map((r) => r.variant.id))
        ids.filter((id) => !found.has(id)).forEach(remove)
      },
      // Sin conexión no se toca el carrito: se reintenta cuando cambia
      () => {
        if (!cancelled) setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [idsKey, remove])

  return useMemo(() => {
    const lines: CartLine[] = []
    for (const item of items) {
      const r = resolved.get(item.variantId)
      if (!r) continue
      const unitPrice = r.product.price
      lines.push({ ...r, quantity: item.quantity, unitPrice, lineTotal: unitPrice * item.quantity })
    }
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
    const count = lines.reduce((sum, l) => sum + l.quantity, 0)
    const freeShipping = subtotal >= FREE_SHIPPING_FROM
    const shipping = lines.length === 0 || freeShipping ? 0 : SHIPPING_COST
    return {
      lines,
      count,
      subtotal,
      shipping,
      total: subtotal + shipping,
      freeShipping,
      missingForFreeShipping: Math.max(0, FREE_SHIPPING_FROM - subtotal),
      loading: loading && items.length > 0,
    }
  }, [items, resolved, loading])
}
