import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { createShadowStyle } from '../../lib/platformShadow'

type AuthSubmitButtonProps = {
  label: string
  loadingLabel?: string
  loading?: boolean
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  onPress: () => void
}

export default function AuthSubmitButton({
  label,
  loadingLabel = 'Procesando...',
  loading = false,
  disabled = false,
  icon = 'arrow-forward',
  onPress,
}: AuthSubmitButtonProps) {
  const unavailable = loading || disabled

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? loadingLabel : label}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: unavailable ? 0.55 : pressed ? 0.88 : 1 })}
    >
      <LinearGradient
        colors={['#3479F4', '#8D63F7']}
        start={{ x: 0, y: 0.15 }}
        end={{ x: 1, y: 0.9 }}
        style={{
          alignItems: 'center',
          borderRadius: 22,
          flexDirection: 'row',
          justifyContent: 'center',
          minHeight: 58,
          paddingHorizontal: 22,
          ...createShadowStyle({
            color: '#7C66FF',
            opacity: 0.28,
            radius: 18,
            offsetY: 9,
            elevation: 7,
            web: '0 14px 28px rgba(124, 102, 255, 0.24)',
          }),
        }}
      >
        <View className="flex-row items-center gap-3">
          {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
          <Text className="text-[16px] font-black text-white">{loading ? loadingLabel : label}</Text>
        </View>
        {!loading ? (
          <View className="absolute right-3 h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <Ionicons name={icon} size={21} color="#FFFFFF" />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  )
}
