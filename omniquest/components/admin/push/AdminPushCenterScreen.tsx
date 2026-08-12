import React, { useMemo, useState } from 'react'
import AdminButton from '../shared/AdminButton'
import { ActivityIndicator, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppBottomSheet, AppDropdown, AppPressable, DateCalendar } from '../../ui'
import { useAppModal } from '../../AppModalProvider'
import { useAppTheme } from '../../../lib/appTheme'
import { useI18n } from '../../../lib/i18n'
import { useResponsiveLayout } from '../../../lib/responsive'
import { formatAdminPushRelative, getAdminPushErrorLabel, getAdminPushRoleLabel, getAdminPushStatusLabel, getAdminPushTypeLabel } from '../../../lib/adminPushPresentation'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminPushCenter, type AdminPushFilters } from '../hooks/useAdminPushCenter'
import { AdminMetric, AdminPaginationControls, EmptyState, Panel } from '../shared/AdminPrimitives'
import { AdminScaffold } from '../shared/AdminScaffold'
import type { AdminPushDeliveryMetrics, AdminPushDeliveryRow } from '../types/admin'
import AdminPushDeliveryDetailDrawer from './AdminPushDeliveryDetailDrawer'

const ALL = '__all__'

export default function AdminPushCenterScreen() {
  const data = useAdminData()
  const responsive = useResponsiveLayout()
  const { showModal } = useAppModal()
  const canRead = Boolean(data.portalContext?.permissions.includes('notifications.read'))
  const canManage = Boolean(data.portalContext?.permissions.includes('notifications.manage'))
  const center = useAdminPushCenter(data.portalContext?.user_id || null, canRead)

  const confirmCancel = () => showModal({ title: 'Cancelar envío push', message: 'La notificación seguirá disponible dentro de OmniQuest, pero este envío push dejará de procesarse.', variant: 'warning', buttons: [{ label: 'Volver', role: 'cancel' }, { label: 'Cancelar envío', role: 'danger', onPress: center.cancel }] })

  return (
    <AdminScaffold activeSection="push" requiredPermissions={['notifications.read']} title="Notificaciones push" subtitle="Supervisa la cola, entregas, reintentos y dispositivos registrados sin exponer tokens internos." data={data}>
      <View className={responsive.isDesktop ? 'flex-row items-start justify-between gap-4' : 'gap-3'}>
        <ServiceHealth metrics={center.metrics} />
        {canManage ? <AdminButton label="Enviar prueba a mi dispositivo" icon="phone-portrait-outline" variant="secondary" loading={center.acting} onPress={center.sendTest} fullWidth={!responsive.isDesktop} /> : null}
      </View>
      <View className="mt-5"><PushMetrics metrics={center.metrics} /></View>
      <View className="mt-5"><PushFilters filters={center.filters} onChange={center.setFilters} /></View>
      <View className="mt-5"><PushDeliveryList loading={center.loading} rows={center.rows} isDesktop={responsive.isDesktop} onOpen={center.openDetail} /></View>
      {!center.loading && center.total > 0 ? <AdminPaginationControls page={center.page} pageSize={center.pageSize} total={center.total} hasPrevious={center.page > 0} hasNext={(center.page + 1) * center.pageSize < center.total} onPrevious={() => center.setPage(Math.max(0, center.page - 1))} onNext={() => center.setPage(center.page + 1)} /> : null}
      <AdminPushDeliveryDetailDrawer visible={center.selectedQueueId !== null} loading={center.detailLoading} detail={center.detail} canManage={canManage} acting={center.acting} onClose={center.closeDetail} onRetry={center.retry} onProcessNow={center.processNow} onCancel={confirmCancel} />
    </AdminScaffold>
  )
}

