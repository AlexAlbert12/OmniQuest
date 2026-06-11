import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'

export default function StudentMetricCard({
  title,
  value,
  icon,
  color,
  onPress,
  className = '',
}: {
  title: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
  color?: string
  onPress?: () => void
  className?: string
}) {
  const Container = onPress ? Pressable : View
  const { accentColor } = useAppTheme()
  const tint = color || accentColor

  return (
    <Container
      onPress={onPress}
      className={`min-w-[170px] flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4 ${className}`}
      style={onPress ? ({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.84 : 1 }) : undefined}
    >
      <Text className="text-center text-[13px] font-semibold text-[#8FA7C7]">{title}</Text>
      <View className="mt-5 items-center">
        <View
          className="h-20 w-20 items-center justify-center rounded-full border-[7px]"
          style={{ borderColor: tint, backgroundColor: withAlpha(tint, '1F') }}
        >
          <Ionicons name={icon} size={28} color={tint} />
        </View>
        <Text className="mt-4 text-[28px] font-black text-white">{value}</Text>
      </View>
    </Container>
  )
}
