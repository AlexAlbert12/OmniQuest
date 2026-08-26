import React from 'react'
import { View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'
import MobileMetricCard from '../../ui/mobile/MobileMetricCard'

export default function ProgressOverview({ progressPercent, accuracyPercent, answeredQuestions, failedQuestions, streakDays }: {
  progressPercent: number
  answeredQuestions: number
  accuracyPercent: number
  failedQuestions: number
  streakDays: number
}) {
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const dense = responsive.isMobile
  const metrics = [
    { icon: 'analytics' as const, label: 'Progreso', value: `${progressPercent}%`, color: tokens.brand.student },
    { icon: 'checkmark-circle' as const, label: 'Precisión global', value: answeredQuestions > 0 ? `${accuracyPercent}%` : '\u2014', color: tokens.semantic.success },
    { icon: 'refresh-circle' as const, label: 'Para practicar', value: String(failedQuestions), color: tokens.semantic.warning },
    { icon: 'flame' as const, label: 'Racha', value: `${streakDays} ${streakDays === 1 ? 'día' : 'días'}`, color: tokens.gamification.streak },
  ]

  return (
    <View className={`mt-5 flex-row ${dense ? 'gap-2' : 'gap-3'}`}>
      {metrics.map((metric) => (
        <MobileMetricCard
          key={metric.label}
          accessibilityLabel={`${metric.label}: ${metric.value}`}
          className="min-w-0 flex-1"
          color={metric.color}
          compact={!dense}
          dense={dense}
          icon={metric.icon}
          label={metric.label}
          style={dense ? { aspectRatio: 1 } : { minHeight: 118 }}
          value={metric.value}
        />
      ))}
    </View>
  )
}
