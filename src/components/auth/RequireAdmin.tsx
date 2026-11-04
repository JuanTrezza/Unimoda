import type { ReactNode } from 'react'
import { Layout } from '../layout/Layout'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { isAdminUser, useSession } from '../../store/session'

/**
 * Rutas /admin/*: sin el claim de admin se ve la página 404 de la tienda, como si no existieran
 * (no un "acceso denegado" que confirme que el panel está ahí).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, user } = useSession()
  if (status === 'loading') return <div className="h-screen bg-crema" aria-busy="true" />
  if (!isAdminUser(user)) {
    return (
      <Layout>
        <NotFoundPage />
      </Layout>
    )
  }
  return children
}
