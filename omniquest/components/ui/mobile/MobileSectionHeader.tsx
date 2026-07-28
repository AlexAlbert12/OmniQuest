import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type IconName = keyof typeof Ionicons.glyphMap

type MobileSectionHeaderProps = {
  title: string
  icon?: IconName
  iconColor?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export default function MobileSectionHeader({
  title,
  icon,
  iconColor = '#9F7AEA',
  actionLabel,
  onAction,
  className = '',
}: MobileSectionHeaderProps) {
  return (
    <View className={`flex-row items-center justify-between gap-3 ${className}`}>
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        {icon ? <Ionicons name={icon} size={21} color={iconColor} /> : null}
        <Text className="min-w-0 flex-1 text-[22px] font-black text-white" numberOfLines={1}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} className="flex-row items-center gap-2 rounded-xl px-2 py-2" style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
          <Text className="text-[15px] font-black text-brand-admin">{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={18} color="#9F7AEA" />
        </Pressable>
      ) : null}
    </View>
  )
}
