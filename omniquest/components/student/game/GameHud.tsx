import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export function TimerPill({ timeLeft }: { timeLeft: number }) {
  const isLow = timeLeft <= 5
  const color = isLow ? '#FB7185' : '#8B5CF6'

  return (
    <View className="items-center justify-center">
      <View
        className="h-[92px] w-[92px] items-center justify-center rounded-full border-[8px] bg-[#070F26]"
        style={{ borderColor: color, shadowColor: color, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}
      >
        <Ionicons name="timer-outline" size={18} color={color} />
        <Text className={`mt-1 text-[22px] font-black ${isLow ? 'text-[#FDA4AF]' : 'text-white'}`}>
          00:{timeLeft.toString().padStart(2, '0')}
        </Text>
      </View>
    </View>
  )
}

export function LivesBadge({ lives }: { lives: number }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-[#223A62] bg-[#08172E] px-3 py-2">
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
  lives,
}: {
  points: number
  streak: number
  position: string
  category: string
  lives: number
}) {
  const hasStreakBonus = streak >= 3

  return (
    <View className="mt-5 flex-row flex-wrap items-center justify-center gap-2">
      <GameStatPill icon="flash" color="#FBBF24" label={`${points} XP`} highlighted />
      <GameStatPill icon="flame" color="#FF7B45" label={hasStreakBonus ? `Racha ${streak}` : `Racha ${streak}`} />
      <GameStatPill icon="podium-outline" color="#9B6CFF" label={`Posición ${position}`} />
      <GameStatPill icon="heart" color="#FF647C" label={`${lives} vidas`} />
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
      className="flex-row items-center gap-2 rounded-xl border px-3 py-2"
      style={{
        backgroundColor: highlighted ? `${color}18` : '#08172E',
        borderColor: highlighted ? `${color}66` : '#173055',
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
}: {
  onHint: () => void
  onSkip: () => void
}) {
  return (
    <View className="mt-5 flex-row gap-3 rounded-[22px] border border-[#173055] bg-[#08172E]/92 p-3">
      <HudAction icon="bulb" title="Pista" detail="-10 pts" color="#FBBF24" onPress={onHint} />
      <HudAction icon="play-skip-forward" title="Saltar" detail="-20 pts" color="#A78BFA" onPress={onSkip} />
    </View>
  )
}

function HudAction({
  icon,
  title,
  detail,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  detail: string
  color: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-[#1A3155] bg-[#0D1D3B] px-3 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
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
