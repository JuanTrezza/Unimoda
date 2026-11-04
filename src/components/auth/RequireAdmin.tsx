import type { ReactNode } from 'react'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { isAdminUser, useSession } from '../../store/session'

/**
 * Rutas /admin/*: sin el claim de admin se ve la página 404, como si no existieran
 * (no un "acceso denegado" que confirme que el panel está ahí).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, user } = useSession()
  if (status === 'loading') return <div className="container-site h-80 py-16" aria-busy="true" />
  if (!isAdminUser(user)) return <NotFoundPage />
  return children
}
