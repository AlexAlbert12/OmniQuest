import React, { useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import type { QuestionType } from '../../../lib/gameQuestionLogic'
import GameQuestionRenderer from '../../student/game/GameQuestionRenderer'
import type { GameQuestion, StructuredAnswerPayload } from '../../student/game/types'
import QuestionMedia from '../../questions/QuestionMedia'
import type { TeacherQuestionMediaValue } from '../TeacherQuestionMediaEditor'
import type { AnswerItem, QuestionTypeCard, QuestionTypeId } from './types'
import { parseLines, parsePairLines, toDatabaseQuestionType } from './utils'
import QuestionFormSection from './QuestionFormSection'

export default function QuestionPreview({
  selectedType,
  selectedTypeCard,
  questionText,
  media,
  visibleAnswers,
  openExpectedAnswer,
  fillAnswersText,
  orderItemsText,
  matchPairsText,
  dragdropPairsText,
  explanation,
  timeLimit,
  points,
}: {
  selectedType: QuestionTypeId
  selectedTypeCard: QuestionTypeCard
  questionText: string
  media: TeacherQuestionMediaValue
  visibleAnswers: AnswerItem[]
  openExpectedAnswer: string
  fillAnswersText: string
  orderItemsText: string
  matchPairsText: string
  dragdropPairsText: string
  explanation: string
  timeLimit: number | null
  points: number | null
}) {
  const { tokens } = useAppTheme()
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null)
  const [previewInteraction, setPreviewInteraction] = useState(0)
  const questionType = toDatabaseQuestionType(selectedType) as QuestionType
  const question = useMemo(() => buildPreviewQuestion({
    selectedType,
    questionText,
    visibleAnswers,
    openExpectedAnswer,
    fillAnswersText,
    orderItemsText,
    matchPairsText,
    dragdropPairsText,
    explanation,
    points,
  }), [
    dragdropPairsText,
    explanation,
    fillAnswersText,
    matchPairsText,
    openExpectedAnswer,
    orderItemsText,
    points,
    questionText,
    selectedType,
    visibleAnswers,
  ])

  useEffect(() => {
    setSelectedAnswerId(null)
    setPreviewInteraction((value) => value + 1)
  }, [question.id, question.text, questionType])

  const handleStructuredPreview = (_payload: StructuredAnswerPayload) => {
    setPreviewInteraction((value) => value + 1)
  }

  return (
    <QuestionFormSection
      title="Vista previa real"
      subtitle="Usa el mismo componente que la partida del alumno; puedes interactuar sin guardar respuestas."
      icon="eye-outline"
    >
      <View className="rounded-2xl border p-4 md:p-5" style={{ borderColor: tokens.border.active, backgroundColor: tokens.surface.raised }}>
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="rounded-full border px-3 py-1" style={{ borderColor: selectedTypeCard.accent, backgroundColor: `${selectedTypeCard.accent}20` }}>
            <Text className="font-black" style={{ color: selectedTypeCard.accent }}>{selectedTypeCard.title}</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <Metric icon="time-outline" value={`${timeLimit ?? 0}s`} />
            <Metric icon="star" value={`${points ?? 0} pts`} highlight />
          </View>
        </View>

        <Text
          accessibilityRole="header"
          className="mt-5 text-[25px] font-black leading-8 md:text-[34px] md:leading-[42px]"
          style={{ color: tokens.text.primary }}
        >
          {question.text}
        </Text>

        {media.type && (media.pendingAsset?.uri || media.url || media.path) ? (
          <QuestionMedia
            type={media.type}
            url={media.pendingAsset?.uri || media.url}
            path={media.path}
            transcript={media.transcript}
            subtitlesVtt={media.subtitlesVtt}
            altText={media.altText}
            caption={media.caption}
            compact
          />
        ) : null}

        <View className="mt-5" key={`${question.id}-${previewInteraction}`}>
          <GameQuestionRenderer
            question={question}
            questionType={questionType}
            selectedAnswerId={selectedAnswerId}
            correctAnswerId={null}
            hintedAnswerId={null}
            hasAnswered={false}
            isSubmitting={false}
            answerStatus={null}
            onChoiceAnswer={setSelectedAnswerId}
            onStructuredAnswer={handleStructuredPreview}
          />
        </View>

        {explanation.trim() ? (
          <View className="mt-5 rounded-xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
            <Text className="font-black" style={{ color: tokens.brand.teacher }}>Feedback después del intento</Text>
            <Text className="mt-2 text-[14px] leading-6" style={{ color: tokens.text.secondary }}>{explanation.trim()}</Text>
          </View>
        ) : null}
      </View>
    </QuestionFormSection>
  )
}

function buildPreviewQuestion({
  selectedType,
  questionText,
  visibleAnswers,
  openExpectedAnswer,
  fillAnswersText,
  orderItemsText,
  matchPairsText,
  dragdropPairsText,
  explanation,
  points,
}: {
  selectedType: QuestionTypeId
  questionText: string
  visibleAnswers: AnswerItem[]
  openExpectedAnswer: string
  fillAnswersText: string
  orderItemsText: string
  matchPairsText: string
  dragdropPairsText: string
  explanation: string
  points: number | null
}): GameQuestion {
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
  if (selectedType === 'match' || selectedType === 'dragdrop') {
    answers = pairs.map((pair, index) => ({ id: index + 1, text: pair.left }))
    pairOptions = pairs.map((pair) => pair.right)
  }

  return {
    id: stablePreviewId(selectedType, prompt, answers.map((answer) => answer.text).join('|')),
    text: prompt,
    type: toDatabaseQuestionType(selectedType),
    points_base: points ?? 0,
    explanation: explanation.trim() || null,
    answers,
    pair_options: pairOptions,
    blank_count: selectedType === 'fill' ? Math.max(fillAnswers.length, 1) : null,
  }
}

function stablePreviewId(...values: string[]) {
  let hash = 17
  values.join('::').split('').forEach((character) => { hash = ((hash * 31) + character.charCodeAt(0)) | 0 })
  return Math.abs(hash || 1)
}

function Metric({ icon, value, highlight = false }: { icon: keyof typeof Ionicons.glyphMap; value: string; highlight?: boolean }) {
  const { tokens } = useAppTheme()
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={18} color={highlight ? tokens.gamification.xp : tokens.text.secondary} />
      <Text className="text-[14px] font-black" style={{ color: highlight ? tokens.gamification.xp : tokens.text.secondary }}>{value}</Text>
    </View>
  )
}
