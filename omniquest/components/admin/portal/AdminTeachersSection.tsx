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

export function AdminTeachersSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const actions = useAdminActions(data)
  const params = useLocalSearchParams<{ teacherId?: string; search?: string }>()
  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const [exporting, setExporting] = useState(false)
  const [teacherAlias, setTeacherAlias] = useState('')

  useEffect(() => {
    setSearch(getSearchParam(params.search))
  }, [params.search])
  const [teacherEmail, setTeacherEmail] = useState('')
  const [teacherPassword, setTeacherPassword] = useState('')
  const [creatingTeacher, setCreatingTeacher] = useState(false)
  const [createdTeacher, setCreatedTeacher] = useState<CreateTeacherResult | null>(null)

  const teacherPage = useAdminRpcPage<ProfileRow>('get_admin_profiles_page', {
    p_role: 'teacher',
    p_search: search.trim(),
    p_subject_id: null,
    p_classroom_id: null,
    p_profile_id: getSearchParam(params.teacherId) || null,
  }, data.version, adminPageSize)
  const visibleTeachers = teacherPage.rows

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
        body: {
          alias,
          email,
          password: teacherPassword.trim() || undefined,
        },
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

  return (
    <AdminScaffold activeSection="teachers" title="Profesores" subtitle="Crea y gestiona las cuentas docentes." data={data}>
      <AdminUsersSection listArea={<>

      <Panel title="Crear cuenta de profesor" icon="person-add-outline" className="mt-5">
        <View className="flex-row flex-wrap items-end gap-3">
          <AdminInput label="Alias" value={teacherAlias} onChangeText={setTeacherAlias} placeholder="Ej. Profesor Random" />
          <AdminInput label="Correo" value={teacherEmail} onChangeText={setTeacherEmail} placeholder="profesor@centro.es" autoCapitalize="none" />
          <AdminInput label="Contraseña temporal" value={teacherPassword} onChangeText={setTeacherPassword} placeholder="Autogenerar" />
          <Pressable
            onPress={handleCreateTeacher}
            disabled={creatingTeacher}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#5A46D8] px-5"
            style={({ pressed }) => ({ opacity: creatingTeacher ? 0.6 : pressed ? 0.82 : 1 })}
          >
            {creatingTeacher ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={18} color="#FFFFFF" />}
            <Text className="font-black text-white">{creatingTeacher ? 'Creando...' : 'Crear profesor'}</Text>
          </Pressable>
        </View>

        {createdTeacher ? (
          <View className="mt-4 rounded-xl border border-[#1E3A8A] bg-[#10224A] p-4">
            <Text className="font-black text-white">
              {createdTeacher.status === 'created' ? 'Profesor creado' : 'Profesor actualizado'}
            </Text>
            <Text className="mt-1 text-[13px] text-[#B7C4D7]">
              {createdTeacher.teacher.alias} · {createdTeacher.teacher.email}
            </Text>
            {createdTeacher.temporaryPassword ? (
              <Text className="mt-2 text-[13px] text-[#DDE7F4]">
                Contraseña temporal:{' '}
                <Text className="font-mono font-black text-[#9FD6FF]">{createdTeacher.temporaryPassword}</Text>
              </Text>
            ) : null}
          </View>
        ) : null}
      </Panel>

      <Panel title="Listado de profesores" icon="school-outline" className="mt-5">
        <AdminSearchBar
          search={search}
          onChangeSearch={setSearch}
          placeholder="Buscar profesor por nombre o correo..."
          exporting={exporting}
          onExport={() => void runAdminExport(setExporting, () => exportAdminProfiles({ role: 'teacher', search, profileId: getSearchParam(params.teacherId) || null }))}
        />
        <View className="mt-4" style={{ gap: 12 }}>
          {teacherPage.loading && !teacherPage.refreshing ? <ListLoadingState /> : null}
          {visibleTeachers.map((profile) => (
            <ProfileRowCard
              key={profile.id}
              profile={profile}
              meta={`${profile.subject_count ?? 0} curso(s)`}
              actions={[
                { label: 'Ver cursos', icon: 'book-outline', onPress: () => actions.router.push(`/(admin)/courses?teacherId=${profile.id}` as any) },
                { label: profile.active === false ? 'Activar' : 'Desactivar', icon: profile.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: profile.active !== false, onPress: () => actions.toggleProfileActive(profile) },
                { label: 'Restablecer contraseña', icon: 'key-outline', onPress: () => actions.resetPassword(profile) },
              ]}
            />
          ))}
          {!teacherPage.loading && visibleTeachers.length === 0 ? <EmptyState label="No hay profesores que coincidan." /> : null}
        </View>
        <AdminPagination page={teacherPage.page} pageSize={teacherPage.pageSize} total={teacherPage.total} hasPrevious={teacherPage.hasPrevious} hasNext={teacherPage.hasNext} onPrevious={teacherPage.previousPage} onNext={teacherPage.nextPage} />
      </Panel>
      </>} />
    </AdminScaffold>
  )
}


export const AdminTeachersScreen = AdminTeachersSection
