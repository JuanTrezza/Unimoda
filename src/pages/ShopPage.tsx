import { useEffect, useId, useState } from 'react'
import { Seo } from '../components/Seo'
import { ProductGrid } from '../components/product/ProductCard'
import { Filters } from '../components/shop/Filters'
import { Drawer } from '../components/ui/Drawer'
import { ErrorState } from '../components/ui/ErrorState'
import { Icon } from '../components/ui/Icon'
import { useAsync } from '../hooks/useAsync'
import { useShopParams } from '../hooks/useShopParams'
import { getFilterOptions, getProducts } from '../services/catalog'
import { CATEGORIES } from '../data/categories'
import { formatPrice } from '../lib/format'
import type { SortOption } from '../types'

const SORT_LABELS: Record<SortOption, string> = {
  relevancia: 'Relevancia',
  novedades: 'Novedades',
  'precio-asc': 'Precio: menor a mayor',
  'precio-desc': 'Precio: mayor a menor',
}

export function ShopPage() {
  const { query, key, update, toggleInList, clear, activeCount } = useShopParams()
  const products = useAsync(`products:${key}`, () => getProducts(query), { keepPrevious: true })
  const options = useAsync('filter-options', getFilterOptions)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState(query.search ?? '')
  const searchId = useId()
  const sortId = useId()

  // Búsqueda con debounce hacia la URL
  useEffect(() => {
    setSearch(query.search ?? '')
  }, [query.search])
  useEffect(() => {
    const value = search.trim()
    if (value === (query.search ?? '')) return
    const t = window.setTimeout(() => update({ q: value || undefined }), 300)
    return () => window.clearTimeout(t)
  }, [search, query.search, update])

  const category = CATEGORIES.find((c) => c.id === query.category)
  const count = products.data?.length ?? 0
  const refreshing = products.loading && products.data !== undefined
  const failed = products.error !== undefined || options.error !== undefined
  const retry = () => {
    if (products.error) products.retry()
    if (options.error) options.retry()
  }
  const title = category?.name ?? (query.search ? `Resultados para “${query.search}”` : 'Tienda')

  const chips: { label: string; remove: () => void }[] = []
  if (category) chips.push({ label: category.name, remove: () => update({ categoria: undefined }) })
  query.sizes?.forEach((s) => chips.push({ label: `Talle ${s}`, remove: () => toggleInList('talle', s) }))
  query.colors?.forEach((id) => {
    const color = options.data?.colors.find((c) => c.id === id)
    chips.push({ label: color?.name ?? id, remove: () => toggleInList('color', id) })
  })
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const label =
      query.minPrice !== undefined && query.maxPrice !== undefined
        ? `${formatPrice(query.minPrice)} a ${formatPrice(query.maxPrice)}`
        : query.minPrice !== undefined
          ? `Desde ${formatPrice(query.minPrice)}`
          : `Hasta ${formatPrice(query.maxPrice!)}`
    chips.push({ label, remove: () => update({ min: undefined, max: undefined }) })
  }
  if (query.search) chips.push({ label: `“${query.search}”`, remove: () => update({ q: undefined }) })

  const filters = options.data && (
    <Filters options={options.data} query={query} update={update} toggleInList={toggleInList} />
  )

  return (
    <div className="container-site pb-20 pt-8 md:pt-12">
      <Seo
        title={category ? `${category.name} de mujer` : 'Tienda'}
        description={
          category
            ? `${category.name} de mujer en Unimoda. ${category.description} Envíos a todo el país y 6 cuotas sin interés.`
            : 'Toda la colección de Unimoda: vestidos, blusas, pantalones, faldas, abrigos y tejidos. Filtrá por talle, color y precio.'
        }
      />

      <header className="mb-8 md:mb-10">
        <p className="eyebrow">{category ? 'Categoría' : 'Colección'}</p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl">{title}</h1>
        {category && <p className="mt-3 max-w-xl text-tinta-soft">{category.description}</p>}
      </header>

      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-12">
        <aside aria-label="Filtros" className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-editorial">Filtros</h2>
              {activeCount > 0 && (
                <button type="button" onClick={clear} className="min-h-11 text-xs underline underline-offset-4">
                  Limpiar
                </button>
              )}
            </div>
            {filters}
          </div>
        </aside>

        <div className="min-w-0">
          {/* Barra de herramientas */}
          <div className="flex flex-col gap-3 border-b border-tinta/10 pb-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <label htmlFor={searchId} className="sr-only">
                Buscar en la tienda
              </label>
              <Icon
                name="search"
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-muted"
              />
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar prendas"
                className="input pl-11"
                autoComplete="off"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="btn-outline min-h-12 flex-1 px-5 lg:hidden"
                aria-haspopup="dialog"
              >
                <Icon name="filter" size={18} />
                Filtros{activeCount > 0 && ` (${activeCount})`}
              </button>
              <label htmlFor={sortId} className="sr-only">
                Ordenar por
              </label>
              <div className="relative flex-1 sm:flex-none">
                <select
                  id={sortId}
                  value={query.sort}
                  onChange={(e) => update({ orden: e.target.value })}
                  className="input appearance-none pr-10 text-sm sm:w-60"
                >
                  {Object.entries(SORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Icon
                  name="chevronDown"
                  size={18}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 py-4">
            <p className="mr-2 text-sm text-tinta-muted" aria-live="polite" aria-atomic="true">
              {failed ? '' : products.loading && !refreshing ? 'Buscando…' : `${count} ${count === 1 ? 'producto' : 'productos'}`}
            </p>
            {chips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.remove}
                className="inline-flex min-h-11 items-center gap-1 rounded-full bg-crema-200 py-1 pl-4 pr-3 text-sm hover:bg-crema-300"
                aria-label={`Quitar filtro ${chip.label}`}
              >
                {chip.label}
                <Icon name="close" size={14} />
              </button>
            ))}
            {chips.length > 1 && (
              <button type="button" onClick={clear} className="min-h-11 px-2 text-sm underline underline-offset-4">
                Limpiar todo
              </button>
            )}
          </div>

          {failed ? (
            <ErrorState what="los productos" onRetry={retry} />
          ) : products.data && count === 0 ? (
            <div className="flex flex-col items-center rounded-sm bg-crema-200/60 px-6 py-20 text-center">
              <p className="font-serif text-3xl">No encontramos prendas</p>
              <p className="mt-3 max-w-sm text-tinta-soft">
                Probá con otra búsqueda o quitá algunos filtros para ver más resultados.
              </p>
              <button type="button" onClick={clear} className="btn-primary mt-8">
                Ver toda la tienda
              </button>
            </div>
          ) : (
            <div className={refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={products.loading}>
              <ProductGrid products={products.data} loading={!products.data} />
            </div>
          )}
        </div>
      </div>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        side="right"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={clear} className="btn-outline flex-1" disabled={activeCount === 0}>
              Limpiar
            </button>
            <button type="button" onClick={() => setFiltersOpen(false)} className="btn-primary flex-1 whitespace-nowrap px-4">
              Ver resultados ({count})
            </button>
          </div>
        }
      >
        <div className="px-5">{filters}</div>
      </Drawer>
    </div>
  )
}
