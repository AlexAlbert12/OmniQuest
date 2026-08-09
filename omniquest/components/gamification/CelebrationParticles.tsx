import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, View } from 'react-native'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { USE_NATIVE_ANIMATION_DRIVER } from '../../lib/animation'

const PARTICLE_COLORS = ['#FBBF24', '#A78BFA', '#38BDF8', '#34D399', '#FB7185', '#F97316']

export default function CelebrationParticles({ active = true, color, size = 220 }: { active?: boolean; color?: string; size?: number }) {
  const reducedMotion = useReducedMotion()
  const progress = useRef(new Animated.Value(0)).current
  const particles = useMemo(() => Array.from({ length: 12 }, (_, index) => ({
    angle: (Math.PI * 2 * index) / 12,
    color: color || PARTICLE_COLORS[index % PARTICLE_COLORS.length],
    radius: index % 2 === 0 ? size * 0.38 : size * 0.3,
    particleSize: index % 3 === 0 ? 8 : 6,
  })), [color, size])

  useEffect(() => {
    if (!active || reducedMotion) return
    progress.setValue(0)
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1050,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
    })
    animation.start()
    return () => animation.stop()
  }, [active, progress, reducedMotion])

  if (!active || reducedMotion) return null

  return (
    <View style={{ pointerEvents: 'none', position: 'absolute', width: size, height: size }}>
      {particles.map((particle, index) => {
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(particle.angle) * particle.radius],
        })
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(particle.angle) * particle.radius],
        })
        const opacity = progress.interpolate({
          inputRange: [0, 0.2, 0.75, 1],
          outputRange: [0, 1, 0.8, 0],
        })
        const scale = progress.interpolate({
          inputRange: [0, 0.28, 1],
          outputRange: [0.2, 1, 0.55],
        })

        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              left: size / 2 - particle.particleSize / 2,
              top: size / 2 - particle.particleSize / 2,
              width: particle.particleSize,
              height: particle.particleSize,
              borderRadius: particle.particleSize,
              backgroundColor: particle.color,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }, { rotate: `${index * 31}deg` }],
            }}
          />
        )
      })}
    </View>
  )
}
