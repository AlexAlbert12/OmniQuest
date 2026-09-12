import React from 'react'
import { View } from 'react-native'
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
    </View>
  )
}
