import { expect, test, type Page } from '@playwright/test'
import { buildCatalogRows } from '../scripts/catalog-rows'
import { mockSupabase, type SupabaseMock } from './supabase-mock'

const ADMIN = { email: 'admin@unimoda.com.ar', password: 'Admin1234', fullName: 'Admin Demo', admin: true }
// supabase-js reintenta ~7 s antes de rendirse
const RETRIES_TIMEOUT = 15_000

const vestido = buildCatalogRows().variants.find((v) => v.product_slug === 'vestido-midi-lino' && v.stock >= 3)!

let supabase: SupabaseMock

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  supabase = await mockSupabase(page)
  supabase.addUser(ADMIN)
})

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024

async function loginAdmin(page: Page) {
  await page.goto('./#/ingresar')
  await page.getByLabel('Email').fill(ADMIN.email)
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(ADMIN.password)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
}

/** El título tiene que verse: arriba del todo y sin nada encima */
async function expectTitleNotCovered(page: Page, name: string) {
  const title = page.getByRole('heading', { level: 1, name })
  await expect(title).toBeVisible()
  const free = await title.evaluate((h1) => {
    const box = h1.getBoundingClientRect()
    const top = document.elementFromPoint(box.left + 5, box.top + box.height / 2)
    return box.top >= 0 && box.bottom <= window.innerHeight && (top === h1 || h1.contains(top))
  })
  expect(free, `"${name}" no puede quedar tapado`).toBe(true)
}

const SECTIONS = ['Resumen', 'Productos', 'Pedidos', 'Mensajes', 'Suscriptores']
const TITLES: Record<string, string> = { Mensajes: 'Mensajes de contacto' }

test('panel: layout propio, sin la tienda, con los títulos a la vista', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('./#/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Resumen' })).toBeVisible()
  await expect(page.getByText('Envío gratis desde')).toHaveCount(0)
  await expect(page.getByRole('banner')).toHaveCount(0)
  await expect(page.getByRole('contentinfo')).toHaveCount(0)
  await expect(page).toHaveTitle('Resumen · Panel | Unimoda')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')

  const nav = page.getByRole('navigation', { name: 'Panel' })
  const openMenu = page.getByRole('button', { name: 'Abrir menú del panel' })

  if (isMobile(page)) {
    await expect(nav).toBeHidden()
    await expect(openMenu).toHaveAttribute('aria-expanded', 'false')
  } else {
    await expect(nav).toBeVisible()
    await expect(openMenu).toBeHidden()
    const box = await nav.boundingBox()
    expect(box?.x, 'menú lateral').toBeLessThan(200)
  }

  for (const section of SECTIONS) {
    if (isMobile(page)) await openMenu.click()
    await nav.getByRole('link', { name: section }).click()
    if (isMobile(page)) await expect(nav).toBeHidden()
    await expectTitleNotCovered(page, TITLES[section] ?? section)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, 'no debe haber scroll horizontal').toBeLessThanOrEqual(0)
  }

  // Ver tienda vuelve al layout de la tienda
  if (isMobile(page)) await openMenu.click()
  await page.getByRole('link', { name: 'Ver tienda' }).click()
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByText('Envío gratis desde')).toBeVisible()

  // Cerrar sesión desde el panel
  await page.goto('./#/admin/pedidos')
  if (isMobile(page)) await openMenu.click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('link', { name: 'Ingresar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Esta página se fue de temporada' })).toHaveCount(0)
})

test('sin ser admin, /admin es el 404 de la tienda (con su header)', async ({ page }) => {
  await page.goto('./#/admin')
  await expect(page.getByRole('heading', { name: 'Esta página se fue de temporada' })).toBeVisible()
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Panel' })).toHaveCount(0)
})

