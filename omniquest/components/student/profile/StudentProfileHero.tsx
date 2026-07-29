import React from 'react'
import { Text, View } from 'react-native'
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

export default function StudentProfileHero({
  alias,
  avatar,
  level,
  points,
  nextLevelProgress,
  cosmetics,
  onCustomize,
}: Props) {
  const { tokens } = useAppTheme()
  const remaining = Math.max(0, 100 - nextLevelProgress)

  return (
    <LinearGradient
      colors={[tokens.brand.student, tokens.background.secondary, tokens.background.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, borderWidth: 1, borderColor: tokens.border.active, overflow: 'hidden' }}
    >
      <View className="min-h-[230px] p-6">
        <View className="absolute -right-8 top-5 h-28 w-48 rounded-full" style={{ backgroundColor: withAlpha(tokens.text.inverse, '10') }} />
        <View className="flex-row flex-wrap items-center gap-5">
          <GamifiedAvatar
            alias={alias}
            avatarUrl={avatar}
            cosmetics={cosmetics}
            editable
            level={level}
            onPress={onCustomize}
            size={116}
          />

          <View className="min-w-[220px] flex-1">
            <Text className="text-[30px] font-black leading-[38px]" style={{ color: tokens.text.inverse }} maxFontSizeMultiplier={2}>
              {alias}
            </Text>
            <Text className="mt-1 text-[14px] leading-5" style={{ color: withAlpha(tokens.text.inverse, 'CC') }}>
              Tu identidad de aprendizaje en OmniQuest
            </Text>
            <View className="mt-4 self-start flex-row items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: withAlpha(tokens.text.inverse, '18') }}>
              <Ionicons name="star" size={16} color={tokens.gamification.xp} />
              <Text className="text-[14px] font-black" style={{ color: tokens.text.inverse }}>Nivel {level}</Text>
            </View>
          </View>
        </View>

        <View className="mt-6">
          <View className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: withAlpha(tokens.text.inverse, '20') }}>
            <View
              className="h-full rounded-full"
              style={{ width: `${Math.max(nextLevelProgress, nextLevelProgress > 0 ? 8 : 0)}%`, backgroundColor: tokens.gamification.xp }}
            />
          </View>
          <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-[13px]" style={{ color: withAlpha(tokens.text.inverse, 'D8') }}>
              {remaining} XP para el nivel {level + 1}
            </Text>
            <Text className="text-[13px] font-black" style={{ color: tokens.text.inverse }}>
              {points.toLocaleString('es-ES')} XP
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  )
}
