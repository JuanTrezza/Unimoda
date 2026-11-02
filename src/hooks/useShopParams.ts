import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../data/products'
import type { CategoryId, ProductQuery, Size, SortOption } from '../types'

const SORTS: SortOption[] = ['relevancia', 'precio-asc', 'precio-desc', 'novedades']
const SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL']

function parseList(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : []
}

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * Los filtros de la tienda viven en la URL (?categoria=&talle=&color=&min=&max=&orden=&q=)
 * para que el link se pueda compartir.
 */
export function useShopParams() {
  const [params, setParams] = useSearchParams()

  const query = useMemo<ProductQuery>(() => {
    const cat = params.get('categoria')
    const sort = params.get('orden') as SortOption | null
    return {
      category: CATEGORIES.some((c) => c.id === cat) ? (cat as CategoryId) : undefined,
      sizes: parseList(params.get('talle')).filter((s): s is Size => SIZES.includes(s as Size)),
      colors: parseList(params.get('color')),
      minPrice: parseNumber(params.get('min')),
      maxPrice: parseNumber(params.get('max')),
      search: params.get('q')?.trim() || undefined,
      sort: sort && SORTS.includes(sort) ? sort : 'relevancia',
    }
  }, [params])

  const update = useCallback(
    (changes: Record<string, string | string[] | number | undefined>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(changes)) {
            const str = Array.isArray(value) ? value.join(',') : value === undefined ? '' : String(value)
            if (str === '' || (key === 'orden' && str === 'relevancia')) next.delete(key)
            else next.set(key, str)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const toggleInList = useCallback(
    (key: 'talle' | 'color', value: string) => {
      const current = parseList(params.get(key))
      update({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] })
    },
    [params, update],
  )

  const clear = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams()
      const sort = prev.get('orden')
      if (sort) next.set('orden', sort)
      return next
    }, { replace: true })
  }, [setParams])

  const activeCount =
    (query.category ? 1 : 0) +
    (query.sizes?.length ?? 0) +
    (query.colors?.length ?? 0) +
    (query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0) +
    (query.search ? 1 : 0)

  return { query, key: params.toString(), update, toggleInList, clear, activeCount }
}
