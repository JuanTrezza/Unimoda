import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  const missing = [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter(Boolean).join(' y ')
  throw new Error(
    `Falta configurar ${missing}. Copiá .env.example a .env.local y completalo con los datos de tu proyecto ` +
      '(Supabase → Project Settings → API). En GitHub Actions se toman de los secrets del repo.',
  )
}

/**
 * PKCE: los links de los emails vuelven con ?code=… en la query (antes del #), así que no
 * chocan con las rutas del HashRouter. auth-js canjea el código al iniciar; el resto del
 * callback (a qué ruta ir, limpiar la URL) lo resuelve src/lib/authRedirect.ts.
 */
export const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'unimoda-auth',
  },
})
