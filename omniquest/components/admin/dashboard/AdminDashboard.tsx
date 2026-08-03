import React from 'react'
import { type Href } from 'expo-router'
import { Text, View } from 'react-native'
import AdminAlerts from './AdminAlerts'
import AdminPushDeliveryPanel from './AdminPushDeliveryPanel'
import AdminUsageAnalyticsPanel from './AdminUsageAnalyticsPanel'
import { AdminMetrics } from './AdminMetrics'
import { RecentAuditPanel } from '../audit/AdminAuditComponents'
import AdminExportJobsPanel from '../shared/AdminExportJobsPanel'
import AdminRoleManagementPanel from '../users/AdminRoleManagementPanel'
import { AdminScaffold } from '../shared/AdminScaffold'
import { HomeShortcut, Panel } from '../shared/AdminPrimitives'
import { useAdminActions } from '../hooks/useAdminActions'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminDashboard } from '../hooks/useAdminDashboard'
import { useAdminExportJobs } from '../hooks/useAdminExportJobs'
import { useAppFeedback } from '../../../hooks/useAppFeedback'

export function AdminDashboard() {
  const data = useAdminData()
  const actions = useAdminActions(data)
  const dashboard = useAdminDashboard(data)
  const exportJobs = useAdminExportJobs()
  const feedback = useAppFeedback()
  const can = (permission: import('../types/admin').AdminPermission) => !data.portalContext || data.portalContext.permissions.includes(permission)
  return (
    <AdminScaffold activeSection="home" title="Inicio Admin" subtitle="Vista general del sistema, alertas y accesos rápidos." data={data}>
      <AdminMetrics data={data} />
      <View className="mt-5 flex-row flex-wrap gap-4">
        {can('users.manage') ? <HomeShortcut icon="person-add-outline" label="Crear profesor" onPress={() => actions.router.push('/(admin)/teachers' as Href)} /> : null}
        {can('courses.read') ? <HomeShortcut icon="archive-outline" label="Cursos archivados" onPress={() => actions.router.push('/(admin)/courses?archived=1' as Href)} /> : null}
        {can('users.export') || can('audit.export') ? <HomeShortcut icon="download-outline" label="Exportaciones" onPress={() => feedback.success('Exportaciones asíncronas', 'Los listados grandes se generan como trabajos y aparecen más abajo.')} /> : null}
        {can('courses.read') ? <HomeShortcut icon="albums-outline" label="Revisar clases" onPress={() => actions.router.push('/(admin)/classrooms' as Href)} /> : null}
        {can('support.read') ? <HomeShortcut icon="headset-outline" label="Gestionar soporte" onPress={() => actions.router.push('/(admin)/support' as Href)} /> : null}
        {can('audit.read') ? <HomeShortcut icon="receipt-outline" label="Ver auditoría" onPress={() => actions.router.push('/(admin)/audit' as Href)} /> : null}
      </View>
      <View className="mt-5"><AdminAlerts dashboard={dashboard} /></View>
      <View className="mt-5"><AdminUsageAnalyticsPanel refreshVersion={data.version} /></View>
      <View className="mt-5"><AdminPushDeliveryPanel refreshVersion={data.version} /></View>
      {can('audit.read') ? <View className="mt-5"><RecentAuditPanel data={data} /></View> : null}
      <AdminExportJobsPanel jobs={exportJobs.jobs} onDownload={(id) => void exportJobs.download(id)} onRefresh={() => void exportJobs.refresh()} />
      <AdminRoleManagementPanel canManage={Boolean(data.portalContext?.permissions.includes('admin.roles.manage'))} />
      <View className="mt-5">
        <Panel title="Modelo de acceso" icon="lock-closed-outline" compact>
          <Text className="text-[13px] leading-5 text-text-secondary">Los administradores pueden tener perfiles de permisos limitados. La navegación, las acciones sensibles y los trabajos de exportación respetan los permisos asignados.</Text>
          <Text className="mt-2 text-[12px] leading-5 text-text-muted">La cuenta administradora no puede desactivarse a sí misma y todas las operaciones de gobierno quedan registradas.</Text>
        </Panel>
      </View>
    </AdminScaffold>
  )
}

export const AdminHomeScreen = AdminDashboard
