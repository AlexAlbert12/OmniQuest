import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
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
  AdminInput,
  AdminScaffold,
  EmptyState,
  ListLoadingState,
  Panel,
  ProfileRowCard,
  getNumericParam,
  getSearchParam,
  runAdminExport,
  showAlert,
  useAdminActions,
  useAdminData,
  useAdminRpcPage,
  type CreateTeacherResult,
  type ProfileRow,
} from './AdminPortalCore'

export function AdminTeachersSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const confirmation = useAdminTypedConfirmation()
  const actions = useAdminActions(data, confirmation.request)
  const { directory } = useAdminDirectoryFilters()
  const params = useLocalSearchParams<{ teacherId?: string; search?: string; subjectId?: string; classroomId?: string }>()

  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const [accountStatus, setAccountStatus] = useState('all')
  const [activityState, setActivityState] = useState('all')
  const [courseId, setCourseId] = useState(() => getSearchParam(params.subjectId))
  const [classroomId, setClassroomId] = useState(() => getSearchParam(params.classroomId))
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [teacherAlias, setTeacherAlias] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [teacherPassword, setTeacherPassword] = useState('')
  const [creatingTeacher, setCreatingTeacher] = useState(false)
  const [createdTeacher, setCreatedTeacher] = useState<CreateTeacherResult | null>(null)

  useEffect(() => {
    setSearch(getSearchParam(params.search))
  }, [params.search])

  const rpcFilters = {
    p_role: 'teacher',
    p_search: search.trim(),
    p_subject_id: courseId ? Number(courseId) : null,
    p_classroom_id: classroomId ? Number(classroomId) : null,
    p_profile_id: getSearchParam(params.teacherId) || null,
    p_active: accountStatus === 'all' ? null : accountStatus === 'active',
    p_activity_state: activityState === 'all' ? null : activityState,
    p_created_from: toAdminFilterTimestamp(createdFrom),
    p_created_to: toAdminFilterTimestamp(createdTo, true),
  }

  const teacherPage = useAdminRpcPage<ProfileRow>(
    'get_admin_profiles_page',
    rpcFilters,
    data.version,
    adminPageSize,
  )

  const handleCreateTeacher = async () => {
    const email = teacherEmail.trim().toLowerCase()
    const alias = teacherAlias.trim() || email.split('@')[0]

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('Correo no válido', 'Introduce el correo del profesor.')
      return
    }

    setCreatingTeacher(true)
    setCreatedTeacher(null)

    try {
      const { data: resultData, error } = await supabase.functions.invoke('admin-create-teacher', {
        body: { alias, email, password: teacherPassword.trim() || undefined },
      })
      if (error) throw error

      const result = resultData as CreateTeacherResult
      setCreatedTeacher(result)
      setTeacherAlias('')
      setTeacherEmail('')
      setTeacherPassword('')
      await data.refresh()
      teacherPage.refresh()
    } catch (error: any) {
      showAlert('No se pudo crear el profesor', error.message || 'Revisa la Edge Function y los permisos del usuario administrador.')
    } finally {
      setCreatingTeacher(false)
    }
  }

  const handleExport = () => runAdminExport(setExporting, () => exportAdminProfiles({
    role: 'teacher',
    search,
    subjectId: courseId ? Number(courseId) : null,
    classroomId: classroomId ? Number(classroomId) : null,
    profileId: getSearchParam(params.teacherId) || null,
    active: accountStatus === 'all' ? null : accountStatus === 'active',
    activityState: activityState === 'all' ? null : activityState,
    createdFrom: toAdminFilterTimestamp(createdFrom),
    createdTo: toAdminFilterTimestamp(createdTo, true),
  }))

  return (
    <AdminScaffold activeSection="teachers" title="Profesores" subtitle="Supervisa cuentas, actividad y cursos docentes." data={data}>
      <AdminUsersSection
        createArea={(
          <Panel title="Crear cuenta de profesor" icon="person-add-outline" className="mt-5">
            <View className="flex-row flex-wrap items-end gap-3">
              <AdminInput label="Alias" value={teacherAlias} onChangeText={setTeacherAlias} placeholder="Ej. Profesor Random" />
              <AdminInput label="Correo" value={teacherEmail} onChangeText={setTeacherEmail} placeholder="profesor@centro.es" autoCapitalize="none" />
              <AdminInput label="Contraseña temporal" value={teacherPassword} onChangeText={setTeacherPassword} placeholder="Autogenerar" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Crear profesor"
                onPress={handleCreateTeacher}
                disabled={creatingTeacher}
                className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-admin px-5"
                style={({ pressed }) => ({ opacity: creatingTeacher ? 0.6 : pressed ? 0.82 : 1 })}
              >
                {creatingTeacher ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={18} color="#FFFFFF" />}
                <Text className="font-black text-white">{creatingTeacher ? 'Creando...' : 'Crear profesor'}</Text>
              </Pressable>
            </View>

            {createdTeacher ? (
              <View className="mt-4 rounded-xl border border-border-default bg-surface-interactive p-4">
                <Text className="font-black text-white">{createdTeacher.status === 'created' ? 'Profesor creado' : 'Profesor actualizado'}</Text>
                <Text className="mt-1 text-[13px] text-text-secondary">{createdTeacher.teacher.alias} · {createdTeacher.teacher.email}</Text>
                {createdTeacher.temporaryPassword ? (
                  <Text className="mt-2 text-[13px] text-text-secondary">
                    Contraseña temporal: <Text className="font-mono font-black text-semantic-info">{createdTeacher.temporaryPassword}</Text>
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Panel>
        )}
        listArea={(
          <Panel title="Listado de profesores" icon="school-outline" className="mt-5">
            <AdminSearchBar
              search={search}
              onChangeSearch={setSearch}
              placeholder="Buscar profesor por nombre o correo..."
              exporting={exporting}
              onExport={() => void handleExport()}
            />
            <AdminProfileFilters
              currentRole="teacher"
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
              {teacherPage.loading && !teacherPage.refreshing ? <ListLoadingState /> : null}
              {teacherPage.rows.map((profile) => (
                <ProfileRowCard
                  key={profile.id}
                  profile={profile}
                  meta={`${profile.subject_count ?? 0} curso(s)`}
                  actions={[
                    { label: 'Ver actividad', icon: 'pulse-outline', onPress: () => actions.viewProfileActivity(profile) },
                    { label: 'Ver cursos', icon: 'book-outline', onPress: () => actions.router.push(`/(admin)/courses?teacherId=${profile.id}` as any) },
                    { label: profile.active === false ? 'Activar' : 'Desactivar', icon: profile.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: profile.active !== false, onPress: () => void actions.toggleProfileActive(profile) },
                    { label: 'Resetear contraseña', icon: 'key-outline', destructive: true, onPress: () => void actions.resetPassword(profile) },
                  ]}
                />
              ))}
              {!teacherPage.loading && teacherPage.rows.length === 0 ? <EmptyState label="No hay profesores que coincidan con los filtros." /> : null}
            </View>
            <AdminPagination
              page={teacherPage.page}
              pageSize={teacherPage.pageSize}
              total={teacherPage.total}
              hasPrevious={teacherPage.hasPrevious}
              hasNext={teacherPage.hasNext}
              onPrevious={teacherPage.previousPage}
              onNext={teacherPage.nextPage}
            />
          </Panel>
        )}
      />
      {confirmation.modal}
    </AdminScaffold>
  )
}

export const AdminTeachersScreen = AdminTeachersSection
