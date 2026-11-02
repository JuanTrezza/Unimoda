import { useToast } from '../../store/toast'
import { cn } from '../../lib/format'
import { Icon } from './Icon'

/** Región aria-live siempre montada: los lectores de pantalla anuncian cada toast nuevo. */
export function Toaster() {
  const toasts = useToast((s) => s.toasts)
  const dismiss = useToast((s) => s.dismiss)

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-0 sm:top-auto sm:items-end sm:p-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-xl px-4 py-3 shadow-lg',
            t.tone === 'error' ? 'bg-terracota-dark text-white' : 'bg-tinta text-crema-50',
          )}
        >
          <Icon name={t.tone === 'error' ? 'info' : 'check'} className="shrink-0" />
          <p className="flex-1 text-sm">{t.message}</p>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.onClick()
                dismiss(t.id)
              }}
              className="min-h-11 shrink-0 px-2 text-sm font-semibold underline underline-offset-4"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-80 hover:opacity-100"
            aria-label="Cerrar aviso"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