test('SEO de producto: Open Graph con su foto y JSON-LD con precio y disponibilidad', async ({ page }) => {
  await page.goto('./#/producto/vestido-midi-lino')
  await expect(page.getByRole('heading', { level: 1, name: 'Vestido midi de lino' })).toBeVisible()
  await expect(page).toHaveTitle('Vestido midi de lino | Unimoda')
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^http.+\/images\/products\/vestido-midi-lino-1\.jpg$/)
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'product')
  const description = await page.locator('meta[name="description"]').getAttribute('content')
  expect(description!.length).toBeLessThanOrEqual(160)

  const readLd = async () =>
    JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}') as {
      name: string
      '@type': string
      image: string[]
      offers: { price: number; priceCurrency: string; availability: string }
    }
  const ld = await readLd()
  expect(ld).toMatchObject({ '@type': 'Product', name: 'Vestido midi de lino' })
  expect(ld.offers).toMatchObject({ price: 89900, priceCurrency: 'ARS', availability: 'https://schema.org/InStock' })
  expect(ld.image[0]).toMatch(/^http.+vestido-midi-lino-1\.jpg$/)

  // Al salir del producto vuelve la imagen general y no queda el JSON-LD
  await page.getByRole('link', { name: 'Unimoda, ir al inicio' }).click()
  await expect(page).toHaveTitle('Unimoda · Moda femenina argentina')
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.png$/)

  // Sin stock en ninguna variante
  for (const v of buildCatalogRows().variants.filter((x) => x.product_slug === 'trench-gabardina')) supabase.setStock(v.sku, 0)
  await page.goto('./#/producto/trench-gabardina')
  await expect(page.getByRole('heading', { level: 1, name: 'Trench de gabardina' })).toBeVisible()
  expect((await readLd()).offers.availability).toBe('https://schema.org/OutOfStock')

  const robots = await page.request.get('./robots.txt')
  expect(robots.ok()).toBe(true)
  expect(await robots.text()).toContain('User-agent: *')
})

test('las fotos usan las versiones WebP livianas y el JPG queda de respaldo', async ({ page }) => {
  await page.goto('./#/tienda')
  const card = page.locator('main article img').first()
  await expect(card).toHaveAttribute('srcset', /-360\.webp 360w, .+-640\.webp 640w, .+\.webp 1024w/)
  await expect(card).toHaveAttribute('src', /-1\.jpg$/)
  await expect.poll(() => card.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\.webp$/)
  await expect.poll(() => card.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
})

test('404: links a la Tienda y a las categorías', async ({ page }) => {
  await page.goto('./#/no-existe')
  await expect(page.getByRole('heading', { name: 'Esta página se fue de temporada' })).toBeVisible()
  await expect(page.locator('main').getByRole('link', { name: 'Ir a la tienda' })).toBeVisible()
  const categories = page.locator('main').getByRole('navigation', { name: 'Categorías' })
  await expect(categories.getByRole('link')).toHaveCount(6)
  await categories.getByRole('link', { name: 'Abrigos' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Abrigos' })).toBeVisible()
})

test('si falla una consulta: mensaje amable y Reintentar, sin decir que el carrito está vacío', async ({ page }) => {
  await page.goto('./')
  await page.evaluate((sku) => {
    localStorage.setItem('unimoda-cart', JSON.stringify({ state: { items: [{ variantId: sku, quantity: 1 }] }, version: 1 }))
  }, vestido.sku)

  // Inicio: la sección de novedades avisa; el resto de la página sigue
  supabase.setOffline(true)
  await page.reload()
  const newArrivals = page.getByRole('alert').filter({ hasText: 'No pudimos cargar las novedades' })
  await expect(newArrivals).toBeVisible({ timeout: RETRIES_TIMEOUT })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lino')
  supabase.setOffline(false)
  await newArrivals.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByRole('link', { name: 'Falda satinada al bies' }).first()).toBeVisible()

  // Carrito
  supabase.setOffline(true)
  await page.goto('./#/carrito')
  await page.reload()
  const cart = page.locator('main').getByRole('alert').filter({ hasText: 'No pudimos cargar tu carrito' })
  await expect(cart).toBeVisible({ timeout: RETRIES_TIMEOUT })
  await expect(page.getByText('Tu carrito está vacío')).toHaveCount(0)
  supabase.setOffline(false)
  await cart.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByTestId('cart-total')).toBeVisible()
  // El ítem no se perdió
  await expect(page.getByTestId('cart-button')).toHaveAccessibleName(/1 producto/)
})

test('si no se puede descargar una página: mensaje y Reintentar, no pantalla en blanco', async ({ page }) => {
  await page.route('**/assets/ContactPage-*', (route) => route.abort())
  await page.goto('./#/contacto')
  const alert = page.getByRole('alert').filter({ hasText: 'No pudimos cargar esta página' })
  await expect(alert).toBeVisible()
  await expect(page.getByRole('banner')).toBeVisible()
  await page.unroute('**/assets/ContactPage-*')
  await alert.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Estamos para ayudarte' })).toBeVisible()
})
