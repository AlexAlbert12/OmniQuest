import React, { useEffect, useRef } from 'react'
import { Animated, Modal, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import OmniGuide from '../OmniGuide'
import CelebrationParticles from './CelebrationParticles'
import AppButton from '../ui/AppButton'
import type { StudentBadge } from '../../lib/studentBadges'
import { useAppHaptics } from '../../lib/haptics'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { USE_NATIVE_ANIMATION_DRIVER } from '../../lib/animation'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'

export default function BadgeUnlockModal({
  badge,
  onClose,
  remainingCount = 0,
  visible = true,
}: {
  badge: StudentBadge | null
  onClose: () => void
  remainingCount?: number
  visible?: boolean
}) {
  const reducedMotion = useReducedMotion()
  const haptics = useAppHaptics()
  const { height } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.82)).current
  const glow = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!badge || !visible) return

    void haptics.success()
    opacity.setValue(reducedMotion ? 1 : 0)
    scale.setValue(reducedMotion ? 1 : 0.82)
    glow.setValue(0)

    if (reducedMotion) return

    const enter = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 210,
        useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 7,
        stiffness: 150,
        useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 850, useNativeDriver: USE_NATIVE_ANIMATION_DRIVER }),
          Animated.timing(glow, { toValue: 0, duration: 850, useNativeDriver: USE_NATIVE_ANIMATION_DRIVER }),
        ]),
        { iterations: 2 }
      ),
    ])

    enter.start()
    return () => enter.stop()
  }, [badge, glow, haptics, opacity, reducedMotion, scale, visible])

  if (!badge || !visible) return null

  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.18] })
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.62] })

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center px-5 py-6" style={{ backgroundColor: tokens.background.overlay }}>
        <Animated.View
          accessibilityRole="alert"
          accessibilityLabel={`Logro desbloqueado: ${badge.title}. Recompensa ${badge.xp}`}
          className="w-full max-w-[500px] overflow-hidden rounded-[32px] border"
          style={{
            maxHeight: Math.min(720, height * 0.9),
            borderColor: withAlpha(badge.color, 'CC'),
            backgroundColor: tokens.surface.default,
            opacity,
            transform: [{ scale }],
          }}
        >
          <LinearGradient
            colors={[withAlpha(badge.color, '35'), tokens.surface.raised]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="items-center justify-center border-b px-5 py-4"
            style={{ borderBottomColor: withAlpha(badge.color, '66') }}
          >
            <View className="flex-row items-center gap-2 rounded-full border px-4 py-2" style={{ borderColor: withAlpha(tokens.gamification.xp, '99'), backgroundColor: withAlpha(tokens.gamification.xp, '18') }}>
                <Ionicons name="sparkles" size={16} color="#FBBF24" />
                <Text className="text-[12px] font-black uppercase tracking-[0.08em] text-gamification-xp">
                  Logro desbloqueado
                </Text>
            </View>
          </LinearGradient>

          <ScrollView contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24, paddingTop: 20 }} showsVerticalScrollIndicator={false}>
            <View className="relative h-[154px] w-full items-center justify-center">
              <CelebrationParticles active size={220} />
              <View className="h-36 w-36 items-center justify-center">
                  <Animated.View
                    className="absolute h-36 w-36 rounded-full"
                    style={{
                      backgroundColor: `${badge.color}44`,
                      opacity: glowOpacity,
                      transform: [{ scale: glowScale }],
                    }}
                  />
                  <View
                    className="h-28 w-28 items-center justify-center rounded-[30px] border-2"
                    style={{ backgroundColor: `${badge.color}24`, borderColor: badge.color }}
                  >
                    <Ionicons name={badge.icon} size={50} color={badge.color} />
                  </View>
                <View className="absolute -bottom-1 -left-4 h-16 w-16 items-center justify-center rounded-full border" style={{ borderColor: tokens.border.active, backgroundColor: tokens.surface.default }}>
                  <OmniGuide state="happy" size={52} />
                </View>
              </View>
            </View>

            <Text className="mt-2 text-center text-[30px] font-black leading-[38px] text-white">{badge.title}</Text>
            <Text className="mt-2 max-w-[390px] text-center text-[14px] leading-6 text-text-secondary">{badge.requirement}</Text>

            <View
              className="mt-5 w-full overflow-hidden rounded-2xl border"
              style={{ borderColor: withAlpha(tokens.gamification.xp, 'AA'), borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={[withAlpha(tokens.gamification.xp, '2E'), tokens.surface.raised]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="flex-row items-center px-4 py-4"
              >
                <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(tokens.gamification.xp, '26') }}>
                  <Ionicons name="flash" size={25} color={tokens.gamification.xp} />
                </View>
                <View className="ml-3 min-w-0 flex-1">
                  <Text className="text-[11px] font-black uppercase tracking-[0.1em] text-text-secondary">Recompensa conseguida</Text>
                  <Text className="mt-0.5 text-[21px] font-black" style={{ color: tokens.gamification.xp }}>{badge.xp}</Text>
                </View>
              </LinearGradient>
            </View>

            {remainingCount > 0 ? (
              <View className="mt-3 w-full rounded-xl px-3 py-2" style={{ backgroundColor: tokens.semanticSurface.info }}>
                <Text className="text-center text-[12px] font-bold" style={{ color: tokens.semantic.info }}>
                  Tienes {remainingCount} {remainingCount === 1 ? 'logro más' : 'logros más'} esperando.
                </Text>
              </View>
            ) : null}

            <AppButton
              accessibilityLabel={remainingCount > 0 ? 'Ver siguiente logro' : 'Cerrar logro'}
              fullWidth
              icon={remainingCount > 0 ? 'arrow-forward' : 'sparkles'}
              label={remainingCount > 0 ? 'Ver siguiente logro' : '¡Genial!'}
              onPress={onClose}
              role="student"
              variant="primary"
              style={{ marginTop: 20 }}
            />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}
