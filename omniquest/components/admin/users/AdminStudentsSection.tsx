import React, { useEffect, useMemo, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import AdminSearchBar from '../shared/AdminSearchBar'
import VirtualizedStack from '../../ui/VirtualizedStack'
import AdminUsersSection from './AdminUsersSection'
import AdminBulkSelectionBar from '../shared/AdminBulkSelectionBar'
import AdminGovernanceModal, { type AdminGovernanceMode, type AdminGovernanceResult } from '../shared/AdminGovernanceModal'
import AdminUserChangeHistoryModal from './AdminUserChangeHistoryModal'
import { AdminProfileFilters, toAdminFilterTimestamp, useAdminDirectoryFilters } from '../shared/AdminAdvancedFilters'
import { useAdminTypedConfirmation } from '../shared/AdminTypedConfirmation'
import { exportAdminProfiles } from '../../../lib/adminExports'
import { useAdminActions } from '../hooks/useAdminActions'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminExportJobs } from '../hooks/useAdminExportJobs'
import { useAdminRpcPage } from '../hooks/useAdminRpcPage'
import { useAdminSelection } from '../hooks/useAdminSelection'
import { AdminScaffold } from '../shared/AdminScaffold'
import { AdminPaginationControls, EmptyState, ListLoadingState, Panel, ProfileRowCard } from '../shared/AdminPrimitives'
import { ADMIN_PAGE_SIZE, type ProfileRow } from '../types/admin'
import { getSearchParam, runAdminExport } from '../utils/adminUtils'

