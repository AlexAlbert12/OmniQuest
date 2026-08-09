import React from 'react'
import { View } from 'react-native'
import StudentMetricCard from '../StudentMetricCard'
import { useAppTheme } from '../../../lib/appTheme'
import { formatCount } from '../../../lib/formatCount'

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
  return (
    <View className="flex-row flex-wrap gap-3">
      <StudentMetricCard title="Nivel" value={String(level)} icon="star" color={tokens.brand.student} className="min-h-[132px] min-w-[160px] flex-1" />
      <StudentMetricCard title="XP" value={points.toLocaleString('es-ES')} icon="flash" color={tokens.gamification.xp} onPress={onOpenProgress} className="min-h-[132px] min-w-[160px] flex-1" />
      <StudentMetricCard title="Racha" value={formatCount(streakDays, 'd', 'd')} icon="flame" color={tokens.gamification.streak} className="min-h-[132px] min-w-[160px] flex-1" />
      <StudentMetricCard title="Logros" value={`${achievements}/${achievementsTotal}`} icon="ribbon" color={tokens.semantic.success} onPress={onOpenAchievements} className="min-h-[132px] min-w-[160px] flex-1" />
    </View>
  )
}
