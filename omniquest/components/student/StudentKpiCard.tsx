import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { withAlpha } from '../../lib/color'

type StudentKpiCardProps = {
  className?: string
  color: string
  detail?: string
  detailColor?: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
  value: string
  variant?: 'compact' | 'circle'
}

export default function StudentKpiCard({
  className = '',
  color,
  detail,
  detailColor = '#8FA7C7',
  icon,
  label,
  onPress,
  value,
  variant = 'compact',
}: StudentKpiCardProps) {
  const Container = onPress ? Pressable : View
  const pressedStyle = onPress
    ? ({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.84 : 1 })
    : undefined

  if (variant === 'circle') {
    return (
      <Container
        onPress={onPress}
        className={`min-w-[170px] flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4 ${className}`}
        style={pressedStyle}
      >
        <Text className="text-center text-[13px] font-semibold text-[#8FA7C7]">{label}</Text>
        <View className="mt-5 items-center">
          <View
            className="h-20 w-20 items-center justify-center rounded-full border-[7px]"
            style={{ borderColor: color, backgroundColor: withAlpha(color, '1F') }}
          >
            <Ionicons name={icon} size={28} color={color} />
          </View>
          <Text className="mt-4 text-[28px] font-black text-white">{value}</Text>
          {detail ? <Text className="mt-1 text-center text-[12px]" style={{ color: detailColor }}>{detail}</Text> : null}
        </View>
      </Container>
    )
  }

  return (
    <Container
      onPress={onPress}
      className={`min-w-[175px] flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5 ${className}`}
      style={pressedStyle}
    >
      <View className="flex-row items-center gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '24') }}>
          <Ionicons name={icon} size={28} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[24px] font-black text-white" numberOfLines={1}>{value}</Text>
          <Text className="mt-1 text-[13px] font-bold text-[#DDE7F4]" numberOfLines={2}>{label}</Text>
          {detail ? <Text className="mt-1 text-[13px]" style={{ color: detailColor }} numberOfLines={1}>{detail}</Text> : null}
        </View>
      </View>
    </Container>
  )
}
