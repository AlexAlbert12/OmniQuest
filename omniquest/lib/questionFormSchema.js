const TYPES = new Set(['multiple', 'boolean', 'dragdrop', 'match', 'fill', 'order', 'open'])
const QUESTION_TEXT_MAX = 2000
const QUESTION_ANSWER_MAX = 2000
const QUESTION_EXPLANATION_MAX = 4000
const QUESTION_HINT_MAX = 280
const MEDIA_ALT_MAX = 300
const MEDIA_CAPTION_MAX = 300
const MEDIA_TRANSCRIPT_MAX = 20000
const MEDIA_SUBTITLES_MAX = 40000

export const teacherQuestionSchema = {
  safeParse(input) {
    const issues = []
    const value = input && typeof input === 'object' ? input : {}
    const type = TYPES.has(value.selectedType) ? value.selectedType : 'multiple'
    const text = String(value.questionText || '').trim()
    const timeLimit = Number(value.timeLimit)
    const points = Number(value.points)
    const answers = Array.isArray(value.visibleAnswers) ? value.visibleAnswers : []
    const explanation = String(value.explanation || '').trim()
    const hint = String(value.hint || '').trim()
    const altText = String(value.mediaAltText || '').trim()
    const caption = String(value.mediaCaption || '').trim()
    const transcript = String(value.mediaTranscript || '').trim()
    const subtitles = String(value.mediaSubtitlesVtt || '').trim()

    if (!text) issue(issues, ['questionText'], 'Escribe el enunciado de la pregunta.', 2, 'Enunciado')
    else if (text.length > QUESTION_TEXT_MAX) issue(issues, ['questionText'], `El enunciado no puede superar ${QUESTION_TEXT_MAX} caracteres.`, 2, 'Enunciado')
    if (!Number.isInteger(timeLimit) || timeLimit < 5 || timeLimit > 300) issue(issues, ['timeLimit'], 'El tiempo debe estar entre 5 y 300 segundos.', 4, 'Tiempo')
    if (!Number.isInteger(points) || points < 1 || points > 100) issue(issues, ['points'], 'Los puntos deben estar entre 1 y 100.', 4, 'Puntos')
    if (explanation.length > QUESTION_EXPLANATION_MAX) issue(issues, ['explanation'], `La explicación no puede superar ${QUESTION_EXPLANATION_MAX} caracteres.`, 4, 'Explicación')
    if (hint.length > QUESTION_HINT_MAX) issue(issues, ['hint'], `La pista no puede superar ${QUESTION_HINT_MAX} caracteres.`, 4, 'Pista')
    if (caption.length > MEDIA_CAPTION_MAX) issue(issues, ['mediaCaption'], `El pie del recurso no puede superar ${MEDIA_CAPTION_MAX} caracteres.`, 2, 'Contenido multimedia')

    if (value.mediaType === 'image') {
      if (!altText) issue(issues, ['mediaAltText'], 'Añade texto alternativo para la imagen.', 2, 'Contenido multimedia')
      else if (altText.length > MEDIA_ALT_MAX) issue(issues, ['mediaAltText'], `El texto alternativo no puede superar ${MEDIA_ALT_MAX} caracteres.`, 2, 'Contenido multimedia')
    }
    if (value.mediaType === 'audio') {
      if (!transcript) issue(issues, ['mediaTranscript'], 'Añade una transcripción para el audio.', 2, 'Contenido multimedia')
      else if (transcript.length > MEDIA_TRANSCRIPT_MAX) issue(issues, ['mediaTranscript'], 'La transcripción es demasiado larga.', 2, 'Contenido multimedia')
    }
    if (value.mediaType === 'video') {
      if (!isValidWebVtt(subtitles)) issue(issues, ['mediaSubtitlesVtt'], 'Añade subtítulos WebVTT válidos para el vídeo.', 2, 'Contenido multimedia')
      else if (subtitles.length > MEDIA_SUBTITLES_MAX) issue(issues, ['mediaSubtitlesVtt'], 'Los subtítulos son demasiado largos.', 2, 'Contenido multimedia')
    }

    if (type === 'multiple' || type === 'boolean') {
      const expectedCount = type === 'boolean' ? 2 : null
      if (answers.length < 2 || (expectedCount && answers.length !== expectedCount) || answers.some((answer) => !String(answer?.text || '').trim())) {
        issue(issues, ['visibleAnswers'], type === 'boolean' ? 'Verdadero/Falso necesita exactamente dos opciones completas.' : 'Completa al menos dos opciones de respuesta.', 3, 'Respuestas')
      }
      if (answers.some((answer) => String(answer?.text || '').trim().length > QUESTION_ANSWER_MAX)) issue(issues, ['visibleAnswers'], `Cada respuesta puede tener como máximo ${QUESTION_ANSWER_MAX} caracteres.`, 3, 'Respuestas')
      if (answers.filter((answer) => Boolean(answer?.isCorrect)).length !== 1) issue(issues, ['visibleAnswers'], 'Debe existir exactamente una respuesta correcta.', 3, 'Respuestas')
    }
    if (type === 'open') {
      const expected = String(value.openExpectedAnswer || '').trim()
      if (!expected) issue(issues, ['openExpectedAnswer'], 'Añade una respuesta esperada o criterio de corrección.', 3, 'Respuesta esperada')
      else if (expected.length > QUESTION_ANSWER_MAX) issue(issues, ['openExpectedAnswer'], `La respuesta esperada no puede superar ${QUESTION_ANSWER_MAX} caracteres.`, 3, 'Respuesta esperada')
    }
    if (type === 'fill') {
      const markerCount = countFillMarkers(text)
      const fillLines = lines(value.fillAnswersText)
      if (!markerCount) issue(issues, ['questionText'], 'Añade al menos un hueco con el botón «Crear hueco».', 2, 'Enunciado')
      if (fillLines.length === 0) issue(issues, ['fillAnswersText'], 'Añade al menos una solución válida.', 3, 'Soluciones')
      else if (markerCount && fillLines.length !== markerCount) issue(issues, ['fillAnswersText'], `Añade una solución por cada hueco (${markerCount}).`, 3, 'Soluciones')
      if (fillLines.some((item) => item.length > QUESTION_ANSWER_MAX)) issue(issues, ['fillAnswersText'], `Cada solución puede tener como máximo ${QUESTION_ANSWER_MAX} caracteres.`, 3, 'Soluciones')
    }
    if (type === 'order') {
      const orderLines = lines(value.orderItemsText)
      if (orderLines.length < 2) issue(issues, ['orderItemsText'], 'Añade al menos dos elementos.', 3, 'Orden')
      if (orderLines.some((item) => item.length > QUESTION_ANSWER_MAX)) issue(issues, ['orderItemsText'], `Cada elemento puede tener como máximo ${QUESTION_ANSWER_MAX} caracteres.`, 3, 'Orden')
    }
    if (type === 'match' || type === 'dragdrop') {
      const pairRows = pairs(type === 'match' ? value.matchPairsText : value.dragdropPairsText)
      if (pairRows.length < 1) issue(issues, [type === 'match' ? 'matchPairsText' : 'dragdropPairsText'], type === 'match' ? 'Añade al menos una pareja completa.' : 'Añade al menos una relación completa.', 3, type === 'match' ? 'Parejas' : 'Destinos')
      if (pairRows.some((pair) => `${pair.left}|||${pair.right}`.length > QUESTION_ANSWER_MAX)) issue(issues, [type === 'match' ? 'matchPairsText' : 'dragdropPairsText'], `Cada relación puede tener como máximo ${QUESTION_ANSWER_MAX} caracteres.`, 3, type === 'match' ? 'Parejas' : 'Destinos')
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
  return (String(value || '').match(/_{2,}|\[\[\s*blank\s*\]\]|\{\{\s*blank\s*\}\}/gi) || []).length
}

function isValidWebVtt(value) {
  const normalized = value.trim()
  return /^WEBVTT(?:\s|$)/i.test(normalized) && /(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}/.test(normalized)
}
