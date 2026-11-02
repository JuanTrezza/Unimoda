import { useId } from 'react'
import type { EditorialImage } from '../../data/editorial'
import { cn } from '../../lib/format'

interface Props {
  image: EditorialImage
  className?: string
  /** Imagen principal de la página (LCP): carga inmediata y con prioridad alta */
  priority?: boolean
}

/** Foto editorial real o, mientras tanto, una composición abstracta con arcos y degradé. */
export function EditorialPicture({ image, className, priority }: Props) {
  const id = useId()
  if (image.ready) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}images/editorial/${image.file}`}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        className={cn('h-full w-full object-cover', className)}
      />
    )
  }
  const [bg, mid, deep] = image.tones
  return (
    <svg
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={image.alt}
      className={cn('h-full w-full', className)}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg} />
          <stop offset="1" stopColor={mid} stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.72" cy="0.28" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="1000" fill={`url(#${id}-bg)`} />
      <rect width="800" height="1000" fill={`url(#${id}-sun)`} />
      <path d="M-40 1000 V560 a340 340 0 0 1 680 0 V1000 Z" fill={mid} opacity="0.55" />
      <path d="M260 1000 V700 a250 250 0 0 1 500 0 V1000 Z" fill={deep} opacity="0.75" />
      <circle cx="590" cy="260" r="70" fill={deep} opacity="0.18" />
    </svg>
  )
}
