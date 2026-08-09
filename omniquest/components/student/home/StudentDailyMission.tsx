import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

export default function StudentDailyMission({
  count,
  target,
  streakDays,
  onStart,
}: {
  count: number
  target: number
  streakDays: number
  onStart: () => void
}) {
  const { tokens } = useAppTheme()
  const completed = count >= target
  const progress = Math.min(100, Math.round((count / Math.max(target, 1)) * 100))
  const remaining = Math.max(0, target - count)
  const color = completed ? tokens.semantic.success : tokens.gamification.streak

  return (
    <View className="overflow-hidden rounded-[24px] border border-border-default bg-surface-default p-5">
      <View
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          right: -46,
          bottom: -56,
          width: 150,
          height: 150,
          borderRadius: 999,
          backgroundColor: withAlpha(color, '20'),
        }}
      />
      <View className="relative flex-row flex-wrap items-center gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(color, '26') }}>
          <Ionicons name={completed ? 'checkmark-done' : 'flag'} size={28} color={color} />
        </View>
        <View className="min-w-[200px] flex-1">
          <Text className="text-[12px] font-black uppercase tracking-[1.2px]" style={{ color }}>Reto diario</Text>
          <Text maxFontSizeMultiplier={2} className="mt-1 text-[20px] font-black text-white">
            {completed ? '¡Misión completada!' : `Responde ${remaining} ${remaining === 1 ? 'pregunta' : 'preguntas'} más`}
          </Text>
          <Text maxFontSizeMultiplier={2} className="mt-1 text-[13px] leading-5 text-text-secondary">
            {completed ? `Has superado el objetivo de ${target} preguntas de hoy.` : `Llevas ${count} de ${target}. Racha actual: ${streakDays} día${streakDays === 1 ? '' : 's'}.`}
          </Text>
          <View className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-interactive">
            <View className="h-full rounded-full" style={{ width: `${Math.max(count > 0 ? 4 : 0, progress)}%`, backgroundColor: color }} />
          </View>
        </View>
        <AppButton
          label={completed ? 'Seguir practicando' : 'Empezar reto'}
          icon={completed ? 'sparkles' : 'play'}
          variant={completed ? 'secondary' : 'primary'}
          role="student"
          onPress={onStart}
        />
      </View>
    </View>
  )
}
