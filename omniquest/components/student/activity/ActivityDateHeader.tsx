import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'

export default React.memo(function ActivityDateHeader({ label, count }: { label: string; count: number }) {
  const { tokens } = useAppTheme()
  return (
    <View className="mb-3 mt-2 flex-row items-center gap-3" accessibilityRole="header">
      <View className="h-px flex-1" style={{ backgroundColor: tokens.surface.interactive }} />
      <View className="flex-row items-center gap-2 rounded-full border px-3 py-2" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Ionicons name="calendar" size={14} color={tokens.brand.student} />
        <Text maxFontSizeMultiplier={2} className="text-[12px] font-black" style={{ color: tokens.text.secondary }}>{label}</Text>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tokens.surface.interactive }}>
          <Text maxFontSizeMultiplier={2} className="text-[10px] font-black" style={{ color: tokens.text.muted }}>{count}</Text>
        </View>
      </View>
      <View className="h-px flex-1" style={{ backgroundColor: tokens.surface.interactive }} />
    </View>
  )
})
