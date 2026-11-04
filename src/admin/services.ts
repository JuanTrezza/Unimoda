/**
 * Datos del panel. Todo pasa por la Data API con la sesión del admin: lo que se puede leer
 * o escribir lo decide RLS (private.is_admin()), no este archivo.
 */
import { supabase } from '../lib/supabase'
import { imageUrl, PRODUCT_IMAGES_BUCKET } from '../services/catalog'
import type { ImageView, OrderStatus, Size } from '../types'
import { prepareImage } from './imageResize'

export const SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL']
export const PAGE_SIZE = 20

const MESSAGES: Record<string, string> = {
  '23505': 'Ya existe un registro con ese valor (¿slug repetido?).',
  '23514': 'Revisá los datos: alguno no cumple el formato o el rango permitido.',
  '23503': 'No se puede borrar: hay datos que dependen de este registro.',
  '42501': 'No tenés permiso para hacer esto. Volvé a ingresar con una cuenta de administrador.',
}

function fail(error: { code?: string; message: string }): never {
  if (error.code === 'UM007' || error.code === 'UM005') throw new Error(error.message)
  throw new Error(MESSAGES[error.code ?? ''] ?? (/fetch/i.test(error.message) ? 'No pudimos conectarnos.' : error.message))
}

function check<T>({ data, error }: { data: unknown; error: { code?: string; message: string } | null }): T {
  if (error) fail(error)
  return data as T
}

const toCents = (pesos: number) => Math.round(pesos * 100)
const fromCents = (cents: number) => cents / 100

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/, '')
}

// --- Resumen ------------------------------------------------------------------

export interface Dashboard {
  monthSales: number
  monthOrders: number
  pendingOrders: number
  topProducts: { name: string; slug: string | null; units: number; revenue: number }[]
  lowStock: { sku: string; size: string; stock: number; productId: string; productName: string; colorName: string; isActive: boolean }[]
}

export async function getDashboard(): Promise<Dashboard> {
  const d = check<{
    month_sales_cents: number
    month_orders: number
    pending_orders: number
    top_products: { name: string; slug: string | null; units: number; revenue_cents: number }[]
    low_stock: {
      sku: string
      size: string
      stock: number
      product_id: string
      product_name: string
      color_name: string
      is_active: boolean
    }[]
  }>(await supabase.rpc('admin_dashboard'))
  return {
    monthSales: fromCents(d.month_sales_cents),
    monthOrders: d.month_orders,
    pendingOrders: d.pending_orders,
    topProducts: d.top_products.map((t) => ({ name: t.name, slug: t.slug, units: t.units, revenue: fromCents(t.revenue_cents) })),
    lowStock: d.low_stock.map((l) => ({
      sku: l.sku,
      size: l.size,
      stock: l.stock,
      productId: l.product_id,
      productName: l.product_name,
      colorName: l.color_name,
      isActive: l.is_active,
    })),
  }
}

// --- Productos ----------------------------------------------------------------

export interface AdminCategory {
  id: number
  slug: string
  name: string
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  return check<AdminCategory[]>(await supabase.from('categories').select('id, slug, name').order('sort_order'))
}

export interface AdminProductListItem {
  id: string
  slug: string
  name: string
  categoryName: string
  price: number
  isActive: boolean
  stock: number
  thumb: string | null
}

export async function listAdminProducts(filter: { search?: string; active?: 'todos' | 'activos' | 'inactivos' }) {
  let q = supabase
    .from('products')
    .select(
      'id, slug, name, price_cents, is_active, category:categories(name), variants(stock), images:product_images(path, source, sort_order)',
    )
    .order('name')
  if (filter.active === 'activos') q = q.eq('is_active', true)
  if (filter.active === 'inactivos') q = q.eq('is_active', false)
  const terms = slugify(filter.search ?? '').split('-').filter(Boolean)
  for (const t of terms) q = q.ilike('search_text', `%${t}%`)

  const rows = check<
    {
      id: string
      slug: string
      name: string
      price_cents: number
      is_active: boolean
      category: { name: string } | null
      variants: { stock: number }[]
      images: { path: string; source: 'static' | 'storage'; sort_order: number }[]
    }[]
  >(await q)
  return rows.map<AdminProductListItem>((r) => {
    const first = [...r.images].sort((a, b) => a.sort_order - b.sort_order)[0]
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      categoryName: r.category?.name ?? '',
      price: fromCents(r.price_cents),
      isActive: r.is_active,
      stock: r.variants.reduce((sum, v) => sum + v.stock, 0),
      thumb: first ? imageUrl(first.source, first.path) : null,
    }
  })
}

