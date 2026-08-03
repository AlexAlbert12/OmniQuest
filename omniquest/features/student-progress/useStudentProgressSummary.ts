import { useCallback, useEffect, useState } from 'react'
import { fetchStudentProgressSummary } from './api'
import type { StudentProgressSummary } from './types'

export function useStudentProgressSummary(enabled = true) {
  const [data, setData] = useState<StudentProgressSummary | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      setData(await fetchStudentProgressSummary())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el progreso.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => { void reload() }, [reload])
  return { data, loading, error, reload }
}
