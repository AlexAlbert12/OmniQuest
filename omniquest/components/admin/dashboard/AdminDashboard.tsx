import React from 'react'
import { type Href } from 'expo-router'
import { View } from 'react-native'
import AdminAlerts from './AdminAlerts'
import AdminPushDeliveryPanel from './AdminPushDeliveryPanel'
import AdminUsageAnalyticsPanel from './AdminUsageAnalyticsPanel'
import { AdminMetrics } from './AdminMetrics'
import { RecentAuditPanel } from '../audit/AdminAuditComponents'
import { AdminScaffold } from '../shared/AdminScaffold'
import { HomeShortcut, Panel } from '../shared/AdminPrimitives'
import { useAdminActions } from '../hooks/useAdminActions'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminDashboard } from '../hooks/useAdminDashboard'
import { useResponsiveLayout } from '../../../lib/responsive'

export function AdminDashboard() {
  const data = useAdminData()
  const actions = useAdminActions(data)
  const dashboard = useAdminDashboard(data)
  const responsive = useResponsiveLayout()
  const can = (permission: import('../types/admin').AdminPermission) => Boolean(data.portalContext?.permissions.includes(permission))
  const canOpenExports = can('users.export') || can('courses.read') || can('audit.export') || can('support.read')
  const shortcuts = <View className="flex-row flex-wrap" style={{ gap: responsive.isDesktop ? 16 : 10 }}>
    {can('users.manage') ? <HomeShortcut icon="person-add-outline" label="Crear profesor" onPress={() => actions.router.push('/(admin)/teachers' as Href)} /> : null}
    {can('courses.read') ? <HomeShortcut icon="albums-outline" label="Clases" onPress={() => actions.router.push('/(admin)/classrooms' as Href)} /> : null}
    {can('audit.read') ? <HomeShortcut icon="receipt-outline" label="Auditoría" onPress={() => actions.router.push('/(admin)/audit' as Href)} /> : null}
    {can('support.read') ? <HomeShortcut icon="headset-outline" label="Soporte" onPress={() => actions.router.push('/(admin)/support' as Href)} /> : null}
    {canOpenExports ? <HomeShortcut icon="download-outline" label="Exportaciones" onPress={() => actions.router.push('/(admin)/exports' as Href)} /> : null}
    {can('courses.read') ? <HomeShortcut icon="archive-outline" label="Archivados" onPress={() => actions.router.push('/(admin)/courses?archived=1' as Href)} /> : null}
  </View>

  return (
    <AdminScaffold activeSection="home" title="Inicio Admin" subtitle="Estado general del sistema, incidencias prioritarias y accesos rápidos." data={data}>
      <AdminMetrics data={data} />
      {!responsive.isDesktop ? <View className="mt-5"><AdminAlerts dashboard={dashboard} /></View> : null}
      {responsive.isDesktop ? <View className="mt-5">{shortcuts}</View> : <Panel title="Accesos rápidos" icon="grid-outline" compact className="mt-5">{shortcuts}</Panel>}
      {responsive.isDesktop ? <View className="mt-5"><AdminAlerts dashboard={dashboard} /></View> : null}
      <View className="mt-5"><AdminUsageAnalyticsPanel refreshVersion={data.version} /></View>
      {can('notifications.read') ? <View className="mt-5"><AdminPushDeliveryPanel refreshVersion={data.version} /></View> : null}
      {can('audit.read') ? <View className="mt-5"><RecentAuditPanel data={data} /></View> : null}
    </AdminScaffold>
  )
}

export const AdminHomeScreen = AdminDashboard
