/**
 * Fuente de datos del seed (scripts/generate-seed.ts) y de los mocks de los tests.
 * La app ya no importa este archivo: el catálogo se lee de Supabase (src/services/catalog.ts).
 */
import type { Color, ImageView, Product, Silhouette, Size, Variant } from '../types'

export { CATEGORIES } from './categories'

export const COLORS = {
  negro: { id: 'negro', name: 'Negro', hex: '#1F1B18' },
  crudo: { id: 'crudo', name: 'Crudo', hex: '#EDE4D3' },
  blanco: { id: 'blanco', name: 'Blanco', hex: '#FAF8F4' },
  terracota: { id: 'terracota', name: 'Terracota', hex: '#A4502F' },
  arena: { id: 'arena', name: 'Arena', hex: '#D2B48C' },
  camel: { id: 'camel', name: 'Camel', hex: '#B5885A' },
  chocolate: { id: 'chocolate', name: 'Chocolate', hex: '#5A3E2B' },
  salvia: { id: 'salvia', name: 'Salvia', hex: '#8A9A7E' },
  oliva: { id: 'oliva', name: 'Oliva', hex: '#6B6B3A' },
  marino: { id: 'marino', name: 'Azul marino', hex: '#26324A' },
  celeste: { id: 'celeste', name: 'Celeste', hex: '#A9C2D6' },
  rosa: { id: 'rosa', name: 'Rosa empolvado', hex: '#D8A9A0' },
  bordo: { id: 'bordo', name: 'Bordó', hex: '#6E2A2F' },
  gris: { id: 'gris', name: 'Gris melange', hex: '#9A9590' },
} satisfies Record<string, Color>

type ColorKey = keyof typeof COLORS

const ALL_SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL']

/** Stock determinístico (mismo resultado en cada carga) con algunos agotados. */
function seededStock(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const n = Math.abs(h) % 13
  return n < 2 ? 0 : n - 1
}

interface ProductSeed {
  id: string
  slug: string
  name: string
  category: Product['category']
  silhouette: Silhouette
  price: number
  compareAtPrice?: number
  description: string
  details: string[]
  material: string
  care: string
  colors: ColorKey[]
  sizes?: Size[]
  isNew?: boolean
  createdAt: string
  popularity: number
  /**
   * Cuántas fotos reales hay en public/images/products/, en orden frente / espalda / detalle
   * ({slug}-1.jpg, -2.jpg, -3.jpg). Con 0 o sin definir se muestran las 3 vistas con placeholder.
   */
  photos?: number
}

const VIEW_LABEL: Record<ImageView, string> = {
  frente: 'vista de frente',
  espalda: 'vista de espalda',
  detalle: 'detalle de la tela',
}

const VIEWS: ImageView[] = ['frente', 'espalda', 'detalle']

function build({ photos = 0, ...seed }: ProductSeed): Product {
  const sizes = seed.sizes ?? ALL_SIZES
  const colors = seed.colors.map((c) => COLORS[c])
  const variants: Variant[] = colors.flatMap((color) =>
    sizes.map((size) => {
      const id = `${seed.id}-${color.id}-${size}`.toLowerCase()
      return { id, productId: seed.id, size, colorId: color.id, stock: seededStock(id) }
    }),
  )
  // Con fotos reales se muestran solo las vistas disponibles; sin fotos, las 3 vistas con placeholder
  const ready = photos > 0
  const views = ready ? VIEWS.slice(0, photos) : VIEWS
  return {
    ...seed,
    isNew: seed.isNew ?? false,
    sizes,
    colors,
    variants,
    images: views.map((view, i) => ({
      file: `${seed.slug}-${i + 1}.jpg`,
      alt: `${seed.name}, ${VIEW_LABEL[view]}`,
      view,
      ready,
    })),
  }
}

const CARE_DELICADO = 'Lavar a mano con agua fría. No usar secarropas. Planchar a temperatura baja.'
const CARE_LAVARROPAS = 'Lavarropas en ciclo delicado a 30 °C. Secar a la sombra.'
const CARE_TEJIDO = 'Lavar a mano con agua fría. Secar en plano, a la sombra.'

