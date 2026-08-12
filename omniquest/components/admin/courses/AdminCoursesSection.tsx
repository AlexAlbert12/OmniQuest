import React, { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, type Href } from 'expo-router'
import AdminButton from '../shared/AdminButton'
import AdminSearchBar from '../shared/AdminSearchBar'
import AdminBulkSelectionBar from '../shared/AdminBulkSelectionBar'
import AdminGovernanceModal, { type AdminGovernanceMode, type AdminGovernanceResult } from '../shared/AdminGovernanceModal'
import { AdminCourseSupervisionFilters, toAdminFilterTimestamp, useAdminDirectoryFilters } from '../shared/AdminAdvancedFilters'
import { useAdminTypedConfirmation } from '../shared/AdminTypedConfirmation'
import { exportAdminSubjects } from '../../../lib/adminExports'
import { useAdminActions } from '../hooks/useAdminActions'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminExportJobs } from '../hooks/useAdminExportJobs'
import { useAdminRpcPage } from '../hooks/useAdminRpcPage'
import { useAdminSelection } from '../hooks/useAdminSelection'
import { AdminScaffold } from '../shared/AdminScaffold'
import { AdminPaginationControls, CourseRowCard, EmptyState, ListLoadingState, Panel } from '../shared/AdminPrimitives'
import { ADMIN_PAGE_SIZE, type RowAction, type SubjectRow } from '../types/admin'
import { buildTeacherProfileFromSubject, getSearchParam, runAdminExport } from '../utils/adminUtils'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useResponsiveLayout } from '../../../lib/responsive'

