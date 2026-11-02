import { useEffect, useState } from 'react'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: Error | undefined
}

// Cache en memoria por clave: evita parpadeos al volver a una página ya visitada.
const cache = new Map<string, unknown>()

/**
 * Ejecuta una función async del servicio de catálogo y cachea el resultado por `key`.
 * La clave tiene que incluir todos los parámetros que cambian el resultado.
 * Con `keepPrevious`, mientras carga una clave nueva se siguen mostrando los datos anteriores
 * (útil para filtros: la grilla no vuelve a los esqueletos en cada cambio).
 */
export function useAsync<T>(key: string, fn: () => Promise<T>, { keepPrevious = false } = {}): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>(() => ({
    data: cache.get(key) as T | undefined,
    loading: !cache.has(key),
    error: undefined,
  }))

  useEffect(() => {
    let cancelled = false
    const cached = cache.get(key) as T | undefined
    setState((prev) => ({
      data: cached ?? (keepPrevious ? prev.data : undefined),
      loading: cached === undefined,
      error: undefined,
    }))
    fn().then(
      (data) => {
        cache.set(key, data)
        if (!cancelled) setState({ data, loading: false, error: undefined })
      },
      (error: unknown) => {
        if (!cancelled)
          setState({ data: undefined, loading: false, error: error instanceof Error ? error : new Error(String(error)) })
      },
    )
    return () => {
      cancelled = true
    }
    // fn cambia en cada render: la clave describe sus dependencias
  }, [key])

  return state
}
