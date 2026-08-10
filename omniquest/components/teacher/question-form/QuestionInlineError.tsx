import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

export default function QuestionInlineError({ message }: { message?: string }) {
  const { tokens } = useAppTheme()
  if (!message) return null
  return (
    <View className="mt-3 flex-row items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: withAlpha(tokens.semantic.danger, '80'), backgroundColor: withAlpha(tokens.semantic.danger, '14') }}>
      <Ionicons name="alert-circle-outline" size={17} color={tokens.semantic.danger} />
      <Text className="min-w-0 flex-1 text-[12px] font-bold leading-5" style={{ color: tokens.semantic.danger }}>{message}</Text>
    </View>
  )
}
