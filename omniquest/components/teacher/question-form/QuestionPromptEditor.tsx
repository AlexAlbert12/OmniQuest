import React from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import TeacherQuestionMediaEditor, { type TeacherQuestionMediaValue } from '../TeacherQuestionMediaEditor'
import type { QuestionTypeId } from './types'
import QuestionFormSection from './QuestionFormSection'

export default function QuestionPromptEditor({
  selectedType,
  questionText,
  media,
  disabled,
  onChangeQuestionText,
  onChangeMedia,
  onMediaError,
}: {
  selectedType: QuestionTypeId
  questionText: string
  media: TeacherQuestionMediaValue
  disabled?: boolean
  onChangeQuestionText: (value: string) => void
  onChangeMedia: (value: TeacherQuestionMediaValue) => void
  onMediaError: (message: string) => void
}) {
  const { tokens } = useAppTheme()
  const isFill = selectedType === 'fill'
  return (
    <QuestionFormSection
      title="Escribe el enunciado"
      subtitle="Usa una frase breve, directa y comprensible. Puedes añadir imagen, audio o vídeo."
      icon="create-outline"
    >
      <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Enunciado</Text>
      <TextInput
        accessibilityLabel="Enunciado de la pregunta"
        className="min-h-[145px] rounded-xl border px-4 py-3 text-[16px]"
        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }}
        placeholder={isFill ? 'La capital de Francia es ____.' : '¿Cuál es la capital de Francia?'}
        placeholderTextColor={tokens.text.muted}
        multiline
        textAlignVertical="top"
        value={questionText}
        onChangeText={onChangeQuestionText}
      />
      {isFill ? (
        <View className="mt-3 flex-row items-start gap-3 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
          <Ionicons name="information-circle-outline" size={19} color={tokens.brand.teacher} />
          <Text className="min-w-0 flex-1 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>
            Escribe ____ en cada posición donde deba aparecer un hueco.
          </Text>
        </View>
      ) : null}
      <View className="mt-5">
        <TeacherQuestionMediaEditor
          value={media}
          onChange={onChangeMedia}
          disabled={disabled}
          onError={onMediaError}
        />
      </View>
    </QuestionFormSection>
  )
}
