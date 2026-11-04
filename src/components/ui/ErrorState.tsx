import { cn } from '../../lib/format'
import { Icon } from './Icon'

interface Props {
  /** Qué no se pudo cargar, p. ej. "los productos" */
  what: string
  onRetry: () => void
  /** Versión chica, para una sección dentro de una página */
  compact?: boolean
}

/** Estado de error de carga (sin conexión o falla de Supabase) con botón para reintentar. */
export function ErrorState({ what, onRetry, compact }: Props) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-sm bg-crema-200/60 px-6 text-center', compact ? 'py-10' : 'py-20')}>
      <p className={cn('font-serif', compact ? 'text-2xl' : 'text-3xl')}>{offline ? 'Sin conexión' : `No pudimos cargar ${what}`}</p>
      <p className="mt-3 max-w-sm text-tinta-soft">
        {offline
          ? 'Revisá tu conexión a internet y volvé a intentar.'
          : 'Hubo un problema al conectarnos con la tienda. Probá de nuevo en unos segundos.'}
      </p>
      <button type="button" onClick={onRetry} className="btn-primary mt-8">
        <Icon name="refresh" size={18} />
        Reintentar
      </button>
    </div>
  )
}
