/**
 * De cada foto de producto y editorial genera, junto a la original:
 *   - {nombre}-360.webp: para las tarjetas de las grillas en un celular (unos 340 px físicos)
 *   - {nombre}-640.webp: 640 px de ancho, para pantallas chicas
 *   - {nombre}.webp: mismo tamaño que el JPG pero mucho más liviana. Un celular con DPR 2 pide
 *     unos 780 px para una foto a ancho completo: sin esto bajaría el JPG entero.
 * El front las usa en srcset y deja el JPG como src de respaldo. Solo regenera las que faltan
 * o quedaron viejas.
 *
 *   npm run images
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const DIRS = ['public/images/products', 'public/images/editorial']

let created = 0
let bytes = 0
for (const dir of DIRS) {
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.jpg')) continue
    const source = join(dir, file)
    const sourceTime = statSync(source).mtimeMs
    const variants = [
      { target: join(dir, file.replace(/\.jpg$/, '-360.webp')), width: 360 },
      { target: join(dir, file.replace(/\.jpg$/, '-640.webp')), width: 640 },
      { target: join(dir, file.replace(/\.jpg$/, '.webp')), width: undefined },
    ]
    for (const { target, width } of variants) {
      const existing = statSync(target, { throwIfNoEntry: false })
      if (existing && existing.mtimeMs >= sourceTime) continue
      const image = sharp(source)
      if (width) image.resize({ width, withoutEnlargement: true })
      const info = await image.webp({ quality: 70 }).toFile(target)
      created++
      bytes += info.size
    }
  }
}
console.log(`${created} imágenes generadas (${Math.round(bytes / 1024)} KB)`)
