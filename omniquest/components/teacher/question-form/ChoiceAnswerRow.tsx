import React from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

export default function ChoiceAnswerRow({
  index,
  text,
  correct,
  editable = true,
  readOnly = false,
  onMarkCorrect,
  onChangeText,
}: {
  index: number
  text: string
  correct: boolean
  editable?: boolean
  readOnly?: boolean
  onMarkCorrect?: () => void
  onChangeText?: (value: string) => void
}) {
  const { tokens } = useAppTheme()
  const letter = String.fromCharCode(65 + index)
  const canMark = !readOnly && Boolean(onMarkCorrect)

  return (
    <View
      className="rounded-xl border px-4 py-3"
      style={{
        borderColor: correct ? tokens.semantic.success : tokens.border.default,
        backgroundColor: correct ? withAlpha(tokens.semantic.success, '18') : tokens.surface.interactive,
      }}
    >
      <View className="flex-row items-center gap-3">
        <AppPressable
          accessibilityLabel={`Marcar opción ${letter} como correcta`}
          accessibilityState={{ selected: correct, disabled: !canMark }}
          disabled={!canMark}
          onPress={onMarkCorrect}
          className="h-10 w-10 items-center justify-center rounded-full border"
          style={{
            borderColor: correct ? tokens.semantic.success : tokens.brand.teacher,
            backgroundColor: correct ? tokens.semantic.success : 'transparent',
          }}
        >
          <Text className="font-black" style={{ color: correct ? '#FFFFFF' : tokens.brand.teacher }}>{letter}</Text>
        </AppPressable>

        {readOnly ? (
          <Text className="min-h-[38px] flex-1 py-2 text-[15px] font-semibold" style={{ color: tokens.text.primary }}>
            {text || `Opción ${letter}`}
          </Text>
        ) : (
          <TextInput
            accessibilityLabel={`Texto de la opción ${letter}`}
            className="min-h-[42px] flex-1 text-[15px] font-semibold"
            style={{ color: tokens.text.primary }}
            placeholder={`Opción ${letter}`}
            placeholderTextColor={tokens.text.muted}
            value={text}
            editable={editable}
            onChangeText={onChangeText}
          />
        )}

        <Ionicons
          name={correct ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={correct ? tokens.semantic.success : tokens.text.muted}
        />
      </View>
    </View>
  )
}
