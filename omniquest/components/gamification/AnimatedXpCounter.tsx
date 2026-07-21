import React, { useEffect, useRef, useState } from 'react'
import { Animated, Text, type TextStyle } from 'react-native'
import { useReducedMotion } from '../../hooks/useReducedMotion'

type AnimatedXpCounterProps = {
  value: number
  prefix?: string
  suffix?: string
  duration?: number
  style?: TextStyle | TextStyle[]
  accessibilityLabel?: string
}

export default function AnimatedXpCounter({
  value,
  prefix = '',
  suffix = '',
  duration = 850,
  style,
  accessibilityLabel,
}: AnimatedXpCounterProps) {
  const reducedMotion = useReducedMotion()
  const animatedValue = useRef(new Animated.Value(0)).current
  const [displayValue, setDisplayValue] = useState(reducedMotion ? value : 0)

  useEffect(() => {
    if (reducedMotion) {
      animatedValue.setValue(value)
      setDisplayValue(value)
      return
    }

    animatedValue.stopAnimation()
    animatedValue.setValue(0)
    const listener = animatedValue.addListener(({ value: currentValue }) => {
      setDisplayValue(Math.max(0, Math.round(currentValue)))
    })

    Animated.timing(animatedValue, {
      toValue: Math.max(0, value),
      duration,
      useNativeDriver: false,
    }).start()

    return () => animatedValue.removeListener(listener)
  }, [animatedValue, duration, reducedMotion, value])

  return (
    <Text accessibilityLabel={accessibilityLabel || `${value} XP`} style={style}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </Text>
  )
}
