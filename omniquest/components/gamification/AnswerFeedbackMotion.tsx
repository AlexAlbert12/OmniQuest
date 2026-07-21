import React, { useEffect, useRef } from 'react'
import { Animated, Easing, type ViewStyle } from 'react-native'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export default function AnswerFeedbackMotion({
  children,
  status,
  style,
}: {
  children: React.ReactNode
  status: 'correct' | 'incorrect' | 'pending'
  style?: ViewStyle
}) {
  const reducedMotion = useReducedMotion()
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.96)).current
  const translateY = useRef(new Animated.Value(14)).current
  const translateX = useRef(new Animated.Value(0)).current

  useEffect(() => {
    opacity.setValue(reducedMotion ? 1 : 0)
    scale.setValue(reducedMotion ? 1 : 0.96)
    translateY.setValue(reducedMotion ? 0 : 14)
    translateX.setValue(0)

    if (reducedMotion) return

    const enter = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 8,
        stiffness: 170,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ])

    const shake = status === 'incorrect'
      ? Animated.sequence([
          Animated.timing(translateX, { toValue: -7, duration: 55, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 7, duration: 75, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -4, duration: 60, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 55, useNativeDriver: true }),
        ])
      : Animated.delay(1)

    const animation = Animated.sequence([enter, shake])
    animation.start()
    return () => animation.stop()
  }, [opacity, reducedMotion, scale, status, translateX, translateY])

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  )
}
