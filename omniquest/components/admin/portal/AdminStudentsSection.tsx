import React, { useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import AdminSearchBar from './AdminSearchBar'
import { AdminPagination } from './AdminPagination'
import AdminUsersSection from './AdminUsersSection'
import {
  AdminProfileFilters,
  toAdminFilterTimestamp,
  useAdminDirectoryFilters,
} from './AdminAdvancedFilters'
import { useAdminTypedConfirmation } from './AdminTypedConfirmation'
import { exportAdminProfiles } from '../../../lib/adminExports'
import {
  ADMIN_PAGE_SIZE,
  AdminScaffold,
  EmptyState,
  ListLoadingState,
  Panel,
  ProfileRowCard,
  getSearchParam,
  runAdminExport,
  useAdminActions,
  useAdminData,
  useAdminRpcPage,
  type ProfileRow,
} from './AdminPortalCore'

export function AdminStudentsSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const confirmation = useAdminTypedConfirmation()
  const actions = useAdminActions(data, confirmation.request)
  const { directory } = useAdminDirectoryFilters()
  const params = useLocalSearchParams<{ classroomId?: string; subjectId?: string; profileId?: string; search?: string }>()

  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const [accountStatus, setAccountStatus] = useState('all')
  const [activityState, setActivityState] = useState('all')
  const [courseId, setCourseId] = useState(() => getSearchParam(params.subjectId))
  const [classroomId, setClassroomId] = useState(() => getSearchParam(params.classroomId))
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setSearch(getSearchParam(params.search))
  }, [params.search])

  const rpcFilters = {
    p_role: 'student',
    p_search: search.trim(),
    p_subject_id: courseId ? Number(courseId) : null,
    p_classroom_id: classroomId ? Number(classroomId) : null,
    p_profile_id: getSearchParam(params.profileId) || null,
    p_active: accountStatus === 'all' ? null : accountStatus === 'active',
    p_activity_state: activityState === 'all' ? null : activityState,
    p_created_from: toAdminFilterTimestamp(createdFrom),
    p_created_to: toAdminFilterTimestamp(createdTo, true),
  }

  const studentPage = useAdminRpcPage<ProfileRow>(
    'get_admin_profiles_page',
    rpcFilters,
    data.version,
    adminPageSize,
  )

  const handleExport = () => runAdminExport(setExporting, () => exportAdminProfiles({
    role: 'student',
    search,
    subjectId: courseId ? Number(courseId) : null,
    classroomId: classroomId ? Number(classroomId) : null,
    profileId: getSearchParam(params.profileId) || null,
    active: accountStatus === 'all' ? null : accountStatus === 'active',
    activityState: activityState === 'all' ? null : activityState,
    createdFrom: toAdminFilterTimestamp(createdFrom),
    createdTo: toAdminFilterTimestamp(createdTo, true),
  }))

  return (
    <AdminScaffold activeSection="students" title="Alumnos" subtitle="Supervisa cuentas, inscripciones y actividad académica." data={data}>
      <AdminUsersSection
        listArea={(
          <Panel title="Listado de alumnos" icon="people-outline" className="mt-5">
            <AdminSearchBar
              search={search}
              onChangeSearch={setSearch}
              placeholder="Buscar alumno por nombre o correo..."
              exporting={exporting}
              onExport={() => void handleExport()}
            />
            <AdminProfileFilters
              currentRole="student"
              directory={directory}
              accountStatus={accountStatus}
              activityState={activityState}
              courseId={courseId}
              classroomId={classroomId}
              createdFrom={createdFrom}
              createdTo={createdTo}
              onChangeAccountStatus={setAccountStatus}
              onChangeActivityState={setActivityState}
              onChangeCourseId={setCourseId}
              onChangeClassroomId={setClassroomId}
              onChangeCreatedFrom={setCreatedFrom}
              onChangeCreatedTo={setCreatedTo}
            />

            <View className="mt-4" style={{ gap: 12 }}>
              {studentPage.loading && !studentPage.refreshing ? <ListLoadingState /> : null}
              {studentPage.rows.map((profile) => (
                <ProfileRowCard
                  key={profile.id}
                  profile={profile}
                  meta={`${profile.enrollment_count ?? 0} inscripción(es)`}
                  actions={[
                    { label: 'Ver actividad', icon: 'pulse-outline', onPress: () => actions.viewProfileActivity(profile) },
                    { label: 'Ver inscripciones', icon: 'albums-outline', onPress: () => actions.router.push(`/(admin)/classrooms?studentId=${profile.id}` as any) },
                    { label: profile.active === false ? 'Activar' : 'Desactivar', icon: profile.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: profile.active !== false, onPress: () => void actions.toggleProfileActive(profile) },
                    { label: 'Resetear contraseña', icon: 'key-outline', destructive: true, onPress: () => void actions.resetPassword(profile) },
                    { label: 'Eliminar progreso', icon: 'trash-outline', destructive: true, onPress: () => void actions.deleteStudentProgress(profile) },
                  ]}
                />
              ))}
              {!studentPage.loading && studentPage.rows.length === 0 ? <EmptyState label="No hay alumnos que coincidan con los filtros." /> : null}
            </View>
            <AdminPagination
              page={studentPage.page}
              pageSize={studentPage.pageSize}
              total={studentPage.total}
              hasPrevious={studentPage.hasPrevious}
              hasNext={studentPage.hasNext}
              onPrevious={studentPage.previousPage}
              onNext={studentPage.nextPage}
            />
          </Panel>
        )}
      />
      {confirmation.modal}
    </AdminScaffold>
  )
}

export const AdminStudentsScreen = AdminStudentsSection
