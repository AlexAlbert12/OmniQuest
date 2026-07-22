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
  buildSubjectFromClassroom,
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

export function AdminClassroomsSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const actions = useAdminActions(data)
  const params = useLocalSearchParams<{ subjectId?: string; studentId?: string; search?: string }>()
  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setSearch(getSearchParam(params.search))
  }, [params.search])

  const classroomPage = useAdminRpcPage<ClassroomRow>('get_admin_classrooms_page', {
    p_search: search.trim(),
    p_subject_id: getNumericParam(params.subjectId),
    p_student_id: getSearchParam(params.studentId) || null,
  }, data.version, adminPageSize)
  const visibleClassrooms = classroomPage.rows

  return (
    <AdminScaffold activeSection="classrooms" title="Clases" subtitle="Gestiona códigos, estado e inscripciones por clase." data={data}>

      <Panel title="Listado de clases" icon="albums-outline" className="mt-5">
        <AdminSearchBar
          search={search}
          onChangeSearch={setSearch}
          placeholder="Buscar clase, código o curso..."
          exporting={exporting}
          onExport={() => void runAdminExport(setExporting, () => exportAdminClassrooms({
            search,
            subjectId: getNumericParam(params.subjectId),
            studentId: getSearchParam(params.studentId) || null,
          }))}
        />
        <View className="mt-4" style={{ gap: 12 }}>
          {classroomPage.loading && !classroomPage.refreshing ? <ListLoadingState /> : null}
          {visibleClassrooms.map((classroom) => (
            <ClassroomRowCard
              key={classroom.id}
              classroom={classroom}
              subject={buildSubjectFromClassroom(classroom)}
              enrollmentsCount={classroom.enrollments_count ?? 0}
              actions={[
                { label: 'Copiar código', icon: 'copy-outline', onPress: () => actions.copyClassroomCode(classroom) },
                { label: 'Ver alumnos', icon: 'people-outline', onPress: () => actions.router.push(`/(admin)/students?classroomId=${classroom.id}` as any) },
                { label: classroom.active === false ? 'Activar' : 'Desactivar', icon: classroom.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: classroom.active !== false, onPress: () => actions.toggleClassroomActive(classroom) },
              ]}
            />
          ))}
          {!classroomPage.loading && visibleClassrooms.length === 0 ? <EmptyState label="No hay clases que coincidan." /> : null}
        </View>
        <AdminPagination page={classroomPage.page} pageSize={classroomPage.pageSize} total={classroomPage.total} hasPrevious={classroomPage.hasPrevious} hasNext={classroomPage.hasNext} onPrevious={classroomPage.previousPage} onNext={classroomPage.nextPage} />
      </Panel>
    </AdminScaffold>
  )
}




export const AdminClassroomsScreen = AdminClassroomsSection
