import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { callPlatformRpc } from '../../lib/platformRpc'
import type {
  ManualReviewComment,
  ManualReviewConfiguration,
  ManualReviewFilters,
  ManualReviewHistoryItem,
  ManualReviewQueueResponse,
  ManualReviewQueueRow,
  ManualReviewRubricCriterion,
  ManualReviewStatus,
} from '../../lib/teacherManualReview'

const EMPTY_CONFIG: ManualReviewConfiguration = {
  slaHours: 48,
  rubrics: [],
  templates: [],
  savedFilters: [],
  assignees: [],
  subjects: [],
  classrooms: [],
}

const EMPTY_QUEUE: ManualReviewQueueResponse = {
  items: [],
  total: 0,
  summary: { pending: 0, in_review: 0, needs_changes: 0, overdue: 0 },
}

export function useManualReview(pageSize: number) {
  const [queue, setQueue] = useState<ManualReviewQueueResponse>(EMPTY_QUEUE)
  const [configuration, setConfiguration] = useState<ManualReviewConfiguration>(EMPTY_CONFIG)
  const [filters, setFilters] = useState<ManualReviewFilters>({ subjectId: null, classroomId: null, status: 'pending', search: '' })
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const loadConfiguration = useCallback(async () => {
    const result = await callPlatformRpc<ManualReviewConfiguration>('get_manual_review_configuration')
    if (result.error) throw result.error
    setConfiguration(result.data || EMPTY_CONFIG)
  }, [])

  const loadQueue = useCallback(async () => {
    const result = await callPlatformRpc<ManualReviewQueueResponse>('get_teacher_manual_review_queue', {
      p_subject_id: filters.subjectId ?? undefined,
      p_classroom_id: filters.classroomId ?? undefined,
      p_status: filters.status === 'all' ? undefined : filters.status,
      p_search: filters.search.trim() || undefined,
      p_limit: pageSize,
      p_offset: page * pageSize,
    })
    if (result.error) throw result.error
    setQueue(result.data || EMPTY_QUEUE)
    setSelectedIds((current) => current.filter((id) => (result.data?.items || []).some((row) => row.id === id)))
  }, [filters.classroomId, filters.search, filters.status, filters.subjectId, page, pageSize])

  const refresh = useCallback(async (showRefresh = false) => {
    try {
      setError(null)
      if (showRefresh) setRefreshing(true)
      await Promise.all([loadQueue(), loadConfiguration()])
    } catch (nextError: any) {
      setError(nextError?.message || 'No se pudo cargar la cola de revisión.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadConfiguration, loadQueue])

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => void refresh(), filters.search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [filters.search, refresh]))

  useEffect(() => {
    setPage(0)
  }, [filters.classroomId, filters.status, filters.subjectId])

  const updateFilters = useCallback((patch: Partial<ManualReviewFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(0)
  }, [])

  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }, [])

  const selectPage = useCallback(() => {
    const pageIds = queue.items.map((row) => row.id)
    setSelectedIds((current) => pageIds.length > 0 && pageIds.every((id) => current.includes(id)) ? [] : pageIds)
  }, [queue.items])

  const clearSelection = useCallback(() => setSelectedIds([]), [])

  const run = useCallback(async (task: () => Promise<void>) => {
    try {
      setBusy(true)
      setError(null)
      await task()
      await refresh()
    } catch (nextError: any) {
      setError(nextError?.message || 'No se pudo completar la acción.')
      throw nextError
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const assign = useCallback((ids: number[], assigneeId: string | null) => run(async () => {
    const result = await callPlatformRpc<{ updated: number }>('assign_manual_review_attempts', {
      p_attempt_ids: ids,
      p_assignee_id: assigneeId ?? undefined,
    })
    if (result.error) throw result.error
    setSelectedIds([])
  }), [run])

  const reviewOne = useCallback((input: {
    id: number
    status: ManualReviewStatus
    notes?: string
    audience?: 'student' | 'internal'
    rubricId?: string | null
    rubricResult?: Record<string, number> | null
  }) => run(async () => {
    const result = await callPlatformRpc<Record<string, unknown>>('review_manual_review_attempt', {
      p_attempt_history_id: input.id,
      p_status: input.status,
      p_notes: input.notes?.trim() || undefined,
      p_comment_audience: input.audience || 'student',
      p_rubric_id: input.rubricId ?? undefined,
      p_rubric_result: input.rubricResult ?? undefined,
    })
    if (result.error) throw result.error
  }), [run])

  const reviewBatch = useCallback((input: {
    ids: number[]
    status: ManualReviewStatus
    notes?: string
    audience?: 'student' | 'internal'
    rubricId?: string | null
    rubricResult?: Record<string, number> | null
  }) => run(async () => {
    const result = await callPlatformRpc<{ succeeded: number; failed: number }>('batch_review_manual_attempts', {
      p_attempt_ids: input.ids,
      p_status: input.status,
      p_notes: input.notes?.trim() || undefined,
      p_comment_audience: input.audience || 'student',
      p_rubric_id: input.rubricId ?? undefined,
      p_rubric_result: input.rubricResult ?? undefined,
    })
    if (result.error) throw result.error
    setSelectedIds([])
  }), [run])

  const saveSla = useCallback((hours: number) => run(async () => {
    const result = await callPlatformRpc('save_manual_review_settings', { p_sla_hours: hours })
    if (result.error) throw result.error
  }), [run])

  const saveRubric = useCallback((input: { id?: string | null; name: string; subjectId?: number | null; criteria: ManualReviewRubricCriterion[] }) => run(async () => {
    const result = await callPlatformRpc('save_manual_review_rubric', {
      p_id: input.id ?? undefined,
      p_name: input.name,
      p_subject_id: input.subjectId ?? undefined,
      p_criteria: input.criteria,
    })
    if (result.error) throw result.error
  }), [run])

  const saveTemplate = useCallback((input: { id?: string | null; title: string; body: string; audience: 'student' | 'internal' }) => run(async () => {
    const result = await callPlatformRpc('save_manual_review_template', {
      p_id: input.id ?? undefined,
      p_title: input.title,
      p_body: input.body,
      p_audience: input.audience,
    })
    if (result.error) throw result.error
  }), [run])

  const saveFilter = useCallback((name: string) => run(async () => {
    const result = await callPlatformRpc('save_manual_review_filter', {
      p_id: undefined,
      p_name: name,
      p_filters: filters,
    })
    if (result.error) throw result.error
  }), [filters, run])

  const loadDetail = useCallback(async (row: ManualReviewQueueRow) => {
    const [thread, history] = await Promise.all([
      callPlatformRpc<ManualReviewComment[]>('get_manual_review_thread', { p_attempt_history_id: row.id }),
      callPlatformRpc<ManualReviewHistoryItem[]>('get_manual_review_history', { p_attempt_history_id: row.id }),
    ])
    if (thread.error) throw thread.error
    if (history.error) throw history.error
    return { comments: thread.data || [], history: history.data || [] }
  }, [])

  const visibleClassrooms = useMemo(
    () => filters.subjectId ? configuration.classrooms.filter((item) => item.subject_id === filters.subjectId) : configuration.classrooms,
    [configuration.classrooms, filters.subjectId],
  )

  return {
    queue,
    configuration,
    filters,
    visibleClassrooms,
    page,
    loading,
    refreshing,
    busy,
    error,
    selectedIds,
    setPage,
    setError,
    updateFilters,
    toggleSelected,
    selectPage,
    clearSelection,
    refresh: () => refresh(true),
    assign,
    reviewOne,
    reviewBatch,
    saveSla,
    saveRubric,
    saveTemplate,
    saveFilter,
    loadDetail,
  }
}
