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
  const { theme, tokens } = useAppTheme()
  const isMobile = width < 640
  const isDesktop = width >= 1024
  const remaining = Math.max(0, 100 - nextLevelProgress)
  const heroText = theme === 'dark' ? tokens.text.inverse : tokens.text.primary
  const progressWidth: `${number}%` = `${Math.max(nextLevelProgress, nextLevelProgress > 0 ? 8 : 0)}%`
  const gradientColors = [tokens.brand.student, tokens.brand.student, tokens.background.primary] as const
  const gradientLocations = isMobile ? [0, 0.9, 0.98, 1] as const : [0, 0.68, 0.86, 1] as const

  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientLocations}
      start={isMobile ? { x: 0, y: 0 } : { x: 0, y: 0.25 }}
      end={isMobile ? { x: 0, y: 1 } : { x: 1, y: 0.6 }}
      style={{ borderRadius: 30, overflow: 'hidden' }}
    >
      <View style={{ minHeight: 198, padding: 20 }}>
        <View className="absolute -right-8 top-4 h-24 w-44 rounded-full" style={{ backgroundColor: withAlpha(heroText, '0D') }} />
        <View style={{ maxWidth: isDesktop ? 600 : undefined }}>
          <View className="flex-row flex-wrap items-center" style={{ gap: isMobile ? 16 : 20 }}>
            <GamifiedAvatar alias={alias} avatarUrl={avatar} cosmetics={cosmetics} editable level={level} onPress={onCustomize} showLevel={false} size={isMobile ? 100 : 104} />

            <View className="min-w-[190px] flex-1">
              <Text className={`${isMobile ? 'text-[26px] leading-[32px]' : 'text-[29px] leading-[36px]'} font-black`} style={{ color: heroText }} maxFontSizeMultiplier={2}>
                {alias}
              </Text>
              <View className="mt-2 self-start flex-row items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: withAlpha(heroText, '16') }}>
                <Ionicons name="star" size={16} color={tokens.gamification.xp} />
                <Text className="text-[14px] font-black" style={{ color: heroText }}>Nivel {level}</Text>
              </View>
            </View>
          </View>

          <View style={{ marginTop: isMobile ? 16 : 18 }}>
            <View className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: withAlpha(heroText, '20') }}>
              <View className="h-full rounded-full" style={{ width: progressWidth, backgroundColor: tokens.gamification.xp }} />
            </View>
            <View className="flex-row flex-wrap items-center justify-between gap-2" style={{ marginTop: isMobile ? 9 : 10 }}>
              <Text className="text-[13px]" style={{ color: withAlpha(heroText, 'D8') }}>{remaining} XP para el nivel {level + 1}</Text>
              <Text className="text-[13px] font-black" style={{ color: heroText }}>{points.toLocaleString('es-ES')} XP</Text>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  )
}
