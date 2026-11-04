-- =============================================================================
-- 0004 · Cuentas, direcciones, pedidos y checkout
-- Idempotente: se puede volver a correr. Requiere 0001–0003.
--
-- Regla de oro: el cliente NUNCA escribe orders, order_items ni variants.
-- Los pedidos se crean y cancelan solo con create_order / cancel_order
-- (security definer), que leen precios y stock de la base.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Constantes del checkout: ÚNICO lugar donde viven en SQL.
-- Tienen que coincidir con src/lib/format.ts (FREE_SHIPPING_FROM, SHIPPING_COST,
-- en pesos) y src/store/cart.ts (MAX_PER_ITEM). Acá van en centavos.
-- -----------------------------------------------------------------------------
create or replace function private.checkout_rules(
  out shipping_cents integer,            -- $ 8.500
  out free_shipping_from_cents integer,  -- $ 150.000
  out max_lines integer,
  out max_quantity integer,
  out max_pending_per_hour integer
)
language sql
immutable
set search_path = ''
as $$
  select 850000, 15000000, 20, 10, 5
$$;

-- Envío según subtotal (centavos)
create or replace function private.shipping_for(subtotal_cents bigint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when subtotal_cents >= r.free_shipping_from_cents then 0 else r.shipping_cents end
  from private.checkout_rules() r
$$;

-- -----------------------------------------------------------------------------
-- profiles (1 a 1 con auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key,
  full_name  text not null default '',
  phone      text,
  created_at timestamptz not null default now(),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade,
  constraint profiles_full_name_length check (char_length(full_name) <= 100),
  constraint profiles_phone_format check (phone is null or phone ~ '^\+?[0-9][0-9 ()-]{5,19}$')
);

-- Crea el perfil al registrarse. security definer: corre como dueño (postgres) aunque el
-- INSERT en auth.users lo haga supabase_auth_admin; search_path vacío para no resolver
-- objetos de schemas que un usuario pudiera manipular.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100))
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Usuarios creados antes de esta migración
insert into public.profiles (id, full_name)
select u.id, left(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), 100)
from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- addresses
-- -----------------------------------------------------------------------------
create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  street      text not null,
  number      text not null,
  apartment   text,
  city        text not null,
  province    text not null,
  postal_code text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint addresses_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint addresses_street_length check (char_length(btrim(street)) between 2 and 100),
  constraint addresses_number_format check (number ~ '^[0-9A-Za-z/ -]{1,10}$'),
  constraint addresses_apartment_length check (apartment is null or char_length(btrim(apartment)) between 1 and 20),
  constraint addresses_city_length check (char_length(btrim(city)) between 2 and 80),
  constraint addresses_province_check check (province in (
    'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
    'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
    'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
    'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
  )),
  -- 4 dígitos (1425) o CPA (C1425ABC)
  constraint addresses_postal_code_format check (postal_code ~ '^([0-9]{4}|[A-Z][0-9]{4}[A-Z]{3})$')
);

create index if not exists addresses_user_id_idx on public.addresses (user_id);
-- Una sola dirección predeterminada por usuario
create unique index if not exists addresses_one_default_per_user on public.addresses (user_id) where is_default;

-- Al marcar una como predeterminada se desmarcan las demás; máximo 10 direcciones por usuario.
-- security invoker: corre con los permisos (y RLS) del propio usuario.
create or replace function private.addresses_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.addresses a where a.user_id = new.user_id) >= 10 then
    raise exception using errcode = 'UM010', message = 'Podés guardar hasta 10 direcciones.';
  end if;
  if new.is_default then
    update public.addresses a set is_default = false
    where a.user_id = new.user_id and a.id <> new.id and a.is_default;
  end if;
  return new;
end
$$;

drop trigger if exists addresses_before_write on public.addresses;
create trigger addresses_before_write
  before insert or update on public.addresses
  for each row execute function private.addresses_before_write();

-- -----------------------------------------------------------------------------
-- orders y order_items
-- -----------------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  -- set null: si se borra la cuenta, el pedido queda para la contabilidad
  user_id          uuid,
  status           text not null default 'pendiente_pago',
  subtotal_cents   integer not null,
  shipping_cents   integer not null,
  total_cents      integer not null,
  -- Copia de la dirección al momento de comprar (si después se edita, el pedido no cambia)
  shipping_address jsonb not null,
  created_at       timestamptz not null default now(),
  constraint orders_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null,
  constraint orders_status_check check (status in ('pendiente_pago', 'pagado', 'enviado', 'cancelado')),
  constraint orders_amounts_check check (
    subtotal_cents > 0 and shipping_cents >= 0 and total_cents = subtotal_cents + shipping_cents
  ),
  constraint orders_address_is_object check (jsonb_typeof(shipping_address) = 'object')
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);

