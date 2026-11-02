# Unimoda

E-commerce de moda femenina argentina. React 19 + TypeScript + Vite + Tailwind CSS 3, publicado en GitHub Pages.

## Scripts

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173/Unimoda/
npm run build      # tsc + build de producción en dist/
npm run preview    # sirve dist/
npm run test:e2e   # Playwright en 375 px y 1440 px (la primera vez: npx playwright install chromium)
```

## Estructura

```
src/
  data/          productos, categorías, colores, talles y fotos editoriales (datos de ejemplo)
  services/      catalog.ts: única puerta de acceso a los datos (async). En la etapa 2 lee Supabase.
  store/         carrito, favoritos y toasts (Zustand, persistidos en localStorage)
  hooks/         useAsync, useCartLines, useShopParams (filtros en la URL), useFocusTrap
  components/    layout, ui (drawer, modal, toast, íconos), product, cart, shop
  pages/         Inicio, Tienda, Producto, Carrito, Favoritos, Nosotros, Contacto, 404
legacy/          sitio anterior en HTML + Bootstrap (no forma parte del build)
docs/FOTOS.md    lista de fotos a producir
```

## Decisiones

- **HashRouter**: GitHub Pages no reescribe rutas, así que las URLs son `/Unimoda/#/tienda?categoria=vestidos`.
- **El carrito guarda solo `variantId` y cantidad.** Precio, nombre y stock se leen siempre del catálogo (`useCartLines`).
- **Filtros en la URL** (`categoria`, `talle`, `color`, `min`, `max`, `orden`, `q`): el link se puede compartir.
- **Imágenes**: fotos reales donde hay (`photos` en cada producto, `ready` en las editoriales) y placeholders en SVG donde faltan. Ver `docs/FOTOS.md`.
- Tipografías Fraunces e Inter servidas localmente con `@fontsource-variable`.

## Deploy

`.github/workflows/deploy.yml` compila y publica `dist/` en cada push a `master`. En el repo, en Settings → Pages → Source, elegí **GitHub Actions**.
