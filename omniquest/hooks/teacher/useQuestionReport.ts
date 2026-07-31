import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { callPlatformRpc } from '../../lib/platformRpc'
import { supabase } from '../../lib/supabase'
import type {
  AffectedStudentsPage,
  QuestionReportPeriod,
  TeacherQuestionReport,
} from '../../lib/teacherQuestionReport'

const EMPTY_AFFECTED: AffectedStudentsPage = { items: [], total: 0 }

export function useQuestionReport(questionId: number, affectedPageSize: number) {
  const [report, setReport] = useState<TeacherQuestionReport | null>(null)
  const [affected, setAffected] = useState<AffectedStudentsPage>(EMPTY_AFFECTED)
  const [classroomId, setClassroomId] = useState<number | null>(null)
  const [period, setPeriod] = useState<QuestionReportPeriod>('30d')
  const [affectedPage, setAffectedPage] = useState(0)
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => getPeriodRange(period), [period])

  const load = useCallback(async () => {
    if (!Number.isFinite(questionId)) {
      setError('La pregunta no es válida.')
      setLoading(false)
      return
    }
    try {
      setError(null)
      const [reportResult, affectedResult, sessionResult] = await Promise.all([
        callPlatformRpc<TeacherQuestionReport>('get_teacher_question_report', {
          p_question_id: questionId,
          p_classroom_id: classroomId ?? undefined,
          p_date_from: range.from ?? undefined,
          p_date_to: range.to ?? undefined,
        }),
        callPlatformRpc<AffectedStudentsPage>('get_teacher_question_affected_students_page', {
          p_question_id: questionId,
          p_classroom_id: classroomId ?? undefined,
          p_date_from: range.from ?? undefined,
          p_date_to: range.to ?? undefined,
          p_limit: affectedPageSize,
          p_offset: affectedPage * affectedPageSize,
        }),
        supabase.auth.getSession(),
      ])
      if (reportResult.error) throw reportResult.error
      if (affectedResult.error) throw affectedResult.error
      setReport(reportResult.data)
      setAffected(affectedResult.data || EMPTY_AFFECTED)

      const teacherId = sessionResult.data.session?.user.id
      if (teacherId) {
        const countResult = await supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId).eq('is_archived', false)
        if (!countResult.error) setSubjectsCount(countResult.count || 0)
      }
    } catch (nextError: any) {
      setError(nextError?.message || 'No se pudo cargar el informe de la pregunta.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [affectedPage, affectedPageSize, classroomId, questionId, range.from, range.to])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  const refresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const archive = useCallback(async () => {
    if (!report?.question || report.question.active === false) return
    try {
      setBusy(true)
      setError(null)
      const { error: updateError } = await supabase.from('questions').update({ active: false }).eq('id', report.question.id)
      if (updateError) throw updateError
      setReport((current) => current ? { ...current, question: { ...current.question, active: false } } : current)
    } catch (nextError: any) {
      setError(nextError?.message || 'No se pudo archivar la pregunta.')
      throw nextError
    } finally {
      setBusy(false)
    }
  }, [report?.question])

  return {
    report,
    affected,
    classroomId,
    period,
    affectedPage,
    subjectsCount,
    loading,
    refreshing,
    busy,
    error,
    setClassroomId: (value: number | null) => { setClassroomId(value); setAffectedPage(0) },
    setPeriod: (value: QuestionReportPeriod) => { setPeriod(value); setAffectedPage(0) },
    setAffectedPage,
    refresh,
    archive,
  }
}

function getPeriodRange(period: QuestionReportPeriod) {
  if (period === 'all') return { from: null, to: null }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  return {
    from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
    to: null,
  }
}
