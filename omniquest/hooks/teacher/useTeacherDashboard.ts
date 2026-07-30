import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  callTeacherRpc,
  type PagedPayload,
  type TeacherAttentionStudent,
  type TeacherDashboardSummary,
  type TeacherRecentActivity,
} from '../../lib/teacherServerData'

const EMPTY_SUMMARY: TeacherDashboardSummary = {
  teacherAlias: 'Profesor',
  totals: { courses: 0, classrooms: 0, students: 0, questions: 0, attempts: 0, weeklyActiveStudents: 0 },
  openReviewCount: 0,
  emptyCourses: [],
  recentCourses: [],
  problematicQuestions: [],
}

export function useTeacherDashboard() {
  const [summary, setSummary] = useState< TeacherDashboardSummary>(EMPTY_SUMMARY)
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
      const [nextSummary, attentionPage, activityPage] = await Promise.all([
        callTeacherRpc<TeacherDashboardSummary>('get_teacher_dashboard_summary'),
        callTeacherRpc<PagedPayload<TeacherAttentionStudent>>('get_teacher_attention_students_page', {
          p_limit: 6,
          p_offset: 0,
        }),
        callTeacherRpc<PagedPayload<TeacherRecentActivity>>('get_teacher_recent_activity_page', {
          p_limit: 6,
          p_offset: 0,
        }),
      ])
      setSummary(nextSummary)
      setAttention(attentionPage.items || [])
      setRecentActivity(activityPage.items || [])
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'No se pudo cargar el panel docente.'
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    void load(false)
  }, [load]))

  return {
    attention,
    error,
    load,
    loading,
    recentActivity,
    refreshing,
    summary,
    refresh: () => load(true),
  }
}
