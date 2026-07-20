import React from 'react'
import {
  Pressable,
  type PressableProps,
} from 'react-native'

type AppPressableProps = Omit<PressableProps, 'accessibilityLabel' | 'style'> & {
  accessibilityLabel: string
  accessibilityHint?: string
  style?: PressableProps['style']
  hitSlopSize?: number
}

export default function AppPressable({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'button',
  hitSlopSize = 6,
  style,
  ...props
}: AppPressableProps) {
  return (
    <Pressable
      {...props}
      accessible
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      hitSlop={props.hitSlop ?? hitSlopSize}
      style={style}
    />
  )
}
