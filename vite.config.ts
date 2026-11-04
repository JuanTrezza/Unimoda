import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Librerías grandes en chunks propios: cambian poco, así el navegador las reusa de caché
// entre deploys. El panel de admin ya va aparte por React.lazy.
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('@supabase')) return 'supabase'
  if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
  return undefined
}

// GitHub Pages sirve el sitio en https://<usuario>.github.io/Unimoda/
export default defineConfig({
  base: '/Unimoda/',
  plugins: [react()],
  build: {
    rollupOptions: { output: { manualChunks } },
  },
  server: {
    // El sitio viejo vive en legacy/ y no forma parte de la app
    watch: { ignored: ['**/legacy/**'] },
  },
})
