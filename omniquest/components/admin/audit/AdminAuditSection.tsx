import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AdminButton from '../shared/AdminButton'
import { ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import VirtualizedStack from '../../ui/VirtualizedStack'
import AdminSearchBar from '../shared/AdminSearchBar'
import AdminAuditTable from './AdminAuditTable'
import { AdminDateRangeFields, AdminFilterSelect, AdminMobileFilterShell, toAdminFilterTimestamp, useAdminDirectoryFilters } from '../shared/AdminAdvancedFilters'
import { supabase } from '../../../lib/supabase'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage, isRecord } from '../../../lib/typeGuards'
import { useResponsiveLayout } from '../../../lib/responsive'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminExportJobs } from '../hooks/useAdminExportJobs'
import { useAdminRpcPage } from '../hooks/useAdminRpcPage'
import { AdminScaffold } from '../shared/AdminScaffold'
import { AdminPaginationControls, EmptyState, ListLoadingState, MiniPill, Panel } from '../shared/AdminPrimitives'
import { AuditLogCard, AuditTechnicalDetailsSheet } from './AdminAuditComponents'
import type { AdminAuditLogRow } from '../types/admin'
import { formatAuditDate, getAuditActionLabel, getAuditTargetTypeLabel, getSearchParam } from '../utils/adminUtils'

type AuditPolicy = { retention_months?: number; capture_request_context?: boolean; strong_integrity?: boolean; append_only?: boolean; partitioned?: boolean; context_storage?: string; retention_checkpoints?: boolean }
type IntegrityResult = { valid?: boolean; checked_rows?: number; first_invalid_id?: number | null; verified_at?: string }

