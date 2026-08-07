import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { createShadowStyle } from '../../lib/platformShadow'
import { useAppTheme } from '../../lib/appTheme'

type AuthSubmitButtonProps = {
  label: string
  loadingLabel?: string
  loading?: boolean
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  onPress: () => void
  testID?: string
}

export default function AuthSubmitButton({
  label,
  loadingLabel = 'Procesando...',
  loading = false,
  disabled = false,
  icon = 'arrow-forward',
  onPress,
  testID,
}: AuthSubmitButtonProps) {
  const { tokens } = useAppTheme()
  const unavailable = loading || disabled
  const disabledOnly = disabled && !loading
  const foreground = disabledOnly ? tokens.text.disabled : tokens.text.onAccent
  const gradientColors = disabledOnly ? [tokens.surface.disabled, tokens.surface.disabled] as const : ['#3479F4', '#8D63F7'] as const

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? loadingLabel : label}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ opacity: loading ? 0.76 : pressed ? 0.88 : 1 })}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0.15 }}
        end={{ x: 1, y: 0.9 }}
        style={{
          alignItems: 'center',
          borderRadius: 22,
          borderWidth: 1,
          borderColor: disabledOnly ? tokens.border.subtle : 'transparent',
          flexDirection: 'row',
          justifyContent: 'center',
          minHeight: 58,
          paddingHorizontal: 22,
          ...(disabledOnly ? {} : createShadowStyle({ color: '#7C66FF', opacity: 0.28, radius: 18, offsetY: 9, elevation: 7, web: '0 14px 28px rgba(124, 102, 255, 0.24)' })),
        }}
      >
        <View className="flex-row items-center gap-3">
          {loading ? <ActivityIndicator color={tokens.text.onAccent} /> : null}
          <Text className="text-[16px] font-black" style={{ color: foreground }}>{loading ? loadingLabel : label}</Text>
        </View>
        {!loading ? (
          <View className="absolute right-3 h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: disabledOnly ? tokens.surface.raised : 'rgba(255,255,255,0.15)' }}>
            <Ionicons name={icon} size={21} color={foreground} />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  )
}
