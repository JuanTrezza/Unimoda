-- =============================================================================
-- 0005 · Panel de administración
-- Idempotente. Requiere 0001–0004. Si volvés a correr 0003 (que revoca todo),
-- volvé a correr esta después.
--
-- Quién es admin: el claim app_metadata.role = 'admin' del JWT. app_metadata solo
-- se puede escribir con service_role o desde SQL; el usuario no puede tocarlo
-- (user_metadata sí, por eso NUNCA se usa para permisos).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- private.is_admin()
--
-- Las políticas RLS se evalúan con el rol de quien consulta (anon / authenticated),
-- así que ese rol necesita USAGE en el schema private y EXECUTE en la función.
-- No queda expuesta por la API porque la Data API solo publica los schemas de
-- "Exposed schemas" (public); private no está ahí, así que no existe
-- /rest/v1/rpc/is_admin. Y aunque alguien la llamara, solo lee el JWT de quien la
-- llama: no revela nada de otros usuarios. El resto de las funciones de private
-- siguen sin EXECUTE para el cliente.
-- -----------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

grant usage on schema private to anon, authenticated;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- Los triggers de búsqueda ahora también corren cuando el admin edita desde la API
-- (rol authenticated, con GRANT por columna). Pasan a security definer para que
-- puedan recalcular search_text y llamar a normalize_search sin darle esos
-- permisos al cliente. Solo trabajan sobre la fila que ya pasó RLS.
alter function private.products_set_search_text() security definer;
alter function private.product_colors_touch_product() security definer;

-- -----------------------------------------------------------------------------
-- updated_at en products y variants
-- -----------------------------------------------------------------------------
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.variants add column if not exists updated_at timestamptz not null default now();

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

drop trigger if exists variants_updated_at on public.variants;
create trigger variants_updated_at
  before update on public.variants
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- product_images.source: 'static' = public/images del sitio (las 16 actuales),
-- 'storage' = bucket product-images. El front arma la URL según el origen.
-- -----------------------------------------------------------------------------
alter table public.product_images add column if not exists source text not null default 'static';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_images_source_check') then
    alter table public.product_images
      add constraint product_images_source_check check (source in ('static', 'storage'));
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- orders.number: número corto para mostrar y buscar (los primeros 8 del uuid)
-- -----------------------------------------------------------------------------
alter table public.orders
  add column if not exists number text generated always as (upper(left(id::text, 8))) stored;
create index if not exists orders_number_idx on public.orders (number);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);

-- -----------------------------------------------------------------------------
-- Cambios de estado de un pedido: una sola regla para todos los caminos
-- (cancel_order del cliente, admin_set_order_status y el UPDATE directo del admin).
--   pendiente_pago → pagado → enviado
--   pendiente_pago | pagado → cancelado  (devuelve el stock)
-- -----------------------------------------------------------------------------
create or replace function private.orders_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if not (
       (old.status = 'pendiente_pago' and new.status in ('pagado', 'cancelado'))
    or (old.status = 'pagado' and new.status in ('enviado', 'cancelado'))
  ) then
    raise exception using errcode = 'UM007',
      message = format('No se puede pasar un pedido de %s a %s.', old.status, new.status);
  end if;

  if new.status = 'cancelado' then
    -- Mismo orden de locks que create_order: variantes por id
    perform 1 from public.variants va
    where va.id in (select oi.variant_id from public.order_items oi where oi.order_id = new.id)
    order by va.id
    for update;

    update public.variants va set stock = va.stock + oi.quantity
    from public.order_items oi
    where oi.order_id = new.id and va.id = oi.variant_id;
  end if;
  return new;
end
$$;

drop trigger if exists orders_status_change on public.orders;
create trigger orders_status_change
  before update of status on public.orders
  for each row execute function private.orders_status_change();

