import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import StudentDashboardCard from '../StudentDashboardCard'
import StudentEmptyState from '../StudentEmptyState'
import type { StudentLatestResult } from '../../../hooks/student/useStudentProgress'
import { useAppTheme } from '../../../lib/appTheme'

export default function LatestResults({ results, onSeeAll }: { results: StudentLatestResult[]; onSeeAll: () => void }) {
  const { tokens } = useAppTheme()
  return (
    <StudentDashboardCard title="Últimos resultados" actionLabel="Ver actividad" onAction={onSeeAll}>
      {results.length === 0 ? (
        <StudentEmptyState icon="time-outline" title="Sin resultados todavía" message="Completa una partida para ver tu evolución reciente." />
      ) : (
        <View className="gap-2">
          {results.slice(0, 5).map((result, index) => (
            <View key={`${result.label}-${result.meta}-${index}`} className="flex-row items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3">
              <Ionicons name="pulse" size={18} color={tokens.semantic.info} />
              <View className="min-w-0 flex-1">
                <Text className="font-black text-text-primary">{result.label}</Text>
                <Text className="mt-1 text-[12px] text-text-muted">{result.meta}</Text>
              </View>
              <Text className="text-[17px] font-black text-brand-student">{result.value} XP</Text>
            </View>
          ))}
        </View>
      )}
    </StudentDashboardCard>
  )
}
