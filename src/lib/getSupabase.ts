/**
 * El cliente de Supabase, cargado a demanda. supabase-js pesa 227 kB y la mayor parte no se usa
 * al arrancar: así Inicio, Tienda y Producto pintan sin esperarlo.
 *
 * Lo que está en el bundle principal (catálogo, formularios, sesión) entra por acá. Las páginas de
 * cuenta, checkout y panel ya son chunks lazy, y pueden importar lib/supabase directamente.
 */
export const getSupabase = () => import('./supabase').then((m) => m.supabase)
