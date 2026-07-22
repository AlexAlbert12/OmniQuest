import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import AdminSearchBar from './AdminSearchBar'
import { AdminPagination } from './AdminPagination'
import AdminUsersSection from './AdminUsersSection'
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

export function AdminStudentsSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const actions = useAdminActions(data)
  const params = useLocalSearchParams<{ classroomId?: string; subjectId?: string; profileId?: string; search?: string }>()
  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setSearch(getSearchParam(params.search))
  }, [params.search])

  const studentPage = useAdminRpcPage<ProfileRow>('get_admin_profiles_page', {
    p_role: 'student',
    p_search: search.trim(),
    p_subject_id: getNumericParam(params.subjectId),
    p_classroom_id: getNumericParam(params.classroomId),
    p_profile_id: getSearchParam(params.profileId) || null,
  }, data.version, adminPageSize)
  const visibleStudents = studentPage.rows

  return (
    <AdminScaffold activeSection="students" title="Alumnos" subtitle="Consulta cuentas, inscripciones y progreso acumulado." data={data}>
      <AdminUsersSection listArea={<>

      <Panel title="Listado de alumnos" icon="people-outline" className="mt-5">
        <AdminSearchBar
          search={search}
          onChangeSearch={setSearch}
          placeholder="Buscar alumno por nombre o correo..."
          exporting={exporting}
          onExport={() => void runAdminExport(setExporting, () => exportAdminProfiles({
            role: 'student',
            search,
            subjectId: getNumericParam(params.subjectId),
            classroomId: getNumericParam(params.classroomId),
            profileId: getSearchParam(params.profileId) || null,
          }))}
        />
        <View className="mt-4" style={{ gap: 12 }}>
          {studentPage.loading && !studentPage.refreshing ? <ListLoadingState /> : null}
          {visibleStudents.map((profile) => (
            <ProfileRowCard
              key={profile.id}
              profile={profile}
              meta={`${profile.enrollment_count ?? 0} inscripción(es)`}
              actions={[
                { label: 'Ver inscripciones', icon: 'albums-outline', onPress: () => actions.router.push(`/(admin)/classrooms?studentId=${profile.id}` as any) },
                { label: profile.active === false ? 'Activar' : 'Desactivar', icon: profile.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: profile.active !== false, onPress: () => actions.toggleProfileActive(profile) },
                { label: 'Eliminar progreso', icon: 'trash-outline', destructive: true, onPress: () => actions.deleteStudentProgress(profile) },
              ]}
            />
          ))}
          {!studentPage.loading && visibleStudents.length === 0 ? <EmptyState label="No hay alumnos que coincidan." /> : null}
        </View>
        <AdminPagination page={studentPage.page} pageSize={studentPage.pageSize} total={studentPage.total} hasPrevious={studentPage.hasPrevious} hasNext={studentPage.hasNext} onPrevious={studentPage.previousPage} onNext={studentPage.nextPage} />
      </Panel>
      </>} />
    </AdminScaffold>
  )
}


export const AdminStudentsScreen = AdminStudentsSection
