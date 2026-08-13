import React from 'react'
import {
  Pressable,
  type PressableProps,
  type View,
} from 'react-native'

type AppPressableProps = Omit<PressableProps, 'accessibilityLabel' | 'style'> & {
  accessibilityLabel: string
  accessibilityHint?: string
  style?: PressableProps['style']
  hitSlopSize?: number
}

const AppPressable = React.forwardRef<View, AppPressableProps>(function AppPressable({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  disabled,
  focusable,
  hitSlopSize = 6,
  style,
  ...props
}, ref) {
  return (
    <Pressable
      {...props}
      ref={ref}
      accessible
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: disabled || accessibilityState?.disabled }}
      disabled={disabled}
      focusable={focusable ?? !disabled}
      hitSlop={props.hitSlop ?? hitSlopSize}
      style={style}
    />
  )
})

export default AppPressable
