import React from 'react'
import { Text, TextInput, View } from 'react-native'
import { difficultyOptions, getDifficultyMeta, type DifficultyLevel } from '../../../lib/difficulty'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import AppPressable from '../../ui/AppPressable'
import {
  QUESTION_POINTS_MAX,
  QUESTION_POINTS_MIN,
  QUESTION_TIME_LIMIT_MAX,
  QUESTION_TIME_LIMIT_MIN,
  type TopicOption,
} from './types'
import QuestionFormSection from './QuestionFormSection'

export default function QuestionSettingsPanel({
  topics,
  selectedTopicId,
  selectedDifficulty,
  timeLimit,
  points,
  explanation,
  timeLimitError,
  pointsError,
  isDesktop,
  onSelectTopic,
  onSelectDifficulty,
  onChangeTimeLimit,
  onChangePoints,
  onChangeExplanation,
}: {
  topics: TopicOption[]
  selectedTopicId: string | null
  selectedDifficulty: DifficultyLevel
  timeLimit: string
  points: string
  explanation: string
  timeLimitError: string
  pointsError: string
  isDesktop: boolean
  onSelectTopic: (value: string | null) => void
  onSelectDifficulty: (value: DifficultyLevel) => void
  onChangeTimeLimit: (value: string) => void
  onChangePoints: (value: string) => void
  onChangeExplanation: (value: string) => void
}) {
  const { tokens } = useAppTheme()
  return (
    <QuestionFormSection
      title="Configuración"
      subtitle="Asigna el tema, la dificultad, el tiempo, la puntuación y el feedback posterior."
      icon="options-outline"
    >
      <FieldLabel>Temas</FieldLabel>
      {topics.length > 0 ? (
        <View className="mt-2 flex-row flex-wrap gap-2">
          {topics.map((topic) => {
            const active = selectedTopicId === String(topic.id)
            return (
              <AppPressable
                key={topic.id}
                accessibilityLabel={`Tema ${topic.title}`}
                accessibilityState={{ selected: active }}
                onPress={() => onSelectTopic(String(topic.id))}
                className="rounded-xl border px-4 py-3"
                style={{
                  borderColor: active ? tokens.brand.teacher : tokens.border.default,
                  backgroundColor: active ? withAlpha(tokens.brand.teacher, '28') : tokens.surface.interactive,
                }}
              >
                <Text className="font-bold" style={{ color: active ? tokens.text.primary : tokens.text.secondary }}>{topic.title}</Text>
              </AppPressable>
            )
          })}
        </View>
      ) : (
        <Text className="mt-2 text-[13px]" style={{ color: tokens.text.muted }}>Este curso todavía no tiene temas. La pregunta se guardará sin tema.</Text>
      )}

      <FieldLabel className="mt-5">Dificultad</FieldLabel>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {difficultyOptions.map((option) => {
          const active = selectedDifficulty === option.value
          return (
            <AppPressable
              key={option.value}
              accessibilityLabel={`Dificultad ${option.label}`}
              accessibilityState={{ selected: active }}
              onPress={() => onSelectDifficulty(option.value)}
              className="rounded-xl border px-4 py-3"
              style={{
                borderColor: active ? option.color : tokens.border.default,
                backgroundColor: active ? withAlpha(option.color, '26') : tokens.surface.interactive,
              }}
            >
              <Text className="font-bold" style={{ color: active ? option.color : tokens.text.secondary }}>{option.label}</Text>
            </AppPressable>
          )
        })}
      </View>
      <Text className="mt-2 text-[12px]" style={{ color: tokens.text.muted }}>
        Versión {getDifficultyMeta(selectedDifficulty).label.toLowerCase()} del tema.
      </Text>

      <View className={isDesktop ? 'mt-5 flex-row gap-4' : 'mt-5 gap-4'}>
        <NumericField
          label={`Tiempo (${QUESTION_TIME_LIMIT_MIN}-${QUESTION_TIME_LIMIT_MAX} segundos)`}
          value={timeLimit}
          error={timeLimitError}
          onChange={onChangeTimeLimit}
        />
        <NumericField
          label={`Puntos base (${QUESTION_POINTS_MIN}-${QUESTION_POINTS_MAX})`}
          value={points}
          error={pointsError}
          onChange={onChangePoints}
        />
      </View>

      <FieldLabel className="mt-5">Explicación después de responder</FieldLabel>
      <TextInput
        accessibilityLabel="Explicación de la respuesta"
        className="mt-2 min-h-[120px] rounded-xl border px-4 py-3 text-[15px]"
        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }}
        placeholder="Explica por qué la respuesta es correcta sin revelar información antes del intento."
        placeholderTextColor={tokens.text.muted}
        multiline
        textAlignVertical="top"
        value={explanation}
        onChangeText={onChangeExplanation}
      />
    </QuestionFormSection>
  )
}

function FieldLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { tokens } = useAppTheme()
  return <Text className={`${className} text-[12px] font-black uppercase tracking-[0.7px]`} style={{ color: tokens.text.muted }}>{children}</Text>
}

function NumericField({ label, value, error, onChange }: { label: string; value: string; error: string; onChange: (value: string) => void }) {
  const { tokens } = useAppTheme()
  return (
    <View className="min-w-0 flex-1">
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        className="mt-2 h-12 rounded-xl border px-4 text-center text-[16px] font-black"
        style={{
          borderColor: error ? tokens.semantic.danger : tokens.border.default,
          backgroundColor: tokens.surface.interactive,
          color: tokens.text.primary,
        }}
        value={value}
        onChangeText={onChange}
      />
      {error ? <Text className="mt-2 text-[12px] font-semibold" style={{ color: tokens.semantic.danger }}>{error}</Text> : null}
    </View>
  )
}
