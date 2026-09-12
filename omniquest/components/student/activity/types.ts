import type { SafeStudentAttempt } from '../../../lib/studentSecureData'

export type ActivityFilter = 'all' | 'correct' | 'incorrect' | 'pending'

export type ActivityFilterOption = {
  id: string
  label: string
  count: number
}

export type ActivityStatusCounts = {
  all: number
  correct: number
  incorrect: number
  pending: number
}

export type ActivityAttempt = SafeStudentAttempt

export type ActivityListItem =
  | { kind: 'date'; key: string; label: string; count: number }
  | { kind: 'attempt'; key: string; attempt: ActivityAttempt }
