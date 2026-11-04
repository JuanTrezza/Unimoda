import { expect, test, type Page } from '@playwright/test'
import { buildCatalogRows } from '../scripts/catalog-rows'
import { mockSupabase, type SupabaseMock } from './supabase-mock'

const USER = { email: 'ana@mail.com', password: 'Clave1234', fullName: 'Ana Pérez' }

// Variantes del vestido midi de lino ($ 89.900) con stock de sobra para los tests
const variants = buildCatalogRows().variants.filter((v) => v.product_slug === 'vestido-midi-lino' && v.stock >= 3)
const VESTIDO_M = variants.find((v) => v.size === 'M') ?? variants[0]!
const VESTIDO_OTRO = variants.find((v) => v.sku !== VESTIDO_M.sku)!

let supabase: SupabaseMock

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  supabase = await mockSupabase(page)
})

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'no debe haber scroll horizontal').toBeLessThanOrEqual(0)
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `screenshots/${test.info().project.name}-${name}.png`, fullPage: true })

async function fillLogin(page: Page, { email, password } = USER) {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(password)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
}

/** Carrito guardado en localStorage, igual que lo deja la tienda */
async function seedCart(page: Page, items: { variantId: string; quantity: number }[]) {
  await page.goto('./')
  await page.evaluate((list) => {
    localStorage.setItem('unimoda-cart', JSON.stringify({ state: { items: list }, version: 1 }))
  }, items)
  // Cambiar solo el hash no recarga: hay que recargar para que el store lea localStorage
  await page.reload()
}

async function fillAddress(page: Page) {
  await page.getByLabel('Calle').fill('Av. Corrientes')
  await page.getByLabel('Altura').fill('1234')
  await page.getByLabel(/Piso \/ depto/).fill('5B')
  await page.getByLabel('Localidad').fill('CABA')
  await page.getByLabel('Código postal').fill('c1043aaz')
  await page.getByLabel('Provincia').selectOption('Ciudad Autónoma de Buenos Aires')
  await page.getByRole('button', { name: 'Usar esta dirección' }).click()
  await expect(page.getByRole('radio', { name: /Av\. Corrientes 1234, 5B/ })).toBeChecked()
}

/** Login + checkout completo. Devuelve el id del pedido creado en el mock. */
async function placeOrder(page: Page, items: { variantId: string; quantity: number }[]) {
  await seedCart(page, items)
  await page.goto('./#/checkout')
  await fillLogin(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Finalizar compra' })).toBeVisible()
  await fillAddress(page)
  await page.getByRole('button', { name: 'Confirmar pedido' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '¡Gracias! Recibimos tu pedido' })).toBeVisible()
  return supabase.orders.at(-1)!.id
}

test('registro: validación accesible, confirmación por email y alta directa', async ({ page }) => {
  await page.goto('./#/crear-cuenta')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  const nombre = page.getByLabel('Nombre y apellido')
  await expect(nombre).toBeFocused()
  await expect(nombre).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Ingresá tu nombre.')).toBeVisible()

  await nombre.fill('Ana Pérez')
  await page.getByLabel('Email').fill('ana@mail.com')
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill('corta')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('textbox', { name: 'Contraseña', exact: true })).toBeFocused()
  await expect(page.getByText('Usá al menos 8 caracteres.')).toBeVisible()

  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill('Clave1234')
  await page.getByLabel('Repetí la contraseña').fill('Clave1234')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Revisá tu email' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'ana@mail.com' })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await shot(page, '20-registro-email')

  // El link del email vuelve a /Unimoda/?auth=signup&code=… y termina en #/cuenta con sesión
  await page.goto(supabase.emailLink('ana@mail.com'))
  await expect(page).toHaveURL(/\/Unimoda\/#\/cuenta\?aviso=bienvenida$/)
  await expect(page.getByText('¡Bienvenida a Unimoda!')).toBeVisible()
  await expect(page.getByLabel('Nombre y apellido')).toHaveValue('Ana Pérez')

  // Proyecto sin confirmación de email: entra directo
  await page.getByRole('button', { name: 'Mi cuenta' }).click()
  await page.getByRole('banner').getByRole('button', { name: 'Cerrar sesión' }).click()
  // Esperar a que termine el signOut (después navega al inicio)
  await expect(page.getByRole('link', { name: 'Ingresar' })).toBeVisible()
  supabase.confirmEmail = false
  await page.goto('./#/crear-cuenta')
  await page.getByLabel('Nombre y apellido').fill('Lucía Gómez')
  await page.getByLabel('Email').fill('lucia@mail.com')
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill('Clave1234')
  await page.getByLabel('Repetí la contraseña').fill('Clave1234')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
})

