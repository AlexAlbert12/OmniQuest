import React, { useEffect, useMemo, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useLocalSearchParams, type Href } from 'expo-router'
import AdminSearchBar from '../shared/AdminSearchBar'
import AdminBulkSelectionBar from '../shared/AdminBulkSelectionBar'
import AdminGovernanceModal, { type AdminGovernanceMode, type AdminGovernanceResult } from '../shared/AdminGovernanceModal'
import { AdminClassroomSupervisionFilters, toAdminFilterTimestamp, useAdminDirectoryFilters } from '../shared/AdminAdvancedFilters'
import { useAdminTypedConfirmation } from '../shared/AdminTypedConfirmation'
import { exportAdminClassrooms } from '../../../lib/adminExports'
import { useAdminActions } from '../hooks/useAdminActions'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminExportJobs } from '../hooks/useAdminExportJobs'
import { useAdminRpcPage } from '../hooks/useAdminRpcPage'
import { useAdminSelection } from '../hooks/useAdminSelection'
import { AdminScaffold } from '../shared/AdminScaffold'
import { AdminPaginationControls, ClassroomRowCard, EmptyState, ListLoadingState, Panel } from '../shared/AdminPrimitives'
import { ADMIN_PAGE_SIZE, type ClassroomRow } from '../types/admin'
import { buildSubjectFromClassroom, getSearchParam, runAdminExport } from '../utils/adminUtils'
import { useAppFeedback } from '../../../hooks/useAppFeedback'

