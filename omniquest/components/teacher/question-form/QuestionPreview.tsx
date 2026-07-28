import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import QuestionMedia from '../../questions/QuestionMedia'
import type { TeacherQuestionMediaValue } from '../TeacherQuestionMediaEditor'
import type { AnswerItem, QuestionTypeCard, QuestionTypeId } from './types'
import { getQuestionTypePreviewTitle, parseLines, parsePairLines } from './utils'
import ChoiceAnswerRow from './ChoiceAnswerRow'
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
  const previewTextMap: Record<QuestionTypeId, string> = {
    multiple: '',
    boolean: '',
    open: openExpectedAnswer,
    fill: fillAnswersText,
    order: orderItemsText,
    match: matchPairsText,
    dragdrop: dragdropPairsText,
  }
  const sourceText = previewTextMap[selectedType]
  const pairs = selectedType === 'match' || selectedType === 'dragdrop' ? parsePairLines(sourceText) : []
  const lines = pairs.length === 0 ? parseLines(sourceText) : []

  return (
    <QuestionFormSection
      title="Vista previa"
      subtitle="Así verá el alumnado el contenido principal de la pregunta."
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

        <Text className="mt-5 text-[25px] font-black leading-8 md:text-[34px] md:leading-[42px]" style={{ color: tokens.text.primary }}>
          {questionText.trim() || 'Escribe el enunciado para completar la vista previa.'}
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

        {selectedType === 'multiple' || selectedType === 'boolean' ? (
          <View className="mt-5 gap-3">
            {visibleAnswers.map((answer, index) => (
              <ChoiceAnswerRow key={index} index={index} text={answer.text} correct={answer.isCorrect} readOnly />
            ))}
          </View>
        ) : (
          <View className="mt-5 rounded-xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
            <Text className="font-black" style={{ color: tokens.brand.teacher }}>{getQuestionTypePreviewTitle(selectedType)}</Text>
            {pairs.length > 0 ? (
              <View className="mt-3 gap-2">
                {pairs.slice(0, 10).map((pair, index) => (
                  <View key={`${pair.left}-${pair.right}-${index}`} className="flex-row flex-wrap items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: tokens.background.primary }}>
                    <Text className="font-bold" style={{ color: tokens.text.primary }}>{pair.left}</Text>
                    <Ionicons name="arrow-forward" size={15} color={tokens.brand.teacher} />
                    <Text className="font-bold" style={{ color: tokens.semantic.success }}>{pair.right}</Text>
                  </View>
                ))}
              </View>
            ) : lines.length > 0 ? (
              <View className="mt-3 gap-2">
                {lines.slice(0, 10).map((line, index) => (
                  <Text key={`${line}-${index}`} className="text-[14px]" style={{ color: tokens.text.secondary }}>{index + 1}. {line}</Text>
                ))}
              </View>
            ) : (
              <Text className="mt-2 text-[13px]" style={{ color: tokens.text.muted }}>Completa las respuestas para ver el resultado.</Text>
            )}
          </View>
        )}

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

function Metric({ icon, value, highlight = false }: { icon: keyof typeof Ionicons.glyphMap; value: string; highlight?: boolean }) {
  const { tokens } = useAppTheme()
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={18} color={highlight ? tokens.gamification.xp : tokens.text.secondary} />
      <Text className="text-[14px] font-black" style={{ color: highlight ? tokens.gamification.xp : tokens.text.secondary }}>{value}</Text>
    </View>
  )
}
