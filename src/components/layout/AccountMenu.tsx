import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isAdminUser, useSession } from '../../store/session'
import { toast } from '../../store/toast'
import { Icon } from '../ui/Icon'

/** "Ingresar" sin sesión; con sesión, un botón que despliega Mi cuenta / Mis pedidos / Cerrar sesión. */
export function AccountMenu() {
  const { status, user } = useSession()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const location = useLocation()
  const navigate = useNavigate()

  // Se cierra al navegar, con Escape (vuelve el foco al botón) o al tocar afuera
  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (status !== 'authenticated') {
    const here = location.pathname + location.search
    const back = here.startsWith('/ingresar') || here === '/' ? '' : `?volver=${encodeURIComponent(here)}`
    return (
      <Link to={`/ingresar${back}`} className="btn-icon" aria-label="Ingresar">
        <Icon name="user" />
      </Link>
    )
  }

  const name = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="btn-icon relative"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Mi cuenta"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="user" />
        <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-terracota" aria-hidden="true" />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 w-56 rounded-sm border border-tinta/10 bg-crema-50 py-2 shadow-xl"
      >
        <p className="truncate px-4 py-2 text-xs text-tinta-muted">{name ? `Hola, ${name}` : user?.email}</p>
        <ul>
          <li>
            <Link to="/cuenta" className="flex min-h-11 items-center px-4 text-sm hover:bg-crema-200">
              Mi cuenta
            </Link>
          </li>
          <li>
            <Link to="/cuenta/pedidos" className="flex min-h-11 items-center px-4 text-sm hover:bg-crema-200">
              Mis pedidos
            </Link>
          </li>
          {isAdminUser(user) && (
            <li>
              <Link to="/admin" className="flex min-h-11 items-center px-4 text-sm hover:bg-crema-200">
                Panel de administración
              </Link>
            </li>
          )}
          <li>
            <button
              type="button"
              className="flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-crema-200"
              onClick={async () => {
                setOpen(false)
                // Dinámico: services/account y supabase-js no van en el bundle principal
                const { signOut } = await import('../../services/account')
                await signOut()
                toast('Cerraste sesión. Tu carrito sigue guardado.', { tone: 'info' })
                navigate('/')
              }}
            >
              Cerrar sesión
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
