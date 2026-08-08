import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'
import { USE_NATIVE_ANIMATION_DRIVER } from '../lib/animation'

export type OmniState = 'normal' | 'blink' | 'happy' | 'thinking' | 'error'
export type OmniSize = 'sm' | 'md' | 'lg' | 'xl'

type OmniGuideProps = {
  accessibilityLabel?: string
  animate?: boolean
  autoBlink?: boolean
  size?: OmniSize | number
  state?: OmniState
  style?: StyleProp<ViewStyle>
  testID?: string
}

const omniAssets = {
  normal: require('../assets/images/omni/omni-normal.png'),
  blink: require('../assets/images/omni/omni-blink.png'),
  happy: require('../assets/images/omni/omni-happy.png'),
  thinking: require('../assets/images/omni/omni-thinking.png'),
  error: require('../assets/images/omni/omni-error.png'),
} as const

const sizeValues: Record<OmniSize, number> = {
  sm: 52,
  md: 84,
  lg: 128,
  xl: 160,
}

const stateLabels: Record<OmniState, string> = {
  normal: 'Omni, tu guía de aprendizaje',
  blink: 'Omni está preparando la experiencia',
  happy: 'Omni celebra tu progreso',
  thinking: 'Omni está pensando',
  error: 'Omni avisa de un problema',
}

export default function OmniGuide({
  accessibilityLabel,
  animate = true,
  autoBlink = false,
  size = 'md',
  state = 'normal',
  style,
  testID,
}: OmniGuideProps) {
  const resolvedSize = typeof size === 'number' ? size : sizeValues[size]
  const [displayState, setDisplayState] = useState<OmniState>(state)
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current
  const scale = useRef(new Animated.Value(animate ? 0.94 : 1)).current
  const rotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    setDisplayState(state)
  }, [state])

  useEffect(() => {
    if (!animate) {
      opacity.setValue(1)
      scale.setValue(1)
      rotation.setValue(0)
      return
    }

    opacity.setValue(0)
    scale.setValue(0.94)
    rotation.setValue(state === 'thinking' ? -1 : 0)

    const entrance = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 72,
        useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
      }),
    ])

    const animation = state === 'thinking'
      ? Animated.sequence([
          entrance,
          Animated.timing(rotation, {
            toValue: 1,
            duration: 300,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
          }),
          Animated.timing(rotation, {
            toValue: 0,
            duration: 260,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
          }),
        ])
      : entrance

    animation.start()
    return () => animation.stop()
  }, [animate, opacity, rotation, scale, state])

  useEffect(() => {
    if (!autoBlink || state !== 'normal') return

    let resetTimer: ReturnType<typeof setTimeout> | undefined
    const runBlink = () => {
      setDisplayState('blink')
      resetTimer = setTimeout(() => setDisplayState('normal'), 1000)
    }

    const firstBlinkTimer = setTimeout(runBlink, 2500)
    const blinkInterval = setInterval(runBlink, 5000)

    return () => {
      clearTimeout(firstBlinkTimer)
      clearInterval(blinkInterval)
      if (resetTimer) clearTimeout(resetTimer)
    }
  }, [autoBlink, state])

  const rotate = rotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-3deg', '0deg', '3deg'],
  })

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel || stateLabels[state]}
      accessibilityRole="image"
      style={[
        {
          height: resolvedSize,
          opacity,
          transform: [{ scale }, { rotate }],
          width: resolvedSize,
        },
        style,
      ]}
      testID={testID}
    >
      <Image
        accessibilityIgnoresInvertColors
        contentFit="contain"
        source={omniAssets[displayState]}
        style={{ height: '100%', width: '100%' }}
        transition={displayState === state ? 0 : 90}
      />
    </Animated.View>
  )
}
