import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  callTeacherRpc,
  type TeacherStudentHistoryMetricsPayload,
  type TeacherStudentHistoryNote,
  type TeacherStudentHistoryReview,
  type TeacherStudentHistorySummaryPayload,
  type TeacherStudentHistoryTimelineItem,
  type TeacherStudentHistoryWeakness,
} from '../../lib/teacherServerData'

export type TeacherStudentHistoryTab = 'activity' | 'weaknesses' | 'reviews' | 'metrics'

const PAGE_SIZE = 20

export function useTeacherStudentHistory({
  studentId,
  subjectId = null,
  classroomId = null,
}: {
  studentId: string | null
  subjectId?: number | null
  classroomId?: number | null
}) {
  const [summary, setSummary] = useState<TeacherStudentHistorySummaryPayload | null>(null)
  const [timeline, setTimeline] = useState<TeacherStudentHistoryTimelineItem[]>([])
  const [timelineTotal, setTimelineTotal] = useState(0)
  const [timelinePage, setTimelinePage] = useState(0)
  const [weaknesses, setWeaknesses] = useState<TeacherStudentHistoryWeakness[]>([])
  const [reviews, setReviews] = useState<TeacherStudentHistoryReview[]>([])
  const [reviewsTotal, setReviewsTotal] = useState(0)
  const [metrics, setMetrics] = useState<TeacherStudentHistoryMetricsPayload | null>(null)
  const [activeTab, setActiveTabState] = useState<TeacherStudentHistoryTab>('activity')
  const [periodDays, setPeriodDays] = useState(30)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingTab, setLoadingTab] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedTabsRef = useRef<Set<TeacherStudentHistoryTab>>(new Set())

  const commonArgs = useMemo(() => ({
    p_student_id: studentId,
    p_subject_id: subjectId || undefined,
    p_classroom_id: classroomId || undefined,
  }), [classroomId, studentId, subjectId])

  const loadSummary = useCallback(async () => {
    if (!studentId) throw new Error('No se ha recibido el identificador del alumno.')
    const payload = await callTeacherRpc<TeacherStudentHistorySummaryPayload>('get_teacher_student_history_summary', {
      ...commonArgs,
      p_period_days: periodDays,
    })
    setSummary(payload)
  }, [commonArgs, periodDays, studentId])

  const loadActivityPage = useCallback(async (requestedPage: number) => {
    if (!studentId) return
    const payload = await callTeacherRpc<{ items: TeacherStudentHistoryTimelineItem[]; total: number }>('get_teacher_student_history_timeline_page', {
      ...commonArgs,
      p_limit: PAGE_SIZE,
      p_offset: requestedPage * PAGE_SIZE,
    })
    setTimeline(payload.items || [])
    setTimelineTotal(payload.total || 0)
    loadedTabsRef.current.add('activity')
  }, [commonArgs, studentId])

  const loadActivity = useCallback(() => loadActivityPage(timelinePage), [loadActivityPage, timelinePage])

  const loadWeaknesses = useCallback(async () => {
    if (!studentId) return
    const payload = await callTeacherRpc<{ items: TeacherStudentHistoryWeakness[] }>('get_teacher_student_history_weaknesses', {
      ...commonArgs,
      p_period_days: periodDays,
    })
    setWeaknesses(payload.items || [])
    loadedTabsRef.current.add('weaknesses')
  }, [commonArgs, periodDays, studentId])

  const loadReviews = useCallback(async () => {
    if (!studentId) return
    const payload = await callTeacherRpc<{ items: TeacherStudentHistoryReview[]; total: number }>('get_teacher_student_history_reviews_page', {
      ...commonArgs,
      p_limit: PAGE_SIZE,
      p_offset: 0,
    })
    setReviews(payload.items || [])
    setReviewsTotal(payload.total || 0)
    loadedTabsRef.current.add('reviews')
  }, [commonArgs, studentId])

  const loadMetrics = useCallback(async () => {
    if (!studentId) return
    const payload = await callTeacherRpc<TeacherStudentHistoryMetricsPayload>('get_teacher_student_history_metrics', {
      ...commonArgs,
      p_period_days: periodDays,
    })
    setMetrics(payload)
    loadedTabsRef.current.add('metrics')
  }, [commonArgs, periodDays, studentId])

  const loadTab = useCallback(async (tab: TeacherStudentHistoryTab, force = false) => {
    if (!force && loadedTabsRef.current.has(tab)) return
    setLoadingTab(true)
    setError(null)
    try {
      if (tab === 'activity') await loadActivity()
      if (tab === 'weaknesses') await loadWeaknesses()
      if (tab === 'reviews') await loadReviews()
      if (tab === 'metrics') await loadMetrics()
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar esta sección.')
    } finally {
      setLoadingTab(false)
    }
  }, [loadActivity, loadMetrics, loadReviews, loadWeaknesses])

  const loadInitial = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoadingSummary(true)
    setError(null)
    try {
      setTimelinePage(0)
      await Promise.all([loadSummary(), loadActivityPage(0)])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el historial del alumno.')
    } finally {
      setLoadingSummary(false)
      setRefreshing(false)
    }
  }, [loadActivityPage, loadSummary])

  useFocusEffect(useCallback(() => {
    void loadInitial(false)
  }, [loadInitial]))

  useEffect(() => {
    setTimelinePage(0)
    loadedTabsRef.current = new Set(['activity'])
    setWeaknesses([])
    setReviews([])
    setMetrics(null)
    void loadSummary().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No se pudo actualizar el periodo.'))
    if (activeTab !== 'activity') void loadTab(activeTab, true)
    // activeTab/loadTab would cause an unnecessary loop after marking the tab as loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDays])

  useEffect(() => {
    if (!studentId || !loadedTabsRef.current.has('activity')) return
    setLoadingTab(true)
    loadActivity()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la página de actividad.'))
      .finally(() => setLoadingTab(false))
  }, [loadActivity, studentId])

  const setActiveTab = useCallback((tab: TeacherStudentHistoryTab) => {
    setActiveTabState(tab)
    void loadTab(tab)
  }, [loadTab])

  const addNote = useCallback(async (body: string) => {
    if (!studentId || !body.trim()) return
    setSavingNote(true)
    try {
      const note = await callTeacherRpc<TeacherStudentHistoryNote>('add_teacher_student_note', {
        ...commonArgs,
        p_body: body.trim(),
      })
      setSummary((current) => current ? { ...current, notes: [note, ...(current.notes || [])].slice(0, 5) } : current)
    } finally {
      setSavingNote(false)
    }
  }, [commonArgs, studentId])

  return {
    summary,
    timeline,
    timelineTotal,
    timelinePage,
    timelinePageSize: PAGE_SIZE,
    timelinePageCount: Math.max(1, Math.ceil(timelineTotal / PAGE_SIZE)),
    weaknesses,
    reviews,
    reviewsTotal,
    metrics,
    activeTab,
    periodDays,
    loadingSummary,
    loadingTab,
    refreshing,
    savingNote,
    error,
    setActiveTab,
    setPeriodDays,
    setTimelinePage,
    addNote,
    refresh: () => loadInitial(true),
    retryTab: () => loadTab(activeTab, true),
  }
}
