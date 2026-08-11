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

export function useTeacherStudentHistory({ studentId, subjectId = null, classroomId = null }: { studentId: string | null; subjectId?: number | null; classroomId?: number | null }) {
  const [summary, setSummary] = useState<TeacherStudentHistorySummaryPayload | null>(null)
  const [timeline, setTimeline] = useState<TeacherStudentHistoryTimelineItem[]>([])
  const [timelineTotal, setTimelineTotal] = useState(0)
  const [timelinePage, setTimelinePage] = useState(0)
  const [weaknesses, setWeaknesses] = useState<TeacherStudentHistoryWeakness[]>([])
  const [reviews, setReviews] = useState<TeacherStudentHistoryReview[]>([])
  const [reviewsTotal, setReviewsTotal] = useState(0)
  const [reviewsPage, setReviewsPage] = useState(0)
  const [metrics, setMetrics] = useState<TeacherStudentHistoryMetricsPayload | null>(null)
  const [activeTab, setActiveTabState] = useState<TeacherStudentHistoryTab>('activity')
  const [periodDays, setPeriodDays] = useState(30)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingTab, setLoadingTab] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedTabsRef = useRef<Set<TeacherStudentHistoryTab>>(new Set())
  const previousPeriodRef = useRef(periodDays)
  const focusRefreshRef = useRef<() => Promise<void>>(async () => {})

  const commonArgs = useMemo(() => ({ p_student_id: studentId, p_subject_id: subjectId || undefined, p_classroom_id: classroomId || undefined }), [classroomId, studentId, subjectId])

  const loadSummary = useCallback(async () => {
    if (!studentId) throw new Error('No se ha recibido el identificador del alumno.')
    const payload = await callTeacherRpc<TeacherStudentHistorySummaryPayload>('get_teacher_student_history_summary', { ...commonArgs, p_period_days: periodDays })
    setSummary(payload)
  }, [commonArgs, periodDays, studentId])

  const loadActivityPage = useCallback(async (requestedPage: number) => {
    if (!studentId) return
    const payload = await callTeacherRpc<{ items: TeacherStudentHistoryTimelineItem[]; total: number }>('get_teacher_student_history_timeline_page', { ...commonArgs, p_limit: PAGE_SIZE, p_offset: requestedPage * PAGE_SIZE })
    setTimeline(payload.items || [])
    setTimelineTotal(payload.total || 0)
    loadedTabsRef.current.add('activity')
  }, [commonArgs, studentId])

  const loadActivity = useCallback(() => loadActivityPage(timelinePage), [loadActivityPage, timelinePage])

  const loadWeaknesses = useCallback(async () => {
    if (!studentId) return
    const payload = await callTeacherRpc<{ items: TeacherStudentHistoryWeakness[] }>('get_teacher_student_history_weaknesses', { ...commonArgs, p_period_days: periodDays })
    setWeaknesses(payload.items || [])
    loadedTabsRef.current.add('weaknesses')
  }, [commonArgs, periodDays, studentId])

  const loadReviewsPage = useCallback(async (requestedPage: number) => {
    if (!studentId) return
    const payload = await callTeacherRpc<{ items: TeacherStudentHistoryReview[]; total: number }>('get_teacher_student_history_reviews_page', { ...commonArgs, p_limit: PAGE_SIZE, p_offset: requestedPage * PAGE_SIZE })
    setReviews(payload.items || [])
    setReviewsTotal(payload.total || 0)
    loadedTabsRef.current.add('reviews')
  }, [commonArgs, studentId])

  const loadReviews = useCallback(() => loadReviewsPage(reviewsPage), [loadReviewsPage, reviewsPage])

  const loadMetrics = useCallback(async () => {
    if (!studentId) return
    const payload = await callTeacherRpc<TeacherStudentHistoryMetricsPayload>('get_teacher_student_history_metrics', { ...commonArgs, p_period_days: periodDays })
    setMetrics(payload)
    loadedTabsRef.current.add('metrics')
  }, [commonArgs, periodDays, studentId])

  const loadTab = useCallback(async (tab: TeacherStudentHistoryTab, force = false) => {
    if (!force && loadedTabsRef.current.has(tab)) return
    if (tab === 'activity') await loadActivity()
    if (tab === 'weaknesses') await loadWeaknesses()
    if (tab === 'reviews') await loadReviews()
    if (tab === 'metrics') await loadMetrics()
  }, [loadActivity, loadMetrics, loadReviews, loadWeaknesses])

  const refreshVisible = useCallback(async (showRefresh: boolean) => {
    if (showRefresh) setRefreshing(true)
    else if (!summary) setLoadingSummary(true)
    setError(null)
    setLoadingTab(activeTab !== 'activity')
    try {
      await Promise.all([loadSummary(), loadTab(activeTab, true)])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo actualizar el historial del alumno.')
    } finally {
      setLoadingSummary(false)
      setLoadingTab(false)
      setRefreshing(false)
    }
  }, [activeTab, loadSummary, loadTab, summary])

  useEffect(() => { focusRefreshRef.current = () => refreshVisible(false) }, [refreshVisible])
  useFocusEffect(useCallback(() => { void focusRefreshRef.current() }, []))

  useEffect(() => {
    if (previousPeriodRef.current === periodDays) return
    previousPeriodRef.current = periodDays
    loadedTabsRef.current.delete('weaknesses')
    loadedTabsRef.current.delete('metrics')
    setError(null)
    void loadSummary().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No se pudo actualizar el periodo.'))
    if (activeTab === 'weaknesses' || activeTab === 'metrics') {
      setLoadingTab(true)
      void loadTab(activeTab, true).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No se pudo actualizar esta sección.')).finally(() => setLoadingTab(false))
    }
  }, [activeTab, loadSummary, loadTab, periodDays])

  useEffect(() => {
    if (!studentId || activeTab !== 'activity' || !loadedTabsRef.current.has('activity')) return
    setLoadingTab(activeTab === 'activity')
    void loadActivity().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la página de actividad.')).finally(() => setLoadingTab(false))
  }, [activeTab, loadActivity, studentId, timelinePage])

  useEffect(() => {
    if (!studentId || activeTab !== 'reviews' || !loadedTabsRef.current.has('reviews')) return
    setLoadingTab(activeTab === 'reviews')
    void loadReviews().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la página de revisiones.')).finally(() => setLoadingTab(false))
  }, [activeTab, loadReviews, reviewsPage, studentId])

  const setActiveTab = useCallback((tab: TeacherStudentHistoryTab) => {
    setActiveTabState(tab)
    setLoadingTab(!loadedTabsRef.current.has(tab))
    void loadTab(tab).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar esta sección.')).finally(() => setLoadingTab(false))
  }, [loadTab])

  const changePeriodDays = useCallback((days: number) => setPeriodDays(days), [])

  const addNote = useCallback(async (body: string) => {
    if (!studentId || !body.trim()) return
    setSavingNote(true)
    setError(null)
    try {
      const note = await callTeacherRpc<TeacherStudentHistoryNote>('add_teacher_student_note', { ...commonArgs, p_body: body.trim() })
      setSummary((current) => current ? { ...current, notes: [note, ...(current.notes || [])].slice(0, 5), notesTotal: (current.notesTotal || 0) + 1 } : current)
    } catch (noteError) {
      const message = noteError instanceof Error ? noteError.message : 'No se pudo guardar el comentario.'
      throw new Error(message)
    } finally {
      setSavingNote(false)
    }
  }, [commonArgs, studentId])

  return {
    summary, timeline, timelineTotal, timelinePage, timelinePageSize: PAGE_SIZE, timelinePageCount: Math.max(1, Math.ceil(timelineTotal / PAGE_SIZE)),
    weaknesses, reviews, reviewsTotal, reviewsPage, reviewsPageSize: PAGE_SIZE, reviewsPageCount: Math.max(1, Math.ceil(reviewsTotal / PAGE_SIZE)), metrics,
    activeTab, periodDays, loadingSummary, loadingTab, refreshing, savingNote, error,
    setActiveTab, setPeriodDays: changePeriodDays, setTimelinePage, setReviewsPage, addNote,
    refresh: () => refreshVisible(true), retryTab: () => refreshVisible(false),
  }
}
