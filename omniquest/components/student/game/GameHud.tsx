import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export function TimerPill({ timeLeft }: { timeLeft: number }) {
  const isLow = timeLeft <= 5

  return (
    <View
      className={`flex-row items-center rounded-2xl border px-5 py-3 ${
        isLow ? 'border-[#FB7185] bg-[#3A1129]' : 'border-[#6D5AF6] bg-[#0D1738]'
      }`}
    >
      <Ionicons name="timer-outline" size={22} color={isLow ? '#FB7185' : '#8B5CF6'} />
      <Text className={`ml-2 text-[22px] font-black ${isLow ? 'text-[#FDA4AF]' : 'text-white'}`}>
        00:{timeLeft.toString().padStart(2, '0')}
      </Text>
    </View>
  )
}

export function LivesBadge({ lives }: { lives: number }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-[#2A456A] bg-[#0D1D3B] px-3 py-2">
      {[...Array(3)].map((_, index) => (
        <Ionicons
          key={index}
          name={index < lives ? 'heart' : 'heart-outline'}
          size={18}
          color="#FF647C"
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
    <View className="mt-5 flex-row flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#172A4A] bg-[#07162E]/88 px-4 py-3">
      <GameStatPill icon="flash" color="#FBBF24" label={`${points} XP`} />
      <GameStatPill icon="flame" color="#FF7B45" label={hasStreakBonus ? `Racha ${streak} · bonus` : `Racha ${streak}`} />
      <GameStatPill icon="podium-outline" color="#9B6CFF" label={`Posición ${position}`} />
      <GameStatPill icon="heart" color="#FF647C" label={`${lives} vidas`} />
      <GameStatPill icon="albums-outline" color="#60A5FA" label={category} />
    </View>
  )
}

function GameStatPill({
  icon,
  color,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  label: string
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-[#1A3155] bg-[#0D1D3B] px-3 py-2">
      <Ionicons name={icon} size={17} color={color} />
      <Text className="text-[12px] font-bold text-white">{label}</Text>
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
    <View className="mt-6 rounded-3xl border border-[#172A4A] bg-[#08172E]/95 px-5 py-4">
      <View className="flex-row flex-wrap items-center justify-center gap-4">
        <HudAction icon="bulb" title="Pista" detail="-10 pts" color="#FBBF24" onPress={onHint} />

        <View className="min-w-[220px] flex-row items-center justify-center gap-3 rounded-2xl border border-[#10213E] bg-[#071426] px-5 py-4">
          <Ionicons name="checkmark-circle-outline" size={22} color="#43D991" />
          <Text className="text-center font-bold text-[#DDE7F4]">Comprueba desde la tarjeta de respuesta</Text>
        </View>

        <HudAction icon="chevron-forward" title="Saltar" detail="-20 pts" color="#A78BFA" onPress={onSkip} />
      </View>
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
      className="min-w-[150px] flex-row items-center justify-center gap-3 rounded-2xl border border-[#1A3155] bg-[#0D1D3B] px-5 py-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#10213E]">
        <Ionicons name={icon} size={23} color={color} />
      </View>
      <View>
        <Text className="text-[16px] font-black text-white">{title}</Text>
        <Text className="mt-1 text-[13px] font-bold" style={{ color }}>
          {detail}
        </Text>
      </View>
    </Pressable>
  )
}
