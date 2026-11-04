import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/format'
import { signOut } from '../../services/account'
import { toast } from '../../store/toast'

const LINKS = [
  { to: '/cuenta', label: 'Mis datos', end: true },
  { to: '/cuenta/pedidos', label: 'Mis pedidos', end: false },
]

/** Navegación entre secciones de Mi cuenta */
export function AccountNav() {
  const navigate = useNavigate()
  return (
    <nav aria-label="Mi cuenta" className="mb-8 flex flex-wrap items-center gap-2 border-b border-tinta/10 pb-4">
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cn(
              'inline-flex min-h-11 items-center rounded-full px-4 text-sm',
              isActive ? 'bg-tinta text-crema-50' : 'hover:bg-crema-200',
            )
          }
        >
          {l.label}
        </NavLink>
      ))}
      <button
        type="button"
        className="ml-auto inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4"
        onClick={async () => {
          await signOut()
          toast('Cerraste sesión. Tu carrito sigue guardado.', { tone: 'info' })
          navigate('/')
        }}
      >
        Cerrar sesión
      </button>
    </nav>
  )
}
