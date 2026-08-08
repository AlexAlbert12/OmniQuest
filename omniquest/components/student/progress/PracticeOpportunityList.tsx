import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppButton } from '../../ui'
import StudentDashboardCard from '../StudentDashboardCard'
import StudentEmptyState from '../StudentEmptyState'
import type { PracticeOpportunity } from '../../../hooks/student/useStudentProgress'

export default function PracticeOpportunityList({ opportunities, primaryRecommendationShown = false, onPractice, onSeeAll }: {
  opportunities: PracticeOpportunity[]
  primaryRecommendationShown?: boolean
  onPractice: (opportunity: PracticeOpportunity) => void
  onSeeAll: () => void
}) {
  const hasDetectedPatterns = opportunities.some((item) => item.id.startsWith('type-'))

  return (
    <StudentDashboardCard title="Oportunidades de práctica" actionLabel="Revisar historial" onAction={onSeeAll}>
      {opportunities.length === 0 ? (
        <StudentEmptyState
          icon="checkmark-circle"
          title={primaryRecommendationShown ? 'No hay más oportunidades prioritarias' : 'No hay fallos recientes'}
          message={primaryRecommendationShown ? 'Tu recomendación principal ya está destacada arriba. Sigue jugando para detectar nuevos patrones.' : 'Sigue jugando para mantener tu precisión y detectar nuevas recomendaciones.'}
        />
      ) : (
        <View className="gap-3">
          {hasDetectedPatterns ? <Text className="text-[12px] leading-5 text-text-muted">Los patrones detectados resumen los formatos donde se concentran tus fallos recientes.</Text> : null}
          {opportunities.map((item) => {
            const isDetectedPattern = item.id.startsWith('type-')
            return (
              <View key={item.id} className="rounded-2xl border border-border-default bg-surface-raised p-4">
                <View className="flex-row items-start gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${item.color}20` }}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[11px] font-black uppercase tracking-[0.05em] text-text-muted">{item.badge}</Text>
                    <Text className="mt-1 text-[17px] font-black text-text-primary">{item.title}</Text>
                    <Text className="mt-1 text-[13px] leading-5 text-text-secondary">{item.detail}</Text>
                  </View>
                </View>

                <View className="mt-3 border-t border-border-subtle pt-3">
                  {isDetectedPattern ? (
                    <>
                      <Text className="text-[13px] font-bold text-text-primary">{item.evidence}</Text>
                      <Text className="mt-1 text-[12px] font-bold text-semantic-info">{item.improvementPotential}</Text>
                    </>
                  ) : (
                    <>
                      <Text className="text-[13px] font-bold text-text-primary">{item.reason}</Text>
                      <Text className="mt-1 text-[12px] leading-5 text-text-secondary">{item.evidence}</Text>
                      <Text className="mt-1 text-[12px] font-bold text-semantic-info">{item.improvementPotential}</Text>
                    </>
                  )}
                </View>

                <View className="mt-3 flex-row flex-wrap items-center justify-between gap-3">
                  <Text className="text-[13px] font-black text-gamification-xp">+{item.rewardXp} XP posibles</Text>
                  <AppButton size="sm" role="student" label={item.actionLabel} icon={item.subjectId ? 'play' : 'time-outline'} onPress={() => onPractice(item)} />
                </View>
              </View>
            )
          })}
        </View>
      )}
    </StudentDashboardCard>
  )
}
