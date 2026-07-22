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
  buildTeacherProfileFromSubject,
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

export function AdminCoursesSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const actions = useAdminActions(data)
  const params = useLocalSearchParams<{ teacherId?: string; archived?: string; search?: string }>()
  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setSearch(getSearchParam(params.search))
  }, [params.search])

  const subjectPage = useAdminRpcPage<SubjectRow>('get_admin_subjects_page', {
    p_search: search.trim(),
    p_teacher_id: getSearchParam(params.teacherId) || null,
    p_archived: getSearchParam(params.archived) === '1' ? true : null,
  }, data.version, adminPageSize)
  const visibleSubjects = subjectPage.rows

  return (
    <AdminScaffold activeSection="courses" title="Cursos" subtitle="Administra cursos activos, archivados y docentes responsables." data={data}>

      <Panel title="Listado de cursos" icon="book-outline" className="mt-5">
        <AdminSearchBar
          search={search}
          onChangeSearch={setSearch}
          placeholder="Buscar curso o profesor..."
          exporting={exporting}
          onExport={() => void runAdminExport(setExporting, () => exportAdminSubjects({
            search,
            teacherId: getSearchParam(params.teacherId) || null,
            archived: getSearchParam(params.archived) === '1' ? true : null,
          }))}
        />
        <View className="mt-4" style={{ gap: 12 }}>
          {subjectPage.loading && !subjectPage.refreshing ? <ListLoadingState /> : null}
          {visibleSubjects.map((subject) => (
            <CourseRowCard
              key={subject.id}
              subject={subject}
              teacher={buildTeacherProfileFromSubject(subject)}
              classesCount={subject.classes_count ?? 0}
              enrollmentsCount={subject.enrollments_count ?? 0}
              actions={[
                { label: 'Ver clases', icon: 'albums-outline', onPress: () => actions.router.push(`/(admin)/classrooms?subjectId=${subject.id}` as any) },
                { label: subject.is_archived ? 'Restaurar' : 'Archivar', icon: subject.is_archived ? 'refresh-outline' : 'archive-outline', destructive: !subject.is_archived, onPress: () => actions.toggleCourseArchive(subject) },
                { label: 'Ver profesor', icon: 'school-outline', onPress: () => subject.teacher_id ? actions.router.push(`/(admin)/teachers?teacherId=${subject.teacher_id}` as any) : showAlert('Sin profesor', 'Este curso no tiene profesor asignado.') },
              ]}
            />
          ))}
          {!subjectPage.loading && visibleSubjects.length === 0 ? <EmptyState label="No hay cursos que coincidan." /> : null}
        </View>
        <AdminPagination page={subjectPage.page} pageSize={subjectPage.pageSize} total={subjectPage.total} hasPrevious={subjectPage.hasPrevious} hasNext={subjectPage.hasNext} onPrevious={subjectPage.previousPage} onNext={subjectPage.nextPage} />
      </Panel>
    </AdminScaffold>
  )
}


export const AdminCoursesScreen = AdminCoursesSection
