-- =============================================================================
-- 0003 · Permisos (GRANT) y Row Level Security
-- El proyecto NO expone tablas nuevas automáticamente: sin estos GRANT la Data API
-- devuelve "permission denied". RLS decide además qué filas ve cada rol.
-- Idempotente: revoca todo, vuelve a otorgar lo mínimo y recrea las políticas.
-- =============================================================================

-- 1. Punto de partida: nadie del lado cliente puede nada -----------------------
revoke all on table
  public.categories,
  public.products,
  public.product_colors,
  public.product_images,
  public.variants,
  public.newsletter_subscribers,
  public.contact_messages
from public, anon, authenticated;

revoke all on all sequences in schema public from public, anon, authenticated;

-- 2. RLS activado en todas (ya viene por "automatic RLS", lo dejamos explícito) --
alter table public.categories             enable row level security;
alter table public.products               enable row level security;
alter table public.product_colors         enable row level security;
alter table public.product_images         enable row level security;
alter table public.variants               enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages       enable row level security;

-- 3. Catálogo: solo lectura --------------------------------------------------
grant select on table
  public.categories,
  public.products,
  public.product_colors,
  public.product_images,
  public.variants
to anon, authenticated;

drop policy if exists "categories: lectura pública" on public.categories;
create policy "categories: lectura pública"
  on public.categories for select
  to anon, authenticated
  using (true);

drop policy if exists "products: lectura de activos" on public.products;
create policy "products: lectura de activos"
  on public.products for select
  to anon, authenticated
  using (is_active);

drop policy if exists "product_colors: lectura de productos activos" on public.product_colors;
create policy "product_colors: lectura de productos activos"
  on public.product_colors for select
  to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active));

drop policy if exists "product_images: lectura de productos activos" on public.product_images;
create policy "product_images: lectura de productos activos"
  on public.product_images for select
  to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active));

drop policy if exists "variants: lectura de productos activos" on public.variants;
create policy "variants: lectura de productos activos"
  on public.variants for select
  to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active));

-- 4. Formularios: solo INSERT, y solo de las columnas que completa el usuario --
-- (id y created_at los pone la base; las columnas identity no necesitan permiso sobre la secuencia)
grant insert (email) on table public.newsletter_subscribers to anon, authenticated;
grant insert (name, email, message) on table public.contact_messages to anon, authenticated;

drop policy if exists "newsletter_subscribers: alta pública" on public.newsletter_subscribers;
create policy "newsletter_subscribers: alta pública"
  on public.newsletter_subscribers for insert
  to anon, authenticated
  with check (char_length(email) <= 254);

drop policy if exists "contact_messages: envío público" on public.contact_messages;
create policy "contact_messages: envío público"
  on public.contact_messages for insert
  to anon, authenticated
  with check (char_length(message) <= 5000);

-- =============================================================================
-- Qué hace cada política
-- -----------------------------------------------------------------------------
-- categories · "categories: lectura pública"
--   SELECT para anon y authenticated sobre todas las filas (las categorías no
--   tienen is_active). No hay políticas de INSERT/UPDATE/DELETE y además no hay
--   GRANT de escritura: cualquier escritura desde el cliente falla.
--
-- products · "products: lectura de activos"
--   SELECT solo de filas con is_active = true. Un producto desactivado desaparece
--   de la tienda, de la búsqueda, de favoritos y del carrito (sus variantes dejan
--   de resolverse y el carrito las saca) sin borrarlo.
--
-- product_colors / product_images / variants · "…: lectura de productos activos"
--   SELECT solo si el producto padre existe y está activo (EXISTS contra products,
--   que a su vez pasa por la política de products). Evita leer colores, fotos o
--   stock de un producto oculto pidiendo la tabla hija directamente.
--
-- newsletter_subscribers · "newsletter_subscribers: alta pública"
--   Solo INSERT, y el GRANT es por columna: el cliente únicamente puede mandar
--   email. Sin SELECT, UPDATE ni DELETE: nadie desde el navegador puede listar,
--   modificar ni borrar suscriptores. Formato, minúsculas y unicidad del email
--   los garantizan los CHECK y el UNIQUE de la tabla; un duplicado devuelve el
--   error 23505, que el front muestra como "Ya estás suscripta".
--   Como no hay SELECT, el insert se hace sin "returning" (Prefer: return=minimal).
--
-- contact_messages · "contact_messages: envío público"
--   Igual que newsletter: solo INSERT de name, email y message. Los largos y el
--   formato del email se validan con CHECK. Los mensajes se leen desde el panel
--   de Supabase (rol postgres / service_role), nunca desde el cliente.
--
-- Funciones (schema private): normalize_search y los triggers de search_text no
--   están en un schema expuesto y tienen EXECUTE revocado para el cliente.
--
-- Escritura del catálogo: solo desde el SQL Editor o el panel (rol postgres),
--   que ignora RLS. El cliente nunca recibe permisos de escritura.
-- =============================================================================
