/**
 * Genera supabase/seed.sql a partir de src/data/products.ts.
 *
 *   npx tsx scripts/generate-seed.ts
 *
 * El SQL resultante es idempotente (upsert por slug / sku): se puede volver a pegar
 * en el SQL Editor para actualizar precios o stock sin duplicar filas.
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCatalogRows } from './catalog-rows'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/seed.sql')

type Value = string | number | boolean | null | string[]

function sql(value: Value): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`Solo enteros en el seed, llegó ${value}`)
    return String(value)
  }
  if (Array.isArray(value)) return value.length ? `array[${value.map(sql).join(', ')}]::text[]` : `'{}'::text[]`
  return `'${value.replace(/'/g, "''")}'`
}

function values(rows: Value[][]): string {
  return rows.map((r) => `  (${r.map(sql).join(', ')})`).join(',\n')
}

const { categories, products, colors, images, variants } = buildCatalogRows()

const out = `-- =============================================================================
-- Seed del catálogo de Unimoda
-- GENERADO por scripts/generate-seed.ts a partir de src/data/products.ts. No editar a mano.
-- ${products.length} productos · ${colors.length} colores · ${images.length} imágenes · ${variants.length} variantes
-- Idempotente: hace upsert por slug / sku. Correr después de las migraciones.
-- =============================================================================

begin;

-- Categorías
insert into public.categories (slug, name, description, sort_order)
values
${values(categories.map((c) => [c.slug, c.name, c.description, c.sort_order]))}
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- Productos (precios en centavos)
insert into public.products (
  id, slug, name, description, details, care, material, category_id,
  price_cents, compare_at_cents, is_new, is_active, popularity, created_at
)
select
  v.id::uuid, v.slug, v.name, v.description, v.details, v.care, v.material, c.id,
  v.price_cents, v.compare_at_cents, v.is_new, v.is_active, v.popularity, v.created_at::timestamptz
from (values
${values(
  products.map((p) => [
    p.id,
    p.slug,
    p.name,
    p.description,
    p.details,
    p.care,
    p.material,
    p.category_slug,
    p.price_cents,
    p.compare_at_cents,
    p.is_new,
    p.is_active,
    p.popularity,
    p.created_at,
  ]),
)}
) as v(id, slug, name, description, details, care, material, category_slug,
       price_cents, compare_at_cents, is_new, is_active, popularity, created_at)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  details = excluded.details,
  care = excluded.care,
  material = excluded.material,
  category_id = excluded.category_id,
  price_cents = excluded.price_cents,
  compare_at_cents = excluded.compare_at_cents,
  is_new = excluded.is_new,
  is_active = excluded.is_active,
  popularity = excluded.popularity,
  created_at = excluded.created_at;

-- Colores por producto
insert into public.product_colors (product_id, slug, name, hex, sort_order)
select p.id, v.slug, v.name, v.hex, v.sort_order
from (values
${values(colors.map((c) => [c.product_slug, c.slug, c.name, c.hex, c.sort_order]))}
) as v(product_slug, slug, name, hex, sort_order)
join public.products p on p.slug = v.product_slug
on conflict (product_id, slug) do update set
  name = excluded.name,
  hex = excluded.hex,
  sort_order = excluded.sort_order;

-- Imágenes (color_id null = sirven para todos los colores)
insert into public.product_images (product_id, color_id, view, path, width, height, alt, sort_order)
select p.id, pc.id, v.view, v.path, v.width, v.height, v.alt, v.sort_order
from (values
${values(images.map((i) => [i.product_slug, i.color_slug, i.view, i.path, i.width, i.height, i.alt, i.sort_order]))}
) as v(product_slug, color_slug, view, path, width, height, alt, sort_order)
join public.products p on p.slug = v.product_slug
left join public.product_colors pc on pc.product_id = p.id and pc.slug = v.color_slug
on conflict (product_id, path) do update set
  color_id = excluded.color_id,
  view = excluded.view,
  width = excluded.width,
  height = excluded.height,
  alt = excluded.alt,
  sort_order = excluded.sort_order;

-- Variantes (el SKU es el id que guarda el carrito)
insert into public.variants (product_id, color_id, size, sku, stock)
select p.id, pc.id, v.size, v.sku, v.stock
from (values
${values(variants.map((v) => [v.product_slug, v.color_slug, v.size, v.sku, v.stock]))}
) as v(product_slug, color_slug, size, sku, stock)
join public.products p on p.slug = v.product_slug
join public.product_colors pc on pc.product_id = p.id and pc.slug = v.color_slug
on conflict (sku) do update set
  product_id = excluded.product_id,
  color_id = excluded.color_id,
  size = excluded.size,
  stock = excluded.stock;

commit;

-- Control: tiene que dar ${categories.length} / ${products.length} / ${colors.length} / ${images.length} / ${variants.length}
select
  (select count(*) from public.categories)     as categorias,
  (select count(*) from public.products)       as productos,
  (select count(*) from public.product_colors) as colores,
  (select count(*) from public.product_images) as imagenes,
  (select count(*) from public.variants)       as variantes;
`

writeFileSync(OUT, out, 'utf8')
const stock = variants.reduce((sum, v) => sum + v.stock, 0)
console.log(
  `supabase/seed.sql: ${categories.length} categorías, ${products.length} productos, ${colors.length} colores, ` +
    `${images.length} imágenes, ${variants.length} variantes (stock total ${stock}, ${variants.filter((v) => v.stock === 0).length} agotadas)`,
)
