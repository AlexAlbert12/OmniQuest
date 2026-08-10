import React from 'react'
import { Text, TextInput, View } from 'react-native'
import { difficultyOptions, getDifficultyMeta, type DifficultyLevel } from '../../../lib/difficulty'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import AppButton from '../../ui/AppButton'
import AppDropdown from '../../ui/AppDropdown'
import AppPressable from '../../ui/AppPressable'
import { QUESTION_EXPLANATION_MAX, QUESTION_HINT_MAX, QUESTION_POINTS_MAX, QUESTION_POINTS_MIN, QUESTION_TIME_LIMIT_MAX, QUESTION_TIME_LIMIT_MIN, type TopicOption } from './types'
import QuestionFormSection from './QuestionFormSection'

export default function QuestionSettingsPanel({ topics, selectedTopicId, selectedDifficulty, timeLimit, points, explanation, hint, timeLimitError, pointsError, isDesktop, onSelectTopic, onSelectDifficulty, onChangeTimeLimit, onChangePoints, onChangeExplanation, onChangeHint }: { topics: TopicOption[]; selectedTopicId: string | null; selectedDifficulty: DifficultyLevel; timeLimit: string; points: string; explanation: string; hint: string; timeLimitError: string; pointsError: string; isDesktop: boolean; onSelectTopic: (value: string | null) => void; onSelectDifficulty: (value: DifficultyLevel) => void; onChangeTimeLimit: (value: string) => void; onChangePoints: (value: string) => void; onChangeExplanation: (value: string) => void; onChangeHint: (value: string) => void }) {
  const { tokens } = useAppTheme()
  const useTopicDropdown = topics.length > 6
  return (
    <QuestionFormSection title="Configuración" subtitle="Asigna el tema, la dificultad, el tiempo, la puntuación y el feedback posterior." icon="options-outline">
      <FieldLabel>Temas</FieldLabel>
      {topics.length > 0 ? (
        useTopicDropdown ? (
          <AppDropdown accessibilityLabel="Seleccionar tema" value={selectedTopicId} options={topics.map((topic) => ({ value: String(topic.id), label: topic.title, icon: 'book-outline' }))} onChange={onSelectTopic} style={{ marginTop: 8 }} />
        ) : (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {topics.map((topic) => {
              const active = selectedTopicId === String(topic.id)
              return <AppPressable key={topic.id} accessibilityLabel={`Tema ${topic.title}`} accessibilityState={{ selected: active }} onPress={() => onSelectTopic(String(topic.id))} className="min-h-11 rounded-xl border px-4 py-3" style={{ borderColor: active ? tokens.brand.teacher : tokens.border.default, backgroundColor: active ? withAlpha(tokens.brand.teacher, '28') : tokens.surface.interactive }}><Text className="font-bold" style={{ color: active ? tokens.text.primary : tokens.text.secondary }}>{topic.title}</Text></AppPressable>
            })}
          </View>
        )
      ) : <Text className="mt-2 text-[13px]" style={{ color: tokens.text.muted }}>Esta clase todavía no tiene temas. La pregunta se guardará sin tema.</Text>}

      <FieldLabel className="mt-5">Dificultad</FieldLabel>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {difficultyOptions.map((option) => {
          const active = selectedDifficulty === option.value
          return <AppPressable key={option.value} accessibilityLabel={`Dificultad ${option.label}`} accessibilityState={{ selected: active }} onPress={() => onSelectDifficulty(option.value)} className="min-h-11 rounded-xl border px-4 py-3" style={{ borderColor: active ? option.color : tokens.border.default, backgroundColor: active ? withAlpha(option.color, '26') : tokens.surface.interactive }}><Text className="font-bold" style={{ color: active ? option.color : tokens.text.secondary }}>{option.label}</Text></AppPressable>
        })}
      </View>
      <Text className="mt-2 text-[12px]" style={{ color: tokens.text.muted }}>Versión {getDifficultyMeta(selectedDifficulty).label.toLowerCase()} del tema.</Text>

      <View className={isDesktop ? 'mt-5 flex-row gap-4' : 'mt-5 gap-4'}>
        <NumericField label={`Tiempo (${QUESTION_TIME_LIMIT_MIN}-${QUESTION_TIME_LIMIT_MAX} segundos)`} value={timeLimit} min={QUESTION_TIME_LIMIT_MIN} max={QUESTION_TIME_LIMIT_MAX} error={timeLimitError} onChange={onChangeTimeLimit} />
        <NumericField label={`Puntos base (${QUESTION_POINTS_MIN}-${QUESTION_POINTS_MAX})`} value={points} min={QUESTION_POINTS_MIN} max={QUESTION_POINTS_MAX} error={pointsError} onChange={onChangePoints} />
      </View>

      <View className="mt-5 flex-row items-center justify-between gap-3">
        <FieldLabel>Pista para el alumno (opcional)</FieldLabel>
        <Text className="text-[11px] font-bold" style={{ color: hint.length >= QUESTION_HINT_MAX ? tokens.semantic.danger : tokens.text.muted }}>{hint.length} / {QUESTION_HINT_MAX}</Text>
      </View>
      <TextInput accessibilityLabel="Pista de la pregunta" className="mt-2 min-h-[96px] rounded-xl border px-4 py-3 text-[15px]" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }} placeholder="Escribe una ayuda breve que oriente sin revelar directamente la respuesta." placeholderTextColor={tokens.text.muted} maxLength={QUESTION_HINT_MAX} multiline textAlignVertical="top" value={hint} onChangeText={onChangeHint} />
      <Text className="mt-2 text-[12px]" style={{ color: tokens.text.muted }}>La opción Pista solo aparecerá al alumno cuando este campo tenga contenido.</Text>

      <FieldLabel className="mt-5">Explicación después de responder (opcional)</FieldLabel>
      <TextInput accessibilityLabel="Explicación de la respuesta" className="mt-2 min-h-[120px] rounded-xl border px-4 py-3 text-[15px]" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }} placeholder="Explica por qué la respuesta es correcta sin revelar información antes del intento." placeholderTextColor={tokens.text.muted} maxLength={QUESTION_EXPLANATION_MAX} multiline textAlignVertical="top" value={explanation} onChangeText={onChangeExplanation} />
      <Text className="mt-2 text-right text-[11px] font-bold" style={{ color: tokens.text.muted }}>{explanation.length} / {QUESTION_EXPLANATION_MAX}</Text>
    </QuestionFormSection>
  )
}

function FieldLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { tokens } = useAppTheme()
  return <Text className={`${className} text-[12px] font-black uppercase tracking-[0.7px]`} style={{ color: tokens.text.muted }}>{children}</Text>
}

function NumericField({ label, value, min, max, error, onChange }: { label: string; value: string; min: number; max: number; error: string; onChange: (value: string) => void }) {
  const { tokens } = useAppTheme()
  const numeric = Number(value)
  const update = (delta: number) => onChange(String(Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric + delta : min))))
  return (
    <View className="min-w-0 flex-1">
      <FieldLabel>{label}</FieldLabel>
      <View className="mt-2 flex-row items-center gap-2">
        <AppButton icon="remove" iconOnly size="sm" variant="secondary" accessibilityLabel={`Reducir ${label}`} disabled={Number.isFinite(numeric) && numeric <= min} onPress={() => update(-1)} />
        <TextInput accessibilityLabel={label} keyboardType="number-pad" className="h-12 min-w-0 flex-1 rounded-xl border px-4 text-center text-[16px] font-black" style={{ borderColor: error ? tokens.semantic.danger : tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }} value={value} onChangeText={onChange} />
        <AppButton icon="add" iconOnly size="sm" variant="secondary" accessibilityLabel={`Aumentar ${label}`} disabled={Number.isFinite(numeric) && numeric >= max} onPress={() => update(1)} />
      </View>
      {error ? <Text className="mt-2 text-[12px] font-semibold" style={{ color: tokens.semantic.danger }}>{error}</Text> : null}
    </View>
  )
}
