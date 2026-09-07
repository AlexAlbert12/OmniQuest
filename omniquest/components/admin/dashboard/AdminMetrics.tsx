import React from 'react'
import { Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'
import type { AdminData, IconName } from '../types/admin'
import { AdminMetric } from '../shared/AdminPrimitives'

export function AdminMetrics({ data }: { data: AdminData }) {
  const { tokens } = useAppTheme()
  const responsive = useResponsiveLayout()
  const metrics = [
    { icon: 'school' as IconName, label: 'Profesores', value: String(data.metrics.teachersCount), color: tokens.brand.admin },
    { icon: 'people' as IconName, label: 'Alumnos', value: String(data.metrics.studentsCount), color: tokens.semantic.success },
    { icon: 'book' as IconName, label: 'Cursos', value: String(data.metrics.subjectsCount), color: tokens.semantic.info },
    { icon: 'albums' as IconName, label: 'Clases', value: String(data.metrics.classroomsCount), color: tokens.semantic.warning },
    { icon: 'person-add' as IconName, label: 'Inscripciones', value: String(data.metrics.enrollmentsCount), color: tokens.brand.admin },
  ]

  if (!responsive.isDesktop) {
    return (
      <View className="rounded-2xl border border-border-default bg-surface-default p-4">
        <Text className="text-[19px] font-black text-text-primary">Resumen</Text>
        <Text className="mt-1 text-[12px] font-semibold text-text-muted">Estado general de la plataforma.</Text>
        <View className="mt-4 flex-row" style={{ gap: 8 }}>
          {metrics.slice(0, 4).map((metric) => <View key={metric.label} style={{ flex: 1, minWidth: 0 }}><AdminMetric {...metric} dense style={{ width: '100%' }} /></View>)}
        </View>
      </View>
    )
  }

  return <View className="flex-row flex-wrap gap-4">{metrics.map((metric) => <AdminMetric key={metric.label} {...metric} />)}</View>
}
