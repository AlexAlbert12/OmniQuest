import React from 'react'
import { Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'

export default function ProgressOverview({ progressPercent, accuracyPercent, answeredQuestions, failedQuestions, weeklyAttemptsCount, streakDays }: {
  progressPercent: number
  answeredQuestions: number
  accuracyPercent: number
  failedQuestions: number
  weeklyAttemptsCount: number
  streakDays: number
}) {
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const isMobileGrid = width < 640
  const metrics = [
    { icon: 'analytics' as const, label: 'Progreso', value: `${progressPercent}%`, detail: 'Contenido respondido', color: tokens.brand.student },
    { icon: 'checkmark-circle' as const, label: 'Precisión global', value: answeredQuestions > 0 ? `${accuracyPercent}%` : '\u2014', detail: answeredQuestions > 0 ? `${weeklyAttemptsCount} ${weeklyAttemptsCount === 1 ? 'intento' : 'intentos'} esta semana` : 'Sin datos todavía', color: tokens.semantic.success },
    { icon: 'refresh-circle' as const, label: 'Para practicar', value: String(failedQuestions), detail: failedQuestions ? 'Oportunidades de mejora' : 'Todo al día', color: tokens.semantic.warning },
    { icon: 'flame' as const, label: 'Racha', value: `${streakDays} ${streakDays === 1 ? 'día' : 'días'}`, detail: streakDays ? 'Mantén el ritmo' : 'Empieza hoy', color: tokens.gamification.streak },
  ]

  return (
    <View className="mt-5 flex-row flex-wrap gap-3">
      {metrics.map((metric) => (
        <View
          key={metric.label}
          className={`rounded-2xl border border-border-default bg-surface-default ${isMobileGrid ? 'p-3' : 'p-4'}`}
          style={isMobileGrid ? { width: '48%', minWidth: 0, flexGrow: 1 } : { minWidth: 210, flexGrow: 1, flexBasis: 0 }}
        >
          <View className="flex-row items-center gap-3">
            <View className={`${isMobileGrid ? 'h-9 w-9' : 'h-10 w-10'} items-center justify-center rounded-xl`} style={{ backgroundColor: `${metric.color}20` }}>
              <Ionicons name={metric.icon} size={isMobileGrid ? 18 : 20} color={metric.color} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className={`${isMobileGrid ? 'text-[10px]' : 'text-[12px]'} font-black uppercase tracking-[0.05em] text-text-muted`} numberOfLines={2}>{metric.label}</Text>
              <Text className={`${isMobileGrid ? 'mt-0.5 text-[23px]' : 'mt-1 text-[26px]'} font-black text-text-primary`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{metric.value}</Text>
            </View>
          </View>
          <Text className={`${isMobileGrid ? 'mt-2 text-[11px]' : 'mt-3 text-[13px]'} text-text-secondary`} numberOfLines={2}>{metric.detail}</Text>
        </View>
      ))}
    </View>
  )
}
