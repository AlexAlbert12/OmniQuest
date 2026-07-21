import React, { useEffect, useRef } from 'react'
import { Animated, Easing, Text } from 'react-native'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export default function XpGainBurst({ amount, visible }: { amount: number; visible: boolean }) {
  const reducedMotion = useReducedMotion()
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(12)).current
  const scale = useRef(new Animated.Value(0.76)).current

  useEffect(() => {
    if (!visible || amount <= 0) return

    opacity.setValue(0)
    translateY.setValue(reducedMotion ? 0 : 12)
    scale.setValue(reducedMotion ? 1 : 0.76)

    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: reducedMotion ? 1 : 150,
          useNativeDriver: true,
        }),
        Animated.delay(reducedMotion ? 250 : 560),
        Animated.timing(opacity, {
          toValue: 0,
          duration: reducedMotion ? 1 : 220,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(translateY, {
        toValue: reducedMotion ? 0 : -30,
        duration: reducedMotion ? 1 : 930,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 7,
        stiffness: 190,
        useNativeDriver: true,
      }),
    ])

    animation.start()
    return () => animation.stop()
  }, [amount, opacity, reducedMotion, scale, translateY, visible])

  if (!visible || amount <= 0) return null

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        opacity,
        position: 'absolute',
        right: 18,
        top: 14,
        transform: [{ translateY }, { scale }],
        zIndex: 30,
      }}
    >
      <Text style={{ color: '#FBBF24', fontSize: 25, fontWeight: '900', textShadowColor: '#4C2B00', textShadowRadius: 8 }}>
        +{amount} XP
      </Text>
    </Animated.View>
  )
}
