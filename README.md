# Unimoda

E-commerce de moda femenina argentina. React 19 + TypeScript + Vite + Tailwind CSS 3, publicado en GitHub Pages.

## Scripts

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173/Unimoda/
npm run build      # tsc + build de producción en dist/
npm run preview    # sirve dist/
npm run test:e2e   # Playwright en 375 px y 1440 px, con Supabase mockeado (la primera vez: npx playwright install chromium)
npm run db:seed    # regenera supabase/seed.sql desde src/data/products.ts
```

## Estructura

```
src/
  data/          categorías, guía de talles y fotos editoriales. products.ts solo alimenta el seed y los tests
  services/      catalog.ts (catálogo) y forms.ts (newsletter, contacto): única puerta a Supabase
  lib/           supabase.ts (cliente), formato de precios, fotos por color
  store/         carrito, favoritos y toasts (Zustand, persistidos en localStorage)
  hooks/         useAsync, useCartLines, useShopParams (filtros en la URL), useFocusTrap
  components/    layout, ui (drawer, modal, toast, íconos), product, cart, shop
  pages/         Inicio, Tienda, Producto, Carrito, Favoritos, Nosotros, Contacto, 404
supabase/        migraciones SQL y seed.sql (generado)
scripts/         generate-seed.ts y catalog-rows.ts (filas compartidas por el seed y los mocks)
tests/           Playwright + supabase-mock.ts
legacy/          sitio anterior en HTML + Bootstrap (no forma parte del build)
docs/FOTOS.md    lista de fotos a producir
```

## Decisiones

- **HashRouter**: GitHub Pages no reescribe rutas, así que las URLs son `/Unimoda/#/tienda?categoria=vestidos`. Los links de los emails de Supabase vuelven a `/Unimoda/?auth=…&code=…` (ver *Autenticación*).
- **El carrito guarda solo `variantId` y cantidad.** Precio, nombre y stock se leen siempre del catálogo (`useCartLines`).
- **Filtros en la URL** (`categoria`, `talle`, `color`, `min`, `max`, `orden`, `q`): el link se puede compartir.
- **Imágenes**: las de producto salen de `product_images` en Supabase; las editoriales, de `src/data/editorial.ts` (`ready`). Donde falta foto se muestra un placeholder en SVG. Ver `docs/FOTOS.md`.
- Tipografías Fraunces e Inter servidas localmente con `@fontsource-variable`.

## Deploy

`.github/workflows/deploy.yml` compila y publica `dist/` en cada push a `master`. En el repo, en Settings → Pages → Source, elegí **GitHub Actions**.

## Base de datos (Supabase)

El catálogo, la newsletter y el formulario de contacto viven en Supabase. El front usa solo la
publishable key: lo que se puede leer o escribir lo deciden los `GRANT` y las políticas RLS.

### Variables de entorno

Copiá `.env.example` a `.env.local` y completalo (Supabase → Project Settings → API):

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Sin esas variables la app se corta al iniciar con un mensaje que dice cuál falta.

### Aplicar migraciones y seed

En el **SQL Editor** de Supabase, pegá y corré cada archivo completo, en este orden:

1. `supabase/migrations/0001_catalog.sql`: tablas del catálogo, índices y búsqueda
2. `supabase/migrations/0002_forms.sql`: newsletter y contacto
3. `supabase/migrations/0003_rls_and_grants.sql`: permisos y políticas RLS
4. `supabase/migrations/0004_auth_orders.sql`: perfiles, direcciones, pedidos, `create_order` y `cancel_order`
5. `supabase/seed.sql`: categorías, productos, colores, imágenes y variantes

Todos son idempotentes: se pueden volver a correr. El seed hace upsert por `slug` / `sku`, así que
sirve también para actualizar precios o stock. Al final muestra un conteo de control.

Con la CLI de Supabase el equivalente es `supabase db push` y después correr `seed.sql`.

### Cambiar el catálogo

1. Editá `src/data/products.ts`.
2. `npm run db:seed` regenera `supabase/seed.sql` (no se edita a mano).
3. Corré `seed.sql` en el SQL Editor.

Para ocultar un producto sin borrarlo: `update products set is_active = false where slug = '...'`.

### Modelo