create table if not exists public.order_items (
  id               bigint generated by default as identity primary key,
  order_id         uuid not null,
  -- set null: el ítem conserva sku, nombre y precio aunque la variante se borre
  variant_id       bigint,
  sku              text not null,
  product_name     text not null,
  color_name       text not null,
  size             text not null,
  unit_price_cents integer not null,
  quantity         integer not null,
  line_total_cents integer not null,
  constraint order_items_order_id_fkey foreign key (order_id) references public.orders (id) on delete cascade,
  constraint order_items_variant_id_fkey foreign key (variant_id) references public.variants (id) on delete set null,
  constraint order_items_order_variant_key unique (order_id, variant_id),
  constraint order_items_price_positive check (unit_price_cents > 0),
  constraint order_items_quantity_range check (quantity between 1 and 10),
  constraint order_items_line_total check (line_total_cents = unit_price_cents * quantity)
);

-- order_id: cubierto por order_items_order_variant_key
create index if not exists order_items_variant_id_idx on public.order_items (variant_id);

-- -----------------------------------------------------------------------------
-- create_order(items, address_id) → id del pedido
--
-- Códigos de error (SQLSTATE) que interpreta src/services/orders.ts:
--   28000  sin sesión
--   22023  items con formato inválido
--   UM001  sin stock          · detail: JSON [{sku, product_name, color_name, size, requested, available}]
--   UM002  variante inexistente · detail: JSON [variant_id, …]
--   UM003  dirección inválida
--   UM004  demasiados pedidos pendientes en la última hora
-- -----------------------------------------------------------------------------
create or replace function public.create_order(items jsonb, address_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_rules    record;
  v_address  public.addresses%rowtype;
  v_profile  public.profiles%rowtype;
  v_lines    integer;
  v_missing  jsonb;
  v_problems jsonb;
  v_subtotal bigint;
  v_order_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Tenés que ingresar a tu cuenta para comprar.';
  end if;

  select * into v_rules from private.checkout_rules();

  -- 1. Forma de items: array de 1 a N objetos {variant_id: entero, quantity: entero 1..10}
  if items is null or jsonb_typeof(items) <> 'array' then
    raise exception using errcode = '22023', message = 'items tiene que ser un array.';
  end if;
  v_lines := jsonb_array_length(items);
  if v_lines < 1 or v_lines > v_rules.max_lines then
    raise exception using errcode = '22023',
      message = format('El pedido tiene que tener entre 1 y %s productos distintos.', v_rules.max_lines);
  end if;
  if exists (
    select 1 from jsonb_array_elements(items) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(jsonb_typeof(e -> 'variant_id'), '') <> 'number'
       or coalesce(jsonb_typeof(e -> 'quantity'), '') <> 'number'
       or (e ->> 'variant_id') !~ '^[0-9]{1,18}$'
       or (e ->> 'quantity') !~ '^[0-9]{1,3}$'
  ) then
    raise exception using errcode = '22023', message = 'Formato de items inválido.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(items) e
    where (e ->> 'quantity')::integer not between 1 and v_rules.max_quantity
  ) then
    raise exception using errcode = '22023',
      message = format('La cantidad de cada producto va de 1 a %s.', v_rules.max_quantity);
  end if;
  if (select count(distinct (e ->> 'variant_id')::bigint) from jsonb_array_elements(items) e) <> v_lines then
    raise exception using errcode = '22023', message = 'Hay productos repetidos en el pedido.';
  end if;

  -- 2. La dirección tiene que ser del usuario
  select * into v_address from public.addresses a
  where a.id = create_order.address_id and a.user_id = v_uid;
  if not found then
    raise exception using errcode = 'UM003', message = 'La dirección de envío no es válida.';
  end if;

  -- 3. Límite contra abuso. El advisory lock serializa los pedidos del mismo usuario
  --    para que dos llamadas simultáneas no pasen el control a la vez.
  perform pg_advisory_xact_lock(hashtextextended('create_order:' || v_uid::text, 0));
  if (
    select count(*) from public.orders o
    where o.user_id = v_uid and o.status = 'pendiente_pago' and o.created_at > now() - interval '1 hour'
  ) >= v_rules.max_pending_per_hour then
    raise exception using errcode = 'UM004',
      message = 'Tenés demasiados pedidos pendientes de pago. Probá de nuevo más tarde.';
  end if;

  -- 4. Bloquear las variantes en orden de id: dos pedidos con los mismos productos
  --    siempre toman los locks en el mismo orden y no hay deadlock.
  perform 1 from public.variants va
  where va.id in (select (e ->> 'variant_id')::bigint from jsonb_array_elements(items) e)
  order by va.id
  for update;

  create temp table if not exists pg_temp.checkout_lines (
    variant_id bigint, sku text, product_name text, color_name text, size text,
    price_cents integer, is_active boolean, stock integer, quantity integer
  ) on commit drop;
  truncate pg_temp.checkout_lines;

  insert into pg_temp.checkout_lines
  select va.id, va.sku, p.name, pc.name, va.size, p.price_cents, p.is_active, va.stock, l.quantity
  from (
    select (e ->> 'variant_id')::bigint as variant_id, (e ->> 'quantity')::integer as quantity
    from jsonb_array_elements(items) e
  ) l
  join public.variants va on va.id = l.variant_id
  join public.products p on p.id = va.product_id
  join public.product_colors pc on pc.id = va.color_id;

  select jsonb_agg(l.variant_id) into v_missing
  from (select (e ->> 'variant_id')::bigint as variant_id from jsonb_array_elements(items) e) l
  where not exists (select 1 from pg_temp.checkout_lines c where c.variant_id = l.variant_id);
  if v_missing is not null then
    raise exception using errcode = 'UM002', message = 'Algunos productos ya no existen.', detail = v_missing::text;
  end if;

  -- 5. Stock (un producto inactivo cuenta como sin stock). Se informan todas las líneas juntas.
  select jsonb_agg(jsonb_build_object(
    'sku', c.sku, 'product_name', c.product_name, 'color_name', c.color_name, 'size', c.size,
    'requested', c.quantity, 'available', case when c.is_active then c.stock else 0 end
  ) order by c.variant_id) into v_problems
  from pg_temp.checkout_lines c
  where not c.is_active or c.stock < c.quantity;
  if v_problems is not null then
    raise exception using errcode = 'UM001', message = 'No hay stock suficiente.', detail = v_problems::text;
  end if;

  -- 6. Totales con precios de la base (nunca del cliente)
  select sum(c.price_cents::bigint * c.quantity) into v_subtotal from pg_temp.checkout_lines c;
  if v_subtotal > 2000000000 then
    raise exception using errcode = '22023', message = 'El total supera el máximo permitido.';
  end if;

  select * into v_profile from public.profiles pr where pr.id = v_uid;

  insert into public.orders (user_id, status, subtotal_cents, shipping_cents, total_cents, shipping_address)
  values (
    v_uid,
    'pendiente_pago',
    v_subtotal,
    private.shipping_for(v_subtotal),
    v_subtotal + private.shipping_for(v_subtotal),
    jsonb_build_object(
      'recipient', coalesce(v_profile.full_name, ''),
      'phone', v_profile.phone,
      'street', v_address.street,
      'number', v_address.number,
      'apartment', v_address.apartment,
      'city', v_address.city,
      'province', v_address.province,
      'postal_code', v_address.postal_code
    )
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, variant_id, sku, product_name, color_name, size, unit_price_cents, quantity, line_total_cents
  )
  select v_order_id, c.variant_id, c.sku, c.product_name, c.color_name, c.size, c.price_cents, c.quantity,
         c.price_cents * c.quantity
  from pg_temp.checkout_lines c
  order by c.variant_id;

  -- 7. Descontar stock (las filas ya están bloqueadas)
  update public.variants va set stock = va.stock - c.quantity
  from pg_temp.checkout_lines c
  where va.id = c.variant_id;

  return v_order_id;
