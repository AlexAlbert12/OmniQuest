import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import AdminSearchBar from '../shared/AdminSearchBar'
import AdminAuditTable from './AdminAuditTable'
import { AdminDateRangeFields, AdminFilterSelect, toAdminFilterTimestamp, useAdminDirectoryFilters } from '../shared/AdminAdvancedFilters'
import { supabase } from '../../../lib/supabase'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminExportJobs } from '../hooks/useAdminExportJobs'
import { useAdminRpcPage } from '../hooks/useAdminRpcPage'
import { AdminScaffold } from '../shared/AdminScaffold'
import { AdminPaginationControls, EmptyState, ListLoadingState, MiniPill, Panel } from '../shared/AdminPrimitives'
import { AuditLogCard } from './AdminAuditComponents'
import type { AdminAuditLogRow } from '../types/admin'
import { getAuditActionLabel, getSearchParam, showAlert } from '../utils/adminUtils'

type AuditPolicy = { retention_months?: number; capture_request_context?: boolean; strong_integrity?: boolean; append_only?: boolean; partitioned?: boolean; context_storage?: string; retention_checkpoints?: boolean }
type IntegrityResult = { valid?: boolean; checked_rows?: number; first_invalid_id?: number | null; verified_at?: string }

export function AdminAuditSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const auditPageSize = isDesktop ? 25 : 8
  const data = useAdminData()
  const exportJobs = useAdminExportJobs()
  const canExport = !data.portalContext || data.portalContext.permissions.includes('audit.export')
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
  const [policy, setPolicy] = useState<AuditPolicy | null>(null)
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => { setEntity(getSearchParam(params.targetTable)); setTargetId(getSearchParam(params.targetId)) }, [params.targetId, params.targetTable])
  useEffect(() => { void supabase.rpc('get_admin_audit_policy' as any).then(({ data: value }) => setPolicy((value || {}) as AuditPolicy)) }, [])

  const rpcFilters = { p_search: search.trim() || null, p_actor_id: actorId || null, p_action: action || null, p_target_table: entity || null, p_target_id: targetId || null, p_from: toAdminFilterTimestamp(createdFrom), p_to: toAdminFilterTimestamp(createdTo, true), p_severity: severity || null }
  const auditPage = useAdminRpcPage<AdminAuditLogRow>('get_admin_audit_logs_page_secured', rpcFilters, data.version, auditPageSize)
  const actionOptions = useMemo(() => [{ value: '', label: 'Todas las acciones' }, ...directory.audit_actions.map((value) => ({ value, label: getAuditActionLabel(value), subtitle: value }))], [directory.audit_actions])
  const entityOptions = useMemo(() => [{ value: '', label: 'Todas las entidades' }, ...directory.audit_entities.map((value) => ({ value, label: getEntityLabel(value), subtitle: value }))], [directory.audit_entities])
  const activeFilterCount = [actorId, action, entity, targetId, severity, createdFrom, createdTo].filter(Boolean).length

  const clearFilters = () => { setActorId(''); setAction(''); setEntity(''); setTargetId(''); setSeverity(''); setCreatedFrom(''); setCreatedTo('') }
  const handleExport = () => exportJobs.request('audit', { search, actorId: actorId || null, action: action || null, targetTable: entity || null, targetId: targetId || null, from: toAdminFilterTimestamp(createdFrom), to: toAdminFilterTimestamp(createdTo, true), severity: severity || null })
  const verifyIntegrity = async () => {
    setVerifying(true)
    try {
      const { data: result, error } = await supabase.rpc('verify_admin_audit_chain' as any, { p_from: toAdminFilterTimestamp(createdFrom), p_to: toAdminFilterTimestamp(createdTo, true) })
      if (error) throw error
      const value = (result || {}) as IntegrityResult
      setIntegrity(value)
      showAlert(value.valid ? 'Integridad verificada' : 'Cadena no válida', value.valid ? `Se han verificado ${value.checked_rows || 0} registros sin alteraciones.` : `La primera inconsistencia aparece en el registro #${value.first_invalid_id || 'desconocido'}.`)
    } catch (error: any) { showAlert('No se pudo verificar la integridad', error?.message || 'Inténtalo de nuevo.') } finally { setVerifying(false) }
  }

  return (
    <AdminScaffold activeSection="audit" title="Auditoría" subtitle="Trazabilidad inmutable de las acciones sensibles del portal." data={data}>
      <Panel title="Gobierno del registro" icon="finger-print-outline" className="mt-5">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="min-w-[240px] flex-1"><Text className="text-[13px] font-black text-text-primary">Auditoría fuerte y gestionada en servidor</Text><Text className="mt-1 text-[12px] leading-5 text-text-secondary">Los eventos son append-only, se particionan por mes y enlazan criptográficamente cada registro con el anterior.</Text></View>
          <AppButton label={verifying ? 'Verificando...' : 'Verificar cadena'} icon="shield-checkmark-outline" size="sm" disabled={verifying} onPress={() => void verifyIntegrity()} />
        </View>
        <View className="mt-4 flex-row flex-wrap gap-2"><MiniPill icon="lock-closed-outline" label="Append-only" /><MiniPill icon="calendar-outline" label={`Retención: ${policy?.retention_months || 24} meses`} /><MiniPill icon="layers-outline" label="Particionado mensual" />{policy?.retention_checkpoints ? <MiniPill icon="bookmark-outline" label="Anclajes de retención" /> : null}<MiniPill icon="globe-outline" label={policy?.capture_request_context ? 'Contexto legal habilitado' : 'IP / agente deshabilitados'} /></View>
        {integrity ? <View className={`mt-4 flex-row items-center gap-2 rounded-xl border px-4 py-3 ${integrity.valid ? 'border-semantic-success bg-semantic-surface-success' : 'border-semantic-danger bg-semantic-surface-danger'}`}><Ionicons name={integrity.valid ? 'checkmark-circle' : 'warning'} size={18} /><Text className="min-w-0 flex-1 text-[12px] font-black text-text-primary">{integrity.valid ? `Cadena válida · ${integrity.checked_rows || 0} registros verificados` : `Cadena inválida · registro #${integrity.first_invalid_id || '—'}`}</Text></View> : null}
      </Panel>

      <Panel title="Registro de auditoría" icon="shield-checkmark-outline" className="mt-5">
        <AdminSearchBar search={search} onChangeSearch={setSearch} placeholder="Buscar actor, acción, entidad o cambios..." exporting={exportJobs.loading} onExport={canExport ? () => void handleExport() : undefined} />
        <View className="mt-4 flex-row flex-wrap items-end gap-3">
          <AdminFilterSelect label="Usuario" icon="person-outline" value={actorId} onChange={setActorId} options={[{ value: '', label: 'Todos los administradores' }, ...directory.actors.map((actor) => ({ value: actor.id, label: actor.alias, subtitle: actor.email || undefined }))]} />
          <AdminFilterSelect label="Acción" icon="flash-outline" value={action} onChange={setAction} options={actionOptions} />
          <AdminFilterSelect label="Entidad" icon="cube-outline" value={entity} onChange={(value) => { setEntity(value); setTargetId('') }} options={entityOptions} />
          <AdminFilterSelect label="Severidad" icon="warning-outline" value={severity} onChange={setSeverity} options={[{ value: '', label: 'Todas las severidades' }, { value: 'info', label: 'Información' }, { value: 'warning', label: 'Advertencia' }, { value: 'critical', label: 'Crítica' }]} />
          <AdminDateRangeFields from={createdFrom} to={createdTo} onChangeFrom={setCreatedFrom} onChangeTo={setCreatedTo} />
        </View>
        {targetId ? <View className="mt-3 flex-row flex-wrap items-center justify-between gap-3 rounded-xl border border-border-active bg-surface-interactive px-4 py-3"><Text className="min-w-0 flex-1 text-[12px] font-bold text-text-secondary">Auditoría relacionada con {entity || 'entidad'} #{targetId}</Text><AppButton label="Quitar relación" size="sm" variant="ghost" icon="close" onPress={() => setTargetId('')} /></View> : null}
        {activeFilterCount > 0 ? <View className="mt-3 flex-row items-center justify-between gap-3"><Text className="text-[11px] font-bold text-text-muted">{activeFilterCount} filtro(s) avanzado(s) activo(s)</Text><AppButton label="Limpiar filtros" size="sm" variant="ghost" icon="refresh-outline" onPress={clearFilters} /></View> : null}
        <View className="mt-4" style={{ gap: 12 }}>
          {auditPage.loading && !auditPage.refreshing ? <ListLoadingState /> : null}
          {!auditPage.loading && auditPage.rows.length > 0 ? isDesktop ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: 1260 }}><AdminAuditTable rows={auditPage.rows} /></ScrollView> : auditPage.rows.map((log) => <AuditLogCard key={`${log.id}-${log.created_at}`} log={log} data={data} />) : null}
          {!auditPage.loading && auditPage.rows.length === 0 ? <EmptyState label="No hay acciones de auditoría que coincidan con los filtros." /> : null}
        </View>
        <AdminPaginationControls page={auditPage.page} pageSize={auditPage.pageSize} total={auditPage.total} hasPrevious={auditPage.hasPrevious} hasNext={auditPage.hasNext} onPrevious={auditPage.previousPage} onNext={auditPage.nextPage} />
      </Panel>
    </AdminScaffold>
  )
}

function getEntityLabel(value: string) { const labels: Record<string, string> = { profiles: 'Usuarios', subjects: 'Cursos', classrooms: 'Clases', enrollments: 'Inscripciones', questions: 'Preguntas', user_support_tickets: 'Soporte' }; return labels[value] || value }
export const AdminAuditScreen = AdminAuditSection
