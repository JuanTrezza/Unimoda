import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { cn } from '../../lib/format'
import { Icon } from './Icon'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  side?: 'left' | 'right'
  children: ReactNode
  footer?: ReactNode
  widthClass?: string
}

export function Drawer({ open, onClose, title, side = 'right', children, footer, widthClass = 'max-w-md' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(panelRef, open, onClose)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-fade-in bg-tinta/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute top-0 flex h-full w-full flex-col bg-crema-50 shadow-2xl outline-none',
          widthClass,
          side === 'right' ? 'right-0 animate-slide-in-right' : 'left-0 animate-slide-in-left',
        )}
      >
        <div className="flex items-center justify-between border-b border-tinta/10 px-5 py-3">
          <h2 id={titleId} className="font-serif text-xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="btn-icon -mr-2" aria-label={`Cerrar ${title.toLowerCase()}`}>
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="border-t border-tinta/10 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
