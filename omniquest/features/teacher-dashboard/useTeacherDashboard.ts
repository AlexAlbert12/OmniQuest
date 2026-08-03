import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { fetchTeacherDashboard } from './api'
import type { TeacherAttentionStudent, TeacherDashboardSummary, TeacherRecentActivity } from './types'

const EMPTY_SUMMARY: TeacherDashboardSummary = {
  teacherAlias: 'Profesor',
  totals: { courses: 0, classrooms: 0, students: 0, questions: 0, attempts: 0, weeklyActiveStudents: 0 },
  openReviewCount: 0,
  emptyCourses: [],
  recentCourses: [],
  problematicQuestions: [],
}

export function useTeacherDashboard() {
  const [summary, setSummary] = useState<TeacherDashboardSummary>(EMPTY_SUMMARY)
  const [attention, setAttention] = useState<TeacherAttentionStudent[]>([])
  const [recentActivity, setRecentActivity] = useState<TeacherRecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const dashboard = await fetchTeacherDashboard()
      setSummary(dashboard.summary)
      setAttention(dashboard.attention)
      setRecentActivity(dashboard.recentActivity)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el panel docente.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load(false) }, [load]))
  return { attention, error, loading, recentActivity, refreshing, summary, refresh: () => { void load(true) } }
}