const SEEDS: ProductSeed[] = [
  {
    id: 'p01',
    slug: 'vestido-midi-lino',
    name: 'Vestido midi de lino',
    category: 'vestidos',
    silhouette: 'vestido',
    price: 89900,
    description:
      'Vestido de lino con escote recto, breteles finos y falda con frunce bajo el busto, largo debajo de la rodilla. Fresco, liviano y con la textura natural del lino lavado.',
    details: ['Escote recto', 'Breteles finos', 'Largo debajo de la rodilla (105 cm en talle S)', 'Bolsillos laterales'],
    material: '100% lino',
    care: CARE_DELICADO,
    colors: ['terracota', 'crudo', 'negro'],
    isNew: true,
    createdAt: '2026-10-20',
    popularity: 96,
    photos: 1,
  },
  {
    id: 'p02',
    slug: 'vestido-camisero-algodon',
    name: 'Vestido camisero de algodón',
    category: 'vestidos',
    silhouette: 'vestido',
    price: 78500,
    description:
      'Camisero largo con botones al frente y cinto del mismo género. Un clásico que funciona con zapatillas o sandalias.',
    details: ['Cuello camisero', 'Botones nacarados', 'Cinto desmontable', 'Manga 3/4'],
    material: '100% algodón poplin',
    care: CARE_LAVARROPAS,
    colors: ['celeste', 'blanco', 'salvia'],
    createdAt: '2026-08-12',
    popularity: 81,
    photos: 1,
  },
  {
    id: 'p03',
    slug: 'vestido-satinado-lencero',
    name: 'Vestido satinado lencero',
    category: 'vestidos',
    silhouette: 'vestido',
    price: 112000,
    compareAtPrice: 139000,
    description: 'Vestido de corte al bies con brillo suave y caída líquida. Breteles finos cruzados en la espalda.',
    details: ['Corte al bies', 'Breteles finos cruzados', 'Largo maxi', 'Forrería interna'],
    material: '95% viscosa, 5% elastano',
    care: CARE_DELICADO,
    colors: ['chocolate', 'negro', 'arena'],
    createdAt: '2026-06-02',
    popularity: 88,
    photos: 1,
  },
  {
    id: 'p04',
    slug: 'vestido-tejido-acanalado',
    name: 'Vestido tejido acanalado',
    category: 'vestidos',
    silhouette: 'vestido',
    price: 94500,
    description: 'Vestido de punto acanalado al cuerpo, cuello alto y manga larga. Abriga sin sumar volumen.',
    details: ['Cuello alto', 'Manga larga', 'Tejido acanalado elástico', 'Largo midi'],
    material: '70% viscosa, 30% poliamida',
    care: CARE_TEJIDO,
    colors: ['gris', 'bordo'],
    isNew: true,
    createdAt: '2026-10-05',
    popularity: 74,
    photos: 1,
  },
  {
    id: 'p05',
    slug: 'camisa-oversize-poplin',
    name: 'Camisa oversize de poplin',
    category: 'blusas',
    silhouette: 'blusa',
    price: 56900,
    description: 'Camisa amplia de poplin con hombros caídos y espalda más larga. Para usar abierta, anudada o por dentro.',
    details: ['Calce oversize', 'Hombros caídos', 'Bolsillo al pecho', 'Ruedo curvo'],
    material: '100% algodón',
    care: CARE_LAVARROPAS,
    colors: ['blanco', 'celeste', 'arena'],
    createdAt: '2026-07-18',
    popularity: 92,
    photos: 1,
  },
  {
    id: 'p06',
    slug: 'blusa-batista-bordada',
    name: 'Blusa de batista bordada',
    category: 'blusas',
    silhouette: 'blusa',
    price: 48900,
    description: 'Blusa liviana con bordado calado en el canesú y mangas abullonadas. Detalle artesanal, uso cotidiano.',
    details: ['Bordado calado', 'Mangas abullonadas', 'Cuello redondo con lazo', 'Semitransparente'],
    material: '100% algodón batista',
    care: CARE_DELICADO,
    colors: ['crudo', 'rosa'],
    isNew: true,
    createdAt: '2026-10-25',
    popularity: 70,
    photos: 1,
  },
  {
    id: 'p07',
    slug: 'musculosa-modal-basica',
    name: 'Musculosa básica de modal',
    category: 'blusas',
    silhouette: 'blusa',
    price: 24900,
    description: 'La musculosa que se usa todos los días: suave, con escote redondo y espalda nadadora.',
    details: ['Escote redondo', 'Espalda nadadora', 'Calce al cuerpo', 'Tejido suave al tacto'],
    material: '92% modal, 8% elastano',
    care: CARE_LAVARROPAS,
    colors: ['negro', 'blanco', 'salvia', 'terracota'],
    createdAt: '2026-05-10',
    popularity: 85,
    photos: 1,
  },
  {
    id: 'p08',
    slug: 'pantalon-sastrero-pinzas',
    name: 'Pantalón sastrero con pinzas',
    category: 'pantalones',
    silhouette: 'pantalon',
    price: 72900,
    description: 'Pantalón de tiro alto con pinzas y pierna amplia. Sastrería relajada para la oficina o el fin de semana.',
    details: ['Tiro alto', 'Pinzas delanteras', 'Pierna amplia', 'Bolsillos tipo cartera'],
    material: '65% poliéster, 35% viscosa',
    care: CARE_LAVARROPAS,
    colors: ['camel', 'negro', 'gris'],
    createdAt: '2026-09-02',
    popularity: 90,
    photos: 1,
  },
  {
    id: 'p09',
    slug: 'jean-recto-tiro-alto',
    name: 'Jean recto tiro alto',
    category: 'pantalones',
    silhouette: 'pantalon',
    price: 68500,
    compareAtPrice: 79900,
    description: 'Jean rígido de pierna recta y largo tobillero. Lavado medio que mejora con el uso.',
    details: ['Tiro alto', 'Pierna recta', 'Largo tobillero', 'Cinco bolsillos'],
    material: '100% algodón denim 12 oz',
    care: 'Lavar del revés con agua fría. No usar lavandina.',
    colors: ['celeste', 'marino'],
    createdAt: '2026-04-21',
    popularity: 94,
    photos: 1,
  },
  {
    id: 'p10',
    slug: 'pantalon-lino-cintura-elastizada',
    name: 'Pantalón de lino con cintura elastizada',
    category: 'pantalones',
    silhouette: 'pantalon',
    price: 61900,
    description: 'Pantalón fresco de lino con cintura elastizada y cordón. Cómodo, liviano y con caída.',
    details: ['Cintura elastizada', 'Cordón ajustable', 'Pierna amplia', 'Bolsillos laterales'],
    material: '55% lino, 45% viscosa',
    care: CARE_DELICADO,
    colors: ['arena', 'oliva', 'blanco'],
    isNew: true,
    createdAt: '2026-10-12',
    popularity: 77,
    photos: 1,
  },
  {
    id: 'p11',
    slug: 'falda-midi-plisada',
    name: 'Falda midi plisada',
    category: 'faldas',
    silhouette: 'falda',
    price: 58900,
    description: 'Falda plisada con cintura elástica forrada y largo a media pierna. Se mueve con cada paso.',
    details: ['Plisado permanente', 'Cintura elástica', 'Largo midi', 'Forrería interna'],
    material: '100% poliéster reciclado',
    care: CARE_DELICADO,
    colors: ['salvia', 'chocolate', 'negro'],
    createdAt: '2026-08-28',
    popularity: 83,
    photos: 1,
  },
  {
    id: 'p12',
    slug: 'falda-satinada-al-bies',
    name: 'Falda satinada al bies',
    category: 'faldas',
    silhouette: 'falda',
    price: 54500,
    description: 'Falda lisa cortada al bies, con brillo sutil. Combina con tejidos gruesos en invierno y remeras en verano.',
    details: ['Corte al bies', 'Cintura elástica oculta', 'Largo midi', 'Brillo satinado'],
    material: '100% viscosa satinada',
    care: CARE_DELICADO,
    colors: ['arena', 'bordo', 'negro'],
    isNew: true,
    createdAt: '2026-10-28',
    popularity: 72,
    photos: 1,
  },
  {
    id: 'p13',
    slug: 'trench-gabardina',
    name: 'Trench de gabardina',
    category: 'abrigos',
    silhouette: 'abrigo',
    price: 189900,
    description: 'Trench cruzado de gabardina con cinto y charreteras. La prenda de entretiempo que dura años.',
    details: ['Doble botonadura', 'Cinto con hebilla forrada', 'Charreteras', 'Largo debajo de la rodilla'],
    material: '100% algodón gabardina',
    care: 'Limpieza en seco recomendada.',
    colors: ['camel', 'negro'],
    createdAt: '2026-03-15',
    popularity: 87,
    photos: 1,
  },
  {
    id: 'p14',
    slug: 'blazer-pano-entallado',
    name: 'Blazer de paño entallado',
    category: 'abrigos',
    silhouette: 'abrigo',
    price: 149900,
    compareAtPrice: 172000,
    description: 'Blazer de paño con hombros estructurados y un solo botón. Levanta cualquier jean.',
    details: ['Un botón', 'Hombreras suaves', 'Bolsillos con solapa', 'Forro completo'],
    material: '60% lana, 40% poliéster',
    care: 'Limpieza en seco.',
    colors: ['gris', 'chocolate', 'negro'],
    createdAt: '2026-05-30',
    popularity: 79,
    photos: 1,
  },
  {
    id: 'p15',
    slug: 'sweater-cuello-alto',
    name: 'Sweater cuello alto',
    category: 'tejidos',
    silhouette: 'tejido',
    price: 82900,
    description: 'Sweater de punto fino con cuello alto doblado. Suave, liviano y fácil de superponer.',
    details: ['Cuello alto doble', 'Punto fino', 'Puños y ruedo acanalados', 'Calce regular'],
    material: '50% lana merino, 50% acrílico',
    care: CARE_TEJIDO,
    colors: ['crudo', 'camel', 'negro', 'bordo'],
    createdAt: '2026-04-02',
    popularity: 89,
    photos: 1,
  },
  {
    id: 'p16',
    slug: 'cardigan-trenzado-oversize',
    name: 'Cárdigan trenzado oversize',
    category: 'tejidos',
    silhouette: 'tejido',
    price: 96500,
    description: 'Cárdigan amplio con trenzas en el frente y botones de madera. Abrazo tejido para los días fríos.',
    details: ['Trenzas en el frente', 'Botones de madera', 'Hombros caídos', 'Bolsillos parche'],
    material: '60% acrílico, 30% lana, 10% alpaca',
    care: CARE_TEJIDO,
    colors: ['arena', 'salvia', 'crudo'],
    sizes: ['S', 'M', 'L'],
    isNew: true,
    createdAt: '2026-10-18',
    popularity: 80,
    photos: 1,
  },
]

export const PRODUCTS: Product[] = SEEDS.map(build)
