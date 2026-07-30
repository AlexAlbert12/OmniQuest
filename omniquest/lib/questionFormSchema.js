const TYPES = new Set(['multiple', 'boolean', 'dragdrop', 'match', 'fill', 'order', 'open'])

export const teacherQuestionSchema = {
  safeParse(input) {
    const issues = []
    const value = input && typeof input === 'object' ? input : {}
    const type = TYPES.has(value.selectedType) ? value.selectedType : 'multiple'
    const text = String(value.questionText || '').trim()
    const timeLimit = Number(value.timeLimit)
    const points = Number(value.points)
    const answers = Array.isArray(value.visibleAnswers) ? value.visibleAnswers : []

    if (!text) issue(issues, ['questionText'], 'Escribe el enunciado de la pregunta.', 2, 'Enunciado')
    if (!Number.isInteger(timeLimit) || timeLimit < 5 || timeLimit > 300) {
      issue(issues, ['timeLimit'], 'El tiempo debe estar entre 5 y 300 segundos.', 4, 'Tiempo')
    }
    if (!Number.isInteger(points) || points < 1 || points > 100) {
      issue(issues, ['points'], 'Los puntos deben estar entre 1 y 100.', 4, 'Puntos')
    }

    if (value.mediaType === 'image' && !String(value.mediaAltText || '').trim()) {
      issue(issues, ['mediaAltText'], 'Añade texto alternativo para la imagen.', 2, 'Contenido multimedia')
    }
    if (value.mediaType === 'audio' && !String(value.mediaTranscript || '').trim()) {
      issue(issues, ['mediaTranscript'], 'Añade una transcripción para el audio.', 2, 'Contenido multimedia')
    }
    if (value.mediaType === 'video' && !isValidWebVtt(String(value.mediaSubtitlesVtt || ''))) {
      issue(issues, ['mediaSubtitlesVtt'], 'Añade subtítulos WebVTT válidos para el vídeo.', 2, 'Contenido multimedia')
    }

    if (type === 'multiple' || type === 'boolean') {
      if (answers.length < 2 || answers.some((answer) => !String(answer?.text || '').trim())) {
        issue(issues, ['visibleAnswers'], 'Completa todas las opciones de respuesta.', 3, 'Respuestas')
      }
      if (!answers.some((answer) => Boolean(answer?.isCorrect))) {
        issue(issues, ['visibleAnswers'], 'Marca una respuesta correcta.', 3, 'Respuestas')
      }
    }
    if (type === 'open' && !String(value.openExpectedAnswer || '').trim()) {
      issue(issues, ['openExpectedAnswer'], 'Añade una respuesta esperada o criterio de corrección.', 3, 'Respuesta esperada')
    }
    if (type === 'fill') {
      if (!countFillMarkers(text)) issue(issues, ['questionText'], 'Marca al menos un hueco con ____.', 2, 'Enunciado')
      if (lines(value.fillAnswersText).length === 0) issue(issues, ['fillAnswersText'], 'Añade al menos una solución válida.', 3, 'Soluciones')
    }
    if (type === 'order' && lines(value.orderItemsText).length < 2) {
      issue(issues, ['orderItemsText'], 'Añade al menos dos elementos.', 3, 'Orden')
    }
    if (type === 'match' && pairs(value.matchPairsText).length < 1) {
      issue(issues, ['matchPairsText'], 'Añade al menos una pareja completa.', 3, 'Parejas')
    }
    if (type === 'dragdrop' && pairs(value.dragdropPairsText).length < 1) {
      issue(issues, ['dragdropPairsText'], 'Añade al menos una relación completa.', 3, 'Destinos')
    }

    if (issues.length) return { success: false, error: { issues } }
    return { success: true, data: value }
  },
}

function issue(issues, path, message, step, field) {
  issues.push({ path, message, step, field, code: 'custom' })
}

function lines(value) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean)
}

function pairs(value) {
  return lines(value).map((line) => {
    const [left, ...right] = line.split('|')
    return { left: String(left || '').trim(), right: right.join('|').trim() }
  }).filter((pair) => pair.left && pair.right)
}

function countFillMarkers(value) {
  return (String(value || '').match(/_{2,}|\[\[blank\]\]|\{\{blank\}\}/gi) || []).length
}

function isValidWebVtt(value) {
  const normalized = value.trim()
  return /^WEBVTT(?:\s|$)/i.test(normalized)
    && /(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}/.test(normalized)
}
