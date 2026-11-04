import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Icon } from '../components/ui/Icon'
import { Toaster } from '../components/ui/Toaster'
import { cn } from '../lib/format'
import { NotFoundPage } from '../pages/NotFoundPage'
import { signOut } from '../services/account'
import { toast } from '../store/toast'
import { DashboardPage } from './pages/DashboardPage'
import { MessagesPage } from './pages/MessagesPage'
import { OrderPage } from './pages/OrderPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductEditPage } from './pages/ProductEditPage'
import { ProductsPage } from './pages/ProductsPage'
import { SubscribersPage } from './pages/SubscribersPage'

const NAV = [
  { to: '/admin', label: 'Resumen', end: true },
  { to: '/admin/productos', label: 'Productos', end: false },
  { to: '/admin/pedidos', label: 'Pedidos', end: false },
  { to: '/admin/mensajes', label: 'Mensajes', end: false },
  { to: '/admin/suscriptores', label: 'Suscriptores', end: false },
]

const linkClass = 'flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm'

/**
 * Panel de administración, con layout propio y en su propio chunk (ver App.tsx).
 * Desktop: menú lateral fijo. Mobile: barra que despliega el menú; no es sticky, así que
 * ningún header puede tapar el título de una sección.
 */
export function AdminApp() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)
  const menuId = useId()

  useEffect(() => {
    setMenuOpen(false)
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo({ top: 0 })
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  const section = [...NAV].reverse().find((item) => pathname.startsWith(item.to))?.label ?? 'Panel'

  return (
    <div className="min-h-screen bg-crema lg:pl-64">
      <Seo title={`${section} · Panel`} description="Panel de administración de Unimoda." noindex />
      <a
        href="#panel-contenido"
        onClick={(e) => {
          e.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only z-[70] rounded bg-tinta px-4 py-3 text-crema-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <aside className="border-b border-tinta/10 bg-crema-50 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-4 lg:h-auto lg:px-6 lg:pb-4 lg:pt-8">
          <div>
            <p className="font-serif text-2xl leading-none tracking-tight">Unimoda</p>
            <p className="eyebrow mt-1">Panel</p>
          </div>
          <button
            type="button"
            className="btn-icon -mr-2 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Cerrar menú del panel' : 'Abrir menú del panel'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>

        <div id={menuId} className={cn('px-3 pb-4 lg:flex lg:flex-1 lg:flex-col', !menuOpen && 'hidden')}>
          <nav aria-label="Panel">
            <ul className="space-y-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) => cn(linkClass, isActive ? 'bg-tinta text-crema-50' : 'hover:bg-crema-200')}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <ul className="mt-4 space-y-1 border-t border-tinta/10 pt-4 lg:mt-auto">
            <li>
              <Link to="/" className={cn(linkClass, 'hover:bg-crema-200')}>
                Ver tienda
              </Link>
            </li>
            <li>
              <button
                type="button"
                className={cn(linkClass, 'hover:bg-crema-200')}
                onClick={async () => {
                  // Primero se sale del panel: sin sesión, /admin mostraría el 404
                  navigate('/')
                  await signOut()
                  toast('Cerraste sesión.', { tone: 'info' })
                }}
              >
                Cerrar sesión
              </button>
            </li>
          </ul>
        </div>
      </aside>

      <main id="panel-contenido" ref={mainRef} tabIndex={-1} className="mx-auto max-w-site px-4 pb-20 pt-6 outline-none sm:px-6 lg:px-10 lg:pt-10">
        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="productos" element={<ProductsPage />} />
          <Route path="productos/nuevo" element={<ProductEditPage />} />
          <Route path="productos/:id" element={<ProductEditPage />} />
          <Route path="pedidos" element={<OrdersPage />} />
          <Route path="pedidos/:id" element={<OrderPage />} />
          <Route path="mensajes" element={<MessagesPage />} />
          <Route path="suscriptores" element={<SubscribersPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  )
}
