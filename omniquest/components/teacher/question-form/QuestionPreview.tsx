import React, { useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import type { QuestionType } from '../../../lib/gameQuestionLogic'
import AppButton from '../../ui/AppButton'
import AppStatusBanner from '../../ui/AppStatusBanner'
import GameQuestionRenderer from '../../student/game/GameQuestionRenderer'
import type { GameQuestion, StructuredAnswerPayload } from '../../student/game/types'
import QuestionMedia from '../../questions/QuestionMedia'
import type { TeacherQuestionMediaValue } from '../TeacherQuestionMediaEditor'
import type { AnswerItem, QuestionTypeCard, QuestionTypeId } from './types'
import { parseLines, parsePairLines, toDatabaseQuestionType } from './utils'
import QuestionFormSection from './QuestionFormSection'

export default function QuestionPreview({ selectedType, selectedTypeCard, questionText, media, visibleAnswers, openExpectedAnswer, fillAnswersText, orderItemsText, matchPairsText, dragdropPairsText, explanation, hint, timeLimit, points }: { selectedType: QuestionTypeId; selectedTypeCard: QuestionTypeCard; questionText: string; media: TeacherQuestionMediaValue; visibleAnswers: AnswerItem[]; openExpectedAnswer: string; fillAnswersText: string; orderItemsText: string; matchPairsText: string; dragdropPairsText: string; explanation: string; hint: string; timeLimit: number | null; points: number | null }) {
  const { tokens } = useAppTheme()
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null)
  const [previewInteraction, setPreviewInteraction] = useState(0)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [answerStatus, setAnswerStatus] = useState<'correct' | 'incorrect' | null>(null)
  const [feedbackStatus, setFeedbackStatus] = useState<'correct' | 'incorrect' | 'pending' | null>(null)
  const [hintVisible, setHintVisible] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)
  const questionType = toDatabaseQuestionType(selectedType) as QuestionType
  const question = useMemo(() => buildPreviewQuestion({ selectedType, questionText, visibleAnswers, openExpectedAnswer, fillAnswersText, orderItemsText, matchPairsText, dragdropPairsText, explanation, hint, points }), [dragdropPairsText, explanation, fillAnswersText, hint, matchPairsText, openExpectedAnswer, orderItemsText, points, questionText, selectedType, visibleAnswers])
  const correctChoiceId = useMemo(() => {
    const index = visibleAnswers.findIndex((answer) => answer.isCorrect)
    return index >= 0 ? index + 1 : null
  }, [visibleAnswers])

  useEffect(() => { resetPreview() }, [question.id, question.text, questionType])

  function resetPreview() {
    setSelectedAnswerId(null)
    setHasAnswered(false)
    setAnswerStatus(null)
    setFeedbackStatus(null)
    setHintVisible(false)
    setHintUsed(false)
    setPreviewInteraction((value) => value + 1)
  }

  const finish = (status: 'correct' | 'incorrect' | 'pending') => {
    setHasAnswered(true)
    setFeedbackStatus(status)
    setAnswerStatus(status === 'pending' ? null : status)
  }

  const checkChoice = () => {
    if (!selectedAnswerId || !correctChoiceId || hasAnswered) return
    finish(selectedAnswerId === correctChoiceId ? 'correct' : 'incorrect')
  }

  const handleStructuredPreview = (payload: StructuredAnswerPayload) => {
    if (hasAnswered) return
    if (selectedType === 'open') {
      finish('pending')
      return
    }
    finish(evaluateStructuredPreview(selectedType, payload, { fillAnswersText, orderItemsText, matchPairsText, dragdropPairsText }) ? 'correct' : 'incorrect')
  }

  const earnedPoints = feedbackStatus === 'correct' ? Math.max(0, (points ?? 0) - (hintUsed ? 10 : 0)) : 0

  return (
    <QuestionFormSection title="Vista previa real" subtitle="Simula el mismo flujo que verá el alumno: responde, comprueba, prueba la pista y revisa el feedback." icon="eye-outline">
      <View className="rounded-2xl border p-4 md:p-5" style={{ borderColor: tokens.border.active, backgroundColor: tokens.surface.raised }}>
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="rounded-full border px-3 py-1" style={{ borderColor: selectedTypeCard.accent, backgroundColor: `${selectedTypeCard.accent}20` }}><Text className="font-black" style={{ color: selectedTypeCard.accent }}>{selectedTypeCard.title}</Text></View>
          <View className="flex-row items-center gap-4"><Metric icon="time-outline" value={`${timeLimit ?? 0}s`} /><Metric icon="star" value={`${points ?? 0} pts`} highlight /></View>
        </View>

        <Text accessibilityRole="header" className="mt-5 text-[25px] font-black leading-8 md:text-[34px] md:leading-[42px]" style={{ color: tokens.text.primary }}>{question.text}</Text>

        {media.type && (media.pendingAsset?.uri || media.url || media.path) ? <QuestionMedia type={media.type} url={media.pendingAsset?.uri || media.url} path={media.path} transcript={media.transcript} subtitlesVtt={media.subtitlesVtt} altText={media.altText} caption={media.caption} compact /> : null}

        {hint.trim() && !hasAnswered ? (
          <View className="mt-4">
            {hintVisible ? (
              <View className="flex-row items-start gap-2 rounded-xl bg-semantic-surface-warning px-3 py-3">
                <Ionicons name="bulb" size={17} color={tokens.semantic.warning} />
                <View className="min-w-0 flex-1"><Text className="text-[12px] font-black text-gamification-xp">Pista</Text><Text className="mt-1 text-[13px] leading-5 text-text-secondary">{hint.trim()}</Text></View>
              </View>
            ) : <AppButton label="Probar pista" icon="bulb-outline" variant="secondary" onPress={() => { setHintVisible(true); setHintUsed(true) }} />}
          </View>
        ) : null}

        <View className="mt-5" key={`${question.id}-${previewInteraction}`}>
          <GameQuestionRenderer question={question} questionType={questionType} selectedAnswerId={selectedAnswerId} correctAnswerId={hasAnswered ? correctChoiceId : null} hintedAnswerId={null} hasAnswered={hasAnswered} isSubmitting={false} answerStatus={answerStatus} onChoiceAnswer={setSelectedAnswerId} onStructuredAnswer={handleStructuredPreview} />
          {(selectedType === 'multiple' || selectedType === 'boolean') && !hasAnswered ? <AppButton label="Comprobar" icon="checkmark-circle" role="student" disabled={!selectedAnswerId} style={{ marginTop: 14 }} onPress={checkChoice} /> : null}
        </View>

        {feedbackStatus ? (
          <View className="mt-5 gap-3">
            <AppStatusBanner variant={feedbackStatus === 'correct' ? 'success' : feedbackStatus === 'pending' ? 'warning' : 'danger'} title={feedbackStatus === 'correct' ? '¡Correcto!' : feedbackStatus === 'pending' ? 'Pendiente de revisión' : 'Incorrecto'} message={feedbackStatus === 'correct' ? `La simulación otorgaría ${earnedPoints} XP${hintUsed ? ' después de aplicar la penalización de la pista' : ''}.` : feedbackStatus === 'pending' ? 'La respuesta abierta quedaría pendiente de revisión por el profesor.' : 'La respuesta se marcaría para repaso en la partida.'} />
            {explanation.trim() ? <View className="rounded-xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}><Text className="font-black" style={{ color: tokens.brand.teacher }}>Explicación después de responder</Text><Text className="mt-2 text-[14px] leading-6" style={{ color: tokens.text.secondary }}>{explanation.trim()}</Text></View> : null}
            <AppButton label="Reiniciar vista previa" icon="refresh" variant="secondary" onPress={resetPreview} />
          </View>
        ) : null}
      </View>
    </QuestionFormSection>
  )
}

