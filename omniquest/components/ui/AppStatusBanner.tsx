import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton, { type AppButtonVariant } from './AppButton'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import type { SemanticColorKey } from '../../lib/designTokens'

export type AppStatusBannerVariant = SemanticColorKey | 'neutral'

type AppStatusBannerProps = {
  variant?: AppStatusBannerVariant
  title: string
  message?: string
  icon?: keyof typeof Ionicons.glyphMap
  actionLabel?: string
  onAction?: () => void
  compact?: boolean
}

const DEFAULT_ICONS: Record<AppStatusBannerVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle-outline',
  warning: 'warning-outline',
  danger: 'alert-circle-outline',
  info: 'information-circle-outline',
  neutral: 'ellipse-outline',
}

export default function AppStatusBanner({
  variant = 'info',
  title,
  message,
  icon,
  actionLabel,
  onAction,
  compact = false,
}: AppStatusBannerProps) {
  const { tokens } = useAppTheme()
  const color = variant === 'neutral' ? tokens.text.secondary : tokens.semantic[variant]
  const background = variant === 'neutral'
    ? tokens.surface.raised
    : tokens.semanticSurface[variant]
  const buttonVariant: AppButtonVariant = variant === 'danger'
    ? 'danger'
    : variant === 'success'
      ? 'success'
      : 'secondary'

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        compact ? styles.compact : null,
        {
          backgroundColor: background,
          borderColor: withAlpha(color, '88'),
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: withAlpha(color, '1F') }]}>
        <Ionicons name={icon || DEFAULT_ICONS[variant]} size={compact ? 18 : 21} color={color} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: tokens.text.primary }]}>{title}</Text>
        {message ? <Text style={[styles.message, { color: tokens.text.secondary }]}>{message}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} variant={buttonVariant} size="sm" onPress={onAction} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compact: {
    minHeight: 52,
    padding: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  message: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
  },
})
