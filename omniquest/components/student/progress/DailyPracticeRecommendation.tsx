import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import StudentPrimaryLearningCTA from '../StudentPrimaryLearningCTA'
import type { PracticeOpportunity } from '../../../hooks/student/useStudentProgress'

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
  return (
    <View>
      <View className="mb-3 flex-row items-center gap-2">
        <Ionicons name="sparkles" size={20} color={accentColor} />
        <Text className="text-[18px] font-black text-text-primary">Tu recomendación de hoy</Text>
      </View>
      <StudentPrimaryLearningCTA
        icon={recommendation ? 'sparkles' : 'book'}
        title={recommendation ? `Practica ${recommendation.title}` : 'Continúa tu ruta de aprendizaje'}
        subtitle={recommendation?.reason || 'Entra en tus cursos y completa la siguiente actividad disponible.'}
        meta={recommendation ? `+${recommendation.rewardXp} XP posibles` : `${coursesCount} cursos activos`}
        ctaLabel={recommendation ? recommendation.actionLabel : 'Ver cursos'}
        color={recommendation?.color || accentColor}
        onPress={() => recommendation ? onPractice(recommendation) : onBrowseCourses()}
      />
      {recommendation ? (
        <View className="mt-3 rounded-2xl border border-border-default bg-surface-raised p-4">
          <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-text-muted">Por qué se recomienda</Text>
          <Text className="mt-2 text-[14px] font-bold leading-5 text-text-primary">{recommendation.evidence}</Text>
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
