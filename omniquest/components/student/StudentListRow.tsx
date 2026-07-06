import React, { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { withAlpha } from '../../lib/color'

type StudentListRowMeta = {
  label: string
  value: string
  color?: string
}

type StudentListRowProps = {
  actionLabel?: string
  children?: ReactNode
  className?: string
  color?: string
  icon: keyof typeof Ionicons.glyphMap
  meta?: StudentListRowMeta[]
  onPress?: () => void
  subtitle?: string
  title: string
}

export default function StudentListRow({
  actionLabel,
  children,
  className = '',
  color = '#8B5CF6',
  icon,
  meta = [],
  onPress,
  subtitle,
  title,
}: StudentListRowProps) {
  const Container = onPress ? Pressable : View

  return (
    <Container
      onPress={onPress}
      className={`flex-row items-center gap-4 rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-3 ${className}`}
      style={onPress ? ({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.84 : 1 }) : undefined}
    >
      <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(color, '24') }}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-black text-white" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>{subtitle}</Text> : null}
        {children}
      </View>
      {meta.length > 0 ? (
        <View className="hidden flex-row items-center gap-4 md:flex">
          {meta.map((item) => (
            <View key={item.label} className="border-l border-[#172A4A] pl-4">
              <Text className="text-[12px] text-[#60799C]">{item.label}</Text>
              <Text className="text-[13px] font-bold" style={{ color: item.color || '#DDE7F4' }}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {actionLabel ? <Text className="hidden text-[12px] font-black text-[#B9A7FF] md:flex">{actionLabel}</Text> : null}
      {onPress ? <Ionicons name="arrow-forward" size={16} color="#7F91AD" /> : null}
    </Container>
  )
}
