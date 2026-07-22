import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import AppButton from '../../ui/AppButton'
import AdminSearchBar from './AdminSearchBar'
import { AdminPagination } from './AdminPagination'
import AdminAuditTable from './AdminAuditTable'
import {
  AdminDateRangeFields,
  AdminFilterSelect,
  toAdminFilterTimestamp,
  useAdminDirectoryFilters,
} from './AdminAdvancedFilters'
import { exportAdminAudit } from '../../../lib/adminExports'
import {
  AdminScaffold,
  AuditLogCard,
  EmptyState,
  ListLoadingState,
  Panel,
  getAuditActionLabel,
  getSearchParam,
  runAdminExport,
  useAdminData,
  useAdminRpcPage,
  type AdminAuditLogRow,
} from './AdminPortalCore'

export function AdminAuditSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const auditPageSize = isDesktop ? 25 : 8
  const data = useAdminData()
  const { directory } = useAdminDirectoryFilters()
  const params = useLocalSearchParams<{ targetTable?: string; targetId?: string; actorId?: string; search?: string }>()

  const [search, setSearch] = useState(() => getSearchParam(params.search))
  const [actorId, setActorId] = useState(() => getSearchParam(params.actorId))
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState(() => getSearchParam(params.targetTable))
  const [targetId, setTargetId] = useState(() => getSearchParam(params.targetId))
  const [severity, setSeverity] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setEntity(getSearchParam(params.targetTable))
    setTargetId(getSearchParam(params.targetId))
  }, [params.targetId, params.targetTable])

  const rpcFilters = {
    p_search: search.trim() || null,
    p_actor_id: actorId || null,
    p_action: action || null,
    p_target_table: entity || null,
    p_target_id: targetId || null,
    p_from: toAdminFilterTimestamp(createdFrom),
    p_to: toAdminFilterTimestamp(createdTo, true),
    p_severity: severity || null,
  }

  const auditPage = useAdminRpcPage<AdminAuditLogRow>('get_admin_audit_logs_page', rpcFilters, data.version, auditPageSize)

  const actionOptions = useMemo(() => [
    { value: '', label: 'Todas las acciones' },
    ...directory.audit_actions.map((value) => ({ value, label: getAuditActionLabel(value), subtitle: value })),
  ], [directory.audit_actions])

  const entityOptions = useMemo(() => [
    { value: '', label: 'Todas las entidades' },
    ...directory.audit_entities.map((value) => ({ value, label: getEntityLabel(value), subtitle: value })),
  ], [directory.audit_entities])

  const activeFilterCount = [actorId, action, entity, targetId, severity, createdFrom, createdTo].filter(Boolean).length

  const clearFilters = () => {
    setActorId('')
    setAction('')
    setEntity('')
    setTargetId('')
    setSeverity('')
    setCreatedFrom('')
    setCreatedTo('')
  }

  const handleExport = () => runAdminExport(setExporting, () => exportAdminAudit({
    search,
    actorId: actorId || null,
    action: action || null,
    targetTable: entity || null,
    targetId: targetId || null,
    from: toAdminFilterTimestamp(createdFrom),
    to: toAdminFilterTimestamp(createdTo, true),
    severity: severity || null,
  }))

  return (
    <AdminScaffold activeSection="audit" title="Auditoría" subtitle="Trazabilidad completa de las acciones sensibles del portal." data={data}>
      <Panel title="Registro de auditoría" icon="shield-checkmark-outline" className="mt-5">
        <AdminSearchBar
          search={search}
          onChangeSearch={setSearch}
          placeholder="Buscar actor, acción, entidad o metadata..."
          exporting={exporting}
          onExport={() => void handleExport()}
        />

        <View className="mt-4 flex-row flex-wrap items-end gap-3">
          <AdminFilterSelect
            label="Usuario"
            icon="person-outline"
            value={actorId}
            onChange={setActorId}
            options={[
              { value: '', label: 'Todos los administradores' },
              ...directory.actors.map((actor) => ({ value: actor.id, label: actor.alias, subtitle: actor.email || undefined })),
            ]}
          />
          <AdminFilterSelect label="Acción" icon="flash-outline" value={action} onChange={setAction} options={actionOptions} />
          <AdminFilterSelect label="Entidad" icon="cube-outline" value={entity} onChange={(value) => { setEntity(value); setTargetId('') }} options={entityOptions} />
          <AdminFilterSelect
            label="Severidad"
            icon="warning-outline"
            value={severity}
            onChange={setSeverity}
            options={[
              { value: '', label: 'Todas las severidades' },
              { value: 'info', label: 'Información' },
              { value: 'warning', label: 'Advertencia' },
              { value: 'critical', label: 'Crítica' },
            ]}
          />
          <AdminDateRangeFields from={createdFrom} to={createdTo} onChangeFrom={setCreatedFrom} onChangeTo={setCreatedTo} />
        </View>

        {targetId ? (
          <View className="mt-3 flex-row flex-wrap items-center justify-between gap-3 rounded-xl border border-[#31588A] bg-[#102A54] px-4 py-3">
            <Text className="min-w-0 flex-1 text-[12px] font-bold text-[#DDE7F4]">
              Auditoría relacionada con {entity || 'entidad'} #{targetId}
            </Text>
            <AppButton label="Quitar relación" size="sm" variant="ghost" icon="close" onPress={() => setTargetId('')} />
          </View>
        ) : null}

        {activeFilterCount > 0 ? (
          <View className="mt-3 flex-row items-center justify-between gap-3">
            <Text className="text-[11px] font-bold text-[#8FA7C7]">{activeFilterCount} filtro(s) avanzado(s) activo(s)</Text>
            <AppButton label="Limpiar filtros" size="sm" variant="ghost" icon="refresh-outline" onPress={clearFilters} />
          </View>
        ) : null}

        <View className="mt-4" style={{ gap: 12 }}>
          {auditPage.loading && !auditPage.refreshing ? <ListLoadingState /> : null}
          {!auditPage.loading && auditPage.rows.length > 0 ? (
            isDesktop ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: 980 }}>
                <AdminAuditTable rows={auditPage.rows} />
              </ScrollView>
            ) : auditPage.rows.map((log) => <AuditLogCard key={log.id} log={log} data={data} />)
          ) : null}
          {!auditPage.loading && auditPage.rows.length === 0 ? (
            <EmptyState label="No hay acciones de auditoría que coincidan con los filtros." />
          ) : null}
        </View>

        <AdminPagination
          page={auditPage.page}
          pageSize={auditPage.pageSize}
          total={auditPage.total}
          hasPrevious={auditPage.hasPrevious}
          hasNext={auditPage.hasNext}
          onPrevious={auditPage.previousPage}
          onNext={auditPage.nextPage}
        />
      </Panel>
    </AdminScaffold>
  )
}

function getEntityLabel(value: string) {
  const labels: Record<string, string> = {
    profiles: 'Usuarios',
    subjects: 'Cursos',
    classrooms: 'Clases',
    enrollments: 'Inscripciones',
    questions: 'Preguntas',
    user_support_tickets: 'Soporte',
  }
  return labels[value] || value
}

export const AdminAuditScreen = AdminAuditSection
