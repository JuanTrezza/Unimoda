import { expect, test, type Page } from '@playwright/test'

/** Recorre la página para disparar las imágenes lazy y verifica que todas carguen sin error. */
async function expectImagesLoaded(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
    window.scrollTo(0, 0)
  })
  await expect
    .poll(() => page.evaluate(() => [...document.images].filter((i) => !i.complete).length), { message: 'imágenes cargando' })
    .toBe(0)
  const broken = await page.evaluate(() =>
    [...document.images].filter((i) => i.naturalWidth === 0).map((i) => i.getAttribute('src')),
  )
  expect(broken, 'imágenes rotas').toEqual([])
}

const shot = async (page: Page, name: string, fullPage = true) => {
  if (fullPage) await expectImagesLoaded(page)
  await page.screenshot({ path: `screenshots/${test.info().project.name}-${name}.png`, fullPage })
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'no debe haber scroll horizontal').toBeLessThanOrEqual(0)
}

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('recorrido completo: navegar, filtrar, carrito y favoritos', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  // Inicio
  await page.goto('./')
  await expect(page).toHaveTitle(/Unimoda/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lino')
  await expect(page.getByRole('heading', { name: 'Novedades', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Falda satinada al bies' }).first()).toBeVisible()

  // Hero: foto real, prioridad alta y sin lazy
  const hero = page.getByRole('img', { name: /caminando al sol/ })
  await expect(hero).toHaveAttribute('fetchpriority', 'high')
  await expect(hero).toHaveAttribute('loading', 'eager')
  await expect(hero).toHaveAttribute('width', '1024')
  await expect(hero).toHaveAttribute('height', '1280')
  await expectNoHorizontalScroll(page)
  await shot(page, '01-inicio')

  // Newsletter: validación + toast
  const newsletter = page.getByRole('region', { name: /Novedades, preventas/ })
  await newsletter.getByRole('button', { name: 'Suscribirme' }).click()
  await expect(newsletter.getByText('Ingresá tu email.')).toBeVisible()
  await newsletter.getByLabel('Email').fill('ana@mail.com')
  await newsletter.getByRole('button', { name: 'Suscribirme' }).click()
  await expect(page.getByRole('status').filter({ hasText: '¡Listo!' })).toBeVisible()

  // Navegar a la tienda
  if (isMobile(page)) {
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    const menu = page.getByRole('dialog', { name: 'Menú' })
    await expect(menu).toBeVisible()
    await menu.getByRole('link', { name: 'Tienda' }).click()
  } else {
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Tienda' }).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Tienda' })).toBeVisible()
  await expect(page.getByText('16 productos')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Trench de gabardina' }).first()).toBeVisible()
  // Cada tarjeta tiene una sola imagen (sin segunda imagen para el hover)
  const cardImages = await page
    .locator('main article')
    .evaluateAll((cards) => cards.map((c) => c.querySelectorAll('img, svg[role=img]').length))
  expect(cardImages.every((n) => n === 1)).toBe(true)
  await expectNoHorizontalScroll(page)
  await shot(page, '02-tienda')

  // Filtrar por categoría y talle
  if (isMobile(page)) {
    await page.getByRole('button', { name: /^Filtros/ }).click()
    const panel = page.getByRole('dialog', { name: 'Filtros' })
    await panel.getByRole('radio', { name: 'Vestidos' }).click()
    await panel.getByRole('button', { name: 'M', exact: true }).click()
    await expect(page).toHaveURL(/talle=M/)
    await expect(panel.locator('[aria-busy="true"]')).toHaveCount(0)
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0)
    await shot(page, '03-filtros-panel', false)
    await panel.getByRole('button', { name: /^Ver resultados/ }).click()
    await expect(panel).toBeHidden()
  } else {
    const aside = page.getByRole('complementary', { name: 'Filtros' })
    await aside.getByRole('radio', { name: 'Vestidos' }).click()
    await aside.getByRole('button', { name: 'M', exact: true }).click()
  }
  await expect(page).toHaveURL(/categoria=vestidos/)
  await expect(page).toHaveURL(/talle=M/)
  await expect(page.getByRole('heading', { level: 1, name: 'Vestidos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quitar filtro Talle M' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Vestido midi de lino' }).first()).toBeVisible()
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  await expectNoHorizontalScroll(page)
  await shot(page, '04-tienda-filtrada')

  // El link con filtros se puede compartir: recargar mantiene el estado
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Vestidos' })).toBeVisible()

  // Orden por precio
  await page.getByLabel('Ordenar por').selectOption('precio-asc')
  await expect(page).toHaveURL(/orden=precio-asc/)

  // Búsqueda sin resultados → estado vacío
  await page.getByLabel('Buscar en la tienda').fill('zzzz')
  await expect(page.getByText('No encontramos prendas')).toBeVisible()
  await shot(page, '05-estado-vacio', false)
  await page.getByRole('button', { name: 'Ver toda la tienda' }).click()
  await expect(page.getByText('16 productos')).toBeVisible()

  // Detalle de producto
  await page.goto('./#/producto/vestido-midi-lino')
  await expect(page.getByRole('heading', { level: 1, name: 'Vestido midi de lino' })).toBeVisible()
  await expect(page).toHaveTitle('Vestido midi de lino | Unimoda')

  // Con una sola foto: sin miniaturas y la principal con prioridad alta
  await expect(page.getByRole('button', { name: /^Ver imagen/ })).toHaveCount(0)
  const mainPhoto = page.getByRole('region', { name: 'Galería de imágenes' }).getByRole('img')
  await expect(mainPhoto).toHaveCount(1)
  await expect(mainPhoto).toHaveAttribute('fetchpriority', 'high')
  await expect(mainPhoto).toHaveAttribute('src', /vestido-midi-lino-1\.jpg$/)
  await expectNoHorizontalScroll(page)

  // Agregar sin talle → error accesible
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()
  await expect(page.getByText('Elegí un talle para continuar.')).toBeVisible()

  // Guía de talles: abre, Escape cierra y el foco vuelve al botón
  const guideButton = page.getByRole('button', { name: 'Guía de talles' })
  await guideButton.click()
  await expect(page.getByRole('dialog', { name: 'Guía de talles' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Guía de talles' })).toBeHidden()
  await expect(guideButton).toBeFocused()

  // Elegir color y talle con stock
  await page.locator('#size-picker button:not([disabled])').first().click()
  await shot(page, '06-producto')
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()

  // Drawer del carrito
  const drawer = page.getByRole('dialog', { name: /Tu carrito/ })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Vestido midi de lino' })).toBeVisible()
  await expect(page.getByTestId('cart-button')).toHaveAccessibleName(/1 producto/)
  const subtotalBefore = await page.getByTestId('drawer-subtotal').textContent()
  await drawer.getByRole('button', { name: 'Sumar uno' }).click()
  await expect(drawer.getByRole('heading', { name: 'Tu carrito (2)' })).toBeVisible()
  await expect(page.getByTestId('drawer-subtotal')).not.toHaveText(subtotalBefore ?? '')
  const subtotalAfter = await page.getByTestId('drawer-subtotal').textContent()
  expect(subtotalAfter).not.toBe(subtotalBefore)
  await expectNoHorizontalScroll(page)
  await shot(page, '07-carrito-drawer', false)

  // Escape cierra el drawer
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()

  // Favoritos
  await page.getByRole('button', { name: 'Agregar Vestido midi de lino a favoritos' }).click()
  await expect(page.getByRole('button', { name: 'Quitar Vestido midi de lino de favoritos' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('link', { name: /Favoritos, 1 producto/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Favoritos' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Vestido midi de lino' }).first()).toBeVisible()
  await expectNoHorizontalScroll(page)
  await shot(page, '08-favoritos')

  // Página de carrito: cantidad, total y persistencia tras recargar
  await page.goto('./#/carrito')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Carrito' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Cantidad de Vestido midi de lino' })).toContainText('2')
  await page.getByRole('button', { name: 'Restar uno' }).click()
  await expect(page.getByRole('group', { name: 'Cantidad de Vestido midi de lino' })).toContainText('1')
  await expect(page.getByTestId('cart-total')).toContainText('98.400') // 89.900 + 8.500 de envío
  await expectNoHorizontalScroll(page)
  await shot(page, '09-carrito')

  // Contacto: validación accesible y confirmación
  await page.goto('./#/contacto')
  await page.getByRole('button', { name: 'Enviar mensaje' }).click()
  await expect(page.getByLabel(/Nombre/)).toBeFocused()
  await expect(page.getByLabel(/Nombre/)).toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel(/Nombre/).fill('Ana Pérez')
  await page.getByLabel(/Email/).fill('ana@mail.com')
  await page.getByLabel(/Motivo/).selectOption({ index: 1 })
  await page.getByLabel(/Mensaje/).fill('Hola, quería consultar por el talle del vestido.')
  await page.getByRole('button', { name: 'Enviar mensaje' }).click()
  await expect(page.getByRole('heading', { name: '¡Gracias, Ana!' })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await shot(page, '10-contacto')

  // Nosotros y 404
  await page.goto('./#/nosotros')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ropa para vivirla')
  await expectNoHorizontalScroll(page)
  await shot(page, '11-nosotros')
  await page.goto('./#/no-existe')
  await expect(page.getByRole('heading', { name: 'Esta página se fue de temporada' })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await shot(page, '12-404', false)

  expect(errors, 'sin errores en consola').toEqual([])
})
