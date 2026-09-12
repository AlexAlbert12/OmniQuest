import { supabase } from '../../lib/supabase'
import { callPlatformRpc } from '../../lib/platformRpc'
import type { StudentProgressSummary, StudentRecentGame } from './types'

export async function fetchStudentProgressSummary(_userId?: string): Promise<StudentProgressSummary> {
  const { data, error } = await supabase.rpc('get_student_progress_summary')
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('El servidor devolvió un resumen de progreso no válido.')
  return data as unknown as StudentProgressSummary
}


export async function fetchStudentRecentGames(limit = 5): Promise<StudentRecentGame[]> {
  const safeLimit = Math.min(Math.max(Math.round(limit || 5), 1), 20)
  const result = await callPlatformRpc<unknown[]>('get_student_recent_game_attempts', { p_limit: safeLimit })
  if (result.error) throw result.error
  if (!Array.isArray(result.data)) return []
  return result.data.map((value) => mapRecentGame(value)).filter((value): value is StudentRecentGame => value !== null)
}

function mapRecentGame(value: unknown): StudentRecentGame | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : ''
  const subjectId = Number(row.subjectId ?? row.subject_id)
  if (!id || !Number.isFinite(subjectId)) return null
  const nullableNumber = (input: unknown) => {
    if (input === null || input === undefined || input === '') return null
    const parsed = Number(input)
    return Number.isFinite(parsed) ? parsed : null
  }
  return {
    id,
    subjectId,
    subjectName: String(row.subjectName ?? row.subject_name ?? 'Curso'),
    classroomId: nullableNumber(row.classroomId ?? row.classroom_id),
    classroomName: row.classroomName === null || row.classroom_name === null ? null : String(row.classroomName ?? row.classroom_name ?? '') || null,
    topicId: nullableNumber(row.topicId ?? row.topic_id),
    topicName: row.topicName === null || row.topic_name === null ? null : String(row.topicName ?? row.topic_name ?? '') || null,
    difficulty: nullableNumber(row.difficulty),
    startedAt: String(row.startedAt ?? row.started_at ?? ''),
    finishedAt: row.finishedAt === null || row.finished_at === null ? null : String(row.finishedAt ?? row.finished_at ?? '') || null,
    totalScore: Math.max(0, Number(row.totalScore ?? row.total_score ?? 0)),
    questionsTotal: Math.max(0, Number(row.questionsTotal ?? row.questions_total ?? 0)),
    evaluatedTotal: Math.max(0, Number(row.evaluatedTotal ?? row.evaluated_total ?? 0)),
    correctTotal: Math.max(0, Number(row.correctTotal ?? row.correct_total ?? 0)),
    incorrectTotal: Math.max(0, Number(row.incorrectTotal ?? row.incorrect_total ?? 0)),
    pendingTotal: Math.max(0, Number(row.pendingTotal ?? row.pending_total ?? 0)),
    durationSeconds: nullableNumber(row.durationSeconds ?? row.duration_seconds),
  }
}
