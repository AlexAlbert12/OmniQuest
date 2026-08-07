import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from './AppPressable'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import type { AppRole } from '../../lib/designTokens'

type IconName = keyof typeof Ionicons.glyphMap
export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
export type AppButtonSize = 'sm' | 'md' | 'lg'

export type AppButtonProps = {
  label?: string
  accessibilityLabel?: string
  accessibilityHint?: string
  variant?: AppButtonVariant
  size?: AppButtonSize
  icon?: IconName
  iconPosition?: 'left' | 'right'
  iconOnly?: boolean
  loading?: boolean
  disabled?: boolean
  role?: AppRole
  fullWidth?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

const SIZE_STYLES: Record<AppButtonSize, { minHeight: number; paddingHorizontal: number; paddingVertical: number; radius: number; fontSize: number; lineHeight: number; iconSize: number }> = {
  sm: { minHeight: 38, paddingHorizontal: 13, paddingVertical: 8, radius: 11, fontSize: 12, lineHeight: 16, iconSize: 16 },
  md: { minHeight: 46, paddingHorizontal: 17, paddingVertical: 10, radius: 13, fontSize: 13, lineHeight: 18, iconSize: 18 },
  lg: { minHeight: 54, paddingHorizontal: 21, paddingVertical: 12, radius: 15, fontSize: 15, lineHeight: 21, iconSize: 21 },
}

export default function AppButton({
  label,
  accessibilityLabel,
  accessibilityHint,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  iconOnly = false,
  loading = false,
  disabled = false,
  role,
  fullWidth = false,
  onPress,
  style,
}: AppButtonProps) {
  const { accentColor, tokens } = useAppTheme()
  const dimensions = SIZE_STYLES[size]
  const primaryColor = role ? tokens.brand[role] : accentColor
  const palette = getVariantPalette(variant, primaryColor, tokens)
  const disabledPalette = getDisabledPalette(tokens)
  const unavailable = disabled || loading
  const renderedPalette = disabled ? disabledPalette : palette
  const resolvedAccessibilityLabel = accessibilityLabel || label

  if (!resolvedAccessibilityLabel) {
    throw new Error('AppButton requires label or accessibilityLabel')
  }

  return (
    <AppPressable
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: dimensions.minHeight,
          minWidth: iconOnly ? dimensions.minHeight : undefined,
          paddingHorizontal: iconOnly ? 0 : dimensions.paddingHorizontal,
          paddingVertical: iconOnly ? 0 : dimensions.paddingVertical,
          borderRadius: dimensions.radius,
          backgroundColor: renderedPalette.background,
          borderColor: renderedPalette.border,
          opacity: loading ? 0.76 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed && !unavailable ? 0.985 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        fullWidth ? styles.fullWidth : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={renderedPalette.foreground} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' ? <Ionicons name={icon} size={dimensions.iconSize} color={renderedPalette.foreground} /> : null}
          {!iconOnly && label ? (
            <Text
              maxFontSizeMultiplier={2}
              numberOfLines={2}
              style={[styles.label, { color: renderedPalette.foreground, fontSize: dimensions.fontSize, lineHeight: dimensions.lineHeight }]}
            >
              {label}
            </Text>
          ) : null}
          {icon && iconPosition === 'right' ? <Ionicons name={icon} size={dimensions.iconSize} color={renderedPalette.foreground} /> : null}
        </View>
      )}
    </AppPressable>
  )
}

function getVariantPalette(
  variant: AppButtonVariant,
  primary: string,
  tokens: ReturnType<typeof useAppTheme>['tokens'],
) {
  switch (variant) {
    case 'secondary':
      return {
        background: tokens.surface.interactive,
        border: tokens.border.default,
        foreground: tokens.text.primary,
      }
    case 'ghost':
      return {
        background: 'transparent',
        border: 'transparent',
        foreground: tokens.text.secondary,
      }
    case 'danger':
      return {
        background: withAlpha(tokens.semantic.danger, '24'),
        border: withAlpha(tokens.semantic.danger, 'A0'),
        foreground: tokens.semantic.danger,
      }
    case 'success':
      return {
        background: tokens.semantic.success,
        border: tokens.semantic.success,
        foreground: tokens.text.onAccent,
      }
    default:
      return {
        background: primary,
        border: primary,
        foreground: tokens.text.onAccent,
      }
  }
}

function getDisabledPalette(tokens: ReturnType<typeof useAppTheme>['tokens']) {
  return {
    background: tokens.surface.disabled,
    border: tokens.border.subtle,
    foreground: tokens.text.disabled,
  }
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
    fontWeight: '900',
  },
})