-- cancel_order (0004) ahora deja la devolución de stock al trigger
create or replace function public.cancel_order(order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Tenés que ingresar a tu cuenta.';
  end if;

  select o.status into v_status from public.orders o
  where o.id = cancel_order.order_id and o.user_id = v_uid
  for update;
  if not found then
    raise exception using errcode = 'UM005', message = 'No encontramos ese pedido.';
  end if;
  -- El cliente solo puede cancelar mientras no pagó
  if v_status <> 'pendiente_pago' then
    raise exception using errcode = 'UM006', message = 'Este pedido ya no se puede cancelar.';
  end if;

  update public.orders o set status = 'cancelado' where o.id = cancel_order.order_id;
end
$$;

-- -----------------------------------------------------------------------------
-- admin_set_order_status(order_id, status)
--   42501 no es admin · UM005 pedido inexistente · UM007 transición inválida
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_order_status(order_id uuid, status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Solo para administradores.';
  end if;
  if admin_set_order_status.status not in ('pendiente_pago', 'pagado', 'enviado', 'cancelado') then
    raise exception using errcode = '22023', message = 'Estado inválido.';
  end if;

  perform 1 from public.orders o where o.id = admin_set_order_status.order_id for update;
  if not found then
    raise exception using errcode = 'UM005', message = 'No encontramos ese pedido.';
  end if;

  -- El trigger orders_status_change valida la transición y devuelve el stock si cancela
  update public.orders o set status = admin_set_order_status.status
  where o.id = admin_set_order_status.order_id;
end
$$;

-- -----------------------------------------------------------------------------
-- admin_dashboard(): resumen calculado en la base (no se traen todas las filas).
-- security invoker: corre con los permisos del admin, que RLS ya habilita.
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_month_start timestamptz :=
    date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires';
  v_result jsonb;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Solo para administradores.';
  end if;

  select jsonb_build_object(
    'month_sales_cents', (
      select coalesce(sum(o.total_cents), 0) from public.orders o
      where o.status in ('pagado', 'enviado') and o.created_at >= v_month_start
    ),
    'month_orders', (
      select count(*) from public.orders o
      where o.status in ('pagado', 'enviado') and o.created_at >= v_month_start
    ),
    'pending_orders', (
      select count(*) from public.orders o where o.status = 'pendiente_pago'
    ),
    'top_products', coalesce((
      select jsonb_agg(t order by t.units desc, t.name)
      from (
        select coalesce(p.name, oi.product_name) as name, p.slug,
               sum(oi.quantity)::integer as units, sum(oi.line_total_cents)::bigint as revenue_cents
        from public.order_items oi
        join public.orders o on o.id = oi.order_id and o.status in ('pagado', 'enviado')
        left join public.variants va on va.id = oi.variant_id
        left join public.products p on p.id = va.product_id
        where o.created_at >= v_month_start
        group by coalesce(p.name, oi.product_name), p.slug
        order by units desc, name
        limit 5
      ) t
    ), '[]'::jsonb),
    'low_stock', coalesce((
      select jsonb_agg(l order by l.stock, l.product_name, l.sku)
      from (
        select va.sku, va.size, va.stock, p.id as product_id, p.name as product_name,
               p.is_active, pc.name as color_name
        from public.variants va
        join public.products p on p.id = va.product_id
        join public.product_colors pc on pc.id = va.color_id
        where va.stock <= 2
        order by va.stock, p.name, va.sku
        limit 50
      ) l
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end
$$;

-- =============================================================================
-- Permisos y políticas de admin
-- Los GRANT van a authenticated (no hay un rol de Postgres "admin": el admin es
-- un usuario autenticado con el claim). RLS es lo que limita a los admins.
-- =============================================================================

-- --- Catálogo: CRUD -----------------------------------------------------------
grant insert (slug, name, description, sort_order),
      update (slug, name, description, sort_order),
      delete
  on table public.categories to authenticated;

grant insert (slug, name, description, details, care, material, category_id, price_cents,
              compare_at_cents, is_new, is_active, popularity),
      update (slug, name, description, details, care, material, category_id, price_cents,
              compare_at_cents, is_new, is_active, popularity),
      delete
  on table public.products to authenticated;

grant insert (product_id, slug, name, hex, sort_order),
      update (slug, name, hex, sort_order),
      delete
  on table public.product_colors to authenticated;

grant insert (product_id, color_id, view, path, width, height, alt, sort_order, source),
      update (color_id, view, alt, sort_order),
      delete
  on table public.product_images to authenticated;

-- product_id / color_id / size / sku en UPDATE: los necesita el upsert de la grilla de stock
grant insert (product_id, color_id, size, sku, stock),
      update (product_id, color_id, size, sku, stock),
      delete
  on table public.variants to authenticated;

drop policy if exists "categories: admin escribe" on public.categories;
create policy "categories: admin escribe"
  on public.categories for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- products: el admin ve también los inactivos (reemplaza la política de 0003)
drop policy if exists "products: lectura de activos" on public.products;
create policy "products: lectura de activos"
  on public.products for select to anon, authenticated
  using (is_active or (select private.is_admin()));

drop policy if exists "products: admin escribe" on public.products;
create policy "products: admin escribe"
  on public.products for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "product_colors: lectura de productos activos" on public.product_colors;
create policy "product_colors: lectura de productos activos"
  on public.product_colors for select to anon, authenticated
  using (exists (
    select 1 from public.products p where p.id = product_id and (p.is_active or (select private.is_admin()))
  ));

drop policy if exists "product_colors: admin escribe" on public.product_colors;
create policy "product_colors: admin escribe"
  on public.product_colors for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "product_images: lectura de productos activos" on public.product_images;
create policy "product_images: lectura de productos activos"
  on public.product_images for select to anon, authenticated
  using (exists (
    select 1 from public.products p where p.id = product_id and (p.is_active or (select private.is_admin()))
  ));

drop policy if exists "product_images: admin escribe" on public.product_images;
create policy "product_images: admin escribe"
  on public.product_images for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "variants: lectura de productos activos" on public.variants;
create policy "variants: lectura de productos activos"
  on public.variants for select to anon, authenticated
  using (exists (
    select 1 from public.products p where p.id = product_id and (p.is_active or (select private.is_admin()))
  ));

drop policy if exists "variants: admin escribe" on public.variants;
create policy "variants: admin escribe"
  on public.variants for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- --- Pedidos: SELECT de todos y UPDATE solo de status -------------------------
grant update (status) on table public.orders to authenticated;

drop policy if exists "orders: admin lee todos" on public.orders;
create policy "orders: admin lee todos"
  on public.orders for select to authenticated
  using ((select private.is_admin()));

drop policy if exists "orders: admin cambia estado" on public.orders;
create policy "orders: admin cambia estado"
  on public.orders for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "order_items: admin lee todos" on public.order_items;
create policy "order_items: admin lee todos"
  on public.order_items for select to authenticated
  using ((select private.is_admin()));

-- --- Formularios: el admin los lee ----------------------------------------------
grant select on table public.contact_messages, public.newsletter_subscribers to authenticated;

drop policy if exists "contact_messages: admin lee" on public.contact_messages;
create policy "contact_messages: admin lee"
  on public.contact_messages for select to authenticated
  using ((select private.is_admin()));

drop policy if exists "newsletter_subscribers: admin lee" on public.newsletter_subscribers;
create policy "newsletter_subscribers: admin lee"
  on public.newsletter_subscribers for select to authenticated
  using ((select private.is_admin()));

-- --- Funciones ------------------------------------------------------------------
revoke all on function public.admin_set_order_status(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_dashboard() from public, anon, authenticated;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
-- cancel_order se recreó: se reafirman sus permisos
revoke all on function public.cancel_order(uuid) from public, anon, authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.orders_status_change() from public, anon, authenticated;

-- =============================================================================
-- Storage: bucket público "product-images"
-- Lectura: al ser público, las URLs /object/public/… se sirven sin pasar por RLS.
-- Escritura: solo admins, con políticas sobre storage.objects. Los GRANT de
-- storage.objects los administra Supabase (rol supabase_storage_admin); acá
-- solo se agregan políticas.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- SELECT: la API de Storage lo necesita para borrar y reemplazar. Solo admins (así
-- nadie puede listar el bucket; ver una foto no lo necesita).
drop policy if exists "product-images: admin lee" on storage.objects;
create policy "product-images: admin lee"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));

drop policy if exists "product-images: admin sube" on storage.objects;
create policy "product-images: admin sube"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select private.is_admin()));

drop policy if exists "product-images: admin reemplaza" on storage.objects;
create policy "product-images: admin reemplaza"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()))
  with check (bucket_id = 'product-images' and (select private.is_admin()));