export function AdminCoursesSection() {
  const feedback = useAppFeedback()
  const responsive = useResponsiveLayout()
  const data = useAdminData()
  const confirmation = useAdminTypedConfirmation()
  const actions = useAdminActions(data, confirmation.request)
  const selection = useAdminSelection<number>()
  const clearSelection = selection.clear
  const exportJobs = useAdminExportJobs()
  const { directory } = useAdminDirectoryFilters()
  const params = useLocalSearchParams<{ teacherId?: string; archived?: string; search?: string; subjectId?: string }>()
  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const debouncedSearch = useDebouncedValue(search, 350)
  const [teacherId, setTeacherId] = useState(() => getSearchParam(params.teacherId))
  const [activeState, setActiveState] = useState('all')
  const [archivedState, setArchivedState] = useState(() => getSearchParam(params.archived) === '1' ? 'archived' : 'all')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [governanceMode, setGovernanceMode] = useState<AdminGovernanceMode | null>(null)
  const pageSize = responsive.isDesktop ? ADMIN_PAGE_SIZE : 8
  const exactSubjectId = useMemo(() => { const value = Number(getSearchParam(params.subjectId)); return Number.isInteger(value) && value > 0 ? value : null }, [params.subjectId])

  useEffect(() => { setSearch(getSearchParam(params.search)) }, [params.search])

  const rpcFilters = useMemo(() => ({
    p_search: debouncedSearch.trim(), p_subject_id: exactSubjectId, p_teacher_id: teacherId || null,
    p_archived: archivedState === 'all' ? null : archivedState === 'archived', p_active: activeState === 'all' ? null : activeState === 'active',
    p_created_from: toAdminFilterTimestamp(createdFrom), p_created_to: toAdminFilterTimestamp(createdTo, true),
  }), [activeState, archivedState, createdFrom, createdTo, debouncedSearch, exactSubjectId, teacherId])
  const page = useAdminRpcPage<SubjectRow>('get_admin_subjects_page', rpcFilters, data.version, pageSize)
  useEffect(() => clearSelection(), [activeState, archivedState, clearSelection, createdFrom, createdTo, exactSubjectId, page.page, search, teacherId])

  const handleExport = async () => {
    if (page.total >= 1000) return exportJobs.request('subjects', rpcFilters)
    return runAdminExport(feedback, setExporting, () => exportAdminSubjects({ search: debouncedSearch, subjectId: exactSubjectId, teacherId: teacherId || null, archived: archivedState === 'all' ? null : archivedState === 'archived', active: activeState === 'all' ? null : activeState === 'active', createdFrom: toAdminFilterTimestamp(createdFrom), createdTo: toAdminFilterTimestamp(createdTo, true) }))
  }

  const applyGovernance = async (result: AdminGovernanceResult) => {
    if (governanceMode === 'archive-course') await actions.executeBulkAction({ action: 'archive_courses', entity: 'subjects', ids: selection.selected, reason: result.reason, deactivateClassrooms: result.deactivateClassrooms })
    if (governanceMode === 'transfer-course' && result.targetTeacherId) await actions.executeBulkAction({ action: 'transfer_courses', entity: 'subjects', ids: selection.selected, reason: result.reason, targetTeacherId: result.targetTeacherId })
    selection.clear(); setGovernanceMode(null); page.refresh()
  }

  const selectedRows = page.rows.filter((row) => selection.selectedIds.has(row.id))
  const canRestoreSelected = selectedRows.length > 0 && selectedRows.every((row) => row.is_archived)
  const canDeleteSelected = selectedRows.length > 0 && selectedRows.every((row) => Boolean(row.deletion_eligible_at && new Date(row.deletion_eligible_at).getTime() <= Date.now()))
  const permissions = data.portalContext?.permissions || []
  const canRead = permissions.includes('courses.read')
  const canManage = permissions.includes('courses.manage')
  const canTransfer = permissions.includes('courses.transfer')
  const canDelete = permissions.includes('courses.delete')
  const canAudit = permissions.includes('audit.read')
  const canUsers = permissions.includes('users.read')

  const restoreSelected = async () => { await actions.executeBulkAction({ action: 'restore_courses', entity: 'subjects', ids: selection.selected, reason: 'Restauración por lote desde el portal' }); selection.clear(); page.refresh() }
  const deleteSelected = async () => {
    const approved = await confirmation.request({ title: 'Eliminar cursos seleccionados', message: 'Solo se eliminarán cursos archivados fuera del periodo de conservación y sin clases ni matrículas vinculadas.', confirmationText: 'ELIMINAR CURSOS', confirmLabel: 'Eliminar definitivamente', destructive: true, icon: 'trash-outline' })
    if (!approved) return
    await actions.executeBulkAction({ action: 'delete_courses', entity: 'subjects', ids: selection.selected, reason: 'Eliminación por lote tras política de retención' }); selection.clear(); page.refresh()
  }

  const teacherOptions = directory.teachers.filter((teacher) => teacher.active).map((teacher) => ({ value: teacher.id, label: teacher.alias, subtitle: teacher.email || undefined }))
  const exportButton = <AdminButton label={exporting || exportJobs.loading ? 'Preparando...' : 'Exportar CSV'} icon="download-outline" variant="secondary" loading={exporting || exportJobs.loading} disabled={exporting || exportJobs.loading} onPress={() => void handleExport()} />

  return (
    <AdminScaffold activeSection="courses" title="Cursos" subtitle="Supervisa propietarios, archivo, conservación y relación con sus clases." data={data}>
      <Panel title="Supervisión de cursos" icon="book-outline" className="mt-5">
        <AdminSearchBar search={search} onChangeSearch={setSearch} placeholder="Buscar curso, código o profesor..." exporting={exporting || exportJobs.loading} onExport={!responsive.isMobile ? () => void handleExport() : undefined} />
        <AdminCourseSupervisionFilters directory={directory} teacherId={teacherId} activeState={activeState} archivedState={archivedState} createdFrom={createdFrom} createdTo={createdTo} onChangeTeacherId={setTeacherId} onChangeActiveState={setActiveState} onChangeArchivedState={setArchivedState} onChangeCreatedFrom={setCreatedFrom} onChangeCreatedTo={setCreatedTo} mobileAction={responsive.isMobile ? exportButton : undefined} />
        {canManage ? <AdminBulkSelectionBar count={selection.count} onClear={selection.clear} onSelectPage={() => selection.selectPage(page.rows.map((row) => row.id))} primaryLabel="Archivar seleccionados" onPrimary={() => setGovernanceMode('archive-course')} secondaryLabel={canTransfer ? 'Transferir propietario' : undefined} onSecondary={canTransfer ? () => setGovernanceMode('transfer-course') : undefined} actions={[{ label: 'Restaurar seleccionados', disabled: !canRestoreSelected, onPress: () => void restoreSelected() }, ...(canDelete ? [{ label: 'Eliminar seleccionados', variant: 'danger' as const, disabled: !canDeleteSelected, onPress: () => void deleteSelected() }] : [])]} /> : null}
        <View className="mt-4" style={{ gap: 12 }}>
          {page.loading && !page.refreshing ? <ListLoadingState /> : null}
          {page.rows.map((subject) => {
            const eligibleForDeletion = Boolean(subject.deletion_eligible_at && new Date(subject.deletion_eligible_at).getTime() <= Date.now())
            const rowActions: RowAction[] = []
            if (canRead) rowActions.push({ label: 'Ver clases', icon: 'albums-outline', onPress: () => actions.router.push(`/(admin)/classrooms?subjectId=${subject.id}` as Href) })
            if (canAudit) rowActions.push({ label: 'Ver auditoría', icon: 'shield-checkmark-outline', onPress: () => actions.viewRelatedAudit('subjects', subject.id) })
            if (canTransfer) rowActions.push({ label: 'Transferir propietario', icon: 'swap-horizontal-outline', onPress: () => { selection.selectPage([subject.id]); setGovernanceMode('transfer-course') } })
            if (canManage) rowActions.push({ label: subject.is_archived ? 'Restaurar' : 'Archivar', icon: subject.is_archived ? 'refresh-outline' : 'archive-outline', destructive: !subject.is_archived, onPress: () => subject.is_archived ? void actions.executeBulkAction({ action: 'restore_courses', entity: 'subjects', ids: [subject.id], reason: 'Restauración manual desde el portal' }).then(page.refresh) : (selection.selectPage([subject.id]), setGovernanceMode('archive-course')) })
            if (canDelete && eligibleForDeletion) rowActions.push({ label: 'Eliminar definitivamente', icon: 'trash-outline', destructive: true, onPress: () => void confirmation.request({ title: 'Eliminar curso', message: 'El curso ya ha superado el periodo de conservación. Solo se eliminará si no mantiene clases activas ni matrículas vigentes.', confirmationText: 'ELIMINAR CURSO', confirmLabel: 'Eliminar definitivamente', destructive: true, icon: 'trash-outline' }).then((approved) => approved ? actions.executeBulkAction({ action: 'delete_courses', entity: 'subjects', ids: [subject.id], reason: 'Eliminación tras política de retención' }).then(page.refresh) : undefined) })
            if (canUsers) rowActions.push({ label: 'Ver profesor', icon: 'school-outline', onPress: () => subject.teacher_id ? actions.router.push(`/(admin)/teachers?teacherId=${subject.teacher_id}` as Href) : feedback.warning('Curso sin profesor', 'Transfiere el curso a un profesor activo para restaurar su gobernanza.') })
            return <CourseRowCard key={subject.id} subject={subject} teacher={buildTeacherProfileFromSubject(subject)} classesCount={subject.classes_count ?? 0} enrollmentsCount={subject.enrollments_count ?? 0} selected={selection.isSelected(subject.id)} onToggleSelected={canManage ? () => selection.toggle(subject.id) : undefined} actions={rowActions} />
          })}
          {!page.loading && page.rows.length === 0 ? <EmptyState label="No hay cursos que coincidan con los filtros." /> : null}
        </View>
        <AdminPaginationControls page={page.page} pageSize={page.pageSize} total={page.total} hasPrevious={page.hasPrevious} hasNext={page.hasNext} onPrevious={page.previousPage} onNext={page.nextPage} />
      </Panel>
      {confirmation.modal}
      <AdminGovernanceModal visible={Boolean(governanceMode)} mode={governanceMode || 'archive-course'} count={selection.count} teacherOptions={teacherOptions} onCancel={() => setGovernanceMode(null)} onConfirm={applyGovernance} />
    </AdminScaffold>
  )
}

export const AdminCoursesScreen = AdminCoursesSection
