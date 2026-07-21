import React, { useEffect, useRef } from 'react'
import { Animated, Modal, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import OmniGuide from '../OmniGuide'
import CelebrationParticles from './CelebrationParticles'
import type { StudentBadge } from '../../lib/studentBadges'
import { useAppHaptics } from '../../lib/haptics'
import { useReducedMotion } from '../../hooks/useReducedMotion'

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
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 7,
        stiffness: 150,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 850, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 850, useNativeDriver: true }),
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
      <View className="flex-1 items-center justify-center bg-[#010611]/90 px-5">
        <Pressable
          accessibilityLabel="Cerrar celebración de logro"
          accessibilityRole="button"
          onPress={onClose}
          style={{ position: 'absolute', inset: 0 }}
        />

        <Animated.View
          accessibilityRole="alert"
          accessibilityLabel={`Logro desbloqueado: ${badge.title}. Recompensa ${badge.xp}`}
          className="w-full max-w-[500px] overflow-hidden rounded-[30px] border border-[#4A3E91] bg-[#0A1530]"
          style={{ opacity, transform: [{ scale }] }}
        >
          <View className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#6D5AF6]/25" />
          <View className="absolute bottom-[-70px] left-[-52px] h-40 w-52 rounded-full bg-[#38BDF8]/15" />

          <View className="border-b border-[#263E7A] bg-[#111B45] px-6 py-5">
            <View className="items-center">
              <View className="flex-row items-center gap-2 rounded-full border border-[#8B5CF6] bg-[#2A1A5F] px-4 py-2">
                <Ionicons name="sparkles" size={16} color="#FBBF24" />
                <Text className="text-[12px] font-black uppercase tracking-[0.08em] text-[#FDE68A]">
                  Logro desbloqueado
                </Text>
              </View>
            </View>
          </View>

          <View className="items-center px-6 pb-6 pt-5">
            <View className="relative h-[150px] w-full items-center justify-center">
              <CelebrationParticles active size={220} />
              <View className="flex-row items-center justify-center gap-4">
                <OmniGuide state="happy" size={92} />
                <View className="h-32 w-32 items-center justify-center">
                  <Animated.View
                    className="absolute h-32 w-32 rounded-full"
                    style={{
                      backgroundColor: `${badge.color}44`,
                      opacity: glowOpacity,
                      transform: [{ scale: glowScale }],
                    }}
                  />
                  <View
                    className="h-24 w-24 items-center justify-center rounded-3xl border-2"
                    style={{ backgroundColor: `${badge.color}24`, borderColor: badge.color }}
                  >
                    <Ionicons name={badge.icon} size={44} color={badge.color} />
                  </View>
                </View>
              </View>
            </View>

            <Text className="mt-1 text-center text-[29px] font-black text-white">{badge.title}</Text>
            <Text className="mt-2 text-center text-[14px] leading-6 text-[#D8E3F3]">{badge.requirement}</Text>

            <View className="mt-5 flex-row items-center gap-2 rounded-2xl border border-[#FBBF2473] bg-[#FBBF242E] px-5 py-3">
              <Ionicons name="flash" size={18} color="#FBBF24" />
              <Text className="font-black text-[#FDE68A]">Recompensa: {badge.xp}</Text>
            </View>

            {remainingCount > 0 ? (
              <Text className="mt-3 text-center text-[12px] text-[#AFC2DB]">
                Tienes {remainingCount} {remainingCount === 1 ? 'logro más' : 'logros más'} esperando.
              </Text>
            ) : null}

            <Pressable
              accessibilityLabel={remainingCount > 0 ? 'Ver siguiente logro' : 'Cerrar logro'}
              accessibilityRole="button"
              hitSlop={6}
              onPress={onClose}
              className="mt-6 w-full items-center justify-center rounded-2xl bg-[#7C5CFF] px-5 py-4"
              style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}
            >
              <Text className="text-[15px] font-black text-white">
                {remainingCount > 0 ? 'Ver siguiente logro' : 'Genial'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}
