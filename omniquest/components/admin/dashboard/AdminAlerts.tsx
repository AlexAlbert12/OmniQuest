import React from 'react'
import { Panel, SystemAlertRow } from '../shared/AdminPrimitives'
import type { AdminDashboardMetrics } from '../types/admin'
import { useAppTheme } from '../../../lib/appTheme'

export default function AdminAlerts({ dashboard }: { dashboard: AdminDashboardMetrics }) {
  const { tokens } = useAppTheme()
  return (
    <Panel title="Alertas del sistema" icon="alert-circle-outline">
      <SystemAlertRow icon="person-remove-outline" label="Usuarios inactivos" value={dashboard.inactiveUsers} color={tokens.semantic.danger} />
      <SystemAlertRow icon="book-outline" label="Cursos activos sin clases" value={dashboard.coursesWithoutClassrooms} color={tokens.semantic.warning} />
      <SystemAlertRow icon="time-outline" label="Alumnos inactivos · más de 7 días" value={dashboard.inactiveStudents} color={tokens.text.muted} />
      <SystemAlertRow icon="key-outline" label="Clases activas sin código" value={dashboard.classroomsWithoutCode} color={tokens.semantic.info} />
    </Panel>
  )
}
