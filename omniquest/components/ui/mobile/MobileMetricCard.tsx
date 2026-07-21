import React from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { withAlpha } from '../../../lib/color'
import { useAppTheme } from '../../../lib/appTheme'
import { getSemanticColor, semanticIcons, type SemanticIconKey } from '../../../lib/designTokens'
import AppPressable from '../AppPressable'

type IconName = keyof typeof Ionicons.glyphMap

type MobileMetricCardProps = {
  icon?: IconName
  semantic?: SemanticIconKey
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
  semantic,
  label,
  title,
  value,
  suffix,
  detail,
  detailColor,
  color,
  width,
  compact = false,
  className = '',
  onPress,
  style,
  accessibilityLabel,
}: MobileMetricCardProps) {
  const { colors, tokens, accentColor } = useAppTheme()
  const semanticDefinition = semantic ? semanticIcons[semantic] : null
  const resolvedIcon = semanticDefinition?.activeIcon ?? icon
  const resolvedColor = semanticDefinition ? getSemanticColor(tokens, semanticDefinition.colorKey) : color || accentColor
  const metricLabel = label ?? title ?? ''
  const valueText = `${String(value)}${suffix ?? ''}`
  const baseClassName = `overflow-hidden rounded-2xl border ${compact ? 'p-3' : 'p-4'} ${className}`
  const fixedWidthStyle = width ? { width } : undefined

  const content = (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(resolvedColor, compact ? '2B' : '38'), colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View className="absolute -right-6 -top-6 h-20 w-20 rounded-full" style={{ backgroundColor: withAlpha(resolvedColor, '18') }} />
      <View
        className={`${compact ? 'h-10 w-10 rounded-2xl' : 'h-14 w-14 rounded-full'} items-center justify-center`}
        style={{ backgroundColor: withAlpha(resolvedColor, '3D') }}
      >
        <Ionicons name={resolvedIcon} size={compact ? 22 : 29} color={resolvedColor} />
      </View>
      <Text
        className={`${compact ? 'mt-4 text-[24px]' : 'mt-5 text-[30px]'} font-black`}
        style={{ color: colors.text }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {valueText}
      </Text>
      {metricLabel ? (
        <Text className="mt-1 text-[13px] font-bold" style={{ color: colors.textSecondary }} numberOfLines={compact ? 1 : 2}>
          {metricLabel}
        </Text>
      ) : null}
      {detail !== undefined && detail !== null && String(detail).length > 0 ? (
        <Text className="mt-1 text-[12px] font-semibold" style={{ color: detailColor ?? colors.textMuted }} numberOfLines={2}>
          {String(detail)}
        </Text>
      ) : null}
    </>
  )

  if (onPress) {
    return (
      <AppPressable
        accessibilityLabel={accessibilityLabel || metricLabel || `Métrica ${valueText}`}
        accessibilityRole="button"
        onPress={onPress}
        className={baseClassName}
        style={({ pressed }) => [fixedWidthStyle, { borderColor: colors.border }, style, { opacity: pressed ? 0.84 : 1 }]}
      >
        {content}
      </AppPressable>
    )
  }

  return (
    <View className={baseClassName} style={[fixedWidthStyle, { borderColor: colors.border }, style]}>
      {content}
    </View>
  )
}
