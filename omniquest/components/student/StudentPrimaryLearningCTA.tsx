import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { withAlpha } from '../../lib/color'

type StudentPrimaryLearningCTAProps = {
  className?: string
  color?: string
  ctaLabel: string
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  meta?: string
  onPress: () => void
  subtitle: string
  title: string
}

export default function StudentPrimaryLearningCTA({
  className = '',
  color = '#8B5CF6',
  ctaLabel,
  disabled = false,
  icon = 'rocket',
  meta,
  onPress,
  subtitle,
  title,
}: StudentPrimaryLearningCTAProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={className}
      accessibilityRole="button"
      accessibilityLabel={ctaLabel}
      style={({ pressed }) => ({ opacity: disabled ? 0.58 : pressed ? 0.86 : 1 })}
    >
      <LinearGradient
        colors={['#2B176F', '#171B50', '#0A1A35']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, borderWidth: 1, borderColor: withAlpha(color, '70'), overflow: 'hidden' }}
      >
        <View className="relative flex-row items-center gap-4 p-4 md:p-5">
          <View className="absolute -right-10 -top-10 h-32 w-32 rounded-full" style={{ backgroundColor: withAlpha(color, '22') }} />
          <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(color, '24') }}>
            <Ionicons name={icon} size={32} color={color} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[18px] font-black text-white md:text-[20px]" numberOfLines={2}>{title}</Text>
            <Text className="mt-1 text-[13px] leading-5 text-text-secondary" numberOfLines={2}>{subtitle}</Text>
            {meta ? <Text className="mt-2 text-[12px] font-black" style={{ color }}>{meta}</Text> : null}
          </View>
          <View className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl px-4" style={{ backgroundColor: color }}>
            <Text className="text-[13px] font-black text-white" numberOfLines={1}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  )
}
