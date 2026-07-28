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

const SIZE_STYLES: Record<AppButtonSize, { height: number; paddingHorizontal: number; radius: number; fontSize: number; iconSize: number }> = {
  sm: { height: 38, paddingHorizontal: 13, radius: 11, fontSize: 12, iconSize: 16 },
  md: { height: 46, paddingHorizontal: 17, radius: 13, fontSize: 13, iconSize: 18 },
  lg: { height: 54, paddingHorizontal: 21, radius: 15, fontSize: 15, iconSize: 21 },
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
  const unavailable = disabled || loading
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
          minHeight: dimensions.height,
          minWidth: iconOnly ? dimensions.height : undefined,
          paddingHorizontal: iconOnly ? 0 : dimensions.paddingHorizontal,
          borderRadius: dimensions.radius,
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: unavailable ? 0.48 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed && !unavailable ? 0.985 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        fullWidth ? styles.fullWidth : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.foreground} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' ? <Ionicons name={icon} size={dimensions.iconSize} color={palette.foreground} /> : null}
          {!iconOnly && label ? (
            <Text numberOfLines={1} style={[styles.label, { color: palette.foreground, fontSize: dimensions.fontSize }]}>
              {label}
            </Text>
          ) : null}
          {icon && iconPosition === 'right' ? <Ionicons name={icon} size={dimensions.iconSize} color={palette.foreground} /> : null}
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
        foreground: tokens.text.inverse,
      }
    default:
      return {
        background: primary,
        border: primary,
        foreground: tokens.text.inverse,
      }
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontWeight: '900',
  },
})
