import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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
      <View style={{ gap: 14 }}>
        <View className="rounded-[26px] border border-border-default bg-surface-default p-4">
          <View className="flex-row items-center justify-between"><View className="min-w-0 flex-1"><Text className="text-[19px] font-black text-text-primary">Resumen</Text><Text className="mt-1 text-[12px] font-semibold text-text-muted">Estado general de la plataforma.</Text></View><View className="rounded-full bg-surface-selected px-3 py-1"><Text className="text-[11px] font-black uppercase tracking-[0.6px] text-brand-admin">Admin</Text></View></View>
          <View className="mt-4 flex-row flex-wrap" style={{ gap: 12 }}>{metrics.slice(0, 4).map((metric) => <View key={metric.label} style={{ flexBasis: '47%', flexGrow: 1, minWidth: 0 }}><AdminMetric {...metric} compact /></View>)}</View>
        </View>
        <AdminMobileAttention data={data} />
      </View>
    )
  }

  return <View className="flex-row flex-wrap gap-4">{metrics.map((metric) => <AdminMetric key={metric.label} {...metric} />)}</View>
}

export function AdminMobileAttention({ data }: { data: AdminData }) {
  const { tokens } = useAppTheme()
  const alerts = [
    { icon: 'person-remove-outline' as IconName, label: 'Usuarios inactivos', value: data.metrics.inactiveUsers, color: tokens.semantic.danger },
    { icon: 'book-outline' as IconName, label: 'Cursos activos sin clases', value: data.metrics.coursesWithoutClassrooms, color: tokens.semantic.warning },
    { icon: 'time-outline' as IconName, label: 'Alumnos inactivos más de 7 días', value: data.metrics.inactiveStudents, color: tokens.text.muted },
    { icon: 'key-outline' as IconName, label: 'Clases activas sin código', value: data.metrics.classroomsWithoutCode, color: tokens.semantic.info },
  ]
  const visibleAlerts = alerts.filter((alert) => alert.value > 0)
  return (
    <View className="rounded-[24px] border border-border-default bg-surface-default p-4">
      <View className="flex-row items-center justify-between"><View className="flex-row items-center gap-2"><Ionicons name="alert-circle-outline" size={19} color={tokens.semantic.warning} /><Text accessibilityRole="header" className="text-[17px] font-black text-text-primary">Requiere atención</Text></View><Text className="rounded-full bg-surface-interactive px-3 py-1 text-[12px] font-black text-semantic-info">{visibleAlerts.length}</Text></View>
      <View className="mt-3" style={{ gap: 10 }}>
        {visibleAlerts.length > 0 ? visibleAlerts.slice(0, 4).map((alert) => <View key={alert.label} className="flex-row items-center rounded-2xl border border-border-default bg-surface-default px-3 py-3"><View className="h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: `${alert.color}24` }}><Ionicons name={alert.icon} size={18} color={alert.color} /></View><Text className="ml-3 min-w-0 flex-1 text-[13px] font-bold text-text-secondary" numberOfLines={2}>{alert.label}</Text><Text className="text-[18px] font-black text-text-primary">{alert.value}</Text></View>) : <View className="items-center rounded-2xl border border-dashed border-border-default bg-surface-default px-4 py-5"><Ionicons name="checkmark-circle-outline" size={26} color={tokens.semantic.success} /><Text className="mt-2 text-center text-[13px] font-bold text-text-secondary">No hay incidencias prioritarias ahora mismo.</Text></View>}
      </View>
    </View>
  )
}
