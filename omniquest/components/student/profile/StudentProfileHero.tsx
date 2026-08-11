import React from 'react'
import { Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import GamifiedAvatar from '../../gamification/GamifiedAvatar'
import type { ProfileCosmetics } from '../../../lib/avatarCosmetics'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

type Props = {
  alias: string
  avatar: string | null | undefined
  level: number
  points: number
  nextLevelProgress: number
  cosmetics: ProfileCosmetics
  onCustomize: () => void
}

export default function StudentProfileHero({ alias, avatar, level, points, nextLevelProgress, cosmetics, onCustomize }: Props) {
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const isMobile = width < 640
  const isDesktop = width >= 1024
  const remaining = Math.max(0, 100 - nextLevelProgress)
  const heroText = tokens.text.primary
  const heroSecondaryText = tokens.text.secondary
  const progressWidth: `${number}%` = `${Math.max(nextLevelProgress, nextLevelProgress > 0 ? 8 : 0)}%`
  const gradientColors = [tokens.surface.raised, tokens.surface.default, tokens.background.secondary] as const
  const gradientLocations = [0, 0.58, 1] as const

  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: tokens.border.default }}
    >
      <View style={{ minHeight: isMobile ? 218 : 210, padding: isMobile ? 18 : 24 }}>
        <View className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: tokens.brand.student }} />
        <View className="absolute -right-12 -top-20 h-56 w-56 rounded-full" style={{ backgroundColor: withAlpha(tokens.brand.student, '10') }} />
        <View className="absolute -bottom-20 right-32 h-40 w-40 rounded-full" style={{ backgroundColor: withAlpha(tokens.gamification.xp, '0A') }} />

        <View className="flex-row flex-wrap items-center justify-between" style={{ gap: isMobile ? 16 : 24 }}>
          <View className="min-w-0 flex-1 flex-row items-center" style={{ gap: isMobile ? 16 : 20 }}>
            <GamifiedAvatar alias={alias} avatarUrl={avatar} cosmetics={cosmetics} editable level={level} onPress={onCustomize} showLevel={false} size={isMobile ? 94 : 104} />

            <View className="min-w-[150px] flex-1">
              <Text className={`${isMobile ? 'text-[26px] leading-[32px]' : 'text-[30px] leading-[38px]'} font-black`} style={{ color: heroText }} maxFontSizeMultiplier={2}>
                {alias || 'Alumno'}
              </Text>
              <View
                className="mt-2 self-start flex-row items-center gap-2 rounded-full border px-3 py-2"
                style={{ backgroundColor: withAlpha(tokens.brand.student, '14'), borderColor: withAlpha(tokens.brand.student, '66') }}
              >
                <Ionicons name="star" size={16} color={tokens.gamification.xp} />
                <Text className="text-[14px] font-black" style={{ color: heroText }}>Nivel {level}</Text>
              </View>
            </View>
          </View>

          {isDesktop ? (
            <View
              className="min-w-[190px] rounded-2xl border px-5 py-4"
              style={{ backgroundColor: withAlpha(tokens.background.primary, 'B8'), borderColor: tokens.border.default }}
            >
              <Text className="text-[11px] font-black uppercase tracking-[0.8px]" style={{ color: tokens.text.muted }}>XP global</Text>
              <View className="mt-2 flex-row items-center gap-2">
                <Ionicons name="flash" size={21} color={tokens.gamification.xp} />
                <Text className="text-[25px] font-black" style={{ color: heroText }}>{points.toLocaleString('es-ES')}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: isMobile ? 18 : 22 }}>
          <View className="mb-2 flex-row items-center justify-between gap-3">
            <Text className="text-[11px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Progreso</Text>
            <Text className="text-[12px] font-black" style={{ color: tokens.brand.student }}>{nextLevelProgress}%</Text>
          </View>
          <View className="h-3 overflow-hidden rounded-full border" style={{ backgroundColor: tokens.surface.interactive, borderColor: tokens.border.subtle }}>
            <LinearGradient
              colors={[tokens.gamification.xp, tokens.brand.student]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: progressWidth, height: '100%', borderRadius: 999 }}
            />
          </View>
          <View className="mt-2.5 flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-[13px]" style={{ color: heroSecondaryText }}>{remaining} XP para el nivel {level + 1}</Text>
            <Text className="text-[13px] font-black" style={{ color: isDesktop ? heroText : tokens.gamification.xp }}>
              {isDesktop ? `Nivel ${level + 1}` : `${points.toLocaleString('es-ES')} XP`}
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  )
}
