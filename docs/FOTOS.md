# Fotos de Unimoda

Estado: **25 de 57 listas**: las 9 editoriales y la foto de frente de los 16 productos. Faltan las de espalda (`-2`) y detalle (`-3`).

Mientras una foto no está, la web muestra un placeholder en SVG: la silueta de la prenda teñida del color elegido o, en las editoriales, una composición abstracta.

## Cómo cargar fotos nuevas

1. Exportá en **JPG, calidad 80, sRGB**, con **las mismas medidas** que figuran en la tabla. Los `<img>` declaran `width`/`height` con esas medidas para reservar el espacio y evitar saltos de layout (CLS). Si cambiás de tamaño o proporción, actualizá también:
   - productos: `PHOTO_WIDTH`/`PHOTO_HEIGHT` en `src/components/product/ProductImage.tsx`;
   - editoriales: `width`/`height` de la entrada en `src/data/editorial.ts`.
2. Fotos de producto → `public/images/products/` · Editoriales → `public/images/editorial/`.
3. Activalas:
   - **Producto**: en `src/data/products.ts`, el campo `photos` de cada producto (ver abajo).
   - **Editorial**: en `src/data/editorial.ts`, `ready: true` en la entrada.

### El campo `photos`

`photos` indica **cuántas fotos reales hay** de ese producto, siempre en este orden: `{slug}-1.jpg` frente → `-2.jpg` espalda → `-3.jpg` detalle.

| Valor | Qué muestra la web |
|---|---|
| sin definir o `0` | las 3 vistas con placeholder |
| `1` | solo la foto de frente. Sin miniaturas en la galería y sin cambio de imagen al pasar el mouse por la tarjeta |
| `2` | frente y espalda. Aparecen las miniaturas, y la tarjeta muestra la espalda al pasar el mouse |
| `3` | las tres vistas |

Hoy los 16 productos tienen `photos: 1`. Cuando subas la espalda de un producto, cambialo a `2`. Las fotos tienen que ser consecutivas: con `photos: 2` la web busca `-1` y `-2`.

La foto real muestra la prenda en su **primer color**. Al elegir otro color en el detalle, la foto no cambia (el placeholder sí se teñía). Para tener fotos por color hay que ampliar el modelo de datos.

Estilo general: fondo crema o pared clara, luz natural cálida, mucho aire alrededor de la prenda, sin logos ni marcas visibles.

## Editoriales (9 de 9 ✅)

| | Archivo | Descripción | Medidas |
|---|---|---|---|
| ✅ | `hero.jpg` | Mujer con vestido de lino terracota caminando al sol en una calle empedrada. Carga con `fetchpriority="high"` | 4:5 (1024 × 1280) |
| ✅ | `temporada-primavera.jpg` | Dos mujeres con prendas de lino en tonos arena y salvia apoyadas en una pared blanca | 4:3 apaisada (1280 × 960) |
| ✅ | `nosotros-taller.jpg` | Mesa de corte del taller con moldes, tijeras y rollos de tela | 4:5 (1024 × 1280) |
| ✅ | `categoria-vestidos.jpg` | Vestido en percha o modelo, plano medio | 3:4 (960 × 1280) |
| ✅ | `categoria-blusas.jpg` | Camisa o blusa clara, plano medio | 3:4 (960 × 1280) |
| ✅ | `categoria-pantalones.jpg` | Pantalón sastrero camel, de cintura para abajo | 3:4 (960 × 1280) |
| ✅ | `categoria-faldas.jpg` | Falda plisada en movimiento | 3:4 (960 × 1280) |
| ✅ | `categoria-abrigos.jpg` | Trench camel sobre los hombros | 3:4 (960 × 1280) |
| ✅ | `categoria-tejidos.jpg` | Detalle de sweater o cárdigan tejido | 3:4 (960 × 1280) |

## Productos (16 de 48 ✅)

`-1` frente ✅ · `-2` espalda ⏳ · `-3` detalle ⏳

