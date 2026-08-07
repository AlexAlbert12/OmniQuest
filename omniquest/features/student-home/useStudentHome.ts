import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { fetchStudentHomeDashboard } from './api'
import { buildStudentHomeViewModel } from './model'
import type { StudentHomeDashboardPayload, StudentHomeViewModel } from './types'

const EMPTY_VIEW_MODEL: StudentHomeViewModel = {
  profile: null,
  subjects: [],
  subjectRows: [],
  progressSummary: null,
  ranking: [],
  rankingSummary: null,
  rankingPreview: [],
  achievements: [],
  recommendedAction: {
    title: 'Empieza tu primera aventura',
    description: 'Únete a un curso con el código que te facilite tu profesor.',
    buttonLabel: 'Unirme a un curso',
    icon: 'add-circle',
    href: '/(student)/classes',
    tone: 'start',
  },
  continueRow: null,
  currentUserId: null,
  attemptCount: 0,
  todayAttemptCount: 0,
  weeklyAttemptCount: 0,
  streakDays: 0,
  failedQuestions: 0,
  dailyMissionTarget: 5,
  weeklyGoalTarget: 20,
}

export function useStudentHome() {
  const [payload, setPayload] = useState<StudentHomeDashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      setPayload(await fetchStudentHomeDashboard())
    } catch (loadError) {
      console.error('Error cargando el inicio del alumno:', loadError)
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el inicio.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const viewModel = useMemo(() => payload ? buildStudentHomeViewModel(payload) : EMPTY_VIEW_MODEL, [payload])

  return {
    ...viewModel,
    loading,
    refreshing,
    error,
    refresh: () => { void load({ silent: true }) },
  }
}

export { buildStudentClassHref, getStudentHomeCourseKey } from './model'
