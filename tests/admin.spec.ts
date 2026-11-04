import { deflateSync } from 'node:zlib'
import { expect, test, type Page } from '@playwright/test'
import { buildCatalogRows } from '../scripts/catalog-rows'
import { mockSupabase, type SupabaseMock } from './supabase-mock'

const ADMIN = { email: 'admin@unimoda.com.ar', password: 'Admin1234', fullName: 'Juan Admin', admin: true }
const CLIENTA = { email: 'ana@mail.com', password: 'Clave1234', fullName: 'Ana Pérez' }

const vestido = buildCatalogRows().variants.find((v) => v.product_slug === 'vestido-midi-lino' && v.stock >= 3)!

let supabase: SupabaseMock

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  supabase = await mockSupabase(page)
  supabase.addUser(ADMIN)
  supabase.addUser(CLIENTA)
})

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'no debe haber scroll horizontal').toBeLessThanOrEqual(0)
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `screenshots/${test.info().project.name}-${name}.png`, fullPage: true })

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('./#/ingresar')
  await page.getByLabel('Email').fill(user.email)
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
}

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text })

/** Link del menú del panel; en mobile, abre primero el menú desplegable */
const panelLink = (page: Page, name: string) => ({
  click: async () => {
    const open = page.getByRole('button', { name: 'Abrir menú del panel' })
    if (await open.isVisible()) await open.click()
    await page.getByRole('navigation', { name: 'Panel' }).getByRole('link', { name }).click()
  },
})

/** PNG RGB de un color, sin dependencias (para probar el redimensionado del front) */
function makePng(width: number, height: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 2, 0, 0, 0], 8) // 8 bits, RGB
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x++) row.set([107, 107, 58], 1 + x * 3) // oliva
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

test('sin el claim de admin, /admin es un 404 y el panel no se descarga', async ({ page }) => {
  const chunks: string[] = []
  page.on('request', (r) => r.url().includes('AdminApp') && chunks.push(r.url()))

  await page.goto('./#/admin')
  await expect(page.getByRole('heading', { name: 'Esta página se fue de temporada' })).toBeVisible()

  await login(page, CLIENTA)
  await page.goto('./#/admin/productos')
  await expect(page.getByRole('heading', { name: 'Esta página se fue de temporada' })).toBeVisible()
  await page.getByRole('button', { name: 'Mi cuenta' }).click()
  await expect(page.getByRole('link', { name: 'Panel de administración' })).toHaveCount(0)
  expect(chunks, 'el chunk del panel no se pide').toEqual([])
})