| | Archivo | Descripción | Medidas |
|---|---|---|---|
| ✅ | `vestido-midi-lino-1.jpg` | Vestido midi de lino en terracota — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `vestido-midi-lino-2.jpg` | Vestido midi de lino en terracota — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `vestido-midi-lino-3.jpg` | Vestido midi de lino en terracota — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `vestido-camisero-algodon-1.jpg` | Vestido camisero de algodón en celeste — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `vestido-camisero-algodon-2.jpg` | Vestido camisero de algodón en celeste — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `vestido-camisero-algodon-3.jpg` | Vestido camisero de algodón en celeste — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `vestido-satinado-lencero-1.jpg` | Vestido satinado lencero en chocolate — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `vestido-satinado-lencero-2.jpg` | Vestido satinado lencero en chocolate — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `vestido-satinado-lencero-3.jpg` | Vestido satinado lencero en chocolate — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `vestido-tejido-acanalado-1.jpg` | Vestido tejido acanalado en gris melange — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `vestido-tejido-acanalado-2.jpg` | Vestido tejido acanalado en gris melange — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `vestido-tejido-acanalado-3.jpg` | Vestido tejido acanalado en gris melange — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `camisa-oversize-poplin-1.jpg` | Camisa oversize de poplin en blanco — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `camisa-oversize-poplin-2.jpg` | Camisa oversize de poplin en blanco — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `camisa-oversize-poplin-3.jpg` | Camisa oversize de poplin en blanco — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `blusa-batista-bordada-1.jpg` | Blusa de batista bordada en crudo — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `blusa-batista-bordada-2.jpg` | Blusa de batista bordada en crudo — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `blusa-batista-bordada-3.jpg` | Blusa de batista bordada en crudo — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `musculosa-modal-basica-1.jpg` | Musculosa básica de modal en negro — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `musculosa-modal-basica-2.jpg` | Musculosa básica de modal en negro — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `musculosa-modal-basica-3.jpg` | Musculosa básica de modal en negro — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `pantalon-sastrero-pinzas-1.jpg` | Pantalón sastrero con pinzas en camel — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `pantalon-sastrero-pinzas-2.jpg` | Pantalón sastrero con pinzas en camel — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `pantalon-sastrero-pinzas-3.jpg` | Pantalón sastrero con pinzas en camel — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `jean-recto-tiro-alto-1.jpg` | Jean recto tiro alto en celeste — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `jean-recto-tiro-alto-2.jpg` | Jean recto tiro alto en celeste — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `jean-recto-tiro-alto-3.jpg` | Jean recto tiro alto en celeste — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `pantalon-lino-cintura-elastizada-1.jpg` | Pantalón de lino con cintura elastizada en arena — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `pantalon-lino-cintura-elastizada-2.jpg` | Pantalón de lino con cintura elastizada en arena — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `pantalon-lino-cintura-elastizada-3.jpg` | Pantalón de lino con cintura elastizada en arena — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `falda-midi-plisada-1.jpg` | Falda midi plisada en salvia — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `falda-midi-plisada-2.jpg` | Falda midi plisada en salvia — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `falda-midi-plisada-3.jpg` | Falda midi plisada en salvia — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `falda-satinada-al-bies-1.jpg` | Falda satinada al bies en arena — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `falda-satinada-al-bies-2.jpg` | Falda satinada al bies en arena — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `falda-satinada-al-bies-3.jpg` | Falda satinada al bies en arena — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `trench-gabardina-1.jpg` | Trench de gabardina en camel — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `trench-gabardina-2.jpg` | Trench de gabardina en camel — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `trench-gabardina-3.jpg` | Trench de gabardina en camel — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `blazer-pano-entallado-1.jpg` | Blazer de paño entallado en gris melange — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `blazer-pano-entallado-2.jpg` | Blazer de paño entallado en gris melange — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `blazer-pano-entallado-3.jpg` | Blazer de paño entallado en gris melange — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `sweater-cuello-alto-1.jpg` | Sweater cuello alto en crudo — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `sweater-cuello-alto-2.jpg` | Sweater cuello alto en crudo — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `sweater-cuello-alto-3.jpg` | Sweater cuello alto en crudo — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
| ✅ | `cardigan-trenzado-oversize-1.jpg` | Cárdigan trenzado oversize en arena — Frente, prenda puesta en modelo de cuerpo entero (o de rodillas para arriba), fondo crema liso, luz natural suave | 4:5 (1024 × 1280) |
| ⏳ | `cardigan-trenzado-oversize-2.jpg` | Cárdigan trenzado oversize en arena — Espalda, misma modelo y fondo | 4:5 (1024 × 1280) |
| ⏳ | `cardigan-trenzado-oversize-3.jpg` | Cárdigan trenzado oversize en arena — Detalle macro de la tela, costura o terminación | 4:5 (1024 × 1280) |