end
$$;

-- -----------------------------------------------------------------------------
-- cancel_order(order_id): solo el dueño y solo si está 'pendiente_pago'. Devuelve el stock.
--   28000 sin sesión · UM005 pedido inexistente o ajeno · UM006 ya no se puede cancelar
-- -----------------------------------------------------------------------------
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
  if v_status <> 'pendiente_pago' then
    raise exception using errcode = 'UM006', message = 'Este pedido ya no se puede cancelar.';
  end if;

  -- Mismo orden de locks que create_order
  perform 1 from public.variants va
  where va.id in (select oi.variant_id from public.order_items oi where oi.order_id = cancel_order.order_id)
  order by va.id
  for update;

  update public.variants va set stock = va.stock + oi.quantity
  from public.order_items oi
  where oi.order_id = cancel_order.order_id and va.id = oi.variant_id;

  update public.orders o set status = 'cancelado' where o.id = cancel_order.order_id;
end
$$;

-- =============================================================================
-- Permisos y RLS
-- =============================================================================
revoke all on table public.profiles, public.addresses, public.orders, public.order_items
  from public, anon, authenticated;

alter table public.profiles    enable row level security;
alter table public.addresses   enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- profiles: leer y editar el propio (sin INSERT ni DELETE: los maneja el trigger / el cascade)
grant select on table public.profiles to authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;

