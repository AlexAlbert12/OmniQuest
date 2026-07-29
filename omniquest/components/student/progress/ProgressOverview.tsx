import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'

export default function ProgressOverview({ progressPercent, accuracyPercent, failedQuestions, weeklyAttemptsCount, streakDays }: {
  progressPercent: number
  accuracyPercent: number
  failedQuestions: number
  weeklyAttemptsCount: number
  streakDays: number
}) {
  const { tokens } = useAppTheme()
  const metrics = [
    { icon: 'analytics' as const, label: 'Progreso', value: `${progressPercent}%`, detail: 'Contenido respondido', color: tokens.brand.student },
    { icon: 'checkmark-circle' as const, label: 'Precisión', value: `${accuracyPercent}%`, detail: `${weeklyAttemptsCount} intentos esta semana`, color: tokens.semantic.success },
    { icon: 'refresh-circle' as const, label: 'Para practicar', value: String(failedQuestions), detail: failedQuestions ? 'Oportunidades de mejora' : 'Todo al día', color: tokens.semantic.warning },
    { icon: 'flame' as const, label: 'Racha', value: `${streakDays} días`, detail: streakDays ? 'Mantén el ritmo' : 'Empieza hoy', color: tokens.gamification.streak },
  ]
  return (
    <View className="mt-5 flex-row flex-wrap gap-3">
      {metrics.map((metric) => (
        <View key={metric.label} className="min-w-[210px] flex-1 rounded-2xl border border-border-default bg-surface-default p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${metric.color}20` }}>
              <Ionicons name={metric.icon} size={20} color={metric.color} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[12px] font-black uppercase tracking-[0.05em] text-text-muted">{metric.label}</Text>
              <Text className="mt-1 text-[26px] font-black text-text-primary">{metric.value}</Text>
            </View>
          </View>
          <Text className="mt-3 text-[13px] text-text-secondary">{metric.detail}</Text>
        </View>
      ))}
    </View>
  )
}