test('alta de producto con color, stock y foto; desactivar pide confirmación', async ({ page }) => {
  await login(page, ADMIN)
  await page.getByRole('button', { name: 'Mi cuenta' }).click()
  await page.getByRole('link', { name: 'Panel de administración' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Resumen' })).toBeVisible()
  await panelLink(page, 'Productos').click()
  await page.getByRole('link', { name: 'Nuevo producto' }).click()

  // Validación accesible y slug autogenerado
  await page.getByRole('button', { name: 'Crear producto' }).click()
  await expect(page.getByRole('textbox', { name: 'Nombre', exact: true })).toBeFocused()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Vestido de Prueba Ñandú')
  await expect(page.getByRole('textbox', { name: 'Slug (URL)' })).toHaveValue('vestido-de-prueba-nandu')
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ label: 'Vestidos' })
  await page.getByLabel('Detalles (uno por línea)').fill('Escote en V\nLargo midi')
  await page.getByRole('spinbutton', { name: 'Precio en pesos', exact: true }).fill('65000')
  await page.getByRole('spinbutton', { name: 'Precio anterior en pesos' }).fill('60000')
  await page.getByRole('button', { name: 'Crear producto' }).click()
  await expect(page.getByText('Tiene que ser mayor que el precio actual.')).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Precio anterior en pesos' }).fill('')
  await page.getByRole('button', { name: 'Crear producto' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Vestido de Prueba Ñandú' })).toBeVisible()

  const product = supabase.db.products.find((p) => p.slug === 'vestido-de-prueba-nandu')!
  expect(product).toMatchObject({ price_cents: 6500000, compare_at_cents: null, details: ['Escote en V', 'Largo midi'], is_active: true })

  // Color con color picker
  await page.getByLabel('Nuevo color').fill('Verde oliva')
  await page.getByLabel('Tono', { exact: true }).fill('#6b6b3a')
  await page.getByRole('button', { name: 'Agregar color' }).click()
  await expect(page.getByLabel('Nombre del color Verde oliva')).toBeVisible()
  expect(supabase.db.colors.find((c) => c.product_id === product.id)).toMatchObject({ slug: 'verde-oliva', hex: '#6B6B3A' })

  // Stock
  await page.getByLabel('Stock Verde oliva talle M').fill('3')
  await page.getByRole('button', { name: 'Guardar stock' }).click()
  await expect(toast(page, 'Guardamos el stock.')).toBeVisible()
  expect(supabase.stockOf('vestido-de-prueba-nandu-verde-oliva-m')).toBe(3)

  // Foto del color: se achica a 1600 px de alto y se sube como WebP
  const photos = page.getByRole('region', { name: 'Fotos' })
  await photos.getByRole('button', { name: 'Verde oliva' }).click()
  await photos.getByLabel('Subir fotos para Verde oliva').setInputFiles({
    name: 'oliva.png',
    mimeType: 'image/png',
    buffer: makePng(1000, 2000),
  })
  const photo = photos.getByRole('img', { name: 'Vestido de Prueba Ñandú en Verde oliva, vista de frente' })
  await expect(photo).toBeVisible()
  await expect(photos.getByText('800×1600 · Storage')).toBeVisible()
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(1600)
  const [stored] = [...supabase.storage.entries()]
  expect(stored?.[0]).toMatch(new RegExp(`^${product.id}/[0-9a-f-]+\\.webp$`))
  expect(stored?.[1].type).toBe('image/webp')
  expect(supabase.db.images.find((i) => i.product_id === product.id)).toMatchObject({
    source: 'storage',
    width: 800,
    height: 1600,
    view: 'frente',
  })
  await expectNoHorizontalScroll(page)
  await shot(page, '30-admin-producto')

  // En la tienda se ve la foto de Storage
  await page.getByRole('link', { name: 'Ver en la tienda' }).click()
  const gallery = page.getByRole('region', { name: 'Galería de imágenes' }).getByRole('img')
  await expect(gallery).toHaveAttribute('src', /\/storage\/v1\/object\/public\/product-images\/.+\.webp$/)

  // Desactivar: pide confirmación
  await page.goto(`./#/admin/productos/${product.id}`)
  await page.getByLabel('Activo (visible en la tienda)').uncheck()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  const dialog = page.getByRole('dialog', { name: '¿Desactivar el producto?' })
  await expect(dialog).toBeVisible()
  expect(product.is_active).toBe(true)
  await dialog.getByRole('button', { name: 'Sí, desactivar' }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(() => product.is_active).toBe(false)
  await page.goto('./#/producto/vestido-de-prueba-nandu')
  await expect(page.getByRole('heading', { name: 'Esta página se fue de temporada' })).toBeVisible()
})

test('edición de stock de un producto existente', async ({ page }) => {
  await login(page, ADMIN)
  await page.goto('./#/admin/productos')
  await page.getByLabel('Buscar productos').fill('trench')
  await expect(page.getByText('1 producto', { exact: true })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await shot(page, '31-admin-productos')
  await page.getByRole('link', { name: 'Trench de gabardina' }).click()

  const cell = page.getByLabel('Stock Camel talle M')
  await expect(cell).toHaveValue(String(supabase.stockOf('p13-camel-m')))
  await cell.fill('-1')
  await page.getByRole('button', { name: 'Guardar stock' }).click()
  await expect(page.getByRole('alert')).toContainText('Revisá el stock de Camel talle M')
  await cell.fill('7')
  await page.getByRole('button', { name: 'Guardar stock' }).click()
  await expect(toast(page, 'Guardamos el stock.')).toBeVisible()
  expect(supabase.stockOf('p13-camel-m')).toBe(7)
  // El SKU existente no cambia (es lo que guardan los carritos)
  expect(supabase.variantId('p13-camel-m')).toBeGreaterThan(0)
})

test('pedidos: filtro, búsqueda, pagado, resumen y cancelación con devolución de stock', async ({ page }) => {
  const stockBefore = supabase.stockOf(vestido.sku)
  const order = supabase.seedOrder(CLIENTA.email, [{ sku: vestido.sku, quantity: 2 }])
  const number = order.id.slice(0, 8).toUpperCase()
  supabase.seedOrder(CLIENTA.email, [{ sku: 'p13-camel-m', quantity: 1 }])

  await login(page, ADMIN)
  await page.goto('./#/admin/pedidos')
  await expect(page.getByText('2 pedidos')).toBeVisible()
  await page.getByLabel('Buscar por número de pedido').fill(`#${number.slice(0, 6).toLowerCase()}`)
  await expect(page.getByText('1 pedido', { exact: true })).toBeVisible()
  await page.getByLabel('Filtrar por estado').selectOption('pendiente_pago')
  await expectNoHorizontalScroll(page)
  await shot(page, '32-admin-pedidos')
  await page.getByRole('link', { name: `#${number}` }).click()

  await expect(page.getByRole('heading', { level: 1, name: `Pedido #${number}` })).toBeVisible()
  await expect(page.getByText('Av. Siempre Viva 742')).toBeVisible()
  await page.getByRole('button', { name: 'Marcar como pagado' }).click()
  await expect(page.getByText('Pagado', { exact: true })).toBeVisible()
  expect(order.status).toBe('pagado')

  // El resumen cuenta solo pagados/enviados
  await panelLink(page, 'Resumen').click()
  await expect(page.getByTestId('month-sales')).toHaveText(/179\.800/)
  await expect(page.getByTestId('pending-orders')).toHaveText('1')
  await expect(page.getByRole('region', { name: 'Más vendidos del mes' })).toContainText('Vestido midi de lino')
  await expectNoHorizontalScroll(page)
  await shot(page, '33-admin-resumen')

  // Pagado → cancelado devuelve el stock
  await page.goto(`./#/admin/pedidos/${order.id}`)
  await page.getByRole('button', { name: 'Cancelar pedido' }).click()
  const dialog = page.getByRole('dialog', { name: '¿Cancelar el pedido?' })
  await dialog.getByRole('button', { name: 'Sí, cancelar pedido' }).click()
  await expect(page.getByText('Cancelado', { exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Cambiar estado' })).toHaveCount(0)
  expect(supabase.stockOf(vestido.sku)).toBe(stockBefore)
})

test('suscriptores paginados y exportación a CSV', async ({ page }) => {
  for (let i = 1; i <= 23; i++) supabase.addSubscriber(`persona${i}@mail.com`)
  await login(page, ADMIN)
  await page.goto('./#/admin/suscriptores')
  await expect(page.getByText('23 suscriptores')).toBeVisible()
  await expect(page.getByText('Página 1 de 2')).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Página 2 de 2')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await shot(page, '34-admin-suscriptores')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^suscriptores-\d{4}-\d{2}-\d{2}\.csv$/)
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const csv = Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '')
  const lines = csv.trim().split('\n')
  expect(lines[0]).toBe('email,fecha_alta')
  expect(lines).toHaveLength(24)
  expect(csv).toContain('persona17@mail.com,')
})
