import type { Size } from '../types'

/** Tabla de talles (en centímetros). */
export const SIZE_GUIDE: { size: Size; busto: string; cintura: string; cadera: string }[] = [
  { size: 'XS', busto: '80–84', cintura: '62–66', cadera: '88–92' },
  { size: 'S', busto: '84–88', cintura: '66–70', cadera: '92–96' },
  { size: 'M', busto: '88–94', cintura: '70–76', cadera: '96–102' },
  { size: 'L', busto: '94–100', cintura: '76–82', cadera: '102–108' },
  { size: 'XL', busto: '100–106', cintura: '82–88', cadera: '108–114' },
]
