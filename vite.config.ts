import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages sirve el sitio en https://<usuario>.github.io/Unimoda/
export default defineConfig({
  base: '/Unimoda/',
  plugins: [react()],
  server: {
    // El sitio viejo vive en legacy/ y no forma parte de la app
    watch: { ignored: ['**/legacy/**'] },
  },
})
