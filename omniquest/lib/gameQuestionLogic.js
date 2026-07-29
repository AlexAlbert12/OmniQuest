export const QUESTION_TYPES = Object.freeze([
  'multiple_choice',
  'true_false',
  'open_answer',
  'fill_blank',
  'ordering',
  'match_pairs',
  'drag_drop',
])

export function normalizeQuestionType(value) {
  const normalized = String(value || '').toLowerCase()
  return QUESTION_TYPES.includes(normalized) ? normalized : 'multiple_choice'
}

export function isChoiceQuestion(type) {
  return type === 'multiple_choice' || type === 'true_false'
}

export function getQuestionInstruction(type) {
  if (type === 'open_answer') return 'Escribe la respuesta correcta'
  if (type === 'fill_blank') return 'Completa cada hueco en orden'
  if (type === 'ordering') return 'Ordena los elementos'
  if (type === 'match_pairs') return 'Toca un origen y después su pareja'
  if (type === 'drag_drop') return 'Asigna cada elemento a su destino'
  return 'Elige la opción correcta'
}

export function countBlankMarkers(text) {
  return (String(text || '').match(/_{2,}|\[\[blank\]\]|\{\{blank\}\}/gi) || []).length
}

export function splitFillPrompt(text) {
  return String(text || '').split(/_{2,}|\[\[blank\]\]|\{\{blank\}\}/gi)
}

export function getBlankCount(question) {
  const databaseCount = Number(question?.blank_count || 0)
  const markerCount = countBlankMarkers(question?.text || '')
  return Math.max(1, Math.min(8, databaseCount || markerCount || 1))
}

export function buildOpenAnswerSubmission(value) {
  return { answerText: String(value || '').trim() }
}

export function buildFillBlankSubmission(values) {
  return { answerText: values.map((value) => String(value || '').trim()).join(', ') }
}

export function buildOrderingSubmission(answerIds) {
  return { payload: { answer_ids: answerIds.map((value) => Number(value)) } }
}

export function buildPairingSubmission(pairs) {
  return {
    payload: {
      pairs: pairs.map((pair) => ({
        left: String(pair?.left || '').trim(),
        right: String(pair?.right || '').trim(),
      })),
    },
  }
}

export function withQuestionVersionMetadata(payload, questionUpdatedAt) {
  const version = typeof questionUpdatedAt === 'string' && questionUpdatedAt.trim()
    ? questionUpdatedAt.trim()
    : null

  if (!version) return payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ...payload, _omniquest_question_updated_at: version }
  }
  return {
    _omniquest_question_updated_at: version,
    ...(payload === undefined ? {} : { _omniquest_answer_payload: payload }),
  }
}

export function isQuestionVersionConflict(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  const details = String(error?.details || '')
  return code === '40001'
    || message.includes('QUESTION_VERSION_CONFLICT')
    || details.includes('QUESTION_VERSION_CONFLICT')
}
