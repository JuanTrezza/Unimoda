import { Link } from 'react-router-dom'
import { ErrorState } from '../../components/ui/ErrorState'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import { DataTable, Panel, StatCard } from '../components'
import { getDashboard, type Dashboard } from '../services'

export function DashboardPage() {
  const dashboard = useAsync('admin:dashboard', getDashboard)

  return (
    <>
      <h1 className="font-serif text-4xl md:text-5xl">Resumen</h1>
      <div className="mt-8">
        {dashboard.error ? (
          <ErrorState what="el resumen" onRetry={dashboard.retry} />
        ) : !dashboard.data ? (
          <div className="h-60 animate-pulse rounded-sm bg-crema-200" aria-busy="true" />
        ) : (
          <DashboardContent data={dashboard.data} />
        )}
      </div>
    </>
  )
}

function DashboardContent({ data }: { data: Dashboard }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Ventas del mes"
          value={<span data-testid="month-sales">{formatPrice(data.monthSales)}</span>}
          hint={<span className="text-tinta-muted">Solo pedidos pagados y enviados</span>}
        />
        <StatCard label="Pedidos del mes" value={data.monthOrders} />
        <StatCard
          label="Pendientes de pago"
          value={<span data-testid="pending-orders">{data.pendingOrders}</span>}
          hint={
            <Link to="/admin/pedidos?estado=pendiente_pago" className="underline underline-offset-4">
              Ver pendientes
            </Link>
          }
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Más vendidos del mes">
          {data.topProducts.length === 0 ? (
            <p className="text-tinta-soft">Todavía no hay ventas pagadas este mes.</p>
          ) : (
            <ol className="divide-y divide-tinta/10">
              {data.topProducts.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span>
                    <span className="mr-2 text-tinta-muted">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-tinta-soft">
                    {p.units} u. · {formatPrice(p.revenue)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Stock bajo">
          <DataTable
            caption="Variantes con 2 unidades o menos"
            rows={data.lowStock}
            rowKey={(r) => r.sku}
            empty="No hay variantes con stock bajo."
            columns={[
              {
                key: 'producto',
                label: 'Producto',
                render: (r) => (
                  <Link to={`/admin/productos/${r.productId}`} className="underline-offset-4 hover:underline">
                    {r.productName}
                    {!r.isActive && <span className="ml-1 text-tinta-muted">(inactivo)</span>}
                  </Link>
                ),
              },
              { key: 'variante', label: 'Variante', render: (r) => `${r.colorName} · ${r.size}` },
              {
                key: 'stock',
                label: 'Stock',
                className: 'text-right tabular-nums',
                render: (r) => <span className={r.stock === 0 ? 'font-medium text-terracota-dark' : ''}>{r.stock}</span>,
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  )
}
