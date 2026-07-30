import { useCallback, useEffect, useRef, useState } from 'react'
import { callTeacherRpc, type TeacherClassroomsPayload } from '../../lib/teacherServerData'

const EMPTY: TeacherClassroomsPayload = {
  items: [], total: 0, limit: 12, offset: 0,
  summary: { classrooms: 0, courses: 0 },
}

export function useTeacherClassroomsPage({ page, pageSize, search, enabled = true }: {
  page: number
  pageSize: number
  search: string
  enabled?: boolean
}) {
  const [payload, setPayload] = useState(EMPTY)
  const [loading, setLoading] = useState(enabled)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async (refresh = false) => {
    if (!enabled) return
    const currentRequest = ++requestId.current
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const next = await callTeacherRpc<TeacherClassroomsPayload>('get_teacher_classrooms_page', {
        p_search: search.trim() || undefined,
        p_limit: pageSize,
        p_offset: page * pageSize,
      })
      if (currentRequest === requestId.current) setPayload(next)
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las clases.')
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [enabled, page, pageSize, search])

  useEffect(() => { void load(false) }, [load])

  return { ...payload, error, loading, refreshing, refresh: () => load(true) }
}
