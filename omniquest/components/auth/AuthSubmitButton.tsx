import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { createShadowStyle } from '../../lib/platformShadow'

const activeSubmitColors = ['#3479F4', '#8D63F7'] as const
const disabledSubmitColors = ['#263650', '#30354F'] as const

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
  const unavailable = loading || disabled
  const intentionallyDisabled = disabled && !loading
  const colors = intentionallyDisabled ? disabledSubmitColors : activeSubmitColors

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? loadingLabel : label}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ opacity: pressed && !unavailable ? 0.88 : 1 })}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0.15 }}
        end={{ x: 1, y: 0.9 }}
        style={{
          alignItems: 'center',
          borderColor: intentionallyDisabled ? 'rgba(148, 163, 184, 0.18)' : 'transparent',
          borderRadius: 22,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'center',
          minHeight: 58,
          paddingHorizontal: 22,
          ...(intentionallyDisabled
            ? null
            : createShadowStyle({
              color: '#7C66FF',
              opacity: 0.28,
              radius: 18,
              offsetY: 9,
              elevation: 7,
              web: '0 14px 28px rgba(124, 102, 255, 0.24)',
            })),
        }}
      >
        <View className="flex-row items-center gap-3">
          {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
          <Text
            className="text-[16px] font-black"
            style={{ color: intentionallyDisabled ? '#AAB6CA' : '#FFFFFF' }}
          >
            {loading ? loadingLabel : label}
          </Text>
        </View>
        {!loading ? (
          <View
            className="absolute right-3 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: intentionallyDisabled ? 'rgba(148, 163, 184, 0.08)' : 'rgba(255, 255, 255, 0.15)' }}
          >
            <Ionicons name={icon} size={21} color={intentionallyDisabled ? '#8292AC' : '#FFFFFF'} />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  )
}
