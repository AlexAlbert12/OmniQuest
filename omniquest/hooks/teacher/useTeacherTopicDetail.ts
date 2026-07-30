import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  callTeacherRpc,
  type PagedPayload,
  type TeacherTopicQuestion,
  type TeacherTopicSummaryPayload,
} from '../../lib/teacherServerData'

const PAGE_SIZE = 12

type VisibilityFilter = 'all' | 'visible' | 'archived'

export function useTeacherTopicDetail(topicId: number | null) {
  const [summary, setSummary] = useState<TeacherTopicSummaryPayload | null>(null)
  const [questions, setQuestions] = useState<TeacherTopicQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [difficulty, setDifficulty] = useState<number | 'all'>('all')
  const [visibility, setVisibility] = useState<VisibilityFilter>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingQuestions, setLoadingQuestions] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, difficulty, visibility])

  const loadSummary = useCallback(async () => {
    if (!topicId) return
    const payload = await callTeacherRpc<TeacherTopicSummaryPayload>('get_teacher_topic_summary', {
      p_topic_id: topicId,
    })
    setSummary(payload)
  }, [topicId])

  const loadQuestions = useCallback(async () => {
    if (!topicId) return
    const payload = await callTeacherRpc<PagedPayload<TeacherTopicQuestion>>('get_teacher_topic_questions_page', {
      p_topic_id: topicId,
      p_difficulty: difficulty === 'all' ? undefined : difficulty,
      p_search: debouncedSearch || undefined,
      p_visibility: visibility,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    })
    setQuestions(payload.items || [])
    setTotal(payload.total || 0)
  }, [debouncedSearch, difficulty, page, topicId, visibility])

  const loadAll = useCallback(async (refresh = false) => {
    if (!topicId) {
      setError('No se ha recibido un identificador de tema válido.')
      setLoadingSummary(false)
      setLoadingQuestions(false)
      return
    }

    if (refresh) setRefreshing(true)
    else {
      setLoadingSummary(true)
      setLoadingQuestions(true)
    }
    setError(null)

    try {
      await Promise.all([loadSummary(), loadQuestions()])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el tema.')
    } finally {
      setLoadingSummary(false)
      setLoadingQuestions(false)
      setRefreshing(false)
    }
  }, [loadQuestions, loadSummary, topicId])

  useFocusEffect(useCallback(() => {
    if (!topicId) return
    setLoadingSummary(true)
    setError(null)
    void loadSummary()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el tema.'))
      .finally(() => setLoadingSummary(false))
  }, [loadSummary, topicId]))

  useEffect(() => {
    if (!topicId) {
      setLoadingQuestions(false)
      return
    }
    setLoadingQuestions(true)
    setError(null)
    void loadQuestions()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las preguntas.'))
      .finally(() => setLoadingQuestions(false))
  }, [loadQuestions, topicId])

  const archiveTopic = useCallback(async () => {
    if (!topicId) return
    await callTeacherRpc<{ id: number; active: boolean }>('archive_teacher_topic', { p_topic_id: topicId })
    await loadSummary()
  }, [loadSummary, topicId])

  const removeQuestion = useCallback((questionId: number) => {
    setQuestions((current) => current.filter((question) => question.id !== questionId))
    setTotal((current) => Math.max(0, current - 1))
    setSummary((current) => current ? {
      ...current,
      summary: {
        ...current.summary,
        questionsCount: Math.max(0, current.summary.questionsCount - 1),
        visibleQuestionsCount: Math.max(0, current.summary.visibleQuestionsCount - 1),
      },
    } : current)
  }, [])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  return useMemo(() => ({
    archiveTopic,
    difficulty,
    error,
    loadingQuestions,
    loadingSummary,
    page: safePage,
    pageCount,
    pageSize: PAGE_SIZE,
    questions,
    refresh: () => loadAll(true),
    refreshing,
    removeQuestion,
    search,
    setDifficulty,
    setPage,
    setSearch,
    setVisibility,
    summary,
    total,
    visibility,
  }), [
    archiveTopic,
    difficulty,
    error,
    loadAll,
    loadingQuestions,
    loadingSummary,
    pageCount,
    questions,
    refreshing,
    removeQuestion,
    safePage,
    search,
    summary,
    total,
    visibility,
  ])
}

export type { VisibilityFilter }
