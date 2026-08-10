import React from 'react'
import { Text, TextInput } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import { QUESTION_ANSWER_MAX } from './types'
import QuestionFormSection from './QuestionFormSection'
import QuestionInlineError from './QuestionInlineError'

export default function OpenAnswerEditor({ value, error, onChange }: { value: string; error?: string; onChange: (value: string) => void }) {
  const { tokens } = useAppTheme()
  return (
    <QuestionFormSection title="Criterio de corrección" subtitle="Escribe una respuesta esperada. El profesor podrá revisar manualmente las respuestas abiertas." icon="chatbox-ellipses-outline">
      <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Respuesta esperada</Text>
      <TextInput accessibilityLabel="Respuesta esperada" multiline maxLength={QUESTION_ANSWER_MAX} textAlignVertical="top" className="min-h-[130px] rounded-xl border px-4 py-3 text-[15px]" style={{ borderColor: error ? tokens.semantic.danger : tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }} placeholder="Describe la respuesta correcta o el criterio que debe cumplir." placeholderTextColor={tokens.text.muted} value={value} onChangeText={onChange} />
      <QuestionInlineError message={error} />
    </QuestionFormSection>
  )
}
