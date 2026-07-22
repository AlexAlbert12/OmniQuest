import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import AdminSearchBar from './AdminSearchBar'
import { AdminPagination } from './AdminPagination'
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

export function AdminAuditSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const auditPageSize = isDesktop ? 25 : 8
  const data = useAdminData()
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  const auditPage = useAdminRpcPage<AdminAuditLogRow & { total_count?: number | null }>(
    'get_admin_audit_logs_page',
    { p_search: search.trim() || null },
    data.version,
    auditPageSize,
  )

  return (
    <AdminScaffold activeSection="audit" title="Auditoría" subtitle="Registro de acciones sensibles realizadas desde el portal admin." data={data}>

      <Panel title="Últimas acciones registradas" icon="receipt-outline" className="mt-5">
        <AdminSearchBar
          search={search}
          onChangeSearch={setSearch}
          placeholder="Buscar por acción, admin, objetivo o metadata..."
          exporting={exporting}
          onExport={() => void runAdminExport(setExporting, () => exportAdminAudit(search))}
        />
        <View className="mt-4" style={{ gap: 12 }}>
          {auditPage.loading && !auditPage.refreshing ? <ListLoadingState /> : null}
          {auditPage.rows.map((log) => (
            <AuditLogCard key={log.id} log={log} data={data} />
          ))}
          {!auditPage.loading && auditPage.rows.length === 0 ? (
            <EmptyState label="No hay acciones de auditoría que coincidan." />
          ) : null}
        </View>
        <AdminPagination
          page={auditPage.page}
          pageSize={auditPage.pageSize}
          total={auditPage.total}
          hasPrevious={auditPage.hasPrevious}
          hasNext={auditPage.hasNext}
          onPrevious={auditPage.previousPage}
          onNext={auditPage.nextPage}
        />
      </Panel>
    </AdminScaffold>
  )
}


export const AdminAuditScreen = AdminAuditSection
