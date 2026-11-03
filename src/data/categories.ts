import type { Category } from '../types'

/**
 * Categorías fijas del sitio: alimentan la navegación (header, footer, filtros en la URL)
 * y también el seed de la base. El tipo CategoryId es una unión cerrada, así que si se
 * agrega una categoría hay que tocar types.ts, este archivo y volver a generar el seed.
 */
export const CATEGORIES: Category[] = [
  { id: 'vestidos', name: 'Vestidos', description: 'Siluetas fluidas para el día y la noche.' },
  { id: 'blusas', name: 'Blusas y tops', description: 'Básicos nobles y camisas con caída.' },
  { id: 'pantalones', name: 'Pantalones', description: 'Sastrería relajada y denim de todos los días.' },
  { id: 'faldas', name: 'Faldas', description: 'Largos midi y texturas que se mueven.' },
  { id: 'abrigos', name: 'Abrigos', description: 'Capas para el entretiempo y el invierno.' },
  { id: 'tejidos', name: 'Tejidos', description: 'Punto suave, hilados cálidos.' },
]
