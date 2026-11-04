/**
 * Prepara una foto antes de subirla: máximo 1600 px de alto (sin agrandar), WebP con canvas
 * y medidas reales para guardar en product_images. Sin dependencias.
 */
export const MAX_HEIGHT = 1600
const MAX_BYTES = 5 * 1024 * 1024 // límite del bucket
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

export interface PreparedImage {
  blob: Blob
  type: string
  extension: 'webp' | 'jpg'
  width: number
  height: number
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No pudimos procesar la foto.'))), type, quality),
  )
}

export async function prepareImage(file: File, maxHeight = MAX_HEIGHT): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Usá una foto JPG, PNG o WebP.')

  // createImageBitmap respeta la orientación EXIF (las fotos del celular no quedan giradas)
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('No pudimos leer la foto. Probá con otro archivo.')
  })
  const scale = Math.min(1, maxHeight / bitmap.height)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Tu navegador no puede procesar fotos.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // Safari viejo no codifica WebP (devuelve PNG): en ese caso, JPEG
  let blob = await toBlob(canvas, 'image/webp', 0.85)
  let extension: PreparedImage['extension'] = 'webp'
  if (blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/jpeg', 0.88)
    extension = 'jpg'
  }
  if (blob.size > MAX_BYTES) throw new Error('La foto pesa más de 5 MB incluso después de achicarla.')
  return { blob, type: blob.type, extension, width, height }
}