export interface AdminColor {
  id: number
  slug: string
  name: string
  hex: string
  sortOrder: number
}

export interface AdminImage {
  id: number
  colorId: number | null
  view: ImageView
  path: string
  width: number
  height: number
  alt: string
  sortOrder: number
  source: 'static' | 'storage'
  url: string
}

export interface AdminVariant {
  id: number
  colorId: number
  size: Size
  sku: string
  stock: number
}

export interface ProductInput {
  name: string
  slug: string
  categoryId: number
  description: string
  details: string[]
  care: string[]
  material: string
  /** En pesos */
  price: number
  compareAtPrice: number | null
  isNew: boolean
  isActive: boolean
}

export interface AdminProduct extends ProductInput {
  id: string
  colors: AdminColor[]
  images: AdminImage[]
  variants: AdminVariant[]
}

interface ProductDbRow {
  id: string
  slug: string
  name: string
  description: string
  details: string[]
  care: string[]
  material: string
  category_id: number
  price_cents: number
  compare_at_cents: number | null
  is_new: boolean
  is_active: boolean
  colors: { id: number; slug: string; name: string; hex: string; sort_order: number }[]
  images: {
    id: number
    color_id: number | null
    view: ImageView
    path: string
    width: number
    height: number
    alt: string
    sort_order: number
    source: 'static' | 'storage'
  }[]
  variants: { id: number; color_id: number; size: Size; sku: string; stock: number }[]
}

