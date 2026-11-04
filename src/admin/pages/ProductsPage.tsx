import { useEffect, useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorState } from '../../components/ui/ErrorState'
import { Icon } from '../../components/ui/Icon'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import { DataTable } from '../components'
import { listAdminProducts } from '../services'

const FILTERS = { todos: 'Todos', activos: 'Activos', inactivos: 'Inactivos' } as const
type ActiveFilter = keyof typeof FILTERS

export function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const active = (Object.keys(FILTERS).find((k) => k === params.get('estado')) ?? 'todos') as ActiveFilter
  const [term, setTerm] = useState(search)
  const searchId = useId()
  const filterId = useId()

  const products = useAsync(`admin:products:${params.toString()}`, () => listAdminProducts({ search, active }), {
    keepPrevious: true,
  })

  const update = (key: string, value: string | undefined) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        value ? next.set(key, value) : next.delete(key)
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    if (term.trim() === search) return
    const t = window.setTimeout(() => update('q', term.trim() || undefined), 300)
    return () => window.clearTimeout(t)
  }, [term])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl md:text-5xl">Productos</h1>
        <Link to="/admin/productos/nuevo" className="btn-primary">
          <Icon name="plus" size={18} /> Nuevo producto
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            Buscar productos
          </label>
          <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-muted" />
          <input
            id={searchId}
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nombre, material o color"
            className="input pl-11"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor={filterId} className="sr-only">
            Mostrar
          </label>
          <select
            id={filterId}
            value={active}
            onChange={(e) => update('estado', e.target.value === 'todos' ? undefined : e.target.value)}
            className="input sm:w-48"
          >
            {Object.entries(FILTERS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6" aria-busy={products.loading}>
        {products.error ? (
          <ErrorState what="los productos" onRetry={products.retry} />
        ) : !products.data ? (
          <div className="h-60 animate-pulse rounded-sm bg-crema-200" />
        ) : (
          <>
            <p className="mb-3 text-sm text-tinta-muted" aria-live="polite">
              {products.data.length} {products.data.length === 1 ? 'producto' : 'productos'}
            </p>
            <DataTable
              caption="Productos"
              rows={products.data}
              rowKey={(p) => p.id}
              empty="No hay productos con esos filtros."
              columns={[
                {
                  key: 'producto',
                  label: 'Producto',
                  render: (p) => (
                    <span className="flex items-center gap-3 text-left">
                      <span className="block h-14 w-11 shrink-0 overflow-hidden rounded-sm bg-crema-200">
                        {p.thumb && <img src={p.thumb} alt="" width={44} height={56} loading="lazy" className="h-full w-full object-cover" />}
                      </span>
                      <Link to={`/admin/productos/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                        {p.name}
                      </Link>
                    </span>
                  ),
                  hideLabelOnCard: true,
                },
                { key: 'categoria', label: 'Categoría', render: (p) => p.categoryName },
                { key: 'precio', label: 'Precio', className: 'tabular-nums', render: (p) => formatPrice(p.price) },
                {
                  key: 'stock',
                  label: 'Stock',
                  className: 'tabular-nums',
                  render: (p) => <span className={p.stock === 0 ? 'text-terracota-dark' : ''}>{p.stock}</span>,
                },
                {
                  key: 'estado',
                  label: 'Estado',
                  render: (p) =>
                    p.isActive ? (
                      <span className="badge bg-salvia/20">Activo</span>
                    ) : (
                      <span className="badge bg-crema-200 text-tinta-muted">Inactivo</span>
                    ),
                },
              ]}
            />
          </>
        )}
      </div>
    </>
  )
}
