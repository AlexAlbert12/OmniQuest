import React from 'react'
import { View } from 'react-native'
import {
  Panel,
  SideFact,
  SystemAlertRow,
} from '../shared/AdminPrimitives'
import type { AdminDashboardMetrics } from '../types/admin'

export default function AdminAlerts({ dashboard }: { dashboard: AdminDashboardMetrics }) {
  return (
    <View className="flex-row flex-wrap gap-5">
      <View className="min-w-[280px] flex-1">
        <Panel title="Alertas del sistema" icon="alert-circle-outline">
          <SystemAlertRow icon="person-remove-outline" label="Usuarios inactivos" value={dashboard.inactiveUsers} color="#FB7185" />
          <SystemAlertRow icon="book-outline" label="Cursos sin clases" value={dashboard.coursesWithoutClassrooms} color="#F59E0B" />
          <SystemAlertRow icon="time-outline" label="Alumnos sin actividad" value={dashboard.studentsWithoutActivity} color="#8FA7C7" />
          <SystemAlertRow icon="key-outline" label="Clases sin código" value={dashboard.classroomsWithoutCode} color="#38BDF8" />
        </Panel>
      </View>

      <View className="min-w-[280px] flex-1">
        <Panel title="Actividad administrativa" icon="analytics-outline">
          <SideFact label="Cursos activos" value={String(dashboard.activeCourses)} />
          <SideFact label="Cursos archivados" value={String(dashboard.archivedCourses)} />
          <SideFact label="Clases activas" value={String(dashboard.activeClassrooms)} />
          <SideFact label="Inscripciones" value={String(dashboard.enrollmentsCount)} />
        </Panel>
      </View>
    </View>
  )
}