test('callback de email abierto en otro navegador: avisa y no rompe el hash', async ({ page }) => {
  // Sin code verifier en este navegador auth-js no canjea el código: igual hay que limpiar la URL
  await page.goto('./?auth=signup&code=abc123')
  await expect(page).toHaveURL(/\/Unimoda\/#\/ingresar\?aviso=email-confirmado$/)
  await expect(page.getByText('Tu email quedó confirmado')).toBeVisible()

  await page.goto('./?auth=recovery&code=abc123')
  await expect(page).toHaveURL(/#\/olvide-contrasena\?aviso=otro-navegador$/)
  await expect(page.getByText('Abrí el enlace en el mismo navegador')).toBeVisible()
})

test('login, recuperar contraseña y cerrar sesión', async ({ page }) => {
  supabase.addUser(USER)
  await page.goto('./#/ingresar')
  await fillLogin(page, { ...USER, password: 'otra-clave' })
  await expect(page.getByRole('alert')).toHaveText(/El email o la contraseña no coinciden/)
  await expectNoHorizontalScroll(page)
  await shot(page, '21-login-error')

  // Olvidé mi contraseña → link del email → nueva contraseña
  await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click()
  await page.getByLabel('Email').fill(USER.email)
  await page.getByRole('button', { name: 'Mandarme el enlace' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'te llega un email' })).toBeVisible()
  await page.goto(supabase.emailLink(USER.email))
  await expect(page).toHaveURL(/#\/nueva-contrasena$/)
  await page.getByLabel('Contraseña nueva').fill('NuevaClave99')
  await page.getByLabel('Repetí la contraseña').fill('NuevaClave99')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()

  // Cerrar sesión desde el menú de la cuenta y volver a entrar con la clave nueva
  await page.getByRole('button', { name: 'Mi cuenta' }).click()
  await page.getByRole('banner').getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('link', { name: 'Ingresar' })).toBeVisible()
  await page.goto('./#/ingresar')
  await fillLogin(page, { ...USER, password: 'NuevaClave99' })
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mi cuenta' })).toBeVisible()
})

test('ruta protegida: redirige a Ingresar y vuelve a donde estaba', async ({ page }) => {
  supabase.addUser(USER)
  await page.goto('./#/cuenta/pedidos')
  await expect(page).toHaveURL(/#\/ingresar\?volver=%2Fcuenta%2Fpedidos$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeVisible()
  await fillLogin(page)
  await expect(page).toHaveURL(/#\/cuenta\/pedidos$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Mis pedidos' })).toBeVisible()
  await expect(page.getByText('Todavía no hiciste pedidos')).toBeVisible()
})

test('checkout feliz: login sin perder el carrito, dirección nueva y confirmación', async ({ page }) => {
  supabase.addUser(USER)
  const stockBefore = supabase.stockOf(VESTIDO_M.sku)
  await seedCart(page, [{ variantId: VESTIDO_M.sku, quantity: 2 }])
  await page.goto('./#/carrito')
  await page.getByRole('link', { name: 'Finalizar compra' }).click()

  // Sin sesión: Ingresar → vuelve al checkout con el carrito intacto
  await expect(page).toHaveURL(/#\/ingresar\?volver=%2Fcheckout$/)
  await fillLogin(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Finalizar compra' })).toBeVisible()
  await expect(page.getByTestId('cart-button')).toHaveAccessibleName(/2 productos/)

  // Dirección: validación accesible y alta
  await page.getByRole('button', { name: 'Usar esta dirección' }).click()
  await expect(page.getByLabel('Calle')).toBeFocused()
  await expect(page.getByLabel('Calle')).toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel('Código postal').fill('12')
  await fillAddress(page)

  await expect(page.getByText('Proyecto demo:')).toBeVisible()
  await expect(page.getByTestId('checkout-total')).toHaveText(/179\.800/) // 2 × 89.900, envío gratis
  await expectNoHorizontalScroll(page)
  await shot(page, '22-checkout')
  await page.getByRole('button', { name: 'Confirmar pedido' }).click()

  // Confirmación con número de pedido; el carrito queda vacío
  await expect(page.getByRole('heading', { level: 1, name: '¡Gracias! Recibimos tu pedido' })).toBeVisible()
  const order = supabase.orders[0]!
  await expect(page.getByTestId('order-number')).toHaveText(`#${order.id.slice(0, 8).toUpperCase()}`)
  await expect(page.getByTestId('order-total')).toHaveText(/179\.800/)
  await expect(page.getByTestId('cart-button')).toHaveAccessibleName('Abrir carrito')
  await expectNoHorizontalScroll(page)
  await shot(page, '23-pedido-confirmado')

  // Al servidor solo viajan variant_id y cantidad; el precio lo pone la base
  expect(supabase.createOrderCalls).toEqual([
    { items: [{ variant_id: supabase.variantId(VESTIDO_M.sku), quantity: 2 }], address_id: expect.any(String) },
  ])
  expect(order.total_cents).toBe(17980000)
  expect(order.shipping_address).toMatchObject({ street: 'Av. Corrientes', postal_code: 'C1043AAZ', recipient: 'Ana Pérez' })
  expect(supabase.stockOf(VESTIDO_M.sku)).toBe(stockBefore - 2)

  await page.getByRole('link', { name: 'Ver el pedido' }).click()
  await expect(page.getByText('Pendiente de pago', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Mis pedidos' }).first().click()
  await expect(page.getByRole('link', { name: `Pedido #${order.id.slice(0, 8).toUpperCase()}` })).toBeVisible()
})

test('checkout: error de stock por línea y ajuste', async ({ page }) => {
  supabase.addUser(USER)
  await seedCart(page, [
    { variantId: VESTIDO_M.sku, quantity: 3 },
    { variantId: VESTIDO_OTRO.sku, quantity: 1 },
  ])
  await page.goto('./#/checkout')
  await fillLogin(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Finalizar compra' })).toBeVisible()
  await fillAddress(page)

  // Alguien compró mientras tanto: quedan 2
  supabase.setStock(VESTIDO_M.sku, 2)
  await page.getByRole('button', { name: 'Confirmar pedido' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toBeFocused()
  await expect(alert).toContainText('No hay stock suficiente')
  const message = `Sin stock: Vestido midi de lino, talle ${VESTIDO_M.size} (quedan 2)`
  await expect(alert).toContainText(message)
  // También junto a la línea del pedido
  await expect(page.getByRole('region', { name: '2. Revisá tu pedido' }).getByText(message)).toBeVisible()
  expect(supabase.orders).toHaveLength(0)
  await expectNoHorizontalScroll(page)
  await shot(page, '24-checkout-sin-stock')

  await page.getByRole('button', { name: 'Ajustar al stock disponible' }).click()
  await expect(page.getByTestId('cart-button')).toHaveAccessibleName(/3 productos/)
  await page.getByRole('button', { name: 'Confirmar pedido' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '¡Gracias! Recibimos tu pedido' })).toBeVisible()
  expect(supabase.stockOf(VESTIDO_M.sku)).toBe(0)
})

test('cancelar pedido devuelve el stock', async ({ page }) => {
  supabase.addUser(USER)
  const stockBefore = supabase.stockOf(VESTIDO_M.sku)
  const orderId = await placeOrder(page, [{ variantId: VESTIDO_M.sku, quantity: 1 }])
  expect(supabase.stockOf(VESTIDO_M.sku)).toBe(stockBefore - 1)

  await page.getByRole('link', { name: 'Ver el pedido' }).click()
  await page.getByRole('button', { name: 'Cancelar pedido' }).click()
  const dialog = page.getByRole('dialog', { name: '¿Cancelar el pedido?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Sí, cancelar pedido' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Cancelado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar pedido' })).toHaveCount(0)
  expect(supabase.orders.find((o) => o.id === orderId)?.status).toBe('cancelado')
  expect(supabase.stockOf(VESTIDO_M.sku)).toBe(stockBefore)
  await expectNoHorizontalScroll(page)
  await shot(page, '25-pedido-cancelado')
})