function ServiceHealth({ metrics }: { metrics: AdminPushDeliveryMetrics | null }) {
  const { tokens } = useAppTheme()
  const attention = metrics?.service_health === 'attention'
  const oldest = metrics?.oldest_pending_at ? formatAdminPushRelative(metrics.oldest_pending_at) : null
  return <View className="min-w-0 flex-1 rounded-2xl border border-border-default bg-surface-default px-4 py-3"><View className="flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: attention ? tokens.semanticSurface.warning : tokens.semanticSurface.success }}><Ionicons name={attention ? 'warning-outline' : 'checkmark-circle-outline'} size={21} color={attention ? tokens.semantic.warning : tokens.semantic.success} /></View><View className="min-w-0 flex-1"><Text className="text-[12px] font-bold text-text-muted">Servicio push</Text><Text className="mt-1 text-[15px] font-black text-text-primary">{attention ? 'Requiere atención' : 'Operativo'}</Text>{metrics ? <Text className="mt-1 text-[11px] leading-4 text-text-muted">{metrics.queued > 0 ? `${metrics.queued} pendientes${oldest ? ` · el más antiguo: ${oldest.toLowerCase()}` : ''}` : 'No hay envíos pendientes.'}{metrics.stale_receipts > 0 ? ` · ${metrics.stale_receipts} confirmaciones demoradas` : ''}</Text> : null}</View></View></View>
}

function PushMetrics({ metrics }: { metrics: AdminPushDeliveryMetrics | null }) {
  const { tokens } = useAppTheme()
  if (!metrics) return <Panel title="Entrega · 30 días" icon="paper-plane-outline"><EmptyState label="No se pudieron consultar las métricas push." /></Panel>
  const cards = [
    { label: 'Pendientes', value: metrics.queued, icon: 'time-outline' as const, color: tokens.semantic.info },
    { label: 'Procesando', value: metrics.processing, icon: 'sync-outline' as const, color: tokens.semantic.warning },
    { label: 'Entregadas', value: metrics.delivered, icon: 'checkmark-circle-outline' as const, color: tokens.semantic.success },
    { label: 'Fallidas', value: metrics.failed, icon: 'alert-circle-outline' as const, color: tokens.semantic.danger },
    { label: 'Omitidas', value: metrics.skipped, icon: 'remove-circle-outline' as const, color: tokens.text.muted },
    { label: 'Tasa de entrega', value: metrics.delivery_rate === null ? '—' : `${metrics.delivery_rate.toFixed(1)}%`, icon: 'analytics-outline' as const, color: tokens.brand.admin },
  ]
  return <Panel title="Entrega · 30 días" icon="paper-plane-outline"><View className="flex-row flex-wrap gap-3">{cards.map((card) => <View key={card.label} style={{ flexBasis: '30%', flexGrow: 1, minWidth: 145 }}><AdminMetric compact icon={card.icon} label={card.label} value={String(card.value)} color={card.color} /></View>)}</View>{metrics.waiting_receipt > 0 ? <Text className="mt-3 text-[12px] text-text-muted">{metrics.waiting_receipt} envío{metrics.waiting_receipt === 1 ? '' : 's'} esperando confirmación del proveedor.</Text> : null}{metrics.delivery_rate === null ? <Text className="mt-2 text-[11px] text-text-muted">Sin entregas resueltas todavía.</Text> : null}</Panel>
}

function PushFilters({ filters, onChange }: { filters: AdminPushFilters; onChange: (patch: Partial<AdminPushFilters>) => void }) {
  const { tokens } = useAppTheme()
  return <Panel title="Filtros" icon="options-outline" compact><View className="flex-row flex-wrap gap-3"><View className="min-w-[240px] flex-[2]"><Text className="mb-2 text-[12px] font-bold text-text-secondary">Buscar</Text><TextInput accessibilityLabel="Buscar destinatario o notificación" value={filters.search} onChangeText={(search) => onChange({ search })} placeholder="Alias, correo o título..." placeholderTextColor={tokens.text.muted} className="min-h-12 rounded-xl border border-border-default bg-surface-interactive px-4 text-text-primary" /></View><AppDropdown label="Estado" value={filters.status || ALL} options={[{ value: ALL, label: 'Todos los estados' }, { value: 'pending', label: 'Pendiente' }, { value: 'processing', label: 'Procesando' }, { value: 'waiting_receipt', label: 'Esperando confirmación' }, { value: 'completed', label: 'Entregada' }, { value: 'failed', label: 'Fallida' }, { value: 'skipped', label: 'Omitida' }, { value: 'cancelled', label: 'Cancelada' }]} onChange={(value) => onChange({ status: value === ALL ? null : value })} style={{ minWidth: 190, flex: 1 }} /><AppDropdown label="Destinatario" value={filters.role || ALL} options={[{ value: ALL, label: 'Todos' }, { value: 'student', label: 'Alumnos' }, { value: 'teacher', label: 'Profesores' }, { value: 'admin', label: 'Administradores' }]} onChange={(value) => onChange({ role: value === ALL ? null : value })} style={{ minWidth: 180, flex: 1 }} /><AppDropdown label="Tipo" value={filters.type || ALL} options={[{ value: ALL, label: 'Todos los tipos' }, { value: 'announcement', label: 'Aviso' }, { value: 'enrollment', label: 'Matrícula' }, { value: 'student_activity', label: 'Actividad del alumno' }, { value: 'achievement', label: 'Logro' }, { value: 'new_class', label: 'Contenido del curso' }, { value: 'manual_review', label: 'Revisión manual' }, { value: 'task', label: 'Tarea' }]} onChange={(value) => onChange({ type: value === ALL ? null : value })} style={{ minWidth: 190, flex: 1 }} /><PushDateField label="Desde" value={filters.from} boundary="start" onChange={(from) => onChange({ from })} /><PushDateField label="Hasta" value={filters.to} boundary="end" onChange={(to) => onChange({ to })} /></View></Panel>
}

