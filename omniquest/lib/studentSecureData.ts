import type { Json } from '../types/database.types'
import { supabase } from './supabase'

export type SafeStudentQuestion = {
  id: number
  subject_id: number | null
  classroom_id: number | null
  topic_id: number | null
  text: string | null
  type: string | null
  difficulty: number | null
  active: boolean | null
}

export type SafeAttemptSubject = {
  id: number
  name: string | null
}

export type SafeAttemptTopic = {
  id: number
  title: string | null
}

export type SafeAttemptAnswer = {
  id: number
  text: string | null
  is_correct: boolean | null
  sort_order: number | null
}

export type SafeAttemptQuestion = SafeStudentQuestion & {
  explanation?: string | null
  media_type?: 'image' | 'audio' | 'video' | null
  media_url?: string | null
  media_alt_text?: string | null
  media_caption?: string | null
  subjects?: SafeAttemptSubject | SafeAttemptSubject[] | null
  subject_topics?: SafeAttemptTopic | SafeAttemptTopic[] | null
  answers?: SafeAttemptAnswer[] | null
}

export type SafeManualReviewComment = {
  id: number
  author_name: string | null
  body: string
  created_at: string
}

export type SafeStudentAttempt = {
  id: number
  question_id: number | null
  answer_id: number | null
  is_correct: boolean
  time_taken_seconds: number | null
  attempted_at: string
  submitted_answer_text: string | null
  submitted_answer_payload: Json | null
  earned_points: number | null
  hint_used: boolean | null
  was_skipped: boolean | null
  manual_review_status?: string | null
  review_notes?: string | null
  review_comments?: SafeManualReviewComment[] | null
  questions: SafeAttemptQuestion | SafeAttemptQuestion[] | null
}

export type AttemptFeedback = {
  attempt_history_id?: number
  is_correct?: boolean
  requires_manual_review?: boolean
  manual_review_status?: string | null
  earned_points?: number
  correct_answer_id?: number | null
  correct_answer_text?: string | null
  explanation?: string | null
  review_notes?: string | null
  review_comments?: SafeManualReviewComment[]
}


export type StudentAttemptHistoryPageFilters = {
  page?: number
  pageSize?: number
  status?: 'all' | 'correct' | 'incorrect'
  search?: string
  subjectId?: number | null
  classroomId?: number | null
  topicId?: number | null
  difficulty?: number | null
}

export type StudentActivityFacet = {
  id: string
  label: string
  count: number
}

export type StudentActivityTopicFacet = StudentActivityFacet & {
  subjectId: number | null
}

export type StudentAttemptStatusCounts = {
  all: number
  correct: number
  incorrect: number
}

export type StudentAttemptHistoryPage = {
  rows: SafeStudentAttempt[]
  total: number
  statusCounts: StudentAttemptStatusCounts
  subjects: StudentActivityFacet[]
  topics: StudentActivityTopicFacet[]
}

export type StudentAttemptHistoryFilters = {
  limit?: number
  since?: string | null
  subjectId?: number | null
  classroomId?: number | null
  topicId?: number | null
  difficulty?: number | null
}

export function parseRpcArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export async function fetchStudentQuestionCatalog({
  subjectId = null,
  classroomId = null,
}: {
  subjectId?: number | null
  classroomId?: number | null
} = {}): Promise<SafeStudentQuestion[]> {
  const { data, error } = await supabase.rpc('get_student_question_catalog', {
    p_subject_id: subjectId ?? undefined,
    p_classroom_id: classroomId ?? undefined,
  })

  if (error) throw error
  return parseRpcArray<SafeStudentQuestion>(data)
}

export async function fetchStudentAttemptHistory({
  limit = 100,
  since = null,
  subjectId = null,
  classroomId = null,
  topicId = null,
  difficulty = null,
}: StudentAttemptHistoryFilters = {}): Promise<SafeStudentAttempt[]> {
  const { data, error } = await supabase.rpc('get_student_attempt_history', {
    p_limit: limit,
    p_since: since ?? undefined,
    p_subject_id: subjectId ?? undefined,
    p_classroom_id: classroomId ?? undefined,
    p_topic_id: topicId ?? undefined,
    p_difficulty: difficulty ?? undefined,
  })

  if (error) throw error
  return parseRpcArray<SafeStudentAttempt>(data)
}

export async function fetchStudentAttemptHistoryPage({
  page = 0,
  pageSize = 20,
  status = 'all',
  search = '',
  subjectId = null,
  classroomId = null,
  topicId = null,
  difficulty = null,
}: StudentAttemptHistoryPageFilters = {}): Promise<StudentAttemptHistoryPage> {
  const safePageSize = Math.min(Math.max(pageSize, 1), 100)
  const safePage = Math.max(page, 0)
  const { data, error } = await supabase.rpc('get_student_attempt_history_page', {
    p_status: status,
    p_search: search.trim() || undefined,
    p_subject_id: subjectId ?? undefined,
    p_classroom_id: classroomId ?? undefined,
    p_topic_id: topicId ?? undefined,
    p_difficulty: difficulty ?? undefined,
    p_limit: safePageSize,
    p_offset: safePage * safePageSize,
  })

  if (error) throw error
  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? data as { rows?: unknown; total?: unknown; status_counts?: unknown; subjects?: unknown; topics?: unknown }
    : {}

  const rawStatusCounts = payload.status_counts && typeof payload.status_counts === 'object' && !Array.isArray(payload.status_counts)
    ? payload.status_counts as Record<string, unknown>
    : {}

  return {
    rows: parseRpcArray<SafeStudentAttempt>(payload.rows),
    total: Math.max(0, Number(payload.total || 0)),
    statusCounts: {
      all: Math.max(0, Number(rawStatusCounts.all || 0)),
      correct: Math.max(0, Number(rawStatusCounts.correct || 0)),
      incorrect: Math.max(0, Number(rawStatusCounts.incorrect || 0)),
    },
    subjects: parseRpcArray<Record<string, unknown>>(payload.subjects).map((item) => ({
      id: String(item.id ?? ''),
      label: String(item.label ?? 'Clase sin nombre'),
      count: Math.max(0, Number(item.count || 0)),
    })).filter((item) => Boolean(item.id)),
    topics: parseRpcArray<Record<string, unknown>>(payload.topics).map((item) => ({
      id: String(item.id ?? ''),
      subjectId: item.subject_id === null || item.subject_id === undefined ? null : Number(item.subject_id),
      label: String(item.label ?? 'Tema general'),
      count: Math.max(0, Number(item.count || 0)),
    })).filter((item) => Boolean(item.id)),
  }
}

export async function fetchAttemptFeedback(attemptHistoryId: number): Promise<AttemptFeedback> {
  const { data, error } = await supabase.rpc('get_attempt_feedback', {
    p_attempt_history_id: attemptHistoryId,
  })

  if (error) throw error
  return data && typeof data === 'object' ? (data as AttemptFeedback) : {}
}

export async function fetchActivityAttemptDetail(attemptHistoryId: number): Promise<SafeStudentAttempt> {
  const { data, error } = await supabase.rpc('get_activity_attempt_detail', {
    p_attempt_history_id: attemptHistoryId,
  })

  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('No se pudo recuperar el detalle del intento.')
  }

  return data as unknown as SafeStudentAttempt
}
