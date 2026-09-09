import React from 'react'
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { withAlpha } from '../../../lib/color'
import { useAppTheme } from '../../../lib/appTheme'
import { getSemanticColor, semanticIcons, type SemanticIconKey } from '../../../lib/designTokens'
import { useResponsiveLayout } from '../../../lib/responsive'
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
  dense?: boolean
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
  dense = false,
  className = '',
  onPress,
  style,
  accessibilityLabel,
}: MobileMetricCardProps) {
  const { colors, tokens, accentColor } = useAppTheme()
  const responsive = useResponsiveLayout()
  const desktopInline = Platform.OS === 'web' && responsive.isDesktop
  const semanticDefinition = semantic ? semanticIcons[semantic] : null
  const resolvedIcon = semanticDefinition?.activeIcon ?? icon
  const resolvedColor = semanticDefinition ? getSemanticColor(tokens, semanticDefinition.colorKey) : color || accentColor
  const metricLabel = label ?? title ?? ''
  const valueText = `${String(value)}${suffix ?? ''}`
  const baseClassName = `overflow-hidden rounded-2xl border border-border-default ${desktopInline ? 'p-3' : dense ? 'p-1.5' : compact ? 'p-3' : 'p-4'} ${className}`
  const fixedWidthStyle = width ? { width } : undefined

  const content = (
    <>
      <LinearGradient
        colors={[withAlpha(resolvedColor, dense ? '24' : compact ? '2B' : '38'), colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      />
      <View className="absolute -right-6 -top-6 h-20 w-20 rounded-full" style={{ backgroundColor: withAlpha(resolvedColor, '18') }} />
      <View style={{ minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: desktopInline ? 'center' : undefined, gap: dense ? 6 : compact ? 9 : 11 }}>
        <View
          className={`${dense ? 'h-5 w-5 rounded-lg' : compact ? 'h-10 w-10 rounded-2xl' : 'h-14 w-14 rounded-full'} items-center justify-center`}
          style={{ flexShrink: 0, backgroundColor: withAlpha(resolvedColor, '3D') }}
        >
          <Ionicons name={resolvedIcon} size={dense ? 14 : compact ? 22 : 29} color={resolvedColor} />
        </View>
        <Text
          className={`${dense ? 'text-[17px]' : compact ? 'text-[24px]' : 'text-[30px]'} min-w-0 font-black`}
          style={{ color: colors.text, flex: desktopInline ? undefined : 1, flexShrink: 1 }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {valueText}
        </Text>
        {desktopInline && metricLabel ? (
          <Text
            className={`${dense ? 'text-[8px]' : 'text-[13px]'} min-w-0 font-bold`}
            style={{ color: colors.textSecondary, flexShrink: 1 }}
            numberOfLines={1}
          >
            {metricLabel}
          </Text>
        ) : null}
      </View>
      {!desktopInline && metricLabel ? (
        <Text className={`${dense ? 'mt-0.5 text-[8px] leading-2.5' : 'mt-1 text-[13px]'} font-bold`} style={{ color: colors.textSecondary }} numberOfLines={dense ? 2 : compact ? 1 : 2}>
          {metricLabel}
        </Text>
      ) : null}
      {detail !== undefined && detail !== null && String(detail).length > 0 ? (
        <Text className={`${dense ? 'mt-0.5 text-[9px] leading-3' : 'mt-1 text-[12px]'} font-semibold`} style={{ color: detailColor ?? colors.textMuted, textAlign: desktopInline ? 'center' : undefined }} numberOfLines={dense ? 1 : 2}>
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
        style={({ pressed }) => [fixedWidthStyle, style, { opacity: pressed ? 0.84 : 1 }]}
      >
        {content}
      </AppPressable>
    )
  }

  return (
    <View className={baseClassName} style={[fixedWidthStyle, style]}>
      {content}
    </View>
  )
}
