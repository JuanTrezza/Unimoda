import { useEffect } from 'react'

const SITE = 'Unimoda'
const DEFAULT_DESCRIPTION =
  'Unimoda: moda femenina argentina. Vestidos, tejidos, sastrería y básicos nobles. Envíos a todo el país, 6 cuotas sin interés y cambios gratis.'

interface SeoProps {
  title?: string
  description?: string
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

/** Actualiza title, description y Open Graph de cada página. */
export function Seo({ title, description = DEFAULT_DESCRIPTION }: SeoProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE}` : `${SITE} · Moda femenina argentina`
    document.title = fullTitle
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', window.location.href)
  }, [title, description])

  return null
}
