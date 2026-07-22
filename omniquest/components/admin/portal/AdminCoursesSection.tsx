import React, { useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import AdminSearchBar from './AdminSearchBar'
import { AdminPagination } from './AdminPagination'
import {
  AdminCourseSupervisionFilters,
  toAdminFilterTimestamp,
  useAdminDirectoryFilters,
} from './AdminAdvancedFilters'
import { useAdminTypedConfirmation } from './AdminTypedConfirmation'
import { exportAdminSubjects } from '../../../lib/adminExports'
import {
  ADMIN_PAGE_SIZE,
  AdminScaffold,
  CourseRowCard,
  EmptyState,
  ListLoadingState,
  Panel,
  buildTeacherProfileFromSubject,
  getSearchParam,
  runAdminExport,
  showAlert,
  useAdminActions,
  useAdminData,
  useAdminRpcPage,
  type SubjectRow,
} from './AdminPortalCore'

export function AdminCoursesSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const confirmation = useAdminTypedConfirmation()
  const actions = useAdminActions(data, confirmation.request)
  const { directory } = useAdminDirectoryFilters()
  const params = useLocalSearchParams<{ teacherId?: string; archived?: string; search?: string }>()

  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const [teacherId, setTeacherId] = useState(() => getSearchParam(params.teacherId))
  const [activeState, setActiveState] = useState('all')
  const [archivedState, setArchivedState] = useState(() => getSearchParam(params.archived) === '1' ? 'archived' : 'all')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setSearch(getSearchParam(params.search))
  }, [params.search])

  const rpcFilters = {
    p_search: search.trim(),
    p_teacher_id: teacherId || null,
    p_archived: archivedState === 'all' ? null : archivedState === 'archived',
    p_active: activeState === 'all' ? null : activeState === 'active',
    p_created_from: toAdminFilterTimestamp(createdFrom),
    p_created_to: toAdminFilterTimestamp(createdTo, true),
  }

  const subjectPage = useAdminRpcPage<SubjectRow>('get_admin_subjects_page', rpcFilters, data.version, adminPageSize)

  const handleExport = () => runAdminExport(setExporting, () => exportAdminSubjects({
    search,
    teacherId: teacherId || null,
    archived: archivedState === 'all' ? null : archivedState === 'archived',
    active: activeState === 'all' ? null : activeState === 'active',
    createdFrom: toAdminFilterTimestamp(createdFrom),
    createdTo: toAdminFilterTimestamp(createdTo, true),
  }))

  return (
    <AdminScaffold activeSection="courses" title="Cursos" subtitle="Supervisa propietarios, estado, actividad e incidencias operativas." data={data}>
      <Panel title="Supervisión de cursos" icon="book-outline" className="mt-5">
        <AdminSearchBar
          search={search}
          onChangeSearch={setSearch}
          placeholder="Buscar curso, código o profesor..."
          exporting={exporting}
          onExport={() => void handleExport()}
        />
        <AdminCourseSupervisionFilters
          directory={directory}
          teacherId={teacherId}
          activeState={activeState}
          archivedState={archivedState}
          createdFrom={createdFrom}
          createdTo={createdTo}
          onChangeTeacherId={setTeacherId}
          onChangeActiveState={setActiveState}
          onChangeArchivedState={setArchivedState}
          onChangeCreatedFrom={setCreatedFrom}
          onChangeCreatedTo={setCreatedTo}
        />

        <View className="mt-4" style={{ gap: 12 }}>
          {subjectPage.loading && !subjectPage.refreshing ? <ListLoadingState /> : null}
          {subjectPage.rows.map((subject) => (
            <CourseRowCard
              key={subject.id}
              subject={subject}
              teacher={buildTeacherProfileFromSubject(subject)}
              classesCount={subject.classes_count ?? 0}
              enrollmentsCount={subject.enrollments_count ?? 0}
              actions={[
                { label: 'Ver clases', icon: 'albums-outline', onPress: () => actions.router.push(`/(admin)/classrooms?subjectId=${subject.id}` as any) },
                { label: 'Ver auditoría', icon: 'shield-checkmark-outline', onPress: () => actions.viewRelatedAudit('subjects', subject.id) },
                { label: subject.is_archived ? 'Restaurar' : 'Archivar', icon: subject.is_archived ? 'refresh-outline' : 'archive-outline', destructive: !subject.is_archived, onPress: () => void actions.toggleCourseArchive(subject) },
                { label: 'Ver profesor', icon: 'school-outline', onPress: () => subject.teacher_id ? actions.router.push(`/(admin)/teachers?teacherId=${subject.teacher_id}` as any) : showAlert('Sin profesor', 'Este curso no tiene profesor asignado.') },
              ]}
            />
          ))}
          {!subjectPage.loading && subjectPage.rows.length === 0 ? <EmptyState label="No hay cursos que coincidan con los filtros." /> : null}
        </View>
        <AdminPagination
          page={subjectPage.page}
          pageSize={subjectPage.pageSize}
          total={subjectPage.total}
          hasPrevious={subjectPage.hasPrevious}
          hasNext={subjectPage.hasNext}
          onPrevious={subjectPage.previousPage}
          onNext={subjectPage.nextPage}
        />
      </Panel>
      {confirmation.modal}
    </AdminScaffold>
  )
}

export const AdminCoursesScreen = AdminCoursesSection