export function AdminStudentsSection() {
  const { width } = useWindowDimensions()
  const data = useAdminData()
  const confirmation = useAdminTypedConfirmation()
  const actions = useAdminActions(data, confirmation.request)
  const selection = useAdminSelection<string>()
  const exportJobs = useAdminExportJobs()
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
  const [governanceMode, setGovernanceMode] = useState<AdminGovernanceMode | null>(null)
  const [historyProfile, setHistoryProfile] = useState<ProfileRow | null>(null)
  const pageSize = width >= 1040 ? ADMIN_PAGE_SIZE : 8

  useEffect(() => setSearch(getSearchParam(params.search)), [params.search])
  const rpcFilters = useMemo(() => ({
    p_role: 'student', p_search: search.trim(), p_subject_id: courseId ? Number(courseId) : null,
    p_classroom_id: classroomId ? Number(classroomId) : null, p_profile_id: getSearchParam(params.profileId) || null,
    p_active: accountStatus === 'all' ? null : accountStatus === 'active', p_activity_state: activityState === 'all' ? null : activityState,
    p_created_from: toAdminFilterTimestamp(createdFrom), p_created_to: toAdminFilterTimestamp(createdTo, true),
  }), [accountStatus, activityState, classroomId, courseId, createdFrom, createdTo, params.profileId, search])
  const page = useAdminRpcPage<ProfileRow>('get_admin_profiles_page', rpcFilters, data.version, pageSize)

  const handleExport = async () => {
    if (page.total >= 1000) return exportJobs.request('profiles', rpcFilters)
    return runAdminExport(setExporting, () => exportAdminProfiles({ role: 'student', search, subjectId: courseId ? Number(courseId) : null, classroomId: classroomId ? Number(classroomId) : null, profileId: getSearchParam(params.profileId) || null, active: accountStatus === 'all' ? null : accountStatus === 'active', activityState: activityState === 'all' ? null : activityState, createdFrom: toAdminFilterTimestamp(createdFrom), createdTo: toAdminFilterTimestamp(createdTo, true) }))
  }

  const applyGovernance = async (result: AdminGovernanceResult) => {
    if (governanceMode === 'deactivate-user') await actions.executeBulkAction({ action: 'deactivate_users', entity: 'profiles', ids: selection.selected, reason: result.reason, reactivateAt: result.reactivateAt })
    selection.clear(); setGovernanceMode(null); page.refresh()
  }
  const canManage = !data.portalContext || data.portalContext.permissions.includes('users.manage')
  const canSecurity = !data.portalContext || data.portalContext.permissions.includes('users.security')
  const canExport = !data.portalContext || data.portalContext.permissions.includes('users.export')

  return (
    <AdminScaffold activeSection="students" title="Alumnos" subtitle="Supervisa cuentas, seguridad, inscripciones y actividad académica." data={data}>
      <AdminUsersSection listArea={<Panel title="Listado de alumnos" icon="people-outline" className="mt-5">
        <AdminSearchBar search={search} onChangeSearch={setSearch} placeholder="Buscar alumno por nombre o correo..." exporting={exporting || exportJobs.loading} onExport={canExport ? () => void handleExport() : undefined} />
        <AdminProfileFilters currentRole="student" directory={directory} accountStatus={accountStatus} activityState={activityState} courseId={courseId} classroomId={classroomId} createdFrom={createdFrom} createdTo={createdTo} onChangeAccountStatus={setAccountStatus} onChangeActivityState={setActivityState} onChangeCourseId={setCourseId} onChangeClassroomId={setClassroomId} onChangeCreatedFrom={setCreatedFrom} onChangeCreatedTo={setCreatedTo} />
        {canManage ? <AdminBulkSelectionBar count={selection.count} onClear={selection.clear} onSelectPage={() => selection.selectPage(page.rows.map((row) => row.id))} primaryLabel="Desactivar seleccionados" onPrimary={() => setGovernanceMode('deactivate-user')} secondaryLabel="Activar seleccionados" onSecondary={() => void actions.executeBulkAction({ action: 'activate_users', entity: 'profiles', ids: selection.selected }).then(() => { selection.clear(); page.refresh() })} /> : null}
        <View className="mt-4">{page.loading && !page.refreshing ? <ListLoadingState /> : null}<VirtualizedStack data={page.rows} keyExtractor={(profile) => profile.id} renderItem={(profile) => <ProfileRowCard profile={profile} meta={`${profile.enrollment_count ?? 0} inscripción(es)`} selected={selection.isSelected(profile.id)} onToggleSelected={canManage ? () => selection.toggle(profile.id) : undefined} actions={[
          { label: 'Ver actividad', icon: 'pulse-outline', onPress: () => actions.viewProfileActivity(profile) },
          { label: 'Historial de cambios', icon: 'git-compare-outline', onPress: () => setHistoryProfile(profile) },
          { label: 'Ver inscripciones', icon: 'albums-outline', onPress: () => actions.router.push(`/(admin)/classrooms?studentId=${profile.id}` as any) },
          { label: profile.active === false ? 'Activar' : 'Desactivar', icon: profile.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: profile.active !== false, disabled: !canManage, onPress: () => profile.active === false ? void actions.toggleProfileActive(profile) : (selection.selectPage([profile.id]), setGovernanceMode('deactivate-user')) },
          { label: 'Resetear contraseña', icon: 'key-outline', destructive: true, disabled: !canSecurity, onPress: () => void actions.resetPassword(profile) },
          { label: 'Eliminar progreso', icon: 'trash-outline', destructive: true, disabled: !canManage, onPress: () => void actions.deleteStudentProgress(profile) },
        ]} />} emptyComponent={!page.loading ? <EmptyState label="No hay alumnos que coincidan con los filtros." /> : null} accessibilityLabel="Alumnos administrados" /></View>
        <AdminPaginationControls page={page.page} pageSize={page.pageSize} total={page.total} hasPrevious={page.hasPrevious} hasNext={page.hasNext} onPrevious={page.previousPage} onNext={page.nextPage} />
      </Panel>} />
      {confirmation.modal}
      <AdminGovernanceModal visible={Boolean(governanceMode)} mode={governanceMode || 'deactivate-user'} count={selection.count} onCancel={() => setGovernanceMode(null)} onConfirm={applyGovernance} />
      <AdminUserChangeHistoryModal profile={historyProfile} visible={Boolean(historyProfile)} onClose={() => setHistoryProfile(null)} />
    </AdminScaffold>
  )
}

export const AdminStudentsScreen = AdminStudentsSection
