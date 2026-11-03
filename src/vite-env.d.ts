/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** https://<proyecto>.supabase.co — ver .env.example */
  readonly VITE_SUPABASE_URL?: string
  /** Publishable key (sb_publishable_…): es pública por diseño, la protección la da RLS */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