export function AdminAuditSection() {
  const responsive = useResponsiveLayout()
  const auditPageSize = responsive.isDesktop ? 25 : 8
  const feedback = useAppFeedback()
  const data = useAdminData()
  const exportJobs = useAdminExportJobs()
  const canExport = data.portalContext?.permissions.includes('audit.export') === true
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
  const [policyState, setPolicyState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [showPolicyTechnical, setShowPolicyTechnical] = useState(false)
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [technicalLog, setTechnicalLog] = useState<AdminAuditLogRow | null>(null)

  useEffect(() => { setEntity(getSearchParam(params.targetTable)); setTargetId(getSearchParam(params.targetId)) }, [params.targetId, params.targetTable])
  useEffect(() => {
    let cancelled = false
    const loadPolicy = async () => {
      setPolicyState('loading')
      setPolicyError(null)
      const { data: value, error } = await supabase.rpc('get_admin_audit_policy')
      if (cancelled) return
      const mapped = error ? null : mapAuditPolicy(value)
      if (error || !mapped) { setPolicy(null); setPolicyState('error'); setPolicyError(error?.message || 'La política de auditoría no está disponible.') }
      else { setPolicy(mapped); setPolicyState('ready') }
    }
    void loadPolicy()
    return () => { cancelled = true }
  }, [])
  useEffect(() => { setIntegrity(null) }, [data.version])

  const rpcFilters = { p_search: search.trim() || null, p_actor_id: actorId || null, p_action: action || null, p_target_table: entity || null, p_target_id: targetId || null, p_from: toAdminFilterTimestamp(createdFrom), p_to: toAdminFilterTimestamp(createdTo, true), p_severity: severity || null }
  const auditPage = useAdminRpcPage<AdminAuditLogRow>('get_admin_audit_logs_page_secured', rpcFilters, data.version, auditPageSize)
  const actionOptions = useMemo(() => [{ value: '', label: 'Todas las acciones' }, ...directory.audit_actions.map((value) => ({ value, label: getAuditActionLabel(value) }))], [directory.audit_actions])
  const entityOptions = useMemo(() => [{ value: '', label: 'Todas las entidades' }, ...directory.audit_entities.map((value) => ({ value, label: getAuditTargetTypeLabel(value) }))], [directory.audit_entities])
  const severityOptions = useMemo(() => [{ value: '', label: 'Todas las severidades' }, { value: 'info', label: 'Información' }, { value: 'warning', label: 'Advertencia' }, { value: 'critical', label: 'Crítica' }], [])
  const actorOptions = useMemo(() => [{ value: '', label: 'Todos los administradores' }, ...directory.actors.map((actor) => ({ value: actor.id, label: actor.alias, subtitle: actor.email || undefined }))], [directory.actors])
  const activeFilters = useMemo(() => {
    const values: { key: string; label: string; clear: () => void }[] = []
    if (actorId) values.push({ key: 'actor', label: `Usuario: ${directory.actors.find((item) => item.id === actorId)?.alias || 'Administrador'}`, clear: () => setActorId('') })
    if (action) values.push({ key: 'action', label: `Acción: ${getAuditActionLabel(action)}`, clear: () => setAction('') })
    if (entity) values.push({ key: 'entity', label: `Entidad: ${getAuditTargetTypeLabel(entity)}`, clear: () => { setEntity(''); setTargetId('') } })
    if (targetId) values.push({ key: 'target', label: 'Referencia exacta', clear: () => setTargetId('') })
    if (severity) values.push({ key: 'severity', label: `Severidad: ${severityOptions.find((item) => item.value === severity)?.label || severity}`, clear: () => setSeverity('') })
    if (createdFrom) values.push({ key: 'from', label: `Desde: ${createdFrom}`, clear: () => setCreatedFrom('') })
    if (createdTo) values.push({ key: 'to', label: `Hasta: ${createdTo}`, clear: () => setCreatedTo('') })
    return values
  }, [action, actorId, createdFrom, createdTo, directory.actors, entity, severity, severityOptions, targetId])
  const activeFilterCount = activeFilters.length

  const clearFilters = useCallback(() => { setActorId(''); setAction(''); setEntity(''); setTargetId(''); setSeverity(''); setCreatedFrom(''); setCreatedTo('') }, [])
  const handleExport = useCallback(() => exportJobs.request('audit', { search, actorId: actorId || null, action: action || null, targetTable: entity || null, targetId: targetId || null, from: toAdminFilterTimestamp(createdFrom), to: toAdminFilterTimestamp(createdTo, true), severity: severity || null }), [action, actorId, createdFrom, createdTo, entity, exportJobs, search, severity, targetId])
  const verifyIntegrity = useCallback(async () => {
    setVerifying(true)
    try {
      const { data: result, error } = await supabase.rpc('verify_admin_audit_chain', {})
      if (error) throw error
      const value = mapIntegrityResult(result)
      setIntegrity(value)
      if (value.valid) feedback.success('Integridad verificada', `Se han verificado ${value.checked_rows || 0} registros sin alteraciones.`)
      else feedback.warning('Integridad comprometida', `La primera inconsistencia aparece en el registro #${value.first_invalid_id || 'desconocido'}.`)
    } catch (error: unknown) {
      setIntegrity(null)
      feedback.error('No se pudo verificar la integridad', getErrorMessage(error, 'Inténtalo de nuevo.'))
    } finally {
      setVerifying(false)
    }
  }, [feedback])
  const renderAuditLog = useCallback((log: AdminAuditLogRow) => <AuditLogCard log={log} data={data} onShowDetails={setTechnicalLog} />, [data])
  const auditLogKey = useCallback((log: AdminAuditLogRow) => `${log.id}-${log.created_at}`, [])

  const filterFields = (mobile: boolean) => <>
    <AdminFilterSelect label="Usuario" icon="person-outline" value={actorId} onChange={setActorId} options={actorOptions} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Acción" icon="flash-outline" value={action} onChange={setAction} options={actionOptions} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Entidad" icon="cube-outline" value={entity} onChange={(value) => { setEntity(value); setTargetId('') }} options={entityOptions} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Severidad" icon="warning-outline" value={severity} onChange={setSeverity} options={severityOptions} minWidth={mobile ? 0 : 180} />
    <AdminDateRangeFields from={createdFrom} to={createdTo} onChangeFrom={setCreatedFrom} onChangeTo={setCreatedTo} />
  </>
  const mobileExportAction = canExport ? <View style={{ flex: 1 }}><AdminButton label={exportJobs.loading ? 'Preparando...' : 'Exportar CSV'} icon="download-outline" variant="secondary" loading={exportJobs.loading} disabled={exportJobs.loading} fullWidth onPress={() => void handleExport()} /></View> : undefined

  return (
    <AdminScaffold activeSection="audit" title="Auditoría" subtitle="Consulta y verifica los cambios administrativos registrados en el portal." data={data}>
      <Panel title="Integridad del registro" icon="finger-print-outline" className="mt-5">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="min-w-[240px] flex-1"><Text className="text-[13px] font-black text-text-primary">Registro de auditoría protegido</Text><Text className="mt-1 text-[12px] leading-5 text-text-secondary">Los eventos administrativos se conservan de forma no editable y se enlazan criptográficamente para detectar alteraciones.</Text><Text className="mt-1 text-[11px] leading-5 text-text-muted">La verificación recorre siempre la cadena completa, independientemente de los filtros del listado.</Text></View>
          <AdminButton label={verifying ? 'Verificando...' : 'Verificar integridad'} icon="shield-checkmark-outline" size="sm" disabled={verifying} onPress={() => void verifyIntegrity()} />
        </View>
        {policyState === 'loading' ? <Text className="mt-4 text-[12px] font-bold text-text-muted">Consultando configuración de auditoría...</Text> : null}
        {policyState === 'error' ? <View className="mt-4 rounded-xl border border-semantic-danger bg-semantic-surface-danger px-4 py-3"><Text className="text-[12px] font-black text-text-primary">No se pudo consultar la configuración de auditoría.</Text><Text className="mt-1 text-[11px] text-text-secondary">{policyError || 'Vuelve a intentarlo más tarde.'}</Text></View> : null}
        {policyState === 'ready' && policy ? <>
          <View className="mt-4 flex-row flex-wrap items-center gap-2">{policy.append_only ? <MiniPill icon="lock-closed-outline" label="No editable" /> : null}{typeof policy.retention_months === 'number' ? <MiniPill icon="calendar-outline" label={`Conservación: ${policy.retention_months} meses`} /> : null}{policy.capture_request_context === false ? <MiniPill icon="eye-off-outline" label="IP y navegador no almacenados" /> : policy.capture_request_context === true ? <MiniPill icon="shield-outline" label="Contexto de solicitud protegido" /> : null}<AdminButton label={showPolicyTechnical ? 'Ocultar detalles técnicos' : 'Detalles técnicos'} icon="code-slash-outline" size="sm" variant="ghost" onPress={() => setShowPolicyTechnical((value) => !value)} /></View>
          {showPolicyTechnical ? <View className="mt-3 flex-row flex-wrap gap-2">{policy.append_only ? <MiniPill icon="lock-closed-outline" label="Append-only" /> : null}{policy.partitioned ? <MiniPill icon="layers-outline" label="Particionado mensual" /> : null}{policy.strong_integrity ? <MiniPill icon="link-outline" label="Encadenamiento SHA-256" /> : null}{policy.retention_checkpoints ? <MiniPill icon="bookmark-outline" label="Anclajes de retención" /> : null}</View> : null}
        </> : null}
        {integrity ? <View className={`mt-4 flex-row items-center gap-2 rounded-xl border px-4 py-3 ${integrity.valid ? 'border-semantic-success bg-semantic-surface-success' : 'border-semantic-danger bg-semantic-surface-danger'}`}><Ionicons name={integrity.valid ? 'checkmark-circle' : 'warning'} size={18} /><Text className="min-w-0 flex-1 text-[12px] font-black text-text-primary">{integrity.valid ? `Integridad correcta · ${integrity.checked_rows || 0} registros verificados${integrity.verified_at ? ` · ${formatAuditDate(integrity.verified_at)}` : ''}` : `Integridad comprometida · registro #${integrity.first_invalid_id || '—'}${integrity.verified_at ? ` · ${formatAuditDate(integrity.verified_at)}` : ''}`}</Text></View> : null}
      </Panel>

      <Panel title="Registro de auditoría" icon="shield-checkmark-outline" className="mt-5">
        <AdminSearchBar search={search} onChangeSearch={setSearch} placeholder="Buscar actor, acción, contenido o cambios..." exporting={exportJobs.loading} onExport={!responsive.isMobile && canExport ? () => void handleExport() : undefined} />
        {!responsive.isMobile ? <View className="mt-4 flex-row flex-wrap items-end gap-3">{filterFields(false)}</View> : <AdminMobileFilterShell actionFirst activeFilters={activeFilters} applyLabel="Aplicar" mobileAction={mobileExportAction} onClear={clearFilters} open={mobileFiltersOpen} setOpen={setMobileFiltersOpen} description="Refina el registro por usuario, acción, entidad, severidad y fechas.">{filterFields(true)}</AdminMobileFilterShell>}
        {targetId ? <View className="mt-3 flex-row flex-wrap items-center justify-between gap-3 rounded-xl border border-border-active bg-surface-interactive px-4 py-3"><Text className="min-w-0 flex-1 text-[12px] font-bold text-text-secondary">Auditoría relacionada con {getAuditTargetTypeLabel(entity)} · referencia {targetId.length > 18 ? `…${targetId.slice(-12)}` : targetId}</Text><AdminButton label="Quitar relación" size="sm" variant="ghost" icon="close" onPress={() => setTargetId('')} /></View> : null}
        {!responsive.isMobile && activeFilterCount > 0 ? <View className="mt-3 flex-row items-center justify-between gap-3"><Text className="text-[11px] font-bold text-text-muted">{activeFilterCount} {activeFilterCount === 1 ? 'filtro avanzado activo' : 'filtros avanzados activos'}</Text><AdminButton label="Limpiar filtros" size="sm" variant="ghost" icon="refresh-outline" onPress={clearFilters} /></View> : null}
        <View className="mt-4" style={{ gap: 12 }}>
          {auditPage.loading && !auditPage.refreshing ? <ListLoadingState /> : null}
          {!auditPage.loading && auditPage.rows.length > 0 ? responsive.isDesktop ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: 1260 }}><AdminAuditTable rows={auditPage.rows} onShowDetails={setTechnicalLog} /></ScrollView> : <VirtualizedStack data={auditPage.rows} keyExtractor={auditLogKey} renderItem={renderAuditLog} accessibilityLabel="Registros de auditoría" /> : null}
          {!auditPage.loading && auditPage.rows.length === 0 ? <EmptyState label="No hay acciones de auditoría que coincidan con los filtros." /> : null}
        </View>
        <AdminPaginationControls page={auditPage.page} pageSize={auditPage.pageSize} total={auditPage.total} hasPrevious={auditPage.hasPrevious} hasNext={auditPage.hasNext} onPrevious={auditPage.previousPage} onNext={auditPage.nextPage} />
      </Panel>
      <AuditTechnicalDetailsSheet log={technicalLog} onClose={() => setTechnicalLog(null)} />
    </AdminScaffold>
  )
}

