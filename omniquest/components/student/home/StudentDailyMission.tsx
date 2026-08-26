import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

export default function StudentDailyMission({
  count,
  target,
  streakDays,
  compact = false,
  onPress,
}: {
  count: number
  target: number
  streakDays: number
  compact?: boolean
  onPress: () => void
}) {
  const { tokens } = useAppTheme()
  const completed = count >= target
  const progress = Math.min(100, Math.round((count / Math.max(target, 1)) * 100))
  const remaining = Math.max(0, target - count)
  const color = completed ? tokens.semantic.success : tokens.gamification.streak

  return (
    <AppPressable
      testID="student-daily-mission"
      accessibilityLabel={completed ? 'Misión diaria completada. Seguir practicando' : `Reto diario. Responde ${remaining} preguntas más`}
      accessibilityHint="Abre el curso recomendado para practicar"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: compact ? 108 : 148,
        padding: compact ? 14 : 20,
        borderRadius: compact ? 20 : 24,
        borderWidth: 1,
        borderColor: withAlpha(color, compact ? '58' : '42'),
        backgroundColor: tokens.surface.default,
        overflow: 'hidden',
        justifyContent: 'center',
        opacity: pressed ? 0.84 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
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
      <View className={`relative flex-row items-center ${compact ? 'gap-3' : 'gap-4'}`}>
        <View className={`${compact ? 'h-11 w-11 rounded-xl' : 'h-14 w-14 rounded-2xl'} items-center justify-center`} style={{ backgroundColor: withAlpha(color, '26') }}>
          <Ionicons name={completed ? 'checkmark-done' : 'flag'} size={compact ? 23 : 28} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className={`${compact ? 'text-[10px]' : 'text-[12px]'} font-black uppercase tracking-[1.2px]`} style={{ color }}>Reto diario</Text>
          <Text maxFontSizeMultiplier={2} className={`mt-1 font-black text-white ${compact ? 'text-[17px] leading-5' : 'text-[20px]'}`}>
            {completed ? '¡Misión completada!' : `Responde ${remaining} ${remaining === 1 ? 'pregunta' : 'preguntas'} más`}
          </Text>
          <Text maxFontSizeMultiplier={2} className={`mt-1 text-text-secondary ${compact ? 'text-[11px] leading-4' : 'text-[13px] leading-5'}`}>
            {completed ? `Has superado el objetivo de ${target} preguntas de hoy.` : `Llevas ${count} de ${target}. Racha actual: ${streakDays} día${streakDays === 1 ? '' : 's'}.`}
          </Text>
          <View className={`${compact ? 'mt-2 h-1.5' : 'mt-4 h-2.5'} overflow-hidden rounded-full bg-surface-interactive`}>
            <View className="h-full rounded-full" style={{ width: `${Math.max(count > 0 ? 4 : 0, progress)}%`, backgroundColor: color }} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={compact ? 18 : 21} color={color} />
      </View>
    </AppPressable>
  )
}
