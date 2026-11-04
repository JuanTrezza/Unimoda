import { useEffect, useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { OrderStatusBadge } from '../../components/account/OrderStatusBadge'
import { ErrorState } from '../../components/ui/ErrorState'
import { Icon } from '../../components/ui/Icon'
import { useAsync } from '../../hooks/useAsync'
import { formatDate, formatPrice } from '../../lib/format'
import { ORDER_STATUS_LABEL } from '../../services/orders'
import type { OrderStatus } from '../../types'
import { DataTable, Pagination } from '../components'
import { listAdminOrders, PAGE_SIZE } from '../services'

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = STATUSES.find((s) => s === params.get('estado'))
  const search = params.get('q') ?? ''
  const page = Math.max(0, Number(params.get('pagina') ?? 1) - 1) || 0
  const [term, setTerm] = useState(search)
  const statusId = useId()
  const searchId = useId()

  const orders = useAsync(`admin:orders:${params.toString()}`, () => listAdminOrders({ status, search, page }), {
    keepPrevious: true,
  })

  const update = (changes: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k)
        if (!('pagina' in changes)) next.delete('pagina')
        return next
      },
      { replace: true },
    )

  // Búsqueda con debounce
  useEffect(() => {
    if (term.trim() === search) return
    const t = window.setTimeout(() => update({ q: term.trim() || undefined }), 300)
    return () => window.clearTimeout(t)
  }, [term])

  return (
    <>
      <h1 className="font-serif text-4xl md:text-5xl">Pedidos</h1>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            Buscar por número de pedido
          </label>
          <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-muted" />
          <input
            id={searchId}
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Número de pedido (ej. 3F2A9C1B)"
            className="input pl-11"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor={statusId} className="sr-only">
            Filtrar por estado
          </label>
          <select
            id={statusId}
            value={status ?? ''}
            onChange={(e) => update({ estado: e.target.value || undefined })}
            className="input sm:w-60"
          >
            <option value="">Todos los estados</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6" aria-busy={orders.loading}>
        {orders.error ? (
          <ErrorState what="los pedidos" onRetry={orders.retry} />
        ) : !orders.data ? (
          <div className="h-60 animate-pulse rounded-sm bg-crema-200" />
        ) : (
          <>
            <p className="mb-3 text-sm text-tinta-muted" aria-live="polite">
              {orders.data.total} {orders.data.total === 1 ? 'pedido' : 'pedidos'}
            </p>
            <DataTable
              caption="Pedidos"
              rows={orders.data.rows}
              rowKey={(o) => o.id}
              empty="No hay pedidos con esos filtros."
              columns={[
                {
                  key: 'numero',
                  label: 'Pedido',
                  render: (o) => (
                    <Link to={`/admin/pedidos/${o.id}`} className="font-medium underline underline-offset-4">
                      #{o.number}
                    </Link>
                  ),
                },
                { key: 'fecha', label: 'Fecha', render: (o) => formatDate(o.createdAt) },
                { key: 'cliente', label: 'Envío a', render: (o) => o.address.recipient || '—' },
                { key: 'estado', label: 'Estado', render: (o) => <OrderStatusBadge status={o.status} /> },
                { key: 'total', label: 'Total', className: 'text-right tabular-nums', render: (o) => formatPrice(o.total) },
              ]}
            />
            <Pagination
              page={page}
              total={orders.data.total}
              pageSize={PAGE_SIZE}
              label="pedidos"
              onChange={(p) => update({ pagina: String(p + 1) })}
            />
          </>
        )}
      </div>
    </>
  )
}
