import type { Json } from '../types/database.types'

export type QuestionType = 'multiple_choice' | 'true_false' | 'open_answer' | 'fill_blank' | 'ordering' | 'match_pairs' | 'drag_drop'
export type StructuredAnswerPayload = { answerText?: string; payload?: Json }

export const QUESTION_TYPES: readonly QuestionType[]
export function normalizeQuestionType(value: string | null | undefined): QuestionType
export function isChoiceQuestion(type: QuestionType): boolean
export function getQuestionInstruction(type: QuestionType): string
export function countBlankMarkers(text: string): number
export function splitFillPrompt(text: string): string[]
export function getBlankCount(question: { blank_count?: number | null; text?: string | null }): number
export function buildOpenAnswerSubmission(value: string): StructuredAnswerPayload
export function buildFillBlankSubmission(values: string[]): StructuredAnswerPayload
export function buildOrderingSubmission(answerIds: number[]): StructuredAnswerPayload
export function buildPairingSubmission(pairs: { left: string; right: string }[]): StructuredAnswerPayload
export function withQuestionVersionMetadata(payload: Json | undefined, questionUpdatedAt?: string | null): Json | undefined
export function isQuestionVersionConflict(error: unknown): boolean