- Precios en **centavos** (`price_cents`, `compare_at_cents`), siempre enteros.
- `product_colors.slug` es la clave del color compartida entre productos (`negro`, `crudo`…) y la usa el filtro `?color=`.
- `variants.sku` es el id que guarda el carrito en `localStorage`.
- `product_images.color_id` null = la foto sirve para todos los colores. La galería muestra las fotos del color elegido y, si no tiene, las compartidas.
- `products.search_text` lo mantiene un trigger (nombre, descripción, material, categoría y colores, sin tildes). La búsqueda de la tienda filtra con `ilike` sobre esa columna.

### Deploy

El workflow lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` de los secrets del repo
(Settings → Secrets and variables → Actions → New repository secret). La publishable key termina
dentro del bundle público, eso es esperado: la seguridad la dan RLS y los `GRANT`.

## Autenticación

Supabase Auth con email y contraseña, flujo **PKCE** (`src/lib/supabase.ts`). La sesión vive en
`localStorage` (`unimoda-auth`) y `src/store/session.ts` la refleja para la UI. El carrito es
independiente de la sesión: no se pierde al ingresar ni al salir.

**Links de los emails con HashRouter** (`src/lib/authRedirect.ts`): con PKCE, Supabase agrega
`?code=…` a la URL de vuelta. Si esa URL tuviera un `#/ruta`, el `?code=` quedaría detrás del hash y
el router lo tomaría como parte de la ruta. Por eso `emailRedirectTo` / `redirectTo` apuntan a la raíz
con un tipo: `https://juantrezza.github.io/Unimoda/?auth=signup` o `?auth=recovery`. Al cargar, antes
de montar React, se espera a que auth-js canjee el código (`supabase.auth.initialize()`) y se
reemplaza la URL por la ruta con hash que corresponde (`#/cuenta`, `#/nueva-contrasena`), sin el
`code` en el historial. Si el link se abre en otro navegador (no está el *code verifier* de PKCE),
el email igual queda confirmado y se manda a Ingresar con un aviso.

Rutas que piden sesión (`RequireAuth`): `/cuenta`, `/cuenta/pedidos`, `/cuenta/pedidos/:id`,
`/checkout` y `/checkout/confirmado/:id`. Sin sesión redirigen a `/ingresar?volver=<ruta>`.

## Seguridad

**El precio se calcula en el servidor.** El navegador es del usuario: cualquier cosa que mande se
puede modificar desde las DevTools. Por eso `create_order` recibe solo `[{variant_id, quantity}]` y
una dirección; el precio sale de `products.price_cents`, el envío de `private.checkout_rules()` y el
total se suma en la base. Los montos que muestra el front son solo informativos.

**RLS + GRANT.** El proyecto no expone tablas solo: cada tabla tiene `GRANT` explícitos y políticas
RLS. Cada usuario ve y edita solo su `profile` y sus `addresses` (`auth.uid() = user_id`) y puede
*leer* sus `orders` / `order_items`. Nadie desde el cliente puede insertar, editar ni borrar
`orders`, `order_items` ni `variants`: no hay `GRANT` de escritura.

**Funciones `security definer`.** `create_order` y `cancel_order` corren con los permisos de su
dueño, por eso pueden escribir pedidos y descontar stock aunque el cliente no pueda. A cambio:

- `set search_path = ''` y todos los nombres calificados (`public.variants`), para que nadie pueda
  "colar" una tabla o función con el mismo nombre en otro schema;
- validan todo adentro: sesión (`auth.uid()`), que la dirección o el pedido sean del usuario, forma
  y límites de `items` (1 a 20 líneas, cantidad 1 a 10, sin repetidos), producto activo y stock;
- bloquean las variantes con `SELECT … FOR UPDATE` ordenado por id (sin sobreventa ni deadlocks) y
  hacen todo en una transacción;
- limitan a 5 pedidos `pendiente_pago` por usuario por hora;
- `EXECUTE` solo para `authenticated` (revocado a `public` y `anon`).

Las funciones internas viven en el schema `private`, que la Data API no expone.

**Pago simulado.** Los pedidos quedan en `pendiente_pago` y no se cobra nada (proyecto demo). El
paso a `pagado` va a hacerlo solo un webhook de Mercado Pago desde una Edge Function con
`service_role` (TODO en `src/services/orders.ts`).