export function AdminClassroomsSection() {
  const feedback = useAppFeedback()
  const { width } = useWindowDimensions()
  const data = useAdminData()
  const confirmation = useAdminTypedConfirmation()
  const actions = useAdminActions(data, confirmation.request)
  const selection = useAdminSelection<number>()
  const exportJobs = useAdminExportJobs()
  const { directory } = useAdminDirectoryFilters()
  const params = useLocalSearchParams<{ subjectId?: string; studentId?: string; teacherId?: string; search?: string; classroomId?: string }>()
  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const [courseId, setCourseId] = useState(() => getSearchParam(params.subjectId))
  const [teacherId, setTeacherId] = useState(() => getSearchParam(params.teacherId))
  const [activeState, setActiveState] = useState('all')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [governanceMode, setGovernanceMode] = useState<AdminGovernanceMode | null>(null)
  const pageSize = width >= 1040 ? ADMIN_PAGE_SIZE : 8

  useEffect(() => {
    const directSearch = getSearchParam(params.search)
    if (directSearch) { setSearch(directSearch); return }
    const requestedId = Number(getSearchParam(params.classroomId))
    const requestedName = Number.isInteger(requestedId) && requestedId > 0 ? data.classroomById.get(requestedId)?.name : null
    if (requestedName) setSearch(requestedName)
  }, [data.classroomById, params.classroomId, params.search])
  const rpcFilters = useMemo(() => ({
    p_search: search.trim(), p_subject_id: courseId ? Number(courseId) : null,
    p_student_id: getSearchParam(params.studentId) || null, p_teacher_id: teacherId || null,
    p_active: activeState === 'all' ? null : activeState === 'active',
    p_created_from: toAdminFilterTimestamp(createdFrom), p_created_to: toAdminFilterTimestamp(createdTo, true),
  }), [activeState, courseId, createdFrom, createdTo, params.studentId, search, teacherId])
  const page = useAdminRpcPage<ClassroomRow>('get_admin_classrooms_page', rpcFilters, data.version, pageSize)

  const handleExport = async () => {
    if (page.total >= 1000) return exportJobs.request('classrooms', rpcFilters)
    return runAdminExport(feedback, setExporting, () => exportAdminClassrooms({ search, subjectId: courseId ? Number(courseId) : null, studentId: getSearchParam(params.studentId) || null, teacherId: teacherId || null, active: activeState === 'all' ? null : activeState === 'active', createdFrom: toAdminFilterTimestamp(createdFrom), createdTo: toAdminFilterTimestamp(createdTo, true) }))
  }

  const applyGovernance = async (result: AdminGovernanceResult) => {
    if (governanceMode === 'deactivate-classroom') await actions.executeBulkAction({ action: 'deactivate_classrooms', entity: 'classrooms', ids: selection.selected, reason: result.reason })
    selection.clear(); setGovernanceMode(null); page.refresh()
  }
  const canManage = !data.portalContext || data.portalContext.permissions.includes('courses.manage')

  return (
    <AdminScaffold activeSection="classrooms" title="Clases" subtitle="Supervisa estado operativo, códigos, propietarios y relación con el curso." data={data}>
      <Panel title="Supervisión de clases" icon="albums-outline" className="mt-5">
        <AdminSearchBar search={search} onChangeSearch={setSearch} placeholder="Buscar clase, código, curso o profesor..." exporting={exporting || exportJobs.loading} onExport={() => void handleExport()} />
        <AdminClassroomSupervisionFilters directory={directory} teacherId={teacherId} courseId={courseId} activeState={activeState} createdFrom={createdFrom} createdTo={createdTo} onChangeTeacherId={setTeacherId} onChangeCourseId={setCourseId} onChangeActiveState={setActiveState} onChangeCreatedFrom={setCreatedFrom} onChangeCreatedTo={setCreatedTo} />
        {canManage ? <AdminBulkSelectionBar count={selection.count} onClear={selection.clear} onSelectPage={() => selection.selectPage(page.rows.map((row) => row.id))} primaryLabel="Desactivar seleccionadas" onPrimary={() => setGovernanceMode('deactivate-classroom')} secondaryLabel="Activar seleccionadas" onSecondary={() => void actions.executeBulkAction({ action: 'activate_classrooms', entity: 'classrooms', ids: selection.selected }).then(() => { selection.clear(); page.refresh() })} /> : null}
        <View className="mt-4" style={{ gap: 12 }}>
          {page.loading && !page.refreshing ? <ListLoadingState /> : null}
          {page.rows.map((classroom) => <ClassroomRowCard key={classroom.id} classroom={classroom} subject={buildSubjectFromClassroom(classroom)} enrollmentsCount={classroom.enrollments_count ?? 0} selected={selection.isSelected(classroom.id)} onToggleSelected={canManage ? () => selection.toggle(classroom.id) : undefined} actions={[
            { label: 'Ver alumnos', icon: 'people-outline', onPress: () => actions.router.push(`/(admin)/students?classroomId=${classroom.id}` as Href) },
            { label: 'Ver auditoría', icon: 'shield-checkmark-outline', onPress: () => actions.viewRelatedAudit('classrooms', classroom.id) },
            { label: 'Copiar código', icon: 'copy-outline', disabled: !classroom.code || classroom.code_status === 'expired', onPress: () => void actions.copyClassroomCode(classroom) },
            { label: classroom.active === false ? 'Activar' : 'Desactivar', icon: classroom.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: classroom.active !== false, disabled: !canManage, onPress: () => classroom.active === false ? void actions.executeBulkAction({ action: 'activate_classrooms', entity: 'classrooms', ids: [classroom.id] }).then(page.refresh) : (selection.selectPage([classroom.id]), setGovernanceMode('deactivate-classroom')) },
            { label: 'Abrir curso', icon: 'book-outline', onPress: () => classroom.subject_id ? actions.router.push(`/(admin)/courses?search=${encodeURIComponent(classroom.subject_name || '')}` as Href) : undefined },
          ]} />)}
          {!page.loading && page.rows.length === 0 ? <EmptyState label="No hay clases que coincidan con los filtros." /> : null}
        </View>
        <AdminPaginationControls page={page.page} pageSize={page.pageSize} total={page.total} hasPrevious={page.hasPrevious} hasNext={page.hasNext} onPrevious={page.previousPage} onNext={page.nextPage} />
      </Panel>
      {confirmation.modal}
      <AdminGovernanceModal visible={Boolean(governanceMode)} mode={governanceMode || 'deactivate-classroom'} count={selection.count} onCancel={() => setGovernanceMode(null)} onConfirm={applyGovernance} />
    </AdminScaffold>
  )
}

export const AdminClassroomsScreen = AdminClassroomsSection
