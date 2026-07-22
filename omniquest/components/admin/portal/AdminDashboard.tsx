import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import AdminAlerts from './AdminAlerts'
import {
  exportAdminAudit,
  exportAdminClassrooms,
  exportAdminProfiles,
  exportAdminSubjects,
  exportAdminSupport,
} from '../../../lib/adminExports'
import {
  ADMIN_PAGE_SIZE,
  AdminFilterRow,
  AdminInput,
  AdminListToolbar,
  AdminMetrics,
  AdminPaginationControls,
  AdminScaffold,
  AdminUsageAnalyticsPanel,
  AdminChoiceChip,
  AuditLogCard,
  ClassroomRowCard,
  CourseRowCard,
  EmptyState,
  HomeShortcut,
  ListLoadingState,
  MiniPill,
  Panel,
  ProfileRowCard,
  RecentAuditPanel,
  SideFact,
  SupportPriorityPill,
  SupportStatusPill,
  SupportTicketCard,
  SystemAlertRow,
  formatAuditDate,
  getNumericParam,
  getSearchParam,
  getSupportPriorityLabel,
  getSupportStatusLabel,
  runAdminExport,
  showAlert,
  useAdminActions,
  useAdminDashboard,
  useAdminData,
  useAdminRpcPage,
  type AdminAuditLogRow,
  type AdminSupportTicketRow,
  type ClassroomRow,
  type CreateTeacherResult,
  type ProfileRow,
  type SubjectRow,
} from './AdminPortalCore'

export function AdminDashboard() {
  const data = useAdminData()
  const actions = useAdminActions(data)
  const dashboard = useAdminDashboard(data)

  return (
    <AdminScaffold activeSection="home" title="Inicio Admin" subtitle="Vista general del sistema, alertas y accesos rápidos." data={data}>
      <AdminMetrics data={data} activeSection="home" />

      <View className="mt-5 flex-row flex-wrap gap-4">
        <HomeShortcut icon="person-add-outline" label="Crear profesor" onPress={() => actions.router.push('/(admin)/teachers' as any)} />
        <HomeShortcut icon="archive-outline" label="Cursos archivados" onPress={() => actions.router.push('/(admin)/courses?archived=1' as any)} />
        <HomeShortcut icon="download-outline" label="Exportar usuarios" onPress={() => showAlert('Exportar usuarios', 'Usa las secciones Profesores o Alumnos para exportar el listado filtrado.')} />
        <HomeShortcut icon="albums-outline" label="Revisar clases" onPress={() => actions.router.push('/(admin)/classrooms' as any)} />
        <HomeShortcut icon="headset-outline" label="Gestionar soporte" onPress={() => actions.router.push('/(admin)/support' as any)} />
        <HomeShortcut icon="receipt-outline" label="Ver auditoría" onPress={() => actions.router.push('/(admin)/audit' as any)} />
      </View>

      <View className="mt-5">
        <AdminAlerts dashboard={dashboard} />
      </View>

      <View className="mt-5">
        <AdminUsageAnalyticsPanel refreshVersion={data.version} />
      </View>

      <View className="mt-5">
        <RecentAuditPanel data={data} />
      </View>

      <View className="mt-5">
        <Panel title="Modelo de acceso" icon="lock-closed-outline" compact>
          <Text className="text-[13px] leading-5 text-[#B7C4D7]">
            Los alumnos se registran desde la app o se importan por clase. Los profesores se crean desde el portal de administración.
          </Text>
          <Text className="mt-2 text-[12px] leading-5 text-[#8FA7C7]">
            Para activar el primer administrador, asigna role_id = admin al perfil correspondiente en Supabase.
          </Text>
        </Panel>
      </View>
    </AdminScaffold>
  )
}


export const AdminHomeScreen = AdminDashboard
