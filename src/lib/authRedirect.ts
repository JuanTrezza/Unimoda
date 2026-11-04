/**
 * Callback de los emails de Supabase (confirmar cuenta, recuperar contraseña) con HashRouter.
 *
 * GitHub Pages no reescribe rutas, por eso usamos URLs con hash (/Unimoda/#/cuenta). Con PKCE,
 * Supabase vuelve a `redirectTo` agregando ?code=… en la QUERY, que va antes del hash:
 *
 *   https://juantrezza.github.io/Unimoda/?auth=recovery&code=abc
 *
 * 1. `redirectTo` apunta a la raíz del sitio con ?auth=<tipo> (no a una ruta con #, porque
 *    Supabase agregaría ?code= detrás del hash y quedaría como parte de la ruta).
 * 2. Antes de montar React, esperamos a que auth-js canjee el código por la sesión
 *    (supabase.auth.initialize()).
 * 3. Reemplazamos la URL por la ruta con hash que corresponde, sin query, y recién ahí
 *    se monta el HashRouter. El ?code= no queda en el historial.
 *
 * Si el link se abre en otro navegador no está el code verifier de PKCE y no hay sesión: el
 * email igual quedó confirmado (Supabase lo confirma antes de redirigir), así que mandamos a
 * Ingresar con un aviso. Para recuperar contraseña hay que abrirlo en el mismo navegador.
 */
import { getSupabase } from './getSupabase'

export type AuthRedirectType = 'signup' | 'recovery'

/** URL que se manda como emailRedirectTo / redirectTo. Tiene que estar en Auth → URL Configuration. */
export function authRedirectUrl(type: AuthRedirectType): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?auth=${type}`
}

/** Avisos que muestran Ingresar / Olvidé mi contraseña según cómo terminó el callback (?aviso=) */
export type AuthNotice = 'email-confirmado' | 'enlace-vencido' | 'otro-navegador' | 'bienvenida'

function targetFor(type: string | null, hasSession: boolean, failed: boolean): string {
  if (type === 'recovery') {
    if (failed) return '/olvide-contrasena?aviso=enlace-vencido'
    return hasSession ? '/nueva-contrasena' : '/olvide-contrasena?aviso=otro-navegador'
  }
  if (failed) return '/ingresar?aviso=enlace-vencido'
  return hasSession ? '/cuenta?aviso=bienvenida' : '/ingresar?aviso=email-confirmado'
}

/** Se llama una vez antes de montar la app. Si la URL no es un callback, no hace nada. */
export async function handleAuthRedirect(): Promise<void> {
  const url = new URL(window.location.href)
  const query = url.searchParams
  // Errores de Supabase pueden venir en la query o en el hash (#error=…&error_code=otp_expired)
  const hashParams = /^#(error|access_token)=/.test(url.hash) ? new URLSearchParams(url.hash.slice(1)) : null
  const type = query.get('auth')
  const isCallback = Boolean(type || query.has('code') || query.has('error') || hashParams)
  if (!isCallback) return

  const supabase = await getSupabase()
  const { error } = await supabase.auth.initialize()
  const { data } = await supabase.auth.getSession()
  const failed = Boolean(error || query.has('error') || hashParams?.has('error'))
  const target = targetFor(type, data.session !== null, failed && data.session === null)

  window.history.replaceState(null, '', `${import.meta.env.BASE_URL}#${target}`)
}
