import { useCallback, useEffect, useMemo, useState } from 'react'
import { readThroughCache } from '../../lib/offlineCache'
import { supabase } from '../../lib/supabase'
import {
  fetchActivityAttemptDetail,
  fetchStudentAttemptHistoryPage,
  type SafeStudentAttempt,
  type StudentActivityFacet,
  type StudentActivityTopicFacet,
  type StudentAttemptStatusCounts,
} from '../../lib/studentSecureData'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { buildActivityRows } from '../../components/student/activity/utils'
import type { ActivityFilter } from '../../components/student/activity/types'

export const STUDENT_ACTIVITY_PAGE_SIZE = 20

type ActivityProfile = {
  id: string
  alias: string | null
  avatar: string | null
  points: number | null
}

type ActivityCacheSnapshot = {
  profile: ActivityProfile
  attempts: SafeStudentAttempt[]
  total: number
  statusCounts: StudentAttemptStatusCounts
  subjects: StudentActivityFacet[]
  topics: StudentActivityTopicFacet[]
}

const EMPTY_COUNTS: StudentAttemptStatusCounts = { all: 0, correct: 0, incorrect: 0 }

export function useStudentActivity() {
  const [attempts, setAttempts] = useState<SafeStudentAttempt[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<StudentAttemptStatusCounts>(EMPTY_COUNTS)
  const [subjectFacets, setSubjectFacets] = useState<StudentActivityFacet[]>([])
  const [topicFacets, setTopicFacets] = useState<StudentActivityTopicFacet[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ActivityProfile | null>(null)
  const [searchQuery, setSearchQueryState] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilterState] = useState<ActivityFilter>('all')
  const [selectedSubjectId, setSelectedSubjectIdState] = useState('all')
  const [selectedTopicId, setSelectedTopicIdState] = useState('all')
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null)
  const [attemptDetails, setAttemptDetails] = useState<Record<number, SafeStudentAttempt>>({})
  const [loadingAttemptId, setLoadingAttemptId] = useState<number | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim().slice(0, 96)), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const applySnapshot = useCallback((snapshot: ActivityCacheSnapshot) => {
    setProfile(snapshot.profile)
    setAttempts(snapshot.attempts)
    setTotal(snapshot.total)
    setStatusCounts(snapshot.statusCounts)
    setSubjectFacets(snapshot.subjects)
    setTopicFacets(snapshot.topics)
    setLoading(false)
    setRefreshing(false)
  }, [])

  const fetchActivity = useCallback(async () => {
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('La sesión ha caducado. Vuelve a iniciar sesión.')

      const resource = [
        'student:history:v2',
        page,
        statusFilter,
        selectedSubjectId,
        selectedTopicId,
        debouncedSearch,
      ].join(':')

      await readThroughCache<ActivityCacheSnapshot>({
        userId,
        resource,
        fetcher: async () => {
          const [profileResult, historyResult] = await Promise.all([
            supabase.from('profiles').select('id, alias, avatar, points').eq('id', userId).maybeSingle(),
            fetchStudentAttemptHistoryPage({
              page,
              pageSize: STUDENT_ACTIVITY_PAGE_SIZE,
              status: statusFilter,
              search: debouncedSearch,
              subjectId: selectedSubjectId === 'all' ? null : Number(selectedSubjectId),
              topicId: selectedTopicId === 'all' || selectedTopicId.startsWith('general:') ? null : Number(selectedTopicId),
            }),
          ])
          const sessionUser = sessionData.session?.user
          const fallbackProfile: ActivityProfile = {
            id: userId,
            alias: typeof sessionUser?.user_metadata?.alias === 'string' ? sessionUser.user_metadata.alias : sessionUser?.email?.split('@')[0] || 'Alumno',
            avatar: typeof sessionUser?.user_metadata?.avatar === 'string' ? sessionUser.user_metadata.avatar : null,
            points: 0,
          }
          return {
            profile: profileResult.error || !profileResult.data ? fallbackProfile : profileResult.data,
            attempts: historyResult.rows,
            total: historyResult.total,
            statusCounts: historyResult.statusCounts,
            subjects: historyResult.subjects,
            topics: historyResult.topics,
          }
        },
        onData: applySnapshot,
      })
    } catch (caught) {
      console.error('Error al cargar el historial de actividad:', caught)
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar el historial de actividad.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [applySnapshot, debouncedSearch, page, selectedSubjectId, selectedTopicId, statusFilter])

  useEffect(() => {
    void fetchActivity()
  }, [fetchActivity])

  const refresh = useCallback(() => {
    setRefreshing(true)
    void fetchActivity()
  }, [fetchActivity])

  const toggleAttempt = useCallback(async (attemptId: number) => {
    if (expandedAttemptId === attemptId) {
      setExpandedAttemptId(null)
      return
    }

    setExpandedAttemptId(attemptId)
    if (attemptDetails[attemptId]) return

    setLoadingAttemptId(attemptId)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('La sesión ha caducado.')
      await readThroughCache<SafeStudentAttempt>({
        userId,
        resource: `student:history:detail:v2:${attemptId}`,
        fetcher: () => fetchActivityAttemptDetail(attemptId),
        onData: (detail) => setAttemptDetails((current) => ({ ...current, [attemptId]: detail })),
      })
    } catch (caught) {
      console.error('No se pudo cargar el detalle seguro del intento:', caught)
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar el detalle del intento.')
    } finally {
      setLoadingAttemptId((current) => (current === attemptId ? null : current))
    }
  }, [attemptDetails, expandedAttemptId])

  const setSearchQuery = useCallback((value: string) => {
    setPage(0)
    setSearchQueryState(value)
  }, [])
  const setStatusFilter = useCallback((value: ActivityFilter) => {
    setPage(0)
    setStatusFilterState(value)
  }, [])
  const setSelectedSubjectId = useCallback((value: string) => {
    setPage(0)
    setSelectedSubjectIdState(value)
    setSelectedTopicIdState('all')
  }, [])
  const setSelectedTopicId = useCallback((value: string) => {
    setPage(0)
    setSelectedTopicIdState(value)
  }, [])

  const activityRows = useMemo(() => buildActivityRows(attempts), [attempts])
  const topics = useMemo(() => topicFacets.filter((topic) => (
    selectedSubjectId === 'all' || topic.subjectId === Number(selectedSubjectId)
  )), [selectedSubjectId, topicFacets])
  const detailedAttempts = useMemo(() => {
    const next: Record<number, SafeStudentAttempt> = {}
    attempts.forEach((attempt) => { next[attempt.id] = attemptDetails[attempt.id] ?? attempt })
    return next
  }, [attemptDetails, attempts])

  const points = Math.max(0, Number(profile?.points || 0))

  return {
    attempts,
    activityRows,
    detailedAttempts,
    page,
    setPage,
    total,
    statusCounts,
    subjectFacets,
    topicFacets: topics,
    loading,
    refreshing,
    error,
    clearError: () => setError(null),
    profile,
    points,
    level: getStudentLevel(points),
    nextLevelProgress: getNextLevelProgress(points),
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    selectedSubjectId,
    setSelectedSubjectId,
    selectedTopicId,
    setSelectedTopicId,
    expandedAttemptId,
    loadingAttemptId,
    toggleAttempt,
    refresh,
  }
}
