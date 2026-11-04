/**
 * Lighthouse (mobile) en Inicio, Tienda y Producto, contra `npm run preview`.
 *
 *   npm run lighthouse [-- etiqueta]
 *
 * NO usa la base real: compila a dist-lh con VITE_SUPABASE_URL apuntando a scripts/mock-api.ts.
 * Corre 3 veces cada página y toma la mediana de Performance. Reportes en lighthouse-reports/.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const API_PORT = 54399
const WEB_PORT = 4175
const RUNS = Number(process.env.LH_RUNS ?? 3)
const BASE = `http://localhost:${WEB_PORT}/Unimoda/`
const PAGES = {
  inicio: `${BASE}#/`,
  tienda: `${BASE}#/tienda`,
  producto: `${BASE}#/producto/vestido-midi-lino`,
}
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const

const label = process.argv[2] ?? 'actual'
const outDir = resolve('lighthouse-reports', label)
mkdirSync(outDir, { recursive: true })

const env = { ...process.env, VITE_SUPABASE_URL: `http://localhost:${API_PORT}`, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock' }
const run = (command: string) => spawnSync(command, { shell: true, stdio: 'inherit', env })

async function waitFor(url: string) {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error(`No respondió ${url}`)
}

const servers: ChildProcess[] = []
const kill = () => {
  for (const s of servers) if (s.pid) spawnSync(`taskkill /pid ${s.pid} /T /F`, { shell: true, stdio: 'ignore' })
}

try {
  if (run('npx vite build --outDir dist-lh --emptyOutDir --logLevel warn').status !== 0) throw new Error('Falló el build')
  servers.push(spawn('npx tsx scripts/mock-api.ts', [String(API_PORT)], { shell: true, stdio: 'ignore', env }))
  servers.push(spawn(`npm run preview -- --outDir dist-lh --port ${WEB_PORT} --strictPort`, { shell: true, stdio: 'ignore', env }))
  await waitFor(`http://localhost:${API_PORT}/rest/v1/categories`)
  await waitFor(BASE)

  const results: Record<string, Record<string, number>> = {}
  for (const [name, url] of Object.entries(PAGES)) {
    const runs: Record<string, number>[] = []
    for (let i = 1; i <= RUNS; i++) {
      const file = join(outDir, `${name}-${i}.json`)
      // Lighthouse a veces falla al borrar su carpeta temporal en Windows, después de escribir el reporte
      spawnSync(
        `npx --yes lighthouse@12 "${url}" --quiet --output=json --output-path="${file}" --only-categories=${CATEGORIES.join(',')} --chrome-flags="--headless=new --no-sandbox"`,
        { shell: true, stdio: 'ignore', env: { ...env, CHROME_PATH: chromium.executablePath() } },
      )
      if (!existsSync(file)) throw new Error(`Lighthouse no generó ${file}`)
      const report = JSON.parse(readFileSync(file, 'utf8')) as { categories: Record<string, { score: number | null }> }
      runs.push(Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((report.categories[c]?.score ?? 0) * 100)])))
    }
    const sorted = [...runs].sort((a, b) => a.performance! - b.performance!)
    results[name] = sorted[Math.floor(RUNS / 2)]!
    console.log(name, JSON.stringify(results[name]), `(Performance en cada corrida: ${runs.map((r) => r.performance).join(', ')})`)
  }
  console.table(results)
} finally {
  kill()
}
