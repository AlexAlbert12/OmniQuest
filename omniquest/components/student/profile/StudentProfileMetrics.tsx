import React from 'react'
import { View } from 'react-native'
import StudentMetricCard from '../StudentMetricCard'
import { useAppTheme } from '../../../lib/appTheme'
import { formatCount } from '../../../lib/formatCount'
import { useResponsiveLayout } from '../../../lib/responsive'

type Props = {
  level: number
  points: number
  streakDays: number
  achievements: number
  achievementsTotal: number
  onOpenProgress: () => void
  onOpenAchievements: () => void
}

export default function StudentProfileMetrics({
  level,
  points,
  streakDays,
  achievements,
  achievementsTotal,
  onOpenProgress,
  onOpenAchievements,
}: Props) {
  const { tokens } = useAppTheme()
  const responsive = useResponsiveLayout()
  const dense = responsive.isMobile
  const metricStyle = { minWidth: 0 }

  return (
    <View className={`flex-row ${dense ? 'gap-2' : 'gap-3'}`}>
      <StudentMetricCard title="Nivel" value={String(level)} icon="star" color={tokens.brand.student} compact={!dense} dense={dense} className="min-w-0" style={metricStyle} />
      <StudentMetricCard title="XP" value={points.toLocaleString('es-ES')} icon="flash" color={tokens.gamification.xp} compact={!dense} dense={dense} onPress={onOpenProgress} className="min-w-0" style={metricStyle} />
      <StudentMetricCard title="Racha" value={formatCount(streakDays, 'd', 'd')} icon="flame" color={tokens.gamification.streak} compact={!dense} dense={dense} className="min-w-0" style={metricStyle} />
      <StudentMetricCard title="Logros" value={`${achievements}/${achievementsTotal}`} icon="ribbon" color={tokens.semantic.success} compact={!dense} dense={dense} onPress={onOpenAchievements} className="min-w-0" style={metricStyle} />
    </View>
  )
}
