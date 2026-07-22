import React, { useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import AdminSearchBar from './AdminSearchBar'
import { AdminPagination } from './AdminPagination'
import {
  AdminClassroomSupervisionFilters,
  toAdminFilterTimestamp,
  useAdminDirectoryFilters,
} from './AdminAdvancedFilters'
import { useAdminTypedConfirmation } from './AdminTypedConfirmation'
import { exportAdminClassrooms } from '../../../lib/adminExports'
import {
  ADMIN_PAGE_SIZE,
  AdminScaffold,
  ClassroomRowCard,
  EmptyState,
  ListLoadingState,
  Panel,
  buildSubjectFromClassroom,
  getSearchParam,
  runAdminExport,
  useAdminActions,
  useAdminData,
  useAdminRpcPage,
  type ClassroomRow,
} from './AdminPortalCore'

export function AdminClassroomsSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const confirmation = useAdminTypedConfirmation()
  const actions = useAdminActions(data, confirmation.request)
  const { directory } = useAdminDirectoryFilters()
  const params = useLocalSearchParams<{ subjectId?: string; studentId?: string; teacherId?: string; search?: string }>()

  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const [courseId, setCourseId] = useState(() => getSearchParam(params.subjectId))
  const [teacherId, setTeacherId] = useState(() => getSearchParam(params.teacherId))
  const [activeState, setActiveState] = useState('all')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setSearch(getSearchParam(params.search))
  }, [params.search])

  const rpcFilters = {
    p_search: search.trim(),
    p_subject_id: courseId ? Number(courseId) : null,
    p_student_id: getSearchParam(params.studentId) || null,
    p_teacher_id: teacherId || null,
    p_active: activeState === 'all' ? null : activeState === 'active',
    p_created_from: toAdminFilterTimestamp(createdFrom),
    p_created_to: toAdminFilterTimestamp(createdTo, true),
  }

  const classroomPage = useAdminRpcPage<ClassroomRow>('get_admin_classrooms_page', rpcFilters, data.version, adminPageSize)

  const handleExport = () => runAdminExport(setExporting, () => exportAdminClassrooms({
    search,
    subjectId: courseId ? Number(courseId) : null,
    studentId: getSearchParam(params.studentId) || null,
    teacherId: teacherId || null,
    active: activeState === 'all' ? null : activeState === 'active',
    createdFrom: toAdminFilterTimestamp(createdFrom),
    createdTo: toAdminFilterTimestamp(createdTo, true),
  }))

  return (
    <AdminScaffold activeSection="classrooms" title="Clases" subtitle="Supervisa propietarios, alumnado, actividad y estado operativo." data={data}>
      <Panel title="Supervisión de clases" icon="albums-outline" className="mt-5">
        <AdminSearchBar
          search={search}
          onChangeSearch={setSearch}
          placeholder="Buscar clase, código, curso o profesor..."
          exporting={exporting}
          onExport={() => void handleExport()}
        />
        <AdminClassroomSupervisionFilters
          directory={directory}
          teacherId={teacherId}
          courseId={courseId}
          activeState={activeState}
          createdFrom={createdFrom}
          createdTo={createdTo}
          onChangeTeacherId={setTeacherId}
          onChangeCourseId={setCourseId}
          onChangeActiveState={setActiveState}
          onChangeCreatedFrom={setCreatedFrom}
          onChangeCreatedTo={setCreatedTo}
        />

        <View className="mt-4" style={{ gap: 12 }}>
          {classroomPage.loading && !classroomPage.refreshing ? <ListLoadingState /> : null}
          {classroomPage.rows.map((classroom) => (
            <ClassroomRowCard
              key={classroom.id}
              classroom={classroom}
              subject={buildSubjectFromClassroom(classroom)}
              enrollmentsCount={classroom.enrollments_count ?? 0}
              actions={[
                { label: 'Ver alumnos', icon: 'people-outline', onPress: () => actions.router.push(`/(admin)/students?classroomId=${classroom.id}` as any) },
                { label: 'Ver auditoría', icon: 'shield-checkmark-outline', onPress: () => actions.viewRelatedAudit('classrooms', classroom.id) },
                { label: 'Copiar código', icon: 'copy-outline', onPress: () => void actions.copyClassroomCode(classroom) },
                { label: classroom.active === false ? 'Activar' : 'Desactivar', icon: classroom.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: classroom.active !== false, onPress: () => void actions.toggleClassroomActive(classroom) },
              ]}
            />
          ))}
          {!classroomPage.loading && classroomPage.rows.length === 0 ? <EmptyState label="No hay clases que coincidan con los filtros." /> : null}
        </View>
        <AdminPagination
          page={classroomPage.page}
          pageSize={classroomPage.pageSize}
          total={classroomPage.total}
          hasPrevious={classroomPage.hasPrevious}
          hasNext={classroomPage.hasNext}
          onPrevious={classroomPage.previousPage}
          onNext={classroomPage.nextPage}
        />
      </Panel>
      {confirmation.modal}
    </AdminScaffold>
  )
}

export const AdminClassroomsScreen = AdminClassroomsSection
