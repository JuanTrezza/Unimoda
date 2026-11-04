/**
 * Pedidos. El cliente no escribe orders ni order_items: crea y cancela con las funciones
 * create_order / cancel_order de la base, que calculan precios y envío y manejan el stock.
 *
 * TODO(etapa 4): pago con Mercado Pago Checkout Pro.
 *   - Edge Function `create-payment`: recibe el order_id, lee el pedido con service_role
 *     (montos desde la base, nunca del cliente), crea la preferencia y devuelve init_point.
 *   - Edge Function `mp-webhook`: valida la firma (x-signature), consulta el pago en la API de
 *     MP y pasa la orden a 'pagado'. Ese es el único camino a 'pagado'.
 *   - Mientras tanto el pedido queda 'pendiente_pago' y no se cobra nada.
 */
import { supabase } from '../lib/supabase'
import type { Order, OrderAddress, OrderItem, OrderStatus } from '../types'

export interface StockProblem {
  sku: string
  productName: string
  colorName: string
  size: string
  requested: number
  available: number
}

/** Error de checkout con mensaje listo para mostrar y, si es de stock, el detalle por línea */
export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly kind: 'stock' | 'not-found' | 'address' | 'rate-limit' | 'auth' | 'network' | 'other',
    readonly stock: StockProblem[] = [],
  ) {
    super(message)
  }
}

interface PgError {
  code?: string
  message: string
  details?: string | null
}

function parseJson<T>(text: string | null | undefined, fallback: T): T {
  try {
    return text ? (JSON.parse(text) as T) : fallback
  } catch {
    return fallback
  }
}

function toCheckoutError(error: PgError): CheckoutError {
  switch (error.code) {
    case 'UM001': {
      const rows = parseJson<
        { sku: string; product_name: string; color_name: string; size: string; requested: number; available: number }[]
      >(error.details, [])
      return new CheckoutError(
        'No hay stock suficiente de algunos productos.',
        'stock',
        rows.map((r) => ({
          sku: r.sku,
          productName: r.product_name,
          colorName: r.color_name,
          size: r.size,
          requested: r.requested,
          available: r.available,
        })),
      )
    }
    case 'UM002':
      return new CheckoutError('Algunos productos del carrito ya no existen. Actualizá el carrito.', 'not-found')
    case 'UM003':
      return new CheckoutError('Elegí una dirección de envío válida.', 'address')
    case 'UM004':
      return new CheckoutError(error.message, 'rate-limit')
    // cancel_order: pedido ajeno/inexistente o que ya no está pendiente (el mensaje viene de la base)
    case 'UM005':
    case 'UM006':
      return new CheckoutError(error.message, 'other')
    case '28000':
    case '42501':
      return new CheckoutError('Tu sesión venció. Volvé a ingresar.', 'auth')
    default:
      if (/fetch|network/i.test(error.message)) {
        return new CheckoutError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.', 'network')
      }
      return new CheckoutError('No pudimos confirmar el pedido. Probá de nuevo en unos minutos.', 'other')
  }
}

/** Solo variant_id y cantidad: precio, envío y total los calcula la base. */
export async function createOrder(items: { variantId: number; quantity: number }[], addressId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_order', {
    items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    address_id: addressId,
  })
  if (error) throw toCheckoutError(error)
  return data as string
}

export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_order', { order_id: orderId })
  if (error) throw toCheckoutError(error)
}

// --- Lectura (RLS: solo los pedidos propios) -----------------------------------

const ORDER_SELECT = `
  id, status, subtotal_cents, shipping_cents, total_cents, shipping_address, created_at,
  items:order_items(id, variant_id, sku, product_name, color_name, size, unit_price_cents, quantity, line_total_cents)
`

interface OrderRow {
  id: string
  status: OrderStatus
  subtotal_cents: number
  shipping_cents: number
  total_cents: number
  shipping_address: {
    recipient?: string
    phone?: string | null
    street: string
    number: string
    apartment?: string | null
    city: string
    province: string
    postal_code: string
  }
  created_at: string
  items: {
    id: number
    variant_id: number | null
    sku: string
    product_name: string
    color_name: string
    size: string
    unit_price_cents: number
    quantity: number
    line_total_cents: number
  }[]
}

const fromCents = (cents: number) => Math.round(cents / 100)

function toOrder(row: OrderRow): Order {
  const a = row.shipping_address
  const address: OrderAddress = {
    recipient: a.recipient ?? '',
    phone: a.phone ?? null,
    street: a.street,
    number: a.number,
    apartment: a.apartment ?? null,
    city: a.city,
    province: a.province,
    postalCode: a.postal_code,
  }
  const items: OrderItem[] = [...row.items]
    .sort((x, y) => x.id - y.id)
    .map((i) => ({
      id: i.id,
      variantId: i.variant_id,
      sku: i.sku,
      productName: i.product_name,
      colorName: i.color_name,
      size: i.size,
      unitPrice: fromCents(i.unit_price_cents),
      quantity: i.quantity,
      lineTotal: fromCents(i.line_total_cents),
    }))
  return {
    id: row.id,
    status: row.status,
    subtotal: fromCents(row.subtotal_cents),
    shipping: fromCents(row.shipping_cents),
    total: fromCents(row.total_cents),
    address,
    createdAt: row.created_at,
    items,
  }
}

function check<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

export async function getOrders(): Promise<Order[]> {
  const rows = check<OrderRow[]>(await supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }))
  return rows.map(toOrder)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getOrder(id: string): Promise<Order | undefined> {
  if (!UUID_RE.test(id)) return undefined
  const rows = check<OrderRow[]>(await supabase.from('orders').select(ORDER_SELECT).eq('id', id).limit(1))
  return rows[0] && toOrder(rows[0])
}

/** Número corto para mostrar (el id completo es un uuid) */
export function orderNumber(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente_pago: 'Pendiente de pago',
  pagado: 'Pagado',
  enviado: 'Enviado',
  cancelado: 'Cancelado',
}
