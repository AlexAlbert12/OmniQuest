import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import StudentPrimaryLearningCTA from '../StudentPrimaryLearningCTA'
import type { PracticeOpportunity } from '../../../hooks/student/useStudentProgress'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

export default function DailyPracticeRecommendation({
  recommendation,
  coursesCount,
  accentColor,
  onPractice,
  onBrowseCourses,
}: {
  recommendation: PracticeOpportunity | null
  coursesCount: number
  accentColor: string
  onPractice: (opportunity: PracticeOpportunity) => void
  onBrowseCourses: () => void
}) {
  const { tokens } = useAppTheme()

  return (
    <View>
      <StudentPrimaryLearningCTA
        icon={recommendation ? 'sparkles' : 'book'}
        title={recommendation ? `Practica ${recommendation.title}` : 'Continúa tu ruta de aprendizaje'}
        subtitle={recommendation?.reason || 'Entra en tus cursos y completa la siguiente actividad disponible.'}
        meta={recommendation ? `+${recommendation.rewardXp} XP posibles` : `${coursesCount} ${coursesCount === 1 ? 'curso activo' : 'cursos activos'}`}
        ctaLabel={recommendation ? recommendation.actionLabel : 'Ver cursos'}
        color={recommendation?.color || accentColor}
        stackActionOnMobile
        onPress={() => recommendation ? onPractice(recommendation) : onBrowseCourses()}
      />
      {recommendation ? (
        <View className="mt-3 rounded-2xl border border-border-default bg-surface-raised p-4">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(accentColor, '22') }}>
              <Ionicons name="bulb-outline" size={17} color={accentColor} />
            </View>
            <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-text-muted">Por qué se recomienda</Text>
          </View>

          <View className="mt-3 flex-row gap-2">
            <RecommendationSignal
              color={tokens.semantic.warning}
              icon="analytics-outline"
              label="Precisión"
              value={`${recommendation.accuracyPercent}%`}
            />
            <RecommendationSignal
              color={tokens.brand.student}
              icon="calendar-outline"
              label="Periodo"
              value="30 días"
            />
            <RecommendationSignal
              color={tokens.semantic.info}
              icon="repeat-outline"
              label="Intentos"
              value={String(recommendation.totalAttempts)}
            />
          </View>

          <View className="mt-3 flex-row flex-wrap gap-2">
            <View className="rounded-full bg-semantic-surface-info px-3 py-2">
              <Text className="text-[12px] font-bold text-semantic-info">{recommendation.improvementPotential}</Text>
            </View>
            <View className="rounded-full bg-semantic-surface-success px-3 py-2">
              <Text className="text-[12px] font-bold text-semantic-success">Recompensa: +{recommendation.rewardXp} XP</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}

function RecommendationSignal({
  color,
  icon,
  label,
  value,
}: {
  color: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  return (
    <View
      className="min-w-0 flex-1 rounded-xl border border-border-subtle p-2.5"
      style={{ backgroundColor: withAlpha(color, '12') }}
    >
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={14} color={color} />
        <Text className="min-w-0 flex-1 text-[9px] font-black uppercase tracking-[0.04em] text-text-muted" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text className="mt-2 text-[16px] font-black text-text-primary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76}>
        {value}
      </Text>
    </View>
  )
}
