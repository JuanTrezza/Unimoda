import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// npm run docs:screenshots: regenera docs/screenshots/. Va aparte para que test:e2e no reescriba
// archivos versionados. Usa el mismo build con Supabase mockeado: nunca toca la base real.
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: 'docs-screenshots.spec.ts',
  projects: [{ name: 'docs' }],
  timeout: 120_000,
})
