import type { SafeAttemptAnswer, SafeAttemptQuestion, SafeStudentAttempt } from '../../../lib/studentSecureData'
import type { ActivityListItem } from './types'

export function normalizeSingleRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation ?? null
}

export function buildActivityRows(attempts: SafeStudentAttempt[]): ActivityListItem[] {
  const groups = new Map<string, SafeStudentAttempt[]>()
  attempts.forEach((attempt) => {
    const key = getAttemptDateKey(attempt.attempted_at)
    const current = groups.get(key) || []
    current.push(attempt)
    groups.set(key, current)
  })

  const rows: ActivityListItem[] = []
  groups.forEach((groupAttempts, key) => {
    rows.push({
      kind: 'date',
      key: `date-${key}`,
      label: formatActivityGroupLabel(groupAttempts[0]?.attempted_at),
      count: groupAttempts.length,
    })
    groupAttempts.forEach((attempt) => rows.push({ kind: 'attempt', key: `attempt-${attempt.id}`, attempt }))
  })
  return rows
}

export function getAttemptDateKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function formatActivityGroupLabel(value?: string) {
  if (!value) return 'Actividad'
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (getAttemptDateKey(value) === getAttemptDateKey(today.toISOString())) return 'Hoy'
  if (getAttemptDateKey(value) === getAttemptDateKey(yesterday.toISOString())) return 'Ayer'

  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).replace(/^./, (character) => character.toUpperCase())
}

export function getQuestionAnswers(question: SafeAttemptQuestion | null): SafeAttemptAnswer[] {
  return Array.isArray(question?.answers) ? question.answers : []
}

export function getSubmittedAnswerText(attempt: SafeStudentAttempt, answers: SafeAttemptAnswer[]) {
  if (attempt.was_skipped) return 'Sin respuesta / tiempo agotado'

  const textAnswer = attempt.submitted_answer_text?.trim()
  if (textAnswer) return textAnswer

  const payload = attempt.submitted_answer_payload
  const answerMap = new Map(answers.map((answer) => [Number(answer.id), formatAnswerText(answer.text)]))

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.answer_ids)) {
      const orderedAnswers = record.answer_ids
        .map((id) => answerMap.get(Number(id)))
        .filter((value): value is string => Boolean(value))
      if (orderedAnswers.length > 0) return orderedAnswers.join(' → ')
    }

    if (Array.isArray(record.pairs)) {
      const pairs = record.pairs
        .map((pair) => {
          if (!pair || typeof pair !== 'object' || Array.isArray(pair)) return ''
          const pairRecord = pair as Record<string, unknown>
          return `${String(pairRecord.left ?? '')} → ${String(pairRecord.right ?? '')}`.trim()
        })
        .filter((value) => value.replace('→', '').trim().length > 0)
      if (pairs.length > 0) return pairs.join('\n')
    }
  }

  if (attempt.answer_id !== null) {
    const selectedAnswer = answerMap.get(Number(attempt.answer_id))
    if (selectedAnswer) return selectedAnswer
  }

  return 'Respuesta eliminada por la política de privacidad.'
}

function formatAnswerText(value: string | null | undefined) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.includes('|||')) {
    const [left, right] = text.split('|||')
    return `${left?.trim() || ''} → ${right?.trim() || ''}`.trim()
  }
  return text
}

export function getQuestionTypeLabel(type?: string | null) {
  switch (type) {
    case 'multiple_choice': return 'Tipo test'
    case 'true_false': return 'Verdadero/Falso'
    case 'open_answer': return 'Abierta'
    case 'fill_blank': return 'Huecos'
    case 'ordering': return 'Ordenar'
    case 'match_pairs': return 'Parejas'
    case 'drag_drop': return 'Asignar'
    default: return 'Pregunta'
  }
}

export function formatAttemptDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatAttemptTime(value: string) {
  return new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function formatTimeTaken(seconds: number | null) {
  if (seconds === null || Number.isNaN(seconds)) return 'Sin tiempo'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