function mapAuditPolicy(value: unknown): AuditPolicy | null {
  if (!isRecord(value) || Object.keys(value).length === 0) return null
  const retention = typeof value.retention_months === 'number' ? value.retention_months : Number(value.retention_months)
  return {
    retention_months: Number.isFinite(retention) ? retention : undefined,
    capture_request_context: typeof value.capture_request_context === 'boolean' ? value.capture_request_context : undefined,
    strong_integrity: typeof value.strong_integrity === 'boolean' ? value.strong_integrity : undefined,
    append_only: typeof value.append_only === 'boolean' ? value.append_only : undefined,
    partitioned: typeof value.partitioned === 'boolean' ? value.partitioned : undefined,
    context_storage: typeof value.context_storage === 'string' ? value.context_storage : undefined,
    retention_checkpoints: typeof value.retention_checkpoints === 'boolean' ? value.retention_checkpoints : undefined,
  }
}

function mapIntegrityResult(value: unknown): IntegrityResult {
  const row = isRecord(value) ? value : {}
  return { valid: row.valid === true, checked_rows: Number(row.checked_rows || 0), first_invalid_id: row.first_invalid_id == null ? null : Number(row.first_invalid_id), verified_at: typeof row.verified_at === 'string' ? row.verified_at : undefined }
}
