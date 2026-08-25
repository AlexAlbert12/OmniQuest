import React, { useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, type Href } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import AdminSearchBar from '../shared/AdminSearchBar'
import AdminButton from '../shared/AdminButton'
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
import { AdminInput, AdminPaginationControls, EmptyState, ListLoadingState, Panel, ProfileRowCard } from '../shared/AdminPrimitives'
import { ADMIN_PAGE_SIZE, type CreateTeacherResult, type ProfileRow } from '../types/admin'
import { getSearchParam, runAdminExport } from '../utils/adminUtils'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { useResponsiveLayout } from '../../../lib/responsive'
import { getErrorMessage } from '../../../lib/typeGuards'

export function AdminTeachersSection() {
  const feedback = useAppFeedback()
  const responsive = useResponsiveLayout()
  const data = useAdminData()
  const confirmation = useAdminTypedConfirmation()
  const actions = useAdminActions(data, confirmation.request)
  const selection = useAdminSelection<string>()
  const clearSelection = selection.clear
  const exportJobs = useAdminExportJobs()
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
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false)
  const [creatingTeacher, setCreatingTeacher] = useState(false)
  const [createdTeacher, setCreatedTeacher] = useState<CreateTeacherResult | null>(null)
  const [governanceMode, setGovernanceMode] = useState<AdminGovernanceMode | null>(null)
  const [historyProfile, setHistoryProfile] = useState<ProfileRow | null>(null)
  const pageSize = responsive.isDesktop ? ADMIN_PAGE_SIZE : 8

  useEffect(() => setSearch(getSearchParam(params.search)), [params.search])

  const rpcFilters = useMemo(() => ({
    p_role: 'teacher', p_search: search.trim(), p_subject_id: courseId ? Number(courseId) : null,
    p_classroom_id: classroomId ? Number(classroomId) : null, p_profile_id: getSearchParam(params.teacherId) || null,
    p_active: accountStatus === 'all' ? null : accountStatus === 'active', p_activity_state: activityState === 'all' ? null : activityState,
    p_created_from: toAdminFilterTimestamp(createdFrom), p_created_to: toAdminFilterTimestamp(createdTo, true),
  }), [accountStatus, activityState, classroomId, courseId, createdFrom, createdTo, params.teacherId, search])
  const page = useAdminRpcPage<ProfileRow>('get_admin_profiles_page', rpcFilters, data.version, pageSize)
  useEffect(() => clearSelection(), [accountStatus, activityState, classroomId, clearSelection, courseId, createdFrom, createdTo, page.page, params.teacherId, search])

  const handleCreateTeacher = async () => {
    const email = teacherEmail.trim().toLowerCase()
    const alias = teacherAlias.trim() || email.split('@')[0]
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return feedback.warning('Correo no válido', 'Introduce el correo del profesor.')
    setCreatingTeacher(true); setCreatedTeacher(null)
    try {
      const { data: resultData, error } = await supabase.functions.invoke('admin-create-teacher', { body: { alias, email } })
      if (error) throw new Error(await getTeacherCreationError(error))
      setCreatedTeacher(resultData as CreateTeacherResult); setTeacherAlias(''); setTeacherEmail(''); setShowTemporaryPassword(false)
      await data.refresh(); page.refresh()
    } catch (error: unknown) { feedback.error('No se pudo crear el profesor', getErrorMessage(error, 'Revisa permisos y Edge Function.')) }
    finally { setCreatingTeacher(false) }
  }

  const handleExport = async () => {
    if (page.total >= 1000) return exportJobs.request('profiles', rpcFilters)
    return runAdminExport(feedback, setExporting, () => exportAdminProfiles({ role: 'teacher', search, subjectId: courseId ? Number(courseId) : null, classroomId: classroomId ? Number(classroomId) : null, profileId: getSearchParam(params.teacherId) || null, active: accountStatus === 'all' ? null : accountStatus === 'active', activityState: activityState === 'all' ? null : activityState, createdFrom: toAdminFilterTimestamp(createdFrom), createdTo: toAdminFilterTimestamp(createdTo, true) }))
  }

  const applyGovernance = async (result: AdminGovernanceResult) => {
    const ids = selection.selected
    if (governanceMode === 'deactivate-user') await actions.executeBulkAction({ action: 'deactivate_users', entity: 'profiles', ids, reason: result.reason, reactivateAt: result.reactivateAt })
    selection.clear(); setGovernanceMode(null); page.refresh()
  }

  const canManage = Boolean(data.portalContext?.permissions.includes('users.manage'))
  const canSecurity = Boolean(data.portalContext?.permissions.includes('users.security'))
  const canExport = Boolean(data.portalContext?.permissions.includes('users.export'))
  const isMobile = responsive.isMobile
  const copyTemporaryPassword = async () => {
    if (!createdTeacher?.temporaryPassword) return
    try { await Clipboard.setStringAsync(createdTeacher.temporaryPassword); feedback.success('Contraseña copiada', 'Guárdala de forma segura y compártela únicamente con el profesor.') }
    catch (error: unknown) { feedback.error('No se pudo copiar la contraseña', getErrorMessage(error, 'Inténtalo de nuevo.')) }
  }
  return (
    <AdminScaffold activeSection="teachers" title="Profesores" subtitle="Supervisa cuentas, seguridad, actividad y cursos docentes." data={data}>
      <AdminUsersSection
        createArea={canManage ? <Panel title="Crear cuenta de profesor" icon="person-add-outline" className="mt-5"><View className="flex-row flex-wrap items-end gap-3"><AdminInput label="Alias" value={teacherAlias} onChangeText={setTeacherAlias} placeholder="Ej. Profesor Random" /><AdminInput label="Correo" value={teacherEmail} onChangeText={setTeacherEmail} placeholder="profesor@centro.es" autoCapitalize="none" /><AdminButton label={creatingTeacher ? 'Creando...' : 'Crear profesor'} icon="person-add-outline" loading={creatingTeacher} disabled={creatingTeacher} onPress={handleCreateTeacher} /></View><Text className="mt-3 text-[11px] leading-4 text-text-muted">La contraseña temporal se genera de forma segura en el servidor.</Text>{createdTeacher ? <View className="mt-4 rounded-xl border border-border-default bg-surface-interactive p-4"><Text className="font-black text-text-primary">Profesor creado</Text><Text className="mt-1 text-[13px] text-text-secondary">{createdTeacher.teacher.alias} · {createdTeacher.teacher.email}</Text>{createdTeacher.temporaryPassword ? <View className="mt-3 gap-3"><View className="rounded-xl border border-border-default bg-surface-default px-4 py-3"><Text className="text-[10px] font-black uppercase tracking-[0.7px] text-text-muted">Contraseña temporal</Text><Text selectable={showTemporaryPassword} className="mt-2 font-mono text-[14px] font-black text-brand-admin">{showTemporaryPassword ? createdTeacher.temporaryPassword : '••••••••••••••••'}</Text></View><View className="flex-row flex-wrap gap-2"><AdminButton label={showTemporaryPassword ? 'Ocultar' : 'Mostrar'} icon={showTemporaryPassword ? 'eye-off-outline' : 'eye-outline'} size="sm" variant="secondary" onPress={() => setShowTemporaryPassword((value) => !value)} /><AdminButton label="Copiar" icon="copy-outline" size="sm" variant="secondary" onPress={() => void copyTemporaryPassword()} /></View></View> : null}</View> : null}</Panel> : undefined}
        listArea={<Panel title="Listado de profesores" icon="school-outline" className="mt-5">
          <AdminSearchBar search={search} onChangeSearch={setSearch} placeholder="Buscar profesor por nombre o correo..." exporting={exporting || exportJobs.loading} onExport={canExport && !isMobile ? () => void handleExport() : undefined} />
          <AdminProfileFilters currentRole="teacher" directory={directory} accountStatus={accountStatus} activityState={activityState} courseId={courseId} classroomId={classroomId} createdFrom={createdFrom} createdTo={createdTo} onChangeAccountStatus={setAccountStatus} onChangeActivityState={setActivityState} onChangeCourseId={setCourseId} onChangeClassroomId={setClassroomId} onChangeCreatedFrom={setCreatedFrom} onChangeCreatedTo={setCreatedTo} mobileAction={canExport ? <AdminButton label={exporting || exportJobs.loading ? 'Preparando...' : 'Exportar'} icon="download-outline" variant="secondary" loading={exporting || exportJobs.loading} disabled={exporting || exportJobs.loading} onPress={() => void handleExport()} /> : undefined} />
          {canManage ? <AdminBulkSelectionBar count={selection.count} onClear={selection.clear} onSelectPage={() => selection.selectPage(page.rows.map((row) => row.id))} primaryLabel="Desactivar seleccionados" onPrimary={() => setGovernanceMode('deactivate-user')} secondaryLabel="Activar seleccionados" onSecondary={() => void actions.executeBulkAction({ action: 'activate_users', entity: 'profiles', ids: selection.selected }).then(() => { selection.clear(); page.refresh() })} /> : null}
          <View className="mt-4">{page.loading && !page.refreshing ? <ListLoadingState /> : null}<VirtualizedStack data={page.rows} keyExtractor={(profile) => profile.id} renderItem={(profile) => <ProfileRowCard profile={profile} meta={`${profile.subject_count ?? 0} ${(profile.subject_count ?? 0) === 1 ? 'curso' : 'cursos'}`} selected={selection.isSelected(profile.id)} onToggleSelected={canManage ? () => selection.toggle(profile.id) : undefined} actions={[
            { label: 'Ver actividad', icon: 'pulse-outline', onPress: () => actions.viewProfileActivity(profile) },
            { label: 'Historial de cambios', icon: 'git-compare-outline', onPress: () => setHistoryProfile(profile) },
            { label: 'Ver cursos', icon: 'book-outline', onPress: () => actions.router.push(`/(admin)/courses?teacherId=${profile.id}` as Href) },
            { label: profile.active === false ? 'Activar' : 'Desactivar', icon: profile.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: profile.active !== false, disabled: !canManage || profile.id === data.portalContext?.user_id, onPress: () => profile.active === false ? void actions.toggleProfileActive(profile) : (selection.selectPage([profile.id]), setGovernanceMode('deactivate-user')) },
            { label: 'Resetear contraseña', icon: 'key-outline', disabled: !canSecurity, onPress: () => void actions.resetPassword(profile) },
          ]} />} emptyComponent={!page.loading ? <EmptyState label="No hay profesores que coincidan con los filtros." /> : null} accessibilityLabel="Profesores administrados" /></View>
          <AdminPaginationControls page={page.page} pageSize={page.pageSize} total={page.total} hasPrevious={page.hasPrevious} hasNext={page.hasNext} onPrevious={page.previousPage} onNext={page.nextPage} />
        </Panel>}
      />
      {confirmation.modal}
      <AdminGovernanceModal visible={Boolean(governanceMode)} mode={governanceMode || 'deactivate-user'} count={selection.count} onCancel={() => setGovernanceMode(null)} onConfirm={applyGovernance} />
      <AdminUserChangeHistoryModal profile={historyProfile} visible={Boolean(historyProfile)} onClose={() => setHistoryProfile(null)} />
    </AdminScaffold>
  )
}

async function getTeacherCreationError(error: unknown) {
  const fallback = getErrorMessage(error, 'Revisa permisos y Edge Function.')
  const context = error && typeof error === 'object' && 'context' in error ? (error as { context?: unknown }).context : null
  if (context && typeof context === 'object' && 'clone' in context && typeof (context as Response).clone === 'function') {
    try { const payload = await (context as Response).clone().json() as { error?: unknown }; if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim() } catch {}
  }
  return fallback
}

export const AdminTeachersScreen = AdminTeachersSection
