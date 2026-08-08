import React from 'react'
import { Text, View } from 'react-native'
import { AppIconButton } from '../../ui'
import { LivesBadge } from './GameHud'

export default function GameHeader({
  current,
  total,
  progressPercentage,
  score,
  lives,
  isDesktop,
  onExit,
}: {
  current: number
  total: number
  progressPercentage: number
  score: number
  lives: number
  isDesktop: boolean
  onExit: () => void
}) {
  return (
    <View className="flex-row items-center gap-3">
      <AppIconButton
        accessibilityLabel="Salir de la partida"
        accessibilityHint="Abre una confirmación antes de abandonar la partida"
        icon="close"
        role="student"
        variant="secondary"
        onPress={onExit}
      />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between gap-3">
          <Text className={`${isDesktop ? 'text-[18px]' : 'text-[16px]'} font-black text-text-primary`}>
            Pregunta {current} de {total}
          </Text>
          <View className="flex-row items-center gap-2">
            {isDesktop ? (
              <View className="rounded-xl border border-border-default bg-surface-default px-3 py-2">
                <Text className="text-[13px] font-black text-brand-student">{score} XP</Text>
              </View>
            ) : null}
            <LivesBadge lives={lives} />
          </View>
        </View>
        <View
          className="mt-3 h-3 overflow-hidden rounded-full bg-surface-interactive"
          accessibilityRole="progressbar"
          accessibilityLabel="Progreso de la partida"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progressPercentage) }}
        >
          <View className="h-full rounded-full bg-brand-student" style={{ width: `${progressPercentage}%` }} />
        </View>
      </View>
    </View>
  )
}
