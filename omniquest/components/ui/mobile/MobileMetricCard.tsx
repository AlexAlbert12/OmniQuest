import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { withAlpha } from '../../../lib/color'

type IconName = keyof typeof Ionicons.glyphMap

type MobileMetricCardProps = {
  icon: IconName
  label: string
  value: string | number
  color?: string
  width?: number
  compact?: boolean
  className?: string
}

export default function MobileMetricCard({
  icon,
  label,
  value,
  color = '#8B5CF6',
  width,
  compact = false,
  className = '',
}: MobileMetricCardProps) {
  return (
    <LinearGradient
      colors={[withAlpha(color, compact ? '2B' : '38'), '#07162C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className={`overflow-hidden rounded-2xl border border-[#1D3760] ${compact ? 'p-3' : 'p-4'} ${className}`}
      style={width ? { width } : undefined}
    >
      <View className="absolute -right-6 -top-6 h-20 w-20 rounded-full" style={{ backgroundColor: withAlpha(color, '18') }} />
      <View
        className={`${compact ? 'h-10 w-10 rounded-2xl' : 'h-14 w-14 rounded-full'} items-center justify-center`}
        style={{ backgroundColor: withAlpha(color, '3D') }}
      >
        <Ionicons name={icon} size={compact ? 22 : 29} color={color} />
      </View>
      <Text className={`${compact ? 'mt-4 text-[24px]' : 'mt-5 text-[30px]'} font-black text-white`} numberOfLines={1}>
        {String(value)}
      </Text>
      <Text className="mt-1 text-[13px] text-[#D4DDF0]" numberOfLines={compact ? 1 : 2}>
        {label}
      </Text>
    </LinearGradient>
  )
}