function evaluateStructuredPreview(selectedType: QuestionTypeId, submission: StructuredAnswerPayload, expected: { fillAnswersText: string; orderItemsText: string; matchPairsText: string; dragdropPairsText: string }) {
  if (selectedType === 'fill') return sameMultiset(splitSubmittedText(submission.answerText), parseLines(expected.fillAnswersText))
  if (selectedType === 'order') {
    const payload = submission.payload && typeof submission.payload === 'object' && !Array.isArray(submission.payload) ? submission.payload as Record<string, unknown> : {}
    const ids = Array.isArray(payload.answer_ids) ? payload.answer_ids.map(Number) : []
    const expectedIds = parseLines(expected.orderItemsText).map((_, index) => index + 1)
    return ids.length === expectedIds.length && ids.every((value, index) => value === expectedIds[index])
  }
  if (selectedType === 'match' || selectedType === 'dragdrop') {
    const payload = submission.payload && typeof submission.payload === 'object' && !Array.isArray(submission.payload) ? submission.payload as Record<string, unknown> : {}
    const submitted = Array.isArray(payload.pairs) ? payload.pairs.map((pair) => pair && typeof pair === 'object' && !Array.isArray(pair) ? { left: String((pair as Record<string, unknown>).left || '').trim(), right: String((pair as Record<string, unknown>).right || '').trim() } : { left: '', right: '' }).filter((pair) => pair.left && pair.right) : []
    const expectedPairs = parsePairLines(selectedType === 'dragdrop' ? expected.dragdropPairsText : expected.matchPairsText)
    return submitted.length === expectedPairs.length && submitted.every((pair) => expectedPairs.some((candidate) => candidate.left === pair.left && candidate.right === pair.right))
  }
  return false
}

