import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/Unimoda/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-375', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  // Build aparte (dist-e2e) con una URL de Supabase falsa: los tests mockean la API con
  // page.route (tests/supabase-mock.ts) y nunca tocan la base real ni pisan dist/.
  webServer: {
    command: 'npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    env: {
      VITE_SUPABASE_URL: 'https://e2e.supabase.invalid',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e',
    },
    url: 'http://localhost:4173/Unimoda/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
