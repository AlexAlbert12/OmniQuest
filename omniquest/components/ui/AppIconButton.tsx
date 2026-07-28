import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton, { type AppButtonSize, type AppButtonVariant } from './AppButton'
import type { AppRole } from '../../lib/designTokens'

type IconName = keyof typeof Ionicons.glyphMap

export type AppIconButtonProps = {
  accessibilityLabel: string
  accessibilityHint?: string
  icon: IconName
  variant?: AppButtonVariant
  size?: AppButtonSize
  loading?: boolean
  disabled?: boolean
  role?: AppRole
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

export default function AppIconButton({
  accessibilityLabel,
  accessibilityHint,
  icon,
  variant = 'ghost',
  size = 'md',
  loading,
  disabled,
  role,
  onPress,
  style,
}: AppIconButtonProps) {
  return (
    <AppButton
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      icon={icon}
      iconOnly
      variant={variant}
      size={size}
      loading={loading}
      disabled={disabled}
      role={role}
      onPress={onPress}
      style={style}
    />
  )
}
