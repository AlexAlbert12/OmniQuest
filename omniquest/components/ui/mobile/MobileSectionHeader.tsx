import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import AppPressable from '../AppPressable'

type IconName = keyof typeof Ionicons.glyphMap

type MobileSectionHeaderProps = {
  title: string
  icon?: IconName
  iconColor?: string
  actionLabel?: string
  actionHint?: string
  onAction?: () => void
  className?: string
}

export default function MobileSectionHeader({
  title,
  icon,
  iconColor,
  actionLabel,
  actionHint,
  onAction,
  className = '',
}: MobileSectionHeaderProps) {
  const { tokens } = useAppTheme()
  const resolvedIconColor = iconColor || tokens.brand.student

  return (
    <View className={`flex-row items-start justify-between gap-3 ${className}`}>
      <View className="min-w-0 flex-1 flex-row items-start gap-2">
        {icon ? (
          <Ionicons
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            name={icon}
            size={21}
            color={resolvedIconColor}
            style={{ marginTop: 3 }}
          />
        ) : null}
        <Text
          accessibilityRole="header"
          allowFontScaling
          maxFontSizeMultiplier={2}
          className="min-w-0 flex-1 text-[22px] font-black text-text-primary"
          numberOfLines={2}
          style={{ lineHeight: 29 }}
        >
          {title}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <AppPressable
          accessibilityLabel={actionLabel}
          accessibilityHint={actionHint || `Abre la acción ${actionLabel}`}
          onPress={onAction}
          className="min-h-11 flex-row items-center gap-2 rounded-xl px-2 py-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
        >
          <Text
            allowFontScaling
            maxFontSizeMultiplier={2}
            className="text-[15px] font-black"
            numberOfLines={2}
            style={{ color: tokens.brand.student, lineHeight: 20 }}
          >
            {actionLabel}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={tokens.brand.student} />
        </AppPressable>
      ) : null}
    </View>
  )
}
