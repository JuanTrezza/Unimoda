import { useEffect } from 'react'

const SITE = 'Unimoda'
const DEFAULT_DESCRIPTION =
  'Unimoda: moda femenina argentina. Vestidos, tejidos, sastrería y básicos nobles. Envíos a todo el país, 6 cuotas sin interés y cambios gratis.'
const DEFAULT_IMAGE = { url: `${import.meta.env.BASE_URL}og-image.png`, width: 1200, height: 630 }

interface SeoProps {
  title?: string
  description?: string
  /** Foto para compartir (og:image). Sin definir, la imagen general del sitio. */
  image?: { url: string; width?: number; height?: number }
  type?: 'website' | 'product'
  /** Datos estructurados (schema.org) */
  jsonLd?: object
  /** Páginas privadas o sin valor en un buscador */
  noindex?: boolean
}

function setMeta(attr: 'name' | 'property', key: string, content: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (content === undefined) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

/** Actualiza title, description, Open Graph y JSON-LD de cada página. */
export function Seo({ title, description = DEFAULT_DESCRIPTION, image = DEFAULT_IMAGE, type = 'website', jsonLd, noindex }: SeoProps) {
  const ld = jsonLd && JSON.stringify(jsonLd)

  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE}` : `${SITE} · Moda femenina argentina`
    document.title = fullTitle
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noindex ? 'noindex' : undefined)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:url', window.location.href)
    setMeta('property', 'og:image', new URL(image.url, window.location.href).href)
    setMeta('property', 'og:image:width', image.width?.toString())
    setMeta('property', 'og:image:height', image.height?.toString())
  }, [title, description, image.url, image.width, image.height, type, noindex])

  useEffect(() => {
    if (!ld) return
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = ld
    document.head.appendChild(script)
    return () => script.remove()
  }, [ld])

  return null
}