function PushDateField({ boundary, label, onChange, value }: { boundary: 'start' | 'end'; label: string; onChange: (value: string | null) => void; value: string | null }) {
  const { tokens } = useAppTheme()
  const { locale } = useI18n()
  const selectedDate = useMemo(() => { if (!value) return null; const date = new Date(value); if (Number.isNaN(date.getTime())) return null; return boundary === 'end' ? new Date(date.getTime() - 1) : date }, [boundary, value])
  const [visible, setVisible] = useState(false)
  const [month, setMonth] = useState(selectedDate || new Date())
  const formatted = selectedDate ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(selectedDate) : 'Sin límite'
  const select = (date: Date) => { const next = boundary === 'start' ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1); onChange(next.toISOString()); setVisible(false) }
  return <View style={{ minWidth: 170, flex: 1 }}><Text className="mb-2 text-[12px] font-bold text-text-secondary">{label}</Text><AppPressable accessibilityLabel={`Fecha ${label.toLowerCase()}`} accessibilityHint="Abre un calendario para elegir la fecha" accessibilityState={{ expanded: visible }} onPress={() => { setMonth(selectedDate || new Date()); setVisible(true) }} style={({ pressed }) => ({ minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, opacity: pressed ? 0.82 : 1 })}><Ionicons name="calendar-outline" size={18} color={tokens.brand.admin} /><Text className="min-w-0 flex-1 text-[13px] font-extrabold text-text-primary">{formatted}</Text><Ionicons name="chevron-down" size={17} color={tokens.text.muted} /></AppPressable><AppBottomSheet visible={visible} onClose={() => setVisible(false)} title={`Fecha ${label.toLowerCase()}`} description="Selecciona un día en el calendario." footer={<View className="flex-row justify-end gap-2"><AdminButton label="Sin límite" icon="close-circle-outline" variant="ghost" onPress={() => { onChange(null); setVisible(false) }} /><AdminButton label="Cancelar" variant="secondary" onPress={() => setVisible(false)} /></View>}><DateCalendar month={month} selectedDate={selectedDate} onMonthChange={setMonth} onSelectDate={select} subtitle="Selecciona un día" locale={locale} minimumDate={null} selectionColor={tokens.brand.admin} /></AppBottomSheet></View>
}

function PushDeliveryList({ isDesktop, loading, onOpen, rows }: { isDesktop: boolean; loading: boolean; onOpen: (queueId: number) => void; rows: AdminPushDeliveryRow[] }) {
  if (loading) return <Panel title="Entregas push" icon="list-outline"><View className="items-center py-8"><ActivityIndicator /><Text className="mt-3 text-[13px] text-text-muted">Consultando entregas...</Text></View></Panel>
  return <Panel title={`Entregas push · ${rows[0]?.total_count || 0}`} icon="list-outline">{rows.length === 0 ? <EmptyState label="No hay entregas que coincidan con los filtros." /> : isDesktop ? <DesktopDeliveryTable rows={rows} onOpen={onOpen} /> : <View style={{ gap: 10 }}>{rows.map((row) => <MobileDeliveryCard key={row.queue_id} row={row} onOpen={onOpen} />)}</View>}</Panel>
}

