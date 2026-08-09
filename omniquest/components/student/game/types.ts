import type { Json } from '../../../types/database.types'
import type { QuestionType } from '../../../lib/gameQuestionLogic'

export type GameAnswer = {
  id: number
  text: string
}

export type StructuredAnswerPayload = {
  answerText?: string
  payload?: Json
}

export type PairOptionToken = {
  key: string
  text: string
}

export type GameQuestion = {
  id: number
  text: string
  type?: string | null
  points_base?: number | null
  category?: string | null
  subject?: string | null
  explanation?: string | null
  hint?: string | null
  answers: GameAnswer[]
  pair_options?: string[]
  blank_count?: number | null
  media_type?: 'image' | 'audio' | 'video' | null
  media_url?: string | null
  media_alt_text?: string | null
  media_caption?: string | null
  question_updated_at?: string | null
}

export type GameQuestionInteractionProps = {
  question: GameQuestion
  questionType: QuestionType
  selectedAnswerId: number | null
  correctAnswerId: number | null
  hintedAnswerId: number | null
  hasAnswered: boolean
  isSubmitting: boolean
  answerStatus: 'correct' | 'incorrect' | null
  onChoiceAnswer: (answerId: number) => void
  onStructuredAnswer: (payload: StructuredAnswerPayload) => void
}

export type GameSyncState = 'idle' | 'saving' | 'offline' | 'retrying' | 'synced' | 'conflict' | 'error'

export type GameQuestionConflict = {
  questionId: number
  questionText: string
  expectedVersion: string | null
  message: string
}
