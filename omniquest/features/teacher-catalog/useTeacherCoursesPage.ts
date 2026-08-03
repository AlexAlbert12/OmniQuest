import { useCallback, useEffect, useRef, useState } from 'react'
import type { TeacherCoursesPayload } from '../../lib/teacherServerData'
import { fetchTeacherCoursesPage } from './api'
import type { TeacherCourseFilter, TeacherCourseSort } from './types'

const EMPTY: TeacherCoursesPayload = {
  items: [], total: 0, limit: 12, offset: 0,
  summary: {
    courses: 0, students: 0, activeStudents: 0, questions: 0, played: 0,
    answeredQuestions: 0, availableQuestions: 0, weightedScore: 0,
    enrolledThisWeek: 0, activeStudentsThisWeek: 0, playedThisWeek: 0, questionsThisWeek: 0,
  },
}

export function useTeacherCoursesPage({ page, pageSize, search, status, sort, enabled = true }: {
  page: number
  pageSize: number
  search: string
  status: TeacherCourseFilter
  sort: TeacherCourseSort
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
      const next = await fetchTeacherCoursesPage({ page, pageSize, search, status, sort })
      if (currentRequest === requestId.current) setPayload(next)
    } catch (loadError) {
      if (currentRequest === requestId.current) setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los cursos.')
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [enabled, page, pageSize, search, sort, status])

  useEffect(() => { void load(false) }, [load])
  return { ...payload, error, loading, refreshing, refresh: () => { void load(true) } }
}
