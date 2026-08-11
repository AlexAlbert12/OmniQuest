import type { AnswerItem, QuestionTypeId, QuestionValidationIssue, QuestionWizardStep, TopicOption } from './types'
import {
  QUESTION_POINTS_MAX,
  QUESTION_POINTS_MIN,
  QUESTION_TIME_LIMIT_MAX,
  QUESTION_TIME_LIMIT_MIN,
} from './types'

export function toDatabaseQuestionType(typeId: QuestionTypeId) {
  const map: Record<QuestionTypeId, string> = {
    multiple: 'multiple_choice',
    boolean: 'true_false',
    dragdrop: 'drag_drop',
    match: 'match_pairs',
    fill: 'fill_blank',
    order: 'ordering',
    open: 'open_answer',
  }
  return map[typeId]
}

export function fromDatabaseQuestionType(typeValue: string | null | undefined): QuestionTypeId {
  const normalized = (typeValue || '').toLowerCase()
  if (normalized === 'multiple_choice') return 'multiple'
  if (normalized === 'true_false') return 'boolean'
  if (normalized === 'drag_drop') return 'dragdrop'
  // Legacy pair questions are edited as the single canonical destination-assignment type.
  if (normalized === 'match_pairs') return 'dragdrop'
  if (normalized === 'fill_blank') return 'fill'
  if (normalized === 'ordering') return 'order'
  if (normalized === 'open_answer') return 'open'
  return 'multiple'
}

export function parseLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function countFillBlankMarkers(text: string) {
  return (text.match(/_{2,}|\[\[blank\]\]|\{\{blank\}\}/gi) || []).length
}

export function parsePairLines(value: string) {
  return parseLines(value)
    .map((line) => {
      const [left, ...rest] = line.split('|')
      return { left: left?.trim() || '', right: rest.join('|').trim() }
    })
    .filter((pair) => pair.left.length > 0 && pair.right.length > 0)
}

export function parsePairDraftLines(value: string) {
  const lines = value.split('\n').filter((line) => line.length > 0)
  return lines.map((line) => {
    const [left, ...rest] = line.split('|')
    return { left: left ?? '', right: rest.join('|') }
  })
}

export function ensurePairDraftRows(rows: { left: string; right: string }[]) {
  return rows.length > 0 ? rows : [
    { left: '', right: '' },
    { left: '', right: '' },
    { left: '', right: '' },
  ]
}

export function serializePairDraftLines(rows: { left: string; right: string }[]) {
  return rows.map((row) => `${row.left}|${row.right}`).join('\n')
}

export function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 3)
}

export function parseIntegerField(value: string) {
  const trimmedValue = value.trim()
  if (!/^\d+$/.test(trimmedValue)) return null
  return Number(trimmedValue)
}

export function getIntegerRangeError(label: string, value: number | null, min: number, max: number, unit: string) {
  if (value === null) return `${label} debe ser un número.`
  if (value < min) return `${label} mínimo es ${min} ${unit}.`
  if (value > max) return `${label} máximo es ${max} ${unit}.`
  return ''
}

export function encodePairAnswer(left: string, right: string) {
  return `${left}|||${right}`
}

export function decodePairAnswer(text: string) {
  const [left, ...rest] = (text || '').split('|||')
  const right = rest.join('|||')
  if (!left?.trim() || !right?.trim()) return null
  return { left: left.trim(), right: right.trim() }
}

export function ensureBooleanAnswers(currentAnswers: AnswerItem[]) {
  const hasTrueCorrect = currentAnswers.find((answer) => answer.text.trim().toLowerCase() === 'verdadero' && answer.isCorrect)
  const hasFalseCorrect = currentAnswers.find((answer) => answer.text.trim().toLowerCase() === 'falso' && answer.isCorrect)
  const trueIsCorrect = Boolean(hasTrueCorrect) || (!hasTrueCorrect && !hasFalseCorrect)
  return [
    { text: 'Verdadero', isCorrect: trueIsCorrect },
    { text: 'Falso', isCorrect: !trueIsCorrect },
  ]
}

export function buildAnswersForType({
  selectedType,
  questionId,
  visibleAnswers,
  openExpectedAnswer,
  fillLines,
  orderLines,
  matchPairs,
  dragdropPairs,
}: {
  selectedType: QuestionTypeId
  questionId: number | null
  visibleAnswers: AnswerItem[]
  openExpectedAnswer: string
  fillLines: string[]
  orderLines: string[]
  matchPairs: { left: string; right: string }[]
  dragdropPairs: { left: string; right: string }[]
}) {
  if (selectedType === 'multiple' || selectedType === 'boolean') {
    return visibleAnswers.map((answer, index) => ({
      question_id: questionId,
      text: answer.text.trim(),
      is_correct: answer.isCorrect,
      sort_order: index + 1,
    }))
  }
  if (selectedType === 'open') {
    return [{ question_id: questionId, text: openExpectedAnswer.trim(), is_correct: true, sort_order: 1 }]
  }
  if (selectedType === 'fill') {
    return fillLines.map((line, index) => ({ question_id: questionId, text: line, is_correct: true, sort_order: index + 1 }))
  }
  if (selectedType === 'order') {
    return orderLines.map((line, index) => ({ question_id: questionId, text: line, is_correct: true, sort_order: index + 1 }))
  }
  if (selectedType === 'match') {
    return matchPairs.map((pair, index) => ({
      question_id: questionId,
      text: encodePairAnswer(pair.left, pair.right),
      is_correct: true,
      sort_order: index + 1,
    }))
  }
  return dragdropPairs.map((pair, index) => ({
    question_id: questionId,
    text: encodePairAnswer(pair.left, pair.right),
    is_correct: true,
    sort_order: index + 1,
  }))
}

