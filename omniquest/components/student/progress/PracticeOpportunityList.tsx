import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppButton } from '../../ui'
import StudentDashboardCard from '../StudentDashboardCard'
import StudentEmptyState from '../StudentEmptyState'
import type { PracticeOpportunity } from '../../../hooks/student/useStudentProgress'

export default function PracticeOpportunityList({ opportunities, onPractice, onSeeAll }: {
  opportunities: PracticeOpportunity[]
  onPractice: (opportunity: PracticeOpportunity) => void
  onSeeAll: () => void
}) {
  return (
    <StudentDashboardCard title="Oportunidades de práctica" actionLabel="Ver historial" onAction={onSeeAll}>
      {opportunities.length === 0 ? (
        <StudentEmptyState icon="checkmark-circle" title="No hay fallos recientes" message="Sigue jugando para mantener tu precisión y detectar nuevas recomendaciones." />
      ) : (
        <View className="gap-3">
          {opportunities.map((item) => (
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
              <View className="mt-3 rounded-xl border border-border-subtle bg-background-primary p-3">
                <Text className="text-[13px] font-bold text-text-primary">{item.reason}</Text>
                <Text className="mt-1 text-[12px] leading-5 text-text-secondary">{item.evidence}</Text>
                <Text className="mt-1 text-[12px] font-bold text-semantic-info">{item.improvementPotential}</Text>
              </View>
              <View className="mt-3 flex-row flex-wrap items-center justify-between gap-3">
                <Text className="text-[13px] font-black text-gamification-xp">+{item.rewardXp} XP posibles</Text>
                <AppButton size="sm" role="student" label={item.actionLabel} icon="play" onPress={() => onPractice(item)} />
              </View>
            </View>
          ))}
        </View>
      )}
    </StudentDashboardCard>
  )
}