drop policy if exists "profiles: leer el propio" on public.profiles;
create policy "profiles: leer el propio"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles: editar el propio" on public.profiles;
create policy "profiles: editar el propio"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- addresses: CRUD de las propias. user_id lo completa el default auth.uid(): no se puede mandar.
grant select, delete on table public.addresses to authenticated;
grant insert (street, number, apartment, city, province, postal_code, is_default) on table public.addresses to authenticated;
grant update (street, number, apartment, city, province, postal_code, is_default) on table public.addresses to authenticated;

drop policy if exists "addresses: leer las propias" on public.addresses;
create policy "addresses: leer las propias"
  on public.addresses for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "addresses: crear propias" on public.addresses;
create policy "addresses: crear propias"
  on public.addresses for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "addresses: editar las propias" on public.addresses;
create policy "addresses: editar las propias"
  on public.addresses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "addresses: borrar las propias" on public.addresses;
create policy "addresses: borrar las propias"
  on public.addresses for delete to authenticated
  using ((select auth.uid()) = user_id);

-- orders / order_items: solo lectura de lo propio
grant select on table public.orders, public.order_items to authenticated;

drop policy if exists "orders: leer los propios" on public.orders;
create policy "orders: leer los propios"
  on public.orders for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "order_items: leer los de pedidos propios" on public.order_items;
create policy "order_items: leer los de pedidos propios"
  on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));

-- variants: se reafirma que el cliente solo puede leer (el stock lo tocan las funciones)
revoke insert, update, delete, truncate on table public.variants from public, anon, authenticated;

-- Funciones: EXECUTE solo para authenticated. Supabase da EXECUTE a anon por defecto
-- en las funciones nuevas de public, por eso se revoca explícitamente.
revoke all on function public.create_order(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.cancel_order(uuid) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, uuid) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
-- El trigger de auth.users lo dispara supabase_auth_admin
grant usage on schema private to supabase_auth_admin;
grant execute on function private.handle_new_user() to supabase_auth_admin;

-- =============================================================================
-- Qué hace cada política
-- -----------------------------------------------------------------------------
-- profiles · "leer el propio" / "editar el propio"
--   Solo authenticated y solo la fila con id = auth.uid(). El UPDATE está limitado
--   por GRANT a full_name y phone. No hay INSERT (lo crea handle_new_user al
--   registrarse) ni DELETE (se borra en cascada con auth.users).
--
-- addresses · leer / crear / editar / borrar las propias
--   Todas comparan auth.uid() con user_id. En INSERT el user_id sale del default
--   auth.uid() y el WITH CHECK impide guardarla a nombre de otro. El GRANT por
--   columna no deja mandar id, user_id ni created_at. Un trigger (security
--   invoker) mantiene una sola predeterminada y limita a 10 por usuario.
--
-- orders · "leer los propios"  /  order_items · "leer los de pedidos propios"
--   Solo SELECT. No hay GRANT de INSERT/UPDATE/DELETE: la única forma de crear o
--   cancelar un pedido es create_order / cancel_order.
--
-- create_order / cancel_order (security definer, search_path = '')
--   Corren como su dueño, por eso pueden escribir orders, order_items y variants
--   aunque el cliente no tenga permiso. A cambio validan todo adentro: sesión
--   (auth.uid()), que la dirección / el pedido sean del usuario, forma y límites
--   de items, producto activo y stock con las filas bloqueadas (FOR UPDATE en
--   orden de id). El precio sale de products.price_cents y el envío de
--   private.checkout_rules(): el cliente solo manda variant_id y cantidad.
--   search_path vacío + nombres calificados (public.x) evitan que alguien cree
--   una tabla o función con el mismo nombre en otro schema y la "cuele".
--   EXECUTE solo para authenticated.
-- =============================================================================
