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
  compact = false,
  onPress,
}: {
  action: StudentHomeAction
  compact?: boolean
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
      <View className="overflow-hidden border border-border-default" style={{ padding: compact ? 14 : 24, borderRadius: compact ? 22 : 28 }}>
        <LinearGradient
          colors={[withAlpha(toneColor, '3D'), tokens.surface.raised, tokens.surface.default]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            right: -44,
            top: -52,
            width: 190,
            height: 190,
            borderRadius: 999,
            backgroundColor: withAlpha(toneColor, '29'),
          }}
        />

        <View className="relative flex-row items-center" style={{ gap: compact ? 12 : 20 }}>
          <View
            className="items-center justify-center border"
            style={{
              width: compact ? 44 : 64,
              height: compact ? 44 : 64,
              borderRadius: compact ? 14 : 20,
              backgroundColor: withAlpha(toneColor, '26'),
              borderColor: withAlpha(toneColor, '80'),
            }}
          >
            <Ionicons name={action.icon} size={compact ? 23 : 32} color={toneColor} />
          </View>

          <View className="min-w-0 flex-1" style={{ minWidth: compact ? 0 : 220 }}>
            <Text className={`${compact ? 'text-[10px]' : 'text-[12px]'} font-black uppercase tracking-[1.4px]`} style={{ color: toneColor }}>
              Siguiente paso
            </Text>
            <Text maxFontSizeMultiplier={2} className="font-black text-white" style={{ marginTop: compact ? 3 : 8, fontSize: compact ? 19 : 26, lineHeight: compact ? 24 : 32 }}>
              {action.title}
            </Text>
            <Text maxFontSizeMultiplier={2} className={`max-w-[720px] text-text-secondary ${compact ? 'text-[12px]' : 'text-[14px]'}`} style={{ marginTop: compact ? 3 : 8, lineHeight: compact ? 17 : 24 }}>
              {action.description}
            </Text>
          </View>
        </View>
      </View>
    </AppPressable>
  )
}
