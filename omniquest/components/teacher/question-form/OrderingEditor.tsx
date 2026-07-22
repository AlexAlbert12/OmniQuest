import React from 'react'
import { Text, TextInput } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import QuestionFormSection from './QuestionFormSection'

export default function OrderingEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { tokens } = useAppTheme()
  return (
    <QuestionFormSection
      title="Orden correcto"
      subtitle="Añade un elemento por línea siguiendo el orden que deberá reconstruir el alumno."
      icon="reorder-three-outline"
    >
      <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Primero → último</Text>
      <TextInput
        accessibilityLabel="Elementos en orden correcto"
        multiline
        textAlignVertical="top"
        className="min-h-[170px] rounded-xl border px-4 py-3 text-[15px]"
        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }}
        placeholder={'Primer paso\nSegundo paso\nTercer paso'}
        placeholderTextColor={tokens.text.muted}
        value={value}
        onChangeText={onChange}
      />
    </QuestionFormSection>
  )
}
