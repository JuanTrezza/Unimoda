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

// El sitio no tiene login: sin sesión persistida ni refresco de tokens
export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
