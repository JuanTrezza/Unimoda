import { Suspense, useEffect, useRef, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { CartDrawer } from '../cart/CartDrawer'
import { ErrorBoundary } from '../ErrorBoundary'
import { Toaster } from '../ui/Toaster'

/** Layout de la tienda. `children` reemplaza al Outlet cuando se usa fuera de una ruta anidada. */
export function Layout({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // Al cambiar de página: scroll arriba y foco en el contenido (no al cambiar solo los filtros)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo({ top: 0 })
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenido"
        onClick={(e) => {
          e.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only z-[70] rounded bg-tinta px-4 py-3 text-crema-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <Header />
      <main id="contenido" ref={mainRef} tabIndex={-1} className="min-h-screen flex-1 outline-none">
        {/* key: un error en una página no se arrastra a la siguiente */}
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<div className="container-site h-80 py-16" aria-busy="true" />}>{children ?? <Outlet />}</Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <CartDrawer />
      <Toaster />
    </div>
  )
}
