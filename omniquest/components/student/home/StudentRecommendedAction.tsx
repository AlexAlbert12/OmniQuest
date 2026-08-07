import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { StudentHomeAction } from './types'

export default function StudentRecommendedAction({
  action,
  onPress,
}: {
  action: StudentHomeAction
  onPress: () => void
}) {
  const { tokens } = useAppTheme()
  const toneColor = action.tone === 'review'
    ? tokens.semantic.warning
    : action.tone === 'start'
      ? tokens.semantic.info
      : tokens.brand.student

  return (
    <AppPressable
      accessibilityLabel={`${action.title}. ${action.description}`}
      accessibilityHint={action.buttonLabel}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View className="overflow-hidden rounded-[28px] border border-border-active p-6">
        <LinearGradient
          colors={[withAlpha(toneColor, '3D'), tokens.surface.raised, tokens.surface.default]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: -44,
            top: -52,
            width: 190,
            height: 190,
            borderRadius: 999,
            backgroundColor: withAlpha(toneColor, '29'),
          }}
        />

        <View className="relative flex-row flex-wrap items-center gap-5">
          <View
            className="h-16 w-16 items-center justify-center rounded-[20px] border"
            style={{ backgroundColor: withAlpha(toneColor, '26'), borderColor: withAlpha(toneColor, '80') }}
          >
            <Ionicons name={action.icon} size={32} color={toneColor} />
          </View>

          <View className="min-w-[220px] flex-1">
            <Text className="text-[12px] font-black uppercase tracking-[1.4px]" style={{ color: toneColor }}>
              Siguiente paso
            </Text>
            <Text maxFontSizeMultiplier={2} className="mt-2 text-[26px] font-black leading-8 text-white">
              {action.title}
            </Text>
            <Text maxFontSizeMultiplier={2} className="mt-2 max-w-[720px] text-[14px] leading-6 text-text-secondary">
              {action.description}
            </Text>
          </View>

          <View className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl px-5 py-3" style={{ backgroundColor: toneColor }}>
            <Text maxFontSizeMultiplier={2} className="text-[14px] font-black text-white">{action.buttonLabel}</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </AppPressable>
  )
}
