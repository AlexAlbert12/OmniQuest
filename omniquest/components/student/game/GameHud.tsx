import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { withAlpha } from '../../../lib/color'
import { createShadowStyle } from '../../../lib/platformShadow'

export function TimerPill({ timeLeft, compact = false }: { timeLeft: number; compact?: boolean }) {
  const isLow = timeLeft <= 5
  const color = isLow ? '#FB7185' : '#8B5CF6'

  return (
    <View className="items-center justify-center">
      <View
        className="items-center justify-center rounded-full bg-background-primary"
        style={{
          borderColor: color,
          width: compact ? 82 : 92,
          height: compact ? 82 : 92,
          borderWidth: compact ? 7 : 8,
          ...createShadowStyle({
            color,
            opacity: 0.3,
            radius: 18,
            offsetY: 8,
            web: `0 8px 36px ${withAlpha(color, '4D')}`,
          }),
        }}
      >
        <Ionicons name="timer-outline" size={compact ? 16 : 18} color={color} />
        <Text className={`${compact ? 'mt-0.5 text-[20px]' : 'mt-1 text-[22px]'} font-black ${isLow ? 'text-semantic-danger' : 'text-white'}`}>
          00:{timeLeft.toString().padStart(2, '0')}
        </Text>
      </View>
    </View>
  )
}

export function LivesBadge({ lives }: { lives: number }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-border-default bg-surface-default px-3 py-2">
      {[...Array(3)].map((_, index) => (
        <Ionicons
          key={index}
          name={index < lives ? 'heart' : 'heart-outline'}
          size={17}
          color={index < lives ? '#FF647C' : '#52627E'}
        />
      ))}
    </View>
  )
}

export function GameStatsBar({
  points,
  streak,
  position,
  category,
}: {
  points: number
  streak: number
  position: string
  category: string
}) {
  const hasStreakBonus = streak >= 3

  return (
    <View className="mt-5 flex-row flex-wrap items-center justify-center gap-2">
      <GameStatPill icon="flash" color="#FBBF24" label={`${points} XP posibles`} highlighted />
      <GameStatPill icon="flame" color="#FF7B45" label={hasStreakBonus ? `Racha ${streak}` : `Racha ${streak}`} />
      <GameStatPill icon="podium-outline" color="#9B6CFF" label={`Posición ${position}`} />
      <GameStatPill icon="albums-outline" color="#60A5FA" label={category} />
    </View>
  )
}

function GameStatPill({
  icon,
  color,
  highlighted = false,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  highlighted?: boolean
  label: string
}) {
  return (
    <View
      className="flex-row items-center gap-2 rounded-xl px-3 py-2"
      style={{
        backgroundColor: highlighted ? `${color}18` : '#08172E',
        borderColor: highlighted ? `${color}66` : '#173055',
        borderWidth: 1,
      }}
    >
      <Ionicons name={icon} size={17} color={color} />
      <Text className="text-[12px] font-black text-white" numberOfLines={1}>{label}</Text>
    </View>
  )
}

export function BottomHud({
  onHint,
  onSkip,
  showHint = false,
}: {
  onHint: () => void
  onSkip: () => void
  showHint?: boolean
}) {
  return (
    <View className="mt-4 flex-row gap-3">
      {showHint ? <HudAction icon="bulb" title="Pista" detail="-10 XP" color="#FBBF24" emphasized onPress={onHint} /> : null}
      <HudAction icon="play-skip-forward" title="Saltar" detail="-20 XP" color="#A78BFA" onPress={onSkip} />
    </View>
  )
}

function HudAction({
  icon,
  title,
  detail,
  color,
  onPress,
  emphasized = false,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  detail: string
  color: string
  onPress: () => void
  emphasized?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl px-3 py-3"
      style={({ pressed }) => ({
        borderColor: withAlpha(color, emphasized ? 'F0' : 'A6'),
        borderWidth: emphasized ? 2 : 1.5,
        backgroundColor: withAlpha(color, emphasized ? '18' : '0D'),
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${color}20` }}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <View>
        <Text className="text-[14px] font-black text-white">{title}</Text>
        <Text className="mt-0.5 text-[12px] font-black" style={{ color }}>{detail}</Text>
      </View>
    </Pressable>
  )
}
