/** Fotos editoriales (no de producto). Pasar `ready` a true cuando estén en public/images/editorial/ */
export interface EditorialImage {
  file: string
  alt: string
  ready: boolean
  /** Medidas reales del archivo: se usan en width/height del <img> para reservar el espacio (sin CLS) */
  width: number
  height: number
  /** Colores del placeholder */
  tones: [string, string, string]
}

// Categorías: 960×1280 (3:4)
const CATEGORY = { ready: true, width: 960, height: 1280 } as const

export const EDITORIAL = {
  hero: {
    file: 'hero.jpg',
    alt: 'Mujer con vestido de lino terracota caminando al sol en una calle empedrada',
    ready: true,
    width: 1024,
    height: 1280,
    tones: ['#E9D9C3', '#C9805F', '#A4502F'],
  },
  temporada: {
    file: 'temporada-primavera.jpg',
    alt: 'Dos mujeres con prendas de lino en tonos arena y salvia apoyadas en una pared blanca',
    ready: true,
    width: 1280,
    height: 960,
    tones: ['#EFE6D8', '#D9C3A5', '#8A9A7E'],
  },
  nosotros: {
    file: 'nosotros-taller.jpg',
    alt: 'Mesa de corte del taller con moldes, tijeras y rollos de tela',
    ready: true,
    width: 1024,
    height: 1280,
    tones: ['#EFE6D8', '#BFA27C', '#5A3E2B'],
  },
  vestidos: { ...CATEGORY, file: 'categoria-vestidos.jpg', alt: 'Vestidos de la colección', tones: ['#F2E7DE', '#D8A9A0', '#A4502F'] },
  blusas: { ...CATEGORY, file: 'categoria-blusas.jpg', alt: 'Blusas y tops de la colección', tones: ['#F1EADF', '#E4D6C1', '#A9C2D6'] },
  pantalones: { ...CATEGORY, file: 'categoria-pantalones.jpg', alt: 'Pantalones de la colección', tones: ['#ECE3D6', '#B5885A', '#5A3E2B'] },
  faldas: { ...CATEGORY, file: 'categoria-faldas.jpg', alt: 'Faldas de la colección', tones: ['#EFE6D8', '#8A9A7E', '#6B6B3A'] },
  abrigos: { ...CATEGORY, file: 'categoria-abrigos.jpg', alt: 'Abrigos de la colección', tones: ['#EAE2D5', '#B5885A', '#1F1B18'] },
  tejidos: { ...CATEGORY, file: 'categoria-tejidos.jpg', alt: 'Tejidos de la colección', tones: ['#F0E8DA', '#D9C3A5', '#6E2A2F'] },
} satisfies Record<string, EditorialImage>
