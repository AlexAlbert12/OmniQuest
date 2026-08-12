import React from 'react'
import { Panel, SystemAlertRow } from '../shared/AdminPrimitives'
import type { AdminDashboardMetrics } from '../types/admin'

export default function AdminAlerts({ dashboard }: { dashboard: AdminDashboardMetrics }) {
  return (
    <Panel title="Alertas del sistema" icon="alert-circle-outline">
      <SystemAlertRow icon="person-remove-outline" label="Usuarios inactivos" value={dashboard.inactiveUsers} color="#FB7185" />
      <SystemAlertRow icon="book-outline" label="Cursos activos sin clases" value={dashboard.coursesWithoutClassrooms} color="#F59E0B" />
      <SystemAlertRow icon="time-outline" label="Alumnos inactivos · más de 7 días" value={dashboard.inactiveStudents} color="#8FA7C7" />
      <SystemAlertRow icon="key-outline" label="Clases activas sin código" value={dashboard.classroomsWithoutCode} color="#38BDF8" />
    </Panel>
  )
}