function DesktopDeliveryTable({ onOpen, rows }: { onOpen: (queueId: number) => void; rows: AdminPushDeliveryRow[] }) {
  return <View><View className="flex-row gap-3 border-b border-border-subtle px-2 pb-3"><HeaderCell flex={1.2} label="Destinatario" /><HeaderCell flex={1.7} label="Notificación" /><HeaderCell flex={1} label="Estado" /><HeaderCell flex={0.6} label="Intentos" /><HeaderCell flex={0.6} label="Dispositivos" /><HeaderCell flex={0.8} label="Actualización" /><View style={{ width: 112 }} /></View>{rows.map((row) => <View key={row.queue_id} className="flex-row items-center gap-3 border-b border-border-subtle px-2 py-3"><View style={{ flex: 1.2 }}><Text className="font-black text-text-primary" numberOfLines={1}>{row.recipient_alias}</Text><Text className="mt-1 text-[11px] text-text-muted">{getAdminPushRoleLabel(row.recipient_role)}</Text></View><View style={{ flex: 1.7 }}><Text className="font-bold text-text-primary" numberOfLines={2}>{row.notification_title}</Text><Text className="mt-1 text-[11px] text-text-muted">{getAdminPushTypeLabel(row.notification_type)}</Text></View><View style={{ flex: 1 }}><StatusLabel row={row} /></View><Text style={{ flex: 0.6 }} className="text-[12px] font-bold text-text-secondary">{row.attempts}/{row.max_attempts}</Text><Text style={{ flex: 0.6 }} className="text-[12px] font-bold text-text-secondary">{row.active_devices}</Text><Text style={{ flex: 0.8 }} className="text-[11px] text-text-muted">{formatAdminPushRelative(row.updated_at)}</Text><View style={{ width: 112 }}><AdminButton label="Ver detalle" size="sm" variant="secondary" onPress={() => onOpen(row.queue_id)} /></View></View>)}</View>
}

function MobileDeliveryCard({ onOpen, row }: { onOpen: (queueId: number) => void; row: AdminPushDeliveryRow }) { const issue = getAdminPushErrorLabel(row.last_error_code, row.skip_reason); return <View className="rounded-2xl border border-border-default bg-surface-raised p-4"><View className="flex-row items-start justify-between gap-3"><View className="min-w-0 flex-1"><Text className="text-[15px] font-black text-text-primary" numberOfLines={2}>{row.notification_title}</Text><Text className="mt-1 text-[12px] text-text-secondary">{row.recipient_alias} · {getAdminPushRoleLabel(row.recipient_role)}</Text></View><StatusLabel row={row} /></View><View className="mt-3 flex-row flex-wrap gap-2"><MiniInfo icon="refresh-outline" text={`${row.attempts}/${row.max_attempts} intentos`} /><MiniInfo icon="phone-portrait-outline" text={`${row.active_devices} dispositivo${row.active_devices === 1 ? '' : 's'}`} /><MiniInfo icon="time-outline" text={formatAdminPushRelative(row.updated_at)} /></View>{issue ? <Text className="mt-3 text-[12px] font-bold text-semantic-warning">{issue}</Text> : null}<View className="mt-4"><AdminButton label="Ver detalle" icon="chevron-forward" iconPosition="right" size="sm" variant="secondary" fullWidth onPress={() => onOpen(row.queue_id)} /></View></View> }
function StatusLabel({ row }: { row: AdminPushDeliveryRow }) { const { tokens } = useAppTheme(); const color = row.queue_status === 'completed' ? tokens.semantic.success : row.queue_status === 'failed' ? tokens.semantic.danger : row.queue_status === 'skipped' || row.queue_status === 'cancelled' ? tokens.text.muted : row.queue_status === 'waiting_receipt' ? tokens.semantic.info : tokens.semantic.warning; return <View className="self-start rounded-full px-3 py-1" style={{ backgroundColor: `${color}22` }}><Text className="text-[10px] font-black" style={{ color }}>{getAdminPushStatusLabel(row.queue_status)}</Text></View> }
function HeaderCell({ flex, label }: { flex: number; label: string }) { return <Text accessibilityRole="header" style={{ flex }} className="text-[10px] font-black uppercase tracking-[0.6px] text-text-muted">{label}</Text> }
function MiniInfo({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) { const { tokens } = useAppTheme(); return <View className="flex-row items-center gap-1 rounded-full bg-surface-interactive px-2 py-1"><Ionicons name={icon} size={12} color={tokens.text.muted} /><Text className="text-[10px] font-bold text-text-muted">{text}</Text></View> }