export function isNumericId(value: string | null | undefined): value is string {
  return Boolean(value && /^\d+$/.test(value))
}

export function getValidTopicId(selectedTopicId: string | null, topics: TopicOption[]) {
  if (!isNumericId(selectedTopicId)) return null
  const topicId = Number(selectedTopicId)
  return topics.some((topic) => topic.id === topicId) ? topicId : null
}

export function getQuestionTypePreviewTitle(type: QuestionTypeId) {
  if (type === 'open') return 'Respuesta esperada'
  if (type === 'fill') return 'Respuestas válidas'
  if (type === 'order') return 'Orden correcto'
  if (type === 'match') return 'Pares a unir'
  if (type === 'dragdrop') return 'Relaciones elemento/destino'
  return 'Vista previa'
}

export function getQuestionValidationIssues({
  selectedType,
  questionText,
  timeLimit,
  points,
  mediaType,
  mediaAltText,
  mediaTranscript,
  mediaSubtitlesVtt,
  visibleAnswers,
  openExpectedAnswer,
  fillAnswersText,
  orderItemsText,
  matchPairsText,
  dragdropPairsText,
}: {
  selectedType: QuestionTypeId
  questionText: string
  timeLimit: string
  points: string
  mediaType: string | null
  mediaAltText: string
  mediaTranscript: string
  mediaSubtitlesVtt: string
  visibleAnswers: AnswerItem[]
  openExpectedAnswer: string
  fillAnswersText: string
  orderItemsText: string
  matchPairsText: string
  dragdropPairsText: string
}): QuestionValidationIssue[] {
  const issues: QuestionValidationIssue[] = []
  const parsedTime = parseIntegerField(timeLimit)
  const parsedPoints = parseIntegerField(points)
  const timeError = getIntegerRangeError('El tiempo', parsedTime, QUESTION_TIME_LIMIT_MIN, QUESTION_TIME_LIMIT_MAX, 'segundos')
  const pointsError = getIntegerRangeError('Los puntos', parsedPoints, QUESTION_POINTS_MIN, QUESTION_POINTS_MAX, 'puntos')

  if (!questionText.trim()) issues.push({ step: 2, field: 'Enunciado', message: 'Escribe el enunciado de la pregunta.' })
  if (selectedType === 'fill' && countFillBlankMarkers(questionText) === 0) {
    issues.push({ step: 2, field: 'Enunciado', message: 'Marca al menos un hueco con ____.' })
  }
  if (mediaType === 'image' && !mediaAltText.trim()) {
    issues.push({ step: 2, field: 'Contenido multimedia', message: 'Añade texto alternativo para la imagen.' })
  }
  if (mediaType === 'audio' && !mediaTranscript.trim()) {
    issues.push({ step: 2, field: 'Contenido multimedia', message: 'Añade una transcripción para el audio.' })
  }
  if (mediaType === 'video' && !isValidWebVtt(mediaSubtitlesVtt)) {
    issues.push({ step: 2, field: 'Contenido multimedia', message: 'Añade subtítulos WebVTT válidos para el vídeo.' })
  }

  if ((selectedType === 'multiple' || selectedType === 'boolean') && visibleAnswers.some((answer) => !answer.text.trim())) {
    issues.push({ step: 3, field: 'Respuestas', message: 'Completa todas las opciones de respuesta.' })
  }
  if (selectedType === 'open' && !openExpectedAnswer.trim()) {
    issues.push({ step: 3, field: 'Respuesta esperada', message: 'Añade una respuesta esperada o criterio de corrección.' })
  }
  if (selectedType === 'fill' && parseLines(fillAnswersText).length === 0) {
    issues.push({ step: 3, field: 'Soluciones', message: 'Añade al menos una solución válida.' })
  }
  if (selectedType === 'order' && parseLines(orderItemsText).length < 2) {
    issues.push({ step: 3, field: 'Orden', message: 'Añade al menos dos elementos.' })
  }
  if (selectedType === 'match' && parsePairLines(matchPairsText).length < 1) {
    issues.push({ step: 3, field: 'Parejas', message: 'Añade al menos una pareja completa.' })
  }
  if (selectedType === 'dragdrop' && parsePairLines(dragdropPairsText).length < 1) {
    issues.push({ step: 3, field: 'Destinos', message: 'Añade al menos una relación completa.' })
  }

  if (timeError) issues.push({ step: 4, field: 'Tiempo', message: timeError })
  if (pointsError) issues.push({ step: 4, field: 'Puntos', message: pointsError })
  return issues
}

function isValidWebVtt(value: string) {
  const normalized = value.trim()
  return /^WEBVTT(?:\s|$)/i.test(normalized)
    && /(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}/.test(normalized)
}

export function getFirstInvalidStep(issues: QuestionValidationIssue[]): QuestionWizardStep | null {
  if (issues.length === 0) return null
  return issues.reduce<QuestionWizardStep>((minimum, issue) => issue.step < minimum ? issue.step : minimum, issues[0].step)
}

export function issuesForStep(issues: QuestionValidationIssue[], step: QuestionWizardStep) {
  return issues.filter((issue) => issue.step === step)
}