export async function getAdminProduct(id: string): Promise<AdminProduct | undefined> {
  const rows = check<ProductDbRow[]>(
    await supabase
      .from('products')
      .select(
        `id, slug, name, description, details, care, material, category_id, price_cents, compare_at_cents, is_new, is_active,
         colors:product_colors!product_colors_product_id_fkey(id, slug, name, hex, sort_order),
         images:product_images(id, color_id, view, path, width, height, alt, sort_order, source),
         variants(id, color_id, size, sku, stock)`,
      )
      .eq('id', id)
      .limit(1),
  )
  const r = rows[0]
  if (!r) return undefined
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    categoryId: r.category_id,
    description: r.description,
    details: r.details,
    care: r.care,
    material: r.material,
    price: fromCents(r.price_cents),
    compareAtPrice: r.compare_at_cents === null ? null : fromCents(r.compare_at_cents),
    isNew: r.is_new,
    isActive: r.is_active,
    colors: r.colors
      .map((c) => ({ id: c.id, slug: c.slug, name: c.name, hex: c.hex, sortOrder: c.sort_order }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    images: r.images
      .map((i) => ({
        id: i.id,
        colorId: i.color_id,
        view: i.view,
        path: i.path,
        width: i.width,
        height: i.height,
        alt: i.alt,
        sortOrder: i.sort_order,
        source: i.source,
        url: imageUrl(i.source, i.path),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    variants: r.variants.map((v) => ({ id: v.id, colorId: v.color_id, size: v.size, sku: v.sku, stock: v.stock })),
  }
}

const productRow = (p: ProductInput) => ({
  name: p.name.trim(),
  slug: p.slug,
  category_id: p.categoryId,
  description: p.description.trim(),
  details: p.details.map((d) => d.trim()).filter(Boolean),
  care: p.care.map((d) => d.trim()).filter(Boolean),
  material: p.material.trim(),
  price_cents: toCents(p.price),
  compare_at_cents: p.compareAtPrice === null ? null : toCents(p.compareAtPrice),
  is_new: p.isNew,
  is_active: p.isActive,
})

/** Crea o actualiza; devuelve el id */
export async function saveProduct(input: ProductInput, id?: string): Promise<string> {
  if (id) {
    check(await supabase.from('products').update(productRow(input)).eq('id', id))
    return id
  }
  const rows = check<{ id: string }[]>(await supabase.from('products').insert(productRow(input)).select('id'))
  return rows[0]!.id
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  check(await supabase.from('products').update({ is_active: isActive }).eq('id', id))
}

async function removeFiles(images: AdminImage[]) {
  const paths = images.filter((i) => i.source === 'storage').map((i) => i.path)
  if (!paths.length) return
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths)
  if (error) throw new Error(`No pudimos borrar las fotos: ${error.message}`)
}

/** Borra el producto (colores, fotos y variantes en cascada) y sus archivos de Storage */
export async function deleteProduct(product: AdminProduct): Promise<void> {
  await removeFiles(product.images)
  check(await supabase.from('products').delete().eq('id', product.id))
}

// --- Colores ------------------------------------------------------------------

export async function addColor(product: AdminProduct, color: { name: string; hex: string }): Promise<void> {
  const base = slugify(color.name).slice(0, 40) || 'color'
  let slug = base
  for (let n = 2; product.colors.some((c) => c.slug === slug); n++) slug = `${base}-${n}`
  const sortOrder = Math.max(-1, ...product.colors.map((c) => c.sortOrder)) + 1
  check(
    await supabase
      .from('product_colors')
      .insert({ product_id: product.id, slug, name: color.name.trim(), hex: color.hex.toUpperCase(), sort_order: sortOrder }),
  )
}

export async function updateColor(id: number, color: { name: string; hex: string }): Promise<void> {
  check(await supabase.from('product_colors').update({ name: color.name.trim(), hex: color.hex.toUpperCase() }).eq('id', id))
}

/** Borra el color, sus variantes y sus fotos (y los archivos de Storage de esas fotos) */
export async function deleteColor(product: AdminProduct, colorId: number): Promise<void> {
  await removeFiles(product.images.filter((i) => i.colorId === colorId))
  check(await supabase.from('product_colors').delete().eq('id', colorId))
}

// --- Stock --------------------------------------------------------------------

/** Celdas color × talle. Las nuevas crean la variante con un SKU {slug}-{color}-{talle}. */
export async function saveStock(product: AdminProduct, cells: { colorId: number; size: Size; stock: number }[]): Promise<void> {
  const rows = cells.map((cell) => {
    const existing = product.variants.find((v) => v.colorId === cell.colorId && v.size === cell.size)
    const color = product.colors.find((c) => c.id === cell.colorId)!
    return {
      product_id: product.id,
      color_id: cell.colorId,
      size: cell.size,
      // El SKU existente no se toca: es lo que guardan los carritos
      sku: existing?.sku ?? `${product.slug}-${color.slug}-${cell.size}`.toLowerCase().slice(0, 64),
      stock: cell.stock,
    }
  })
  if (!rows.length) return
  check(await supabase.from('variants').upsert(rows, { onConflict: 'product_id,color_id,size' }))
}

// --- Fotos --------------------------------------------------------------------

const VIEW_LABEL: Record<ImageView, string> = { frente: 'vista de frente', espalda: 'vista de espalda', detalle: 'detalle de la tela' }

/** `offset`: cuántas fotos ya se subieron en esta tanda (todavía no están en `product`) */
export async function uploadImage(product: AdminProduct, colorId: number | null, file: File, offset = 0): Promise<void> {
  const prepared = await prepareImage(file)
  const path = `${product.id}/${crypto.randomUUID()}.${prepared.extension}`
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, prepared.blob, { contentType: prepared.type, cacheControl: '31536000', upsert: false })
  if (uploadError) throw new Error(`No pudimos subir la foto: ${uploadError.message}`)

  const sameGroup = product.images.filter((i) => i.colorId === colorId)
  const view: ImageView = (['frente', 'espalda', 'detalle'] as const)[Math.min(sameGroup.length + offset, 2)] ?? 'detalle'
  const color = product.colors.find((c) => c.id === colorId)
  const { error } = await supabase.from('product_images').insert({
    product_id: product.id,
    color_id: colorId,
    view,
    path,
    width: prepared.width,
    height: prepared.height,
    alt: `${product.name}${color ? ` en ${color.name}` : ''}, ${VIEW_LABEL[view]}`.slice(0, 300),
    sort_order: Math.max(-1, ...sameGroup.map((i) => i.sortOrder)) + 1 + offset,
    source: 'storage',
  })
  if (error) {
    // Sin fila no tiene sentido dejar el archivo
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path])
    fail(error)
  }
}

export async function updateImage(id: number, changes: { view?: ImageView; sortOrder?: number }): Promise<void> {
  check(
    await supabase
      .from('product_images')
      .update({
        ...(changes.view && { view: changes.view }),
        ...(changes.sortOrder !== undefined && { sort_order: changes.sortOrder }),
      })
      .eq('id', id),
  )
}

/** Intercambia el orden de dos fotos */
export async function swapImages(a: AdminImage, b: AdminImage): Promise<void> {
  const [first, second] = a.sortOrder === b.sortOrder ? [b.sortOrder + 1, b.sortOrder] : [b.sortOrder, a.sortOrder]
  await updateImage(a.id, { sortOrder: first })
  await updateImage(b.id, { sortOrder: second })
}

export async function deleteImage(image: AdminImage): Promise<void> {
  await removeFiles([image])
  check(await supabase.from('product_images').delete().eq('id', image.id))
}

// --- Pedidos ------------------------------------------------------------------

