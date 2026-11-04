import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { getSupabase } from '../lib/getSupabase'

interface SessionState {
  /** 'loading' hasta que auth-js lee la sesión guardada (o la del link del email) */
  status: 'loading' | 'authenticated' | 'anonymous'
  session: Session | null
  user: User | null
}

/** Sesión de Supabase Auth. La fuente de verdad es auth-js (localStorage); esto solo la refleja. */
export const useSession = create<SessionState>()(() => ({ status: 'loading', session: null, user: null }))

/**
 * El claim viene en app_metadata (solo editable con service_role / SQL). Esto es solo para
 * la UI: lo que el admin puede hacer de verdad lo decide RLS con private.is_admin().
 */
export const isAdminUser = (user: User | null | undefined) => user?.app_metadata?.role === 'admin'

let listening = false

/** Se llama una vez al iniciar la app. El carrito no depende de la sesión: se mantiene al ingresar o salir. */
export function listenToSession() {
  if (listening) return
  listening = true
  // INITIAL_SESSION llega apenas termina la inicialización, después cada SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED.
  // No llamar a supabase.auth dentro del callback (auth-js lo desaconseja: puede trabarse).
  getSupabase().then(
    (supabase) => {
      supabase.auth.onAuthStateChange((_event, session) => {
        useSession.setState({
          status: session ? 'authenticated' : 'anonymous',
          session,
          user: session?.user ?? null,
        })
      })
    },
    // Sin conexión al cargar el chunk, o faltan las variables de entorno: la tienda sigue sin sesión
    (error: unknown) => {
      console.error(error)
      useSession.setState({ status: 'anonymous' })
    },
  )
}
