import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import type { FilterOptions, ProductQuery } from '../../types'
import { cn, formatPrice } from '../../lib/format'
import { Icon } from '../ui/Icon'

interface Props {
  options: FilterOptions
  query: ProductQuery
  update: (changes: Record<string, string | string[] | number | undefined>) => void
  toggleInList: (key: 'talle' | 'color', value: string) => void
}

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: `Hasta ${formatPrice(50000)}`, max: 50000 },
  { label: `${formatPrice(50000)} a ${formatPrice(90000)}`, min: 50000, max: 90000 },
  { label: `${formatPrice(90000)} a ${formatPrice(150000)}`, min: 90000, max: 150000 },
  { label: `Más de ${formatPrice(150000)}`, min: 150000 },
]

function Group({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  const id = useId()
  return (
    <fieldset className="border-b border-tinta/10 py-5">
      <legend className="contents">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 w-full items-center justify-between text-sm font-medium"
        >
          {title}
          <Icon name="chevronDown" size={18} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </legend>
      <div id={id} hidden={!open} className="pt-2">
        {children}
      </div>
    </fieldset>
  )
}

export function Filters({ options, query, update, toggleInList }: Props) {
  const [min, setMin] = useState(query.minPrice?.toString() ?? '')
  const [max, setMax] = useState(query.maxPrice?.toString() ?? '')
  const minId = useId()
  const maxId = useId()

  // Si la URL cambia desde afuera (chips, limpiar), sincronizar los inputs
  useEffect(() => {
    setMin(query.minPrice?.toString() ?? '')
    setMax(query.maxPrice?.toString() ?? '')
  }, [query.minPrice, query.maxPrice])

  const applyPrice = (e: FormEvent) => {
    e.preventDefault()
    let lo = min ? Number(min) : undefined
    let hi = max ? Number(max) : undefined
    if (lo !== undefined && hi !== undefined && lo > hi) [lo, hi] = [hi, lo]
    update({ min: lo, max: hi })
  }

  return (
    <div>
      <Group title="Categoría">
        <ul className="space-y-0.5">
          {[{ id: undefined, name: 'Todas' }, ...options.categories].map((c) => {
            const active = query.category === c.id
            return (
              <li key={c.id ?? 'all'}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="categoria"
                    checked={active}
                    onChange={() => update({ categoria: c.id })}
                    className="h-4 w-4 accent-terracota"
                  />
                  {c.name}
                </label>
              </li>
            )
          })}
        </ul>
      </Group>

      <Group title="Talle">
        <div className="flex flex-wrap gap-2">
          {options.sizes.map((s) => {
            const active = query.sizes?.includes(s) ?? false
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => toggleInList('talle', s)}
                className={cn(
                  'h-11 min-w-11 rounded-full border px-3 text-sm transition-colors',
                  active ? 'border-tinta bg-tinta text-crema-50' : 'border-tinta/20 hover:border-tinta',
                )}
              >
                {s}
              </button>
            )
          })}
        </div>
      </Group>

      <Group title="Color">
        <div className="grid grid-cols-2 gap-1">
          {options.colors.map((c) => {
            const active = query.colors?.includes(c.id) ?? false
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleInList('color', c.id)}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors',
                  active ? 'bg-crema-200 font-medium' : 'hover:bg-crema-200/60',
                )}
              >
                <span
                  className={cn(
                    'h-5 w-5 shrink-0 rounded-full ring-1 ring-tinta/20',
                    active && 'ring-2 ring-tinta ring-offset-2 ring-offset-crema',
                  )}
                  style={{ backgroundColor: c.hex }}
                  aria-hidden="true"
                />
                {c.name}
              </button>
            )
          })}
        </div>
      </Group>

      <Group title="Precio">
        <ul className="space-y-0.5">
          {PRICE_PRESETS.map((p) => {
            const active = query.minPrice === p.min && query.maxPrice === p.max
            return (
              <li key={p.label}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="precio"
                    checked={active}
                    onChange={() => update({ min: p.min, max: p.max })}
                    className="h-4 w-4 accent-terracota"
                  />
                  {p.label}
                </label>
              </li>
            )
          })}
        </ul>
        <form onSubmit={applyPrice} className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor={minId} className="mb-1 block text-xs text-tinta-muted">
              Mínimo
            </label>
            <input
              id={minId}
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder={String(options.priceRange.min)}
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="input min-h-11 px-3 text-sm"
            />
          </div>
          <div className="flex-1">
            <label htmlFor={maxId} className="mb-1 block text-xs text-tinta-muted">
              Máximo
            </label>
            <input
              id={maxId}
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder={String(options.priceRange.max)}
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="input min-h-11 px-3 text-sm"
            />
          </div>
          <button type="submit" className="btn-icon shrink-0 border border-tinta/20" aria-label="Aplicar rango de precio">
            <Icon name="arrowRight" size={18} />
          </button>
        </form>
      </Group>
    </div>
  )
}
