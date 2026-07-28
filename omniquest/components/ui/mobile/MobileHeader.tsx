import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'

type IconName = keyof typeof Ionicons.glyphMap

type MobileHeaderProps = {
  title: string
  subtitle?: string
  icon?: IconName
  iconColor?: string
  iconBackgroundColor?: string
  right?: React.ReactNode
  showLogo?: boolean
  logoSize?: number
  className?: string
  titleNumberOfLines?: number
}

export default function MobileHeader({
  title,
  subtitle,
  icon,
  iconColor,
  iconBackgroundColor,
  right,
  className = '',
  titleNumberOfLines = 2,
}: MobileHeaderProps) {
  const { tokens } = useAppTheme()
  const resolvedIconColor = iconColor || tokens.brand.student
  const resolvedIconBackground = iconBackgroundColor || tokens.surface.raised

  return (
    <View className={className}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1 flex-row items-start gap-3">
          {icon ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="min-h-12 min-w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: resolvedIconBackground }}
            >
              <Ionicons name={icon} size={26} color={resolvedIconColor} />
            </View>
          ) : null}
          <Text
            accessibilityRole="header"
            allowFontScaling
            maxFontSizeMultiplier={2}
            className="min-w-0 flex-1 text-[30px] font-black text-text-primary"
            numberOfLines={Math.max(2, titleNumberOfLines)}
            style={{ lineHeight: 38, includeFontPadding: true }}
          >
            {title}
          </Text>
        </View>
        {right ? <View className="flex-row flex-wrap items-center justify-end gap-3">{right}</View> : null}
      </View>

      {subtitle ? (
        <Text
          allowFontScaling
          maxFontSizeMultiplier={2}
          className="mt-3 max-w-[520px] text-[15px] text-text-secondary"
          style={{ lineHeight: 23 }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}
