import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../store/session'

/** Ruta de vuelta segura: solo rutas internas ("/algo"), nunca "//otro-sitio" */
export function safeReturnPath(value: string | null, fallback = '/cuenta'): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback
}

/** Envuelve rutas que necesitan sesión. Sin sesión redirige a Ingresar con ?volver=<ruta actual>. */
export function RequireAuth() {
  const status = useSession((s) => s.status)
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="container-site py-16" aria-busy="true">
        <div className="h-10 w-1/3 animate-pulse rounded bg-crema-200" />
        <div className="mt-6 h-40 animate-pulse rounded-sm bg-crema-200" />
      </div>
    )
  }
  if (status === 'anonymous') {
    const back = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/ingresar?volver=${back}`} replace />
  }
  return <Outlet />
}
