import type { ReactNode } from 'react'
import { Modal } from '../components/ui/Modal'
import { cn } from '../lib/format'

export interface Column<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  className?: string
  /** Oculta la etiqueta en la vista de tarjeta (p. ej. la columna de acciones) */
  hideLabelOnCard?: boolean
}

/**
 * Tabla que en mobile pasa a tarjetas (.rtable en index.css). Los roles ARIA explícitos
 * mantienen la semántica de tabla aunque el CSS cambie el display de las filas.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
}: {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  empty: string
}) {
  if (!rows.length) return <p className="rounded-sm bg-crema-200/60 px-6 py-12 text-center text-tinta-soft">{empty}</p>
  return (
    <table role="table" className="rtable">
      <caption className="sr-only">{caption}</caption>
      <thead role="rowgroup">
        <tr role="row">
          {columns.map((c) => (
            <th key={c.key} role="columnheader" scope="col" className={c.className}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((row) => (
          <tr key={rowKey(row)} role="row">
            {columns.map((c) => (
              <td key={c.key} role="cell" data-label={c.hideLabelOnCard ? '' : c.label} className={c.className}>
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-tinta-soft">{children}</div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={onConfirm} disabled={busy}>
          {busy ? 'Un momento…' : confirmLabel}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Volver
        </button>
      </div>
    </Modal>
  )
}

export function Pagination({
  page,
  total,
  pageSize,
  onChange,
  label,
}: {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
  label: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav aria-label={`Páginas de ${label}`} className="mt-6 flex items-center justify-between gap-4 text-sm">
      <button type="button" className="btn-outline min-h-11 px-5" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <p aria-live="polite">
        Página {page + 1} de {pages}
      </p>
      <button
        type="button"
        className="btn-outline min-h-11 px-5"
        disabled={page >= pages - 1}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-sm bg-crema-50 p-5">
      <p className="text-sm text-tinta-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl tabular-nums">{value}</p>
      {hint && <div className="mt-2 text-sm">{hint}</div>}
    </div>
  )
}

export function Panel({ title, children, className, actions }: { title: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className={cn('rounded-sm bg-crema-50 p-5 md:p-6', className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="font-serif text-2xl">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  )
}