function splitSubmittedText(value?: string) {
  return String(value || '').split(/[,;\n]/).map((item) => normalizeAnswer(item)).filter(Boolean)
}

function sameMultiset(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const expected = right.map(normalizeAnswer).sort()
  return [...left].sort().every((value, index) => value === expected[index])
}

function normalizeAnswer(value: string) {
  return value.trim().toLocaleLowerCase('es-ES').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

function buildPreviewQuestion({ selectedType, questionText, visibleAnswers, openExpectedAnswer, fillAnswersText, orderItemsText, matchPairsText, dragdropPairsText, explanation, hint, points }: { selectedType: QuestionTypeId; questionText: string; visibleAnswers: AnswerItem[]; openExpectedAnswer: string; fillAnswersText: string; orderItemsText: string; matchPairsText: string; dragdropPairsText: string; explanation: string; hint: string; points: number | null }): GameQuestion {
  const prompt = questionText.trim() || 'Escribe el enunciado para completar la vista previa.'
  const choiceAnswers = visibleAnswers.map((answer, index) => ({ id: index + 1, text: answer.text.trim() || `Opción ${index + 1}` }))
  const orderItems = parseLines(orderItemsText)
  const pairSource = selectedType === 'dragdrop' ? dragdropPairsText : matchPairsText
  const pairs = parsePairLines(pairSource)
  const fillAnswers = parseLines(fillAnswersText)
  const fallbackAnswer = openExpectedAnswer.trim() || 'Respuesta esperada'
  let answers = choiceAnswers
  let pairOptions: string[] | undefined
  if (selectedType === 'open') answers = [{ id: 1, text: fallbackAnswer }]
  if (selectedType === 'fill') answers = fillAnswers.map((text, index) => ({ id: index + 1, text }))
  if (selectedType === 'order') answers = orderItems.map((text, index) => ({ id: index + 1, text }))
  if (selectedType === 'match' || selectedType === 'dragdrop') { answers = pairs.map((pair, index) => ({ id: index + 1, text: pair.left })); pairOptions = pairs.map((pair) => pair.right) }
  return { id: stablePreviewId(selectedType, prompt, answers.map((answer) => answer.text).join('|')), text: prompt, type: toDatabaseQuestionType(selectedType), points_base: points ?? 0, explanation: explanation.trim() || null, hint: hint.trim() || null, answers, pair_options: pairOptions, blank_count: selectedType === 'fill' ? Math.max(fillAnswers.length, 1) : null }
}

function stablePreviewId(...values: string[]) {
  let hash = 17
  values.join('::').split('').forEach((character) => { hash = ((hash * 31) + character.charCodeAt(0)) | 0 })
  return Math.abs(hash || 1)
}

function Metric({ icon, value, highlight = false }: { icon: keyof typeof Ionicons.glyphMap; value: string; highlight?: boolean }) {
  const { tokens } = useAppTheme()
  return <View className="flex-row items-center gap-2"><Ionicons name={icon} size={18} color={highlight ? tokens.gamification.xp : tokens.text.secondary} /><Text className="text-[14px] font-black" style={{ color: highlight ? tokens.gamification.xp : tokens.text.secondary }}>{value}</Text></View>
}
