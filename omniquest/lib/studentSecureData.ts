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

export type GameAttemptReviewIndex = {
  attempt_id: string
  subject_id: number
  subject_name: string | null
  classroom_id: number | null
  topic_id: number | null
  topic_title: string | null
  difficulty: number | null
  started_at: string
  finished_at: string | null
  status: string
  total_score: number
  questions_total: number
  correct_total: number
  failed_attempt_history_ids: number[]
}

export type GameAttemptReviewMistake = {
  attempt: SafeStudentAttempt
  feedback: AttemptFeedback
  submittedAnswerDisplay: string | null
}

export type GameAttemptReview = GameAttemptReviewIndex & {
  mistakes: GameAttemptReviewMistake[]
}

export type GameAttemptReviewFilters = {
  attemptId?: string | null
  subjectId?: number | null
  classroomId?: number | null
  topicId?: number | null
  generalTopic?: boolean
  difficulty?: number | null
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

export async function fetchGameAttemptReview({
  attemptId = null,
  subjectId = null,
  classroomId = null,
  topicId = null,
  generalTopic = false,
  difficulty = null,
}: GameAttemptReviewFilters): Promise<GameAttemptReview | null> {
  const { data, error } = await supabase.rpc('get_game_attempt_review_index', {
    p_attempt_id: attemptId ?? undefined,
    p_subject_id: subjectId ?? undefined,
    p_classroom_id: classroomId ?? undefined,
    p_topic_id: topicId ?? undefined,
    p_general_topic: generalTopic,
    p_difficulty: difficulty ?? undefined,
  })

  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const payload = data as unknown as Record<string, unknown>
  const failedAttemptIds = Array.isArray(payload.failed_attempt_history_ids)
    ? payload.failed_attempt_history_ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : []
  const submittedAnswers = new Map(
    (Array.isArray(payload.failed_attempts) ? payload.failed_attempts : [])
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value))
      .map((value) => [
        Number(value.history_id),
        typeof value.submitted_answer_display === 'string' ? value.submitted_answer_display : null,
      ] as const)
  )

  const mistakes = await Promise.all(failedAttemptIds.map(async (historyId) => {
    const [attempt, feedback] = await Promise.all([
      fetchActivityAttemptDetail(historyId),
      fetchAttemptFeedback(historyId),
    ])
    return {
      attempt,
      feedback,
      submittedAnswerDisplay: submittedAnswers.get(historyId) ?? null,
    }
  }))

  return {
    attempt_id: String(payload.attempt_id || ''),
    subject_id: Number(payload.subject_id || 0),
    subject_name: typeof payload.subject_name === 'string' ? payload.subject_name : null,
    classroom_id: payload.classroom_id === null || payload.classroom_id === undefined ? null : Number(payload.classroom_id),
    topic_id: payload.topic_id === null || payload.topic_id === undefined ? null : Number(payload.topic_id),
    topic_title: typeof payload.topic_title === 'string' ? payload.topic_title : null,
    difficulty: payload.difficulty === null || payload.difficulty === undefined ? null : Number(payload.difficulty),
    started_at: String(payload.started_at || ''),
    finished_at: typeof payload.finished_at === 'string' ? payload.finished_at : null,
    status: String(payload.status || 'finished'),
    total_score: Math.max(0, Number(payload.total_score || 0)),
    questions_total: Math.max(0, Number(payload.questions_total || 0)),
    correct_total: Math.max(0, Number(payload.correct_total || 0)),
    failed_attempt_history_ids: failedAttemptIds,
    mistakes,
  }
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
