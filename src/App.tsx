import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { RequireAdmin } from './components/auth/RequireAdmin'
import { RequireAuth } from './components/auth/RequireAuth'
import { HomePage } from './pages/HomePage'
import { ShopPage } from './pages/ShopPage'
import { ProductPage } from './pages/ProductPage'
import { CartPage } from './pages/CartPage'
import { WishlistPage } from './pages/WishlistPage'
import { AboutPage } from './pages/AboutPage'
import { ContactPage } from './pages/ContactPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { LoginPage } from './pages/auth/LoginPage'
import { SignUpPage } from './pages/auth/SignUpPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { AccountPage } from './pages/account/AccountPage'
import { OrdersPage } from './pages/account/OrdersPage'
import { OrderDetailPage } from './pages/account/OrderDetailPage'
import { CheckoutPage } from './pages/checkout/CheckoutPage'
import { OrderConfirmationPage } from './pages/checkout/OrderConfirmationPage'

// El panel va en un chunk aparte: los clientes nunca lo descargan
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })))

// HashRouter: GitHub Pages no reescribe rutas al index.html.
// Los links de los emails de Supabase vuelven a la raíz con ?code=; ver lib/authRedirect.ts.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="tienda" element={<ShopPage />} />
          <Route path="producto/:slug" element={<ProductPage />} />
          <Route path="carrito" element={<CartPage />} />
          <Route path="favoritos" element={<WishlistPage />} />
          <Route path="nosotros" element={<AboutPage />} />
          <Route path="contacto" element={<ContactPage />} />
          <Route path="ingresar" element={<LoginPage />} />
          <Route path="crear-cuenta" element={<SignUpPage />} />
          <Route path="olvide-contrasena" element={<ForgotPasswordPage />} />
          <Route path="nueva-contrasena" element={<ResetPasswordPage />} />
          <Route element={<RequireAuth />}>
            <Route path="cuenta" element={<AccountPage />} />
            <Route path="cuenta/pedidos" element={<OrdersPage />} />
            <Route path="cuenta/pedidos/:id" element={<OrderDetailPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="checkout/confirmado/:id" element={<OrderConfirmationPage />} />
          </Route>
          <Route
            path="admin/*"
            element={
              <RequireAdmin>
                <Suspense fallback={<div className="container-site h-80 py-16" aria-busy="true" />}>
                  <AdminApp />
                </Suspense>
              </RequireAdmin>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
