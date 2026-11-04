import { NavLink, Route, Routes } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { cn } from '../lib/format'
import { NotFoundPage } from '../pages/NotFoundPage'
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

/** Panel de administración. Se carga con React.lazy en su propio chunk (ver App.tsx). */
export function AdminApp() {
  return (
    <div className="container-site pb-20 pt-6 md:pt-10">
      <Seo title="Panel" />
      <p className="eyebrow">Administración</p>
      <nav aria-label="Panel" className="mt-3 overflow-x-auto border-b border-tinta/10">
        <ul className="flex gap-1 pb-3">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm',
                    isActive ? 'bg-tinta text-crema-50' : 'hover:bg-crema-200',
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-8">
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
      </div>
    </div>
  )
}
