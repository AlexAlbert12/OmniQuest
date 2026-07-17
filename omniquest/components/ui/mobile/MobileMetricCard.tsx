import React from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { withAlpha } from '../../../lib/color'

type IconName = keyof typeof Ionicons.glyphMap

type MobileMetricCardProps = {
  icon?: IconName
  label?: string
  title?: string
  value: string | number
  suffix?: string
  detail?: string | number | null
  detailColor?: string
  color?: string
  width?: number
  compact?: boolean
  className?: string
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

export default function MobileMetricCard({
  icon = 'stats-chart',
  label,
  title,
  value,
  suffix,
  detail,
  detailColor = '#8FA7C7',
  color = '#8B5CF6',
  width,
  compact = false,
  className = '',
  onPress,
  style,
  accessibilityLabel,
}: MobileMetricCardProps) {
  const metricLabel = label ?? title ?? ''
  const valueText = `${String(value)}${suffix ?? ''}`
  const baseClassName = `overflow-hidden rounded-2xl border border-[#1D3760] ${compact ? 'p-3' : 'p-4'} ${className}`
  const fixedWidthStyle = width ? { width } : undefined

  const content = (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(color, compact ? '2B' : '38'), '#07162C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View className="absolute -right-6 -top-6 h-20 w-20 rounded-full" style={{ backgroundColor: withAlpha(color, '18') }} />
      <View
        className={`${compact ? 'h-10 w-10 rounded-2xl' : 'h-14 w-14 rounded-full'} items-center justify-center`}
        style={{ backgroundColor: withAlpha(color, '3D') }}
      >
        <Ionicons name={icon} size={compact ? 22 : 29} color={color} />
      </View>
      <Text
        className={`${compact ? 'mt-4 text-[24px]' : 'mt-5 text-[30px]'} font-black text-white`}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {valueText}
      </Text>
      {metricLabel ? (
        <Text className="mt-1 text-[13px] font-bold text-[#D4DDF0]" numberOfLines={compact ? 1 : 2}>
          {metricLabel}
        </Text>
      ) : null}
      {detail !== undefined && detail !== null && String(detail).length > 0 ? (
        <Text className="mt-1 text-[12px] font-semibold" style={{ color: detailColor }} numberOfLines={2}>
          {String(detail)}
        </Text>
      ) : null}
    </>
  )

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? metricLabel}
        onPress={onPress}
        className={baseClassName}
        style={({ pressed }) => [fixedWidthStyle, style, { opacity: pressed ? 0.84 : 1 }]}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View className={baseClassName} style={[fixedWidthStyle, style]}>
      {content}
    </View>
  )
}