drop policy if exists "product-images: admin borra" on storage.objects;
create policy "product-images: admin borra"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));

-- =============================================================================
-- Qué hace cada política nueva
-- -----------------------------------------------------------------------------
-- private.is_admin(): lee app_metadata.role del JWT. Los clientes tienen USAGE en
--   private y EXECUTE solo en esta función (las políticas la necesitan); private
--   no está en "Exposed schemas", así que no se puede llamar por /rpc.
--
-- "<tabla>: admin escribe" (categories, products, product_colors, product_images,
--   variants): FOR ALL con using/with check = is_admin(). Los GRANT a
--   authenticated son por columna; un usuario común tiene el GRANT pero ninguna
--   política lo deja escribir, así que cualquier INSERT/UPDATE/DELETE falla.
--
-- "…: lectura de productos activos": ahora is_active OR is_admin(). Los clientes
--   siguen viendo solo lo activo; el admin ve todo (el front de la tienda igual
--   filtra is_active para que el admin vea la tienda como un cliente).
--
-- orders: "admin lee todos" (SELECT) y "admin cambia estado" (UPDATE, GRANT solo
--   de la columna status). El trigger orders_status_change valida la transición
--   y devuelve el stock al cancelar, venga el cambio de cancel_order, de
--   admin_set_order_status o de un UPDATE directo: no hay forma de saltearlo.
--
-- order_items / contact_messages / newsletter_subscribers: SELECT para admin.
--
-- Lo de los clientes no cambia: profiles y addresses siguen limitados a
--   auth.uid(), y create_order / cancel_order con las mismas validaciones.
--
-- storage.objects (bucket product-images): SELECT/INSERT/UPDATE/DELETE solo
--   admin. La lectura pública es por la URL del bucket público. Tamaño (5 MB) y
--   tipos (jpeg, webp, png) los aplica el bucket.
-- =============================================================================

-- =============================================================================
-- Hacerte admin (correr APARTE, cambiando el email). Después cerrá sesión y
-- volvé a entrar: el claim viaja en el JWT y el token viejo no lo tiene.
--
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
--   where email = 'jgmorenotrezza@gmail.com';
--
-- Quitarlo:
--   update auth.users set raw_app_meta_data = raw_app_meta_data - 'role'
--   where email = 'jgmorenotrezza@gmail.com';
-- =============================================================================
