import { getDifficultyMeta } from './difficulty'
import type { AnswerDistributionPoint, QuestionReportPeriod, TeacherQuestionReportSummary } from './teacherQuestionReport'

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Tipo test',
  true_false: 'Verdadero/Falso',
  fill_blank: 'Rellenar huecos',
  match_pairs: 'Emparejar',
  ordering: 'Ordenar',
  open_answer: 'Respuesta abierta',
  drag_drop: 'Arrastrar y soltar',
}

export const QUESTION_REPORT_PERIOD_LABELS: Record<QuestionReportPeriod, string> = {
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  all: 'Todo el histórico',
}

export function getQuestionTypeLabel(type: string) {
  return QUESTION_TYPE_LABELS[type] || type
}

export function getQuestionDifficultyLabel(value: number | null | undefined) {
  if (value == null) return 'Sin definir'
  return getDifficultyMeta(value).label
}

export function getDiscriminationLabel(value: number | null) {
  if (value == null) return 'Sin datos suficientes'
  if (value >= 0.4) return 'Muy buena'
  if (value >= 0.3) return 'Adecuada'
  if (value >= 0.2) return 'Revisable'
  return 'Baja o negativa'
}

export function getQuestionFailureRate(summary: TeacherQuestionReportSummary) {
  return summary.totalAttempts > 0 ? summary.failedAttempts / summary.totalAttempts : null
}

export function getFailureTrendLabel(value: number) {
  if (value > 0) return 'Empeora'
  if (value < 0) return 'Mejora'
  return 'Estable'
}

export function getQuestionReportPeriodRange(period: QuestionReportPeriod, now = Date.now()) {
  if (period === 'all') return { from: null, to: null }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  return { from: new Date(now - days * 24 * 60 * 60 * 1000).toISOString(), to: null }
}

export function getAnswerDistributionClassification(questionType: string, item: AnswerDistributionPoint) {
  const normalized = item.label.trim().toLocaleLowerCase('es-ES')
  if (normalized === 'omitida' || normalized.includes('omitid')) return 'Omitida'
  if (questionType === 'open_answer') return 'Respuesta enviada'
  return item.correct ? 'Correcta' : 'Incorrecta'
}
