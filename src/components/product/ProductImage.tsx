import { useId } from 'react'
import type { ImageView, ProductImage as ProductImageData, Silhouette } from '../../types'
import { cn } from '../../lib/format'

/** Siluetas en un viewBox de 400×500 (proporción 4:5, igual que las fotos finales). */
const SILHOUETTES: Record<Silhouette, string> = {
  vestido:
    'M172 96 Q200 118 228 96 L246 102 L258 160 L246 172 L250 204 L304 432 Q200 452 96 432 L150 204 L154 172 L142 160 L154 102 Z',
  blusa:
    'M152 104 Q200 130 248 104 L300 122 L334 214 L298 228 L282 196 L284 340 Q200 352 116 340 L118 196 L102 228 L66 214 L100 122 Z',
  pantalon: 'M138 96 L262 96 L274 146 L294 436 L232 436 L206 200 L194 200 L168 436 L106 436 L126 146 Z',
  falda: 'M148 120 L252 120 L258 148 L310 404 Q200 426 90 404 L142 148 Z',
  abrigo:
    'M150 90 Q200 106 250 90 L304 108 L338 306 L302 316 L286 206 L292 444 L108 444 L114 206 L98 316 L62 306 L96 108 Z',
  tejido:
    'M148 104 L172 96 Q200 112 228 96 L252 104 L306 126 L340 300 L302 312 L284 206 L288 350 Q200 362 112 350 L116 206 L98 312 L60 300 L94 126 Z',
}

const DETAIL_LINES: Partial<Record<Silhouette, string>> = {
  abrigo: 'M200 104 L200 444 M150 250 L250 250',
  tejido: 'M118 330 L282 330 M118 340 L282 340 M62 292 L98 302 M302 302 L338 292',
  pantalon: 'M126 146 L274 146 M200 96 L200 200',
  blusa: 'M200 120 L200 340',
}

// Fondo cálido por silueta para que la grilla no sea monótona
const BACKDROPS: Record<Silhouette, [string, string]> = {
  vestido: ['#EFE6D8', '#E2D2BC'],
  blusa: ['#F1EADF', '#E6DCCB'],
  pantalon: ['#ECE3D6', '#DCCDB8'],
  falda: ['#F2E7DE', '#E5D3C6'],
  abrigo: ['#EAE2D5', '#D8CAB4'],
  tejido: ['#F0E8DA', '#E3D6C0'],
}

const VIEW_TRANSFORM: Record<ImageView, string> = {
  frente: '',
  espalda: 'translate(400 0) scale(-1 1)',
  detalle: 'translate(-300 -330) scale(2.6)',
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 200
}

interface Props {
  image: ProductImageData
  silhouette: Silhouette
  colorHex: string
  className?: string
  /** Para las imágenes visibles al cargar la página: sin lazy */
  priority?: boolean
  /** Solo para la imagen principal (LCP) de la página */
  fetchPriority?: 'high' | 'auto'
  /** Ancho con el que se muestra, para elegir del srcset */
  sizes?: string
}

// Medidas de las fotos de producto (4:5) cuando la imagen no trae las suyas
const PHOTO_WIDTH = 1024
const PHOTO_HEIGHT = 1280

/**
 * Muestra la foto real cuando `image.ready` es true; mientras tanto, un placeholder
 * en SVG con la silueta de la prenda teñida con el color elegido.
 */
export function ProductImage({ image, silhouette, colorHex, className, priority, fetchPriority = 'auto', sizes }: Props) {
  const gradientId = useId()

  if (image.ready) {
    return (
      <img
        src={image.url ?? `${import.meta.env.BASE_URL}images/products/${image.file}`}
        srcSet={sizes ? image.srcSet : undefined}
        sizes={sizes && image.srcSet ? sizes : undefined}
        alt={image.alt}
        width={image.width ?? PHOTO_WIDTH}
        height={image.height ?? PHOTO_HEIGHT}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={fetchPriority}
        decoding="async"
        className={cn('h-full w-full object-cover', className)}
      />
    )
  }

  const [from, to] = BACKDROPS[silhouette]
  const light = isLight(colorHex)
  const detail = DETAIL_LINES[silhouette]

  return (
    <svg
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={image.alt}
      className={cn('h-full w-full', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={image.view === 'espalda' ? to : from} />
          <stop offset="1" stopColor={image.view === 'espalda' ? from : to} />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill={`url(#${gradientId})`} />
      {/* Sombra de piso */}
      <ellipse cx="200" cy="468" rx="130" ry="10" fill="#1F1B18" opacity="0.06" />
      <g transform={VIEW_TRANSFORM[image.view]}>
        {image.view !== 'detalle' && (
          <path
            d="M200 74 q0 -20 14 -20 q10 0 10 10 M200 74 L136 100 M200 74 L264 100"
            fill="none"
            stroke="#6B625A"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.55"
          />
        )}
        <path
          d={SILHOUETTES[silhouette]}
          fill={colorHex}
          stroke={light ? '#BFA27C' : 'none'}
          strokeWidth={light ? 1.5 : 0}
          strokeLinejoin="round"
        />
        {detail && (
          <path d={detail} fill="none" stroke={light ? '#BFA27C' : '#000'} strokeOpacity={light ? 0.6 : 0.18} strokeWidth="1.5" />
        )}
      </g>
    </svg>
  )
}