export interface AdminOrder {
  id: string
  number: string
  status: OrderStatus
  total: number
  subtotal: number
  shipping: number
  createdAt: string
  address: Record<string, string | null>
  items: { id: number; sku: string; productName: string; colorName: string; size: string; unitPrice: number; quantity: number; lineTotal: number }[]
}

interface OrderDbRow {
  id: string
  number: string
  status: OrderStatus
  subtotal_cents: number
  shipping_cents: number
  total_cents: number
  created_at: string
  shipping_address: Record<string, string | null>
  items?: {
    id: number
    sku: string
    product_name: string
    color_name: string
    size: string
    unit_price_cents: number
    quantity: number
    line_total_cents: number
  }[]
}

const toOrder = (r: OrderDbRow): AdminOrder => ({
  id: r.id,
  number: r.number,
  status: r.status,
  total: fromCents(r.total_cents),
  subtotal: fromCents(r.subtotal_cents),
  shipping: fromCents(r.shipping_cents),
  createdAt: r.created_at,
  address: r.shipping_address,
  items: (r.items ?? [])
    .map((i) => ({
      id: i.id,
      sku: i.sku,
      productName: i.product_name,
      colorName: i.color_name,
      size: i.size,
      unitPrice: fromCents(i.unit_price_cents),
      quantity: i.quantity,
      lineTotal: fromCents(i.line_total_cents),
    }))
    .sort((a, b) => a.id - b.id),
})

export interface Page<T> {
  rows: T[]
  total: number
}

export async function listAdminOrders(filter: { status?: OrderStatus; search?: string; page: number }): Promise<Page<AdminOrder>> {
  const from = filter.page * PAGE_SIZE
  let q = supabase
    .from('orders')
    .select('id, number, status, subtotal_cents, shipping_cents, total_cents, created_at, shipping_address', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (filter.status) q = q.eq('status', filter.status)
  const number = (filter.search ?? '').replace(/[^0-9a-f]/gi, '').toUpperCase().slice(0, 8)
  if (number) q = q.like('number', `${number}%`)
  const { data, error, count } = await q
  const rows = check<OrderDbRow[]>({ data, error })
  return { rows: rows.map(toOrder), total: count ?? rows.length }
}

export async function getAdminOrder(id: string): Promise<AdminOrder | undefined> {
  const rows = check<OrderDbRow[]>(
    await supabase
      .from('orders')
      .select(
        `id, number, status, subtotal_cents, shipping_cents, total_cents, created_at, shipping_address,
         items:order_items(id, sku, product_name, color_name, size, unit_price_cents, quantity, line_total_cents)`,
      )
      .eq('id', id)
      .limit(1),
  )
  return rows[0] && toOrder(rows[0])
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  check(await supabase.rpc('admin_set_order_status', { order_id: id, status }))
}

/** Transiciones válidas: las mismas que el trigger orders_status_change */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pendiente_pago: ['pagado', 'cancelado'],
  pagado: ['enviado', 'cancelado'],
  enviado: [],
  cancelado: [],
}

// --- Mensajes y suscriptores ----------------------------------------------------

export interface ContactMessage {
  id: number
  name: string
  email: string
  message: string
  createdAt: string
}

export async function listMessages(page: number): Promise<Page<ContactMessage>> {
  const from = page * PAGE_SIZE
  const { data, error, count } = await supabase
    .from('contact_messages')
    .select('id, name, email, message, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  const rows = check<{ id: number; name: string; email: string; message: string; created_at: string }[]>({ data, error })
  return { rows: rows.map((r) => ({ ...r, createdAt: r.created_at })), total: count ?? rows.length }
}

export interface Subscriber {
  id: number
  email: string
  createdAt: string
}

export async function listSubscribers(page: number, size = PAGE_SIZE): Promise<Page<Subscriber>> {
  const from = page * size
  const { data, error, count } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + size - 1)
  const rows = check<{ id: number; email: string; created_at: string }[]>({ data, error })
  return { rows: rows.map((r) => ({ id: r.id, email: r.email, createdAt: r.created_at })), total: count ?? rows.length }
}

/** Todos los suscriptores en CSV (de a 1000, el máximo por consulta de la Data API) */
export async function subscribersCsv(): Promise<string> {
  const all: Subscriber[] = []
  for (let page = 0; ; page++) {
    const { rows, total } = await listSubscribers(page, 1000)
    all.push(...rows)
    if (!rows.length || all.length >= total) break
  }
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return ['email,fecha_alta', ...all.map((s) => `${escape(s.email)},${s.createdAt}`)].join('\n') + '\n'
}
