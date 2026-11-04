/**
 * Capturas del README y video del panel, en docs/screenshots/ (WebP y WebM livianos).
 * Datos del mock de los tests: pedidos, personas y emails de esta demo son inventados.
 *
 *   npm run docs:screenshots
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Browser, type BrowserContextOptions, type Page } from '@playwright/test'
import sharp from 'sharp'
import { mockSupabase, type SupabaseMock } from '../tests/supabase-mock'

const OUT = 'docs/screenshots'
const BASE = 'http://localhost:4173/Unimoda/'
const ADMIN = { email: 'admin@ejemplo.com', password: 'solo-en-el-mock-1', fullName: 'Admin Demo', admin: true }
const DESKTOP = { viewport: { width: 1440, height: 900 } }
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }

mkdirSync(OUT, { recursive: true })

async function open(browser: Browser, options: BrowserContextOptions) {
  const context = await browser.newContext({ ...options, baseURL: BASE, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const mock = await mockSupabase(page)
  return { context, page, mock }
}

async function shot(page: Page, name: string, width: number) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => Promise.all([...document.images].filter((i) => i.loading !== 'lazy').map((i) => i.decode().catch(() => undefined))))
  const png = await page.screenshot()
  const { size } = await sharp(png).resize({ width }).webp({ quality: 72 }).toFile(join(OUT, `${name}.webp`))
  console.log(`${name}.webp ${Math.round(size / 1024)} KB`)
}

function seedPanel(mock: SupabaseMock) {
  mock.addUser(ADMIN)
  mock.addUser({ email: 'clienta@ejemplo.com', password: 'solo-en-el-mock-2', fullName: 'Clienta Demo' })
  const orders = [
    { lines: [{ sku: 'p13-camel-m', quantity: 1 }], status: 'pagado' },
    { lines: [{ sku: 'p05-blanco-s', quantity: 2 }], status: 'enviado' },
    { lines: [{ sku: 'p09-celeste-m', quantity: 1 }], status: 'pagado' },
    { lines: [{ sku: 'p15-crudo-m', quantity: 1 }], status: 'pendiente_pago' },
  ]
  for (const { lines, status } of orders) {
    for (const l of lines) mock.setStock(l.sku, 6)
    mock.seedOrder('clienta@ejemplo.com', lines).status = status
  }
  for (let i = 1; i <= 8; i++) mock.addSubscriber(`suscriptora${i}@ejemplo.com`)
}

async function login(page: Page) {
  await page.goto('./#/ingresar')
  await page.getByLabel('Email').fill(ADMIN.email)
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(ADMIN.password)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
}

test('tienda', async ({ browser }) => {
  const desktop = await open(browser, DESKTOP)
  await desktop.page.goto('./')
  await expect(desktop.page.getByRole('heading', { level: 1 })).toContainText('Lino')
  await shot(desktop.page, 'portada-desktop', 1280)
  await desktop.page.goto('./#/tienda')
  await expect(desktop.page.getByText('16 productos')).toBeVisible()
  await shot(desktop.page, 'tienda-desktop', 1280)
  await desktop.page.goto('./#/producto/vestido-midi-lino')
  await expect(desktop.page.getByRole('heading', { level: 1, name: 'Vestido midi de lino' })).toBeVisible()
  await shot(desktop.page, 'producto-desktop', 1280)
  await desktop.context.close()

  const mobile = await open(browser, MOBILE)
  await mobile.page.goto('./')
  await expect(mobile.page.getByRole('heading', { level: 1 })).toContainText('Lino')
  await shot(mobile.page, 'portada-mobile', 500)
  await mobile.context.close()
})

test('panel', async ({ browser }) => {
  const desktop = await open(browser, DESKTOP)
  seedPanel(desktop.mock)
  await login(desktop.page)
  await desktop.page.goto('./#/admin')
  await expect(desktop.page.getByTestId('month-sales')).toBeVisible()
  await shot(desktop.page, 'panel-resumen', 1280)
  await desktop.page.goto('./#/admin/productos')
  await expect(desktop.page.getByText('16 productos')).toBeVisible()
  await shot(desktop.page, 'panel-productos', 1280)
  await desktop.page.getByRole('link', { name: 'Trench de gabardina' }).click()
  await desktop.page.getByRole('region', { name: 'Stock' }).scrollIntoViewIfNeeded()
  await shot(desktop.page, 'panel-producto-stock', 1280)
  await desktop.page.goto('./#/admin/pedidos')
  await expect(desktop.page.getByText('4 pedidos')).toBeVisible()
  await shot(desktop.page, 'panel-pedidos', 1280)
  await desktop.context.close()

  const mobile = await open(browser, MOBILE)
  seedPanel(mobile.mock)
  await login(mobile.page)
  await mobile.page.goto('./#/admin/pedidos')
  await expect(mobile.page.getByText('4 pedidos')).toBeVisible()
  await mobile.page.getByRole('button', { name: 'Abrir menú del panel' }).click()
  await shot(mobile.page, 'panel-mobile-menu', 500)
  await mobile.context.close()
})

test('video del panel', async ({ browser }) => {
  const size = { width: 1024, height: 640 }
  const { context, page, mock } = await open(browser, { viewport: size, recordVideo: { dir: join('test-results', 'video'), size } })
  seedPanel(mock)
  await login(page)
  const pause = () => page.waitForTimeout(1200)
  const nav = page.getByRole('navigation', { name: 'Panel' })

  await page.goto('./#/admin')
  await expect(page.getByTestId('month-sales')).toBeVisible()
  await pause()
  await nav.getByRole('link', { name: 'Productos' }).click()
  await expect(page.getByText('16 productos')).toBeVisible()
  await pause()
  await page.getByLabel('Buscar productos').pressSequentially('trench', { delay: 80 })
  await expect(page.getByText('1 producto', { exact: true })).toBeVisible()
  await pause()
  await page.getByRole('link', { name: 'Trench de gabardina' }).click()
  await page.getByRole('region', { name: 'Stock' }).scrollIntoViewIfNeeded()
  await page.getByLabel('Stock Camel talle M').fill('7')
  await pause()
  await page.getByRole('button', { name: 'Guardar stock' }).click()
  await pause()
  await nav.getByRole('link', { name: 'Pedidos' }).click()
  await expect(page.getByText('4 pedidos')).toBeVisible()
  await pause()
  await page.getByLabel('Filtrar por estado').selectOption('pendiente_pago')
  await expect(page.getByText('1 pedido', { exact: true })).toBeVisible()
  await pause()
  await page.locator('main table a').first().click()
  await page.getByRole('button', { name: 'Marcar como pagado' }).click()
  await expect(page.getByText('Pagado', { exact: true })).toBeVisible()
  await pause()
  await nav.getByRole('link', { name: 'Suscriptores' }).click()
  await expect(page.getByText('8 suscriptores')).toBeVisible()
  await pause()

  const video = page.video()
  await context.close()
  copyFileSync(await video!.path(), join(OUT, 'panel-demo.webm'))
})
