import React from 'react'
import { Text, TextInput } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import QuestionFormSection from './QuestionFormSection'

export default function FillBlankEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { tokens } = useAppTheme()
  return (
    <QuestionFormSection
      title="Soluciones válidas"
      subtitle="Escribe una solución por línea y usa ____ en el enunciado para señalar cada hueco."
      icon="grid-outline"
    >
      <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Una solución por línea</Text>
      <TextInput
        accessibilityLabel="Soluciones válidas"
        multiline
        textAlignVertical="top"
        className="min-h-[150px] rounded-xl border px-4 py-3 text-[15px]"
        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }}
        placeholder={'París\nParis'}
        placeholderTextColor={tokens.text.muted}
        value={value}
        onChangeText={onChange}
      />
    </QuestionFormSection>
  )
}
