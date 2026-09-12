export type StudentAttemptEvaluationState = 'pending' | 'needs_changes' | 'correct' | 'incorrect'

type AttemptEvaluationInput = {
  manualReviewStatus?: string | null
  isCorrect?: boolean | null
}

const PENDING_REVIEW_STATUSES = new Set(['pending', 'in_review'])

export function getStudentAttemptEvaluationState(input: AttemptEvaluationInput): StudentAttemptEvaluationState {
  const status = String(input.manualReviewStatus || 'not_required').trim().toLowerCase()
  if (PENDING_REVIEW_STATUSES.has(status)) return 'pending'
  if (status === 'needs_changes') return 'needs_changes'
  if (status === 'approved') return 'correct'
  if (status === 'rejected') return 'incorrect'
  return input.isCorrect === true ? 'correct' : 'incorrect'
}

export function isStudentAttemptUnresolved(input: AttemptEvaluationInput) {
  const state = getStudentAttemptEvaluationState(input)
  return state === 'pending' || state === 'needs_changes'
}

export function isStudentAttemptEvaluated(input: AttemptEvaluationInput) {
  return !isStudentAttemptUnresolved(input)
}

export function isStudentAttemptCorrect(input: AttemptEvaluationInput) {
  return getStudentAttemptEvaluationState(input) === 'correct'
}

export function isStudentAttemptFailure(input: AttemptEvaluationInput) {
  return getStudentAttemptEvaluationState(input) === 'incorrect'
}
