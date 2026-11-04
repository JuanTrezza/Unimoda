import { lazy, Suspense, type ComponentType } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RequireAdmin } from './components/auth/RequireAdmin'
import { RequireAuth } from './components/auth/RequireAuth'
import { HomePage } from './pages/HomePage'
import { ShopPage } from './pages/ShopPage'
import { ProductPage } from './pages/ProductPage'
import { NotFoundPage } from './pages/NotFoundPage'

/** React.lazy para páginas con export nombrado */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })))
}

// Inicio, Tienda y Producto van en el bundle principal; el resto se descarga al entrar
const CartPage = page(() => import('./pages/CartPage'), 'CartPage')
const WishlistPage = page(() => import('./pages/WishlistPage'), 'WishlistPage')
const AboutPage = page(() => import('./pages/AboutPage'), 'AboutPage')
const ContactPage = page(() => import('./pages/ContactPage'), 'ContactPage')
const LoginPage = page(() => import('./pages/auth/LoginPage'), 'LoginPage')
const SignUpPage = page(() => import('./pages/auth/SignUpPage'), 'SignUpPage')
const ForgotPasswordPage = page(() => import('./pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage')
const ResetPasswordPage = page(() => import('./pages/auth/ResetPasswordPage'), 'ResetPasswordPage')
const AccountPage = page(() => import('./pages/account/AccountPage'), 'AccountPage')
const OrdersPage = page(() => import('./pages/account/OrdersPage'), 'OrdersPage')
const OrderDetailPage = page(() => import('./pages/account/OrderDetailPage'), 'OrderDetailPage')
const CheckoutPage = page(() => import('./pages/checkout/CheckoutPage'), 'CheckoutPage')
const OrderConfirmationPage = page(() => import('./pages/checkout/OrderConfirmationPage'), 'OrderConfirmationPage')
// El panel va en un chunk aparte: los clientes nunca lo descargan
const AdminApp = page(() => import('./admin/AdminApp'), 'AdminApp')

// HashRouter: GitHub Pages no reescribe rutas al index.html.
// Los links de los emails de Supabase vuelven a la raíz con ?code=; ver lib/authRedirect.ts.
export function App() {
  return (
    <HashRouter>
      <Routes>
        {/* El panel tiene su propio layout: sin la barra de anuncios ni el header de la tienda */}
        <Route
          path="admin/*"
          element={
            <RequireAdmin>
              <ErrorBoundary>
                <Suspense fallback={<div className="h-screen bg-crema" aria-busy="true" />}>
                  <AdminApp />
                </Suspense>
              </ErrorBoundary>
            </RequireAdmin>
          }
        />
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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
