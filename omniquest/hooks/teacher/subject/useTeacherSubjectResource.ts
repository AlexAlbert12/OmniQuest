import { useCallback, useEffect, useRef, useState } from 'react'

export function useTeacherSubjectResource<T>({
  enabled,
  initialValue,
  loader,
}: {
  enabled: boolean
  initialValue: T
  loader: () => Promise<T>
}) {
  const [data, setData] = useState<T>(initialValue)
  const [loading, setLoading] = useState(enabled)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async (refresh = false) => {
    if (!enabled) return undefined
    const currentRequest = ++requestId.current
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const next = await loader()
      if (currentRequest === requestId.current) setData(next)
      return next
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los datos.')
      }
      throw loadError
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [enabled, loader])

  useEffect(() => {
    if (!enabled) return
    void load(false).catch(() => undefined)
  }, [enabled, load])

  return { data, error, load, loading, refreshing, refresh: () => load(true), setData }
}
