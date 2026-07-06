import React, { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'

type StudentActionBannerProps = {
  actionIcon?: keyof typeof Ionicons.glyphMap
  actionLabel?: string
  children?: ReactNode
  className?: string
  color?: string
  detail: string
  icon?: keyof typeof Ionicons.glyphMap
  kicker?: string
  onPress?: () => void
  title: string
}

export default function StudentActionBanner({
  actionIcon = 'arrow-forward',
  actionLabel,
  children,
  className = '',
  color,
  detail,
  icon = 'rocket',
  kicker,
  onPress,
  title,
}: StudentActionBannerProps) {
  const { accentColor } = useAppTheme()
  const tint = color || accentColor

  return (
    <View className={`overflow-hidden rounded-2xl border border-[#2B3F7A] bg-[#101D4A] p-5 ${className}`}>
      <View className="absolute inset-0 bg-[#17135A]" />
      <View className="absolute -right-8 top-4 h-28 w-28 rounded-full" style={{ backgroundColor: withAlpha(tint, '24') }} />
      <View className="absolute right-12 top-8 h-10 w-28 rounded-full border border-[#7B68FF]/35" style={{ transform: [{ rotate: '-18deg' }] }} />
      <Ionicons
        name={icon}
        size={72}
        color={tint}
        style={{ position: 'absolute', right: 56, top: 24, transform: [{ rotate: '24deg' }], opacity: 0.9 }}
      />

      <View className="relative flex-row flex-wrap items-center gap-5">
        <View className="min-w-[240px] flex-1">
          {kicker ? (
            <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: tint }}>
              {kicker}
            </Text>
          ) : null}
          <Text className={kicker ? 'mt-3 text-[24px] font-black text-white' : 'text-[22px] font-black text-white'}>{title}</Text>
          <Text className="mt-2 text-[13px] leading-5 text-[#D8E3F3]">{detail}</Text>
        </View>

        {actionLabel && onPress ? (
          <Pressable
            onPress={onPress}
            className="flex-row items-center justify-center gap-2 rounded-xl px-6 py-4"
            style={({ pressed }) => ({ backgroundColor: tint, opacity: pressed ? 0.82 : 1 })}
          >
            <Ionicons name={actionIcon} size={16} color="#FFFFFF" />
            <Text className="font-black text-white">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children ? <View className="relative mt-4">{children}</View> : null}
    </View>
  )
}
