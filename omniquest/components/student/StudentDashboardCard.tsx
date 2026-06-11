import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'

export default function StudentDashboardCard({
  title,
  actionLabel,
  onAction,
  className = '',
  compact = false,
  children,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  compact?: boolean
  children: React.ReactNode
}) {
  const { accentColor } = useAppTheme()

  return (
    <View className={`rounded-2xl border border-[#1A3155] bg-[#09162C] ${compact ? 'p-4' : 'p-5'} ${className}`}>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-[15px] font-black text-white">{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} className="flex-row items-center gap-2">
            <Text className="text-[13px] font-bold" style={{ color: accentColor }}>{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={13} color={accentColor} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}

export function StudentCardLink({
  label,
  onPress,
  color,
}: {
  label: string
  onPress: () => void
  color?: string
}) {
  const { accentColor } = useAppTheme()
  const linkColor = color || accentColor

  return (
    <Pressable onPress={onPress} className="mt-4 flex-row items-center justify-center gap-2 border-t border-[#172A4A] pt-4">
      <Text className="text-[13px] font-bold" style={{ color: linkColor }}>{label}</Text>
      <Ionicons name="arrow-forward" size={14} color={linkColor} />
    </Pressable>
  )
}
