import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'
import { withAlpha } from '../../../lib/color'
import { useI18n } from '../../../lib/i18n'
import { getErrorMessage, isRecord } from '../../../lib/typeGuards'
import { fetchAdminSupportDirectory, fetchSupportThread, openSupportAttachment, pickSupportAttachment, uploadAdminSupportAttachment, type PickedSupportAttachment, type SupportAttachment, type SupportDirectory, type SupportHistory, type SupportMessage } from '../../../lib/support'
import AdminButton from '../shared/AdminButton'
import AdminSearchBar from '../shared/AdminSearchBar'
import VirtualizedStack from '../../ui/VirtualizedStack'
import AppBackButton from '../../ui/AppBackButton'
import { AdminFilterSelect, AdminMobileFilterShell } from '../shared/AdminAdvancedFilters'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminExportJobs } from '../hooks/useAdminExportJobs'
import { useAdminRpcPage } from '../hooks/useAdminRpcPage'
import { AdminScaffold } from '../shared/AdminScaffold'
import { AdminChoiceChip, AdminPaginationControls, EmptyState, ListLoadingState, MiniPill, Panel, SupportPriorityPill, SupportSlaPill, SupportStatusPill, SupportTicketCard, type AdminChoiceChipTone } from '../shared/AdminPrimitives'
import type { AdminSupportTicketRow } from '../types/admin'
import { formatAdminCount, formatAuditDate, getSupportStatusLabel } from '../utils/adminUtils'

const EMPTY_DIRECTORY: SupportDirectory = { admins: [], tags: [], templates: [] }
const STATUS_OPTIONS = [{ value: 'all', label: 'Todos' }, { value: 'open', label: 'Abiertos' }, { value: 'in_progress', label: 'En proceso' }, { value: 'resolved', label: 'Resueltos' }, { value: 'closed', label: 'Cerrados' }]
const ROLE_OPTIONS = [{ value: 'all', label: 'Todos' }, { value: 'student', label: 'Alumnos' }, { value: 'teacher', label: 'Profesores' }]
const SLA_OPTIONS = [{ value: 'all', label: 'Todos' }, { value: 'breached', label: 'Vencidos' }, { value: 'at_risk', label: 'En riesgo' }, { value: 'on_track', label: 'En plazo' }, { value: 'completed', label: 'Completados' }]
const SUPPORT_STATUS_TONES: Record<AdminSupportTicketRow['status'], AdminChoiceChipTone> = { open: 'admin', in_progress: 'info', resolved: 'success', closed: 'neutral' }
const SUPPORT_PRIORITY_TONES: Record<AdminSupportTicketRow['priority'], AdminChoiceChipTone> = { low: 'info', medium: 'warning', high: 'danger' }

export function AdminSupportSection() {
  const params = useLocalSearchParams<{ ticket?: string }>()
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const isDesktop = responsive.isDesktop
  const pageSize = isDesktop ? 25 : 8
  const feedback = useAppFeedback()
  const { tokens } = useAppTheme()
  const { locale, t } = useI18n()
  const priorityOptions = useMemo(() => [
    { value: 'all', label: locale === 'en-US' ? 'All' : 'Todas' },
    { value: 'high', label: t('support.priority.high') },
    { value: 'medium', label: t('support.priority.medium') },
    { value: 'low', label: t('support.priority.low') },
  ], [locale, t])
  const data = useAdminData()
  const exportJobs = useAdminExportJobs()
  const canRead = Boolean(data.portalContext?.permissions.includes('support.read'))
  const canManage = Boolean(data.portalContext?.permissions.includes('support.manage'))
  const [directory, setDirectory] = useState<SupportDirectory>(EMPTY_DIRECTORY)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)
  const [statusFilter, setStatusFilter] = useState('open')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [slaFilter, setSlaFilter] = useState('all')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<AdminSupportTicketRow | null>(null)
  const [editStatus, setEditStatus] = useState<AdminSupportTicketRow['status']>('in_progress')
  const [editPriority, setEditPriority] = useState<AdminSupportTicketRow['priority']>('medium')
  const [assignedAdminId, setAssignedAdminId] = useState('')
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>([])
  const [templateId, setTemplateId] = useState('')
  const [adminResponse, setAdminResponse] = useState('')
  const [internalComment, setInternalComment] = useState('')
  const [pickedAttachment, setPickedAttachment] = useState<PickedSupportAttachment | null>(null)
  const [saving, setSaving] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [attachments, setAttachments] = useState<SupportAttachment[]>([])
  const [history, setHistory] = useState<SupportHistory[]>([])

  useEffect(() => {
    if (!canRead) { setDirectory(EMPTY_DIRECTORY); return }
    let cancelled = false
    void fetchAdminSupportDirectory().then((next) => { if (!cancelled) setDirectory(next) }).catch((error: unknown) => console.warn('[support directory]', getErrorMessage(error, 'No se pudo cargar el directorio.')))
    return () => { cancelled = true }
  }, [canRead])

  const supportPage = useAdminRpcPage<AdminSupportTicketRow>('get_admin_support_tickets_page_secured', {
    p_search: debouncedSearch.trim() || undefined,
    p_status: statusFilter === 'all' ? undefined : statusFilter,
    p_priority: priorityFilter === 'all' ? undefined : priorityFilter,
    p_role: roleFilter === 'all' ? undefined : roleFilter,
    p_assigned_admin_id: assigneeFilter === 'all' ? undefined : assigneeFilter,
    p_tag: tagFilter === 'all' ? undefined : tagFilter,
    p_sla_state: slaFilter === 'all' ? undefined : slaFilter,
  }, data.version, pageSize, canRead)

  const loadThread = useCallback(async (ticketId: number) => {
    setThreadLoading(true)
    try {
      const thread = await fetchSupportThread(ticketId)
      setMessages(thread.messages)
      setAttachments(thread.attachments)
      setHistory(thread.history)
      setSelectedTagSlugs(thread.tags.map((tag) => tag.slug))
    } catch (error: unknown) {
      feedback.error('No se pudo cargar la conversación', getErrorMessage(error, 'Inténtalo de nuevo.'))
    } finally {
      setThreadLoading(false)
    }
  }, [feedback])

  const openTicket = useCallback(async (ticket: AdminSupportTicketRow) => {
    setSelectedTicket(ticket)
    setEditStatus(ticket.status)
    setEditPriority(ticket.priority)
    setAssignedAdminId(ticket.assigned_admin_id || '')
    setSelectedTagSlugs((ticket.tags || []).map((tag) => tag.slug))
    setTemplateId('')
    setAdminResponse('')
    setInternalComment('')
    setPickedAttachment(null)
    await loadThread(ticket.id)
  }, [loadThread])

  const closeTicket = useCallback(() => {
    setSelectedTicket(null)
    setMessages([])
    setAttachments([])
    setHistory([])
    if (params.ticket) router.replace('/(admin)/support')
  }, [params.ticket, router])

  useEffect(() => {
    const requestedId = Number(params.ticket)
    if (!Number.isFinite(requestedId) || selectedTicket?.id === requestedId) return
    const requestedTicket = supportPage.rows.find((ticket) => ticket.id === requestedId)
    if (requestedTicket) void openTicket(requestedTicket)
  }, [openTicket, params.ticket, selectedTicket?.id, supportPage.rows])

  const chooseAttachment = useCallback(async () => {
    try { setPickedAttachment(await pickSupportAttachment()) }
    catch (error: unknown) { feedback.warning('Adjunto no válido', getErrorMessage(error, 'Selecciona otro archivo.')) }
  }, [feedback])

  const openAttachment = useCallback(async (attachment: SupportAttachment) => {
    try { await openSupportAttachment(attachment) }
    catch (error: unknown) { feedback.error('No se pudo abrir el adjunto', getErrorMessage(error, 'El enlace puede haber caducado.')) }
  }, [feedback])

  const applyTemplate = useCallback((value: string) => {
    setTemplateId(value)
    const template = directory.templates.find((item) => String(item.id) === value)
    if (template) setAdminResponse(template.body)
  }, [directory.templates])

  const saveTicket = useCallback(async () => {
    if (!selectedTicket || !canManage) return
    if ((editStatus === 'resolved' || editStatus === 'closed') && adminResponse.trim().length < 5) { feedback.warning('Respuesta necesaria', 'Escribe una respuesta antes de resolver o cerrar el ticket.'); return }
    if (pickedAttachment && adminResponse.trim().length < 2) { feedback.warning('Mensaje necesario', 'Añade una respuesta pública para asociar el adjunto.'); return }
    setSaving(true)
    try {
      const { data: result, error } = await supabase.rpc('admin_update_support_ticket_secured', { p_ticket_id: selectedTicket.id, p_status: editStatus, p_priority: editPriority, p_public_response: adminResponse.trim() || undefined, p_internal_comment: internalComment.trim() || undefined, p_assigned_admin_id: assignedAdminId || undefined, p_tag_slugs: selectedTagSlugs, p_template_id: templateId ? Number(templateId) : undefined })
      if (error) throw error
      const resultPayload = isRecord(result) ? result : {}
      const publicMessageId = Number(resultPayload.public_message_id)
      if (pickedAttachment) await uploadAdminSupportAttachment(selectedTicket.id, Number.isFinite(publicMessageId) ? publicMessageId : null, pickedAttachment)
      const assigned = directory.admins.find((admin) => admin.id === assignedAdminId)
      const tags = directory.tags.filter((tag) => selectedTagSlugs.includes(tag.slug))
      setSelectedTicket((current) => current ? { ...current, status: editStatus, priority: editPriority, priority_source: 'admin', assigned_admin_id: assignedAdminId || current.assigned_admin_id, assigned_admin_alias: assigned?.alias || current.assigned_admin_alias, tags, first_responded_at: adminResponse.trim() ? current.first_responded_at || new Date().toISOString() : current.first_responded_at, last_response_at: adminResponse.trim() ? new Date().toISOString() : current.last_response_at } : current)
      await loadThread(selectedTicket.id)
      supportPage.refresh()
      await data.refresh()
      setAdminResponse('')
      setInternalComment('')
      setPickedAttachment(null)
      setTemplateId('')
      feedback.success('Ticket actualizado', 'Los cambios, mensajes y adjuntos se han guardado correctamente.')
    } catch (error: unknown) {
      feedback.error('No se pudo actualizar el ticket', getErrorMessage(error, 'Inténtalo de nuevo.'))
    } finally {
      setSaving(false)
    }
  }, [adminResponse, assignedAdminId, canManage, data, directory.admins, directory.tags, editPriority, editStatus, feedback, internalComment, loadThread, pickedAttachment, selectedTagSlugs, selectedTicket, supportPage, templateId])

  const exportFilters = useMemo(() => ({ search: debouncedSearch, status: statusFilter === 'all' ? null : statusFilter, priority: priorityFilter === 'all' ? null : priorityFilter, role: roleFilter === 'all' ? null : roleFilter, assignedAdminId: assigneeFilter === 'all' ? null : assigneeFilter, tag: tagFilter === 'all' ? null : tagFilter, slaState: slaFilter === 'all' ? null : slaFilter }), [assigneeFilter, debouncedSearch, priorityFilter, roleFilter, slaFilter, statusFilter, tagFilter])
  const notifiesUser = Boolean(adminResponse.trim()) || selectedTicket?.status !== editStatus
  const currentAdminId = data.portalContext?.user_id || ''
  const assigneeOptions = useMemo(() => {
    const options = directory.admins.map((admin) => ({ value: admin.id, label: admin.id === currentAdminId ? `${admin.alias} (yo)` : admin.alias, subtitle: admin.email || undefined }))
    return selectedTicket?.assigned_admin_id ? options : [{ value: '', label: 'Sin asignar' }, ...options]
  }, [currentAdminId, directory.admins, selectedTicket?.assigned_admin_id])
  const activeFilters = useMemo(() => {
    const result: { key: string; label: string; clear: () => void }[] = []
    if (statusFilter !== 'all') result.push({ key: 'status', label: `Estado: ${STATUS_OPTIONS.find((item) => item.value === statusFilter)?.label || statusFilter}`, clear: () => setStatusFilter('all') })
    if (priorityFilter !== 'all') result.push({ key: 'priority', label: `Prioridad: ${priorityOptions.find((item) => item.value === priorityFilter)?.label || priorityFilter}`, clear: () => setPriorityFilter('all') })
    if (roleFilter !== 'all') result.push({ key: 'role', label: `Rol: ${ROLE_OPTIONS.find((item) => item.value === roleFilter)?.label || roleFilter}`, clear: () => setRoleFilter('all') })
    if (slaFilter !== 'all') result.push({ key: 'sla', label: `SLA: ${SLA_OPTIONS.find((item) => item.value === slaFilter)?.label || slaFilter}`, clear: () => setSlaFilter('all') })
    if (assigneeFilter !== 'all') result.push({ key: 'assignee', label: `Responsable: ${directory.admins.find((admin) => admin.id === assigneeFilter)?.alias || 'Administrador'}`, clear: () => setAssigneeFilter('all') })
    if (tagFilter !== 'all') result.push({ key: 'tag', label: `Etiqueta: ${directory.tags.find((tag) => tag.slug === tagFilter)?.label || tagFilter}`, clear: () => setTagFilter('all') })
    return result
  }, [assigneeFilter, directory.admins, directory.tags, priorityFilter, priorityOptions, roleFilter, slaFilter, statusFilter, tagFilter])

  const filterFields = (stacked: boolean) => {
    const configs = [
      { key: 'status', label: 'Estado', icon: 'flag-outline' as const, value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
      { key: 'priority', label: 'Prioridad', icon: 'alert-circle-outline' as const, value: priorityFilter, onChange: setPriorityFilter, options: priorityOptions },
      { key: 'role', label: 'Rol', icon: 'people-outline' as const, value: roleFilter, onChange: setRoleFilter, options: ROLE_OPTIONS },
      { key: 'sla', label: 'SLA', icon: 'timer-outline' as const, value: slaFilter, onChange: setSlaFilter, options: SLA_OPTIONS },
      { key: 'assignee', label: 'Responsable', icon: 'person-outline' as const, value: assigneeFilter, onChange: setAssigneeFilter, options: [{ value: 'all', label: 'Todos los responsables' }, ...directory.admins.map((admin) => ({ value: admin.id, label: admin.alias }))] },
      { key: 'tag', label: 'Etiqueta', icon: 'pricetag-outline' as const, value: tagFilter, onChange: setTagFilter, options: [{ value: 'all', label: 'Todas las etiquetas' }, ...directory.tags.map((tag) => ({ value: tag.slug, label: tag.label }))] },
    ]
    return <View className={stacked ? 'gap-4' : 'flex-row flex-wrap gap-3'}>{configs.map((config) => <View key={config.key} style={stacked ? undefined : { minWidth: 240, flexBasis: 250, flexGrow: 1 }}><AdminFilterSelect minWidth={0} label={config.label} icon={config.icon} value={config.value} onChange={config.onChange} options={config.options} /></View>)}</View>
  }

  const exportButton = <View style={{ flex: 1 }}><AdminButton label={exportJobs.loading ? 'Preparando...' : 'Exportar CSV'} icon="download-outline" variant="secondary" loading={exportJobs.loading} disabled={exportJobs.loading} fullWidth onPress={() => void exportJobs.request('support', exportFilters)} /></View>
  const showQueue = isDesktop || !selectedTicket

  return (
    <AdminScaffold activeSection="support" title="Soporte" subtitle="Gestiona solicitudes, conversación, SLA y coordinación interna desde una única cola." data={data}>
      {selectedTicket ? <Panel title={`Gestionar ticket #${selectedTicket.id}`} icon="chatbubble-ellipses-outline" className="mt-5">
        {!isDesktop ? <View className="mb-4"><AppBackButton label="Volver a soporte" onPress={closeTicket} /></View> : null}
        <View className={isDesktop ? 'flex-row gap-5' : 'gap-4'}>
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2"><SupportStatusPill status={selectedTicket.status} /><SupportPriorityPill priority={selectedTicket.priority} /><SupportSlaPill state={selectedTicket.sla_state} /><MiniPill icon={selectedTicket.role === 'teacher' ? 'school-outline' : 'person-outline'} label={selectedTicket.role === 'teacher' ? 'Profesor' : 'Alumno'} /></View>
            <Text className="mt-4 text-[18px] font-black text-text-primary">{selectedTicket.subject}</Text>
            <Text className="mt-1 text-[12px] font-semibold text-text-muted">{selectedTicket.user_alias || 'Usuario'} · {selectedTicket.user_email || selectedTicket.contact_email || 'Sin correo'} · {formatAuditDate(selectedTicket.created_at)}</Text>
            <View className="mt-4 flex-row flex-wrap gap-2"><MiniPill icon="person-circle-outline" label={selectedTicket.assigned_admin_alias || 'Sin asignar'} /><MiniPill icon="chatbubbles-outline" label={formatAdminCount(selectedTicket.message_count || messages.length, 'mensaje', 'mensajes')} /><MiniPill icon="attach-outline" label={formatAdminCount(selectedTicket.attachment_count || attachments.length, 'adjunto', 'adjuntos')} />{selectedTicket.priority_source === 'automatic' ? <MiniPill icon="sparkles-outline" label={`Prioridad automática · ${selectedTicket.auto_priority_score || 0}/100`} /> : null}</View>
            <View className="mt-3 rounded-xl border border-border-default bg-surface-default p-4"><Text className="text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">SLA</Text><Text className="mt-2 text-[12px] font-semibold text-text-secondary">Primera respuesta: {formatSupportDeadline(selectedTicket.first_response_due_at, Boolean(selectedTicket.first_responded_at))}</Text><Text className="mt-1 text-[12px] font-semibold text-text-secondary">Resolución: {formatSupportDeadline(selectedTicket.resolution_due_at, ['resolved', 'closed'].includes(selectedTicket.status))}</Text></View>
            <View className="mt-4 rounded-xl border border-border-default bg-surface-raised p-4"><Text className="text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Conversación</Text>{threadLoading ? <ActivityIndicator className="my-6" /> : <View className="mt-3 gap-3">{messages.map((message) => <View key={message.id} className={`max-w-[92%] rounded-xl border p-3 ${message.author_role === 'admin' ? 'self-end' : 'self-start'}`} style={message.is_internal ? { borderColor: withAlpha(tokens.brand.admin, '70'), backgroundColor: withAlpha(tokens.brand.admin, '12') } : message.author_role === 'admin' ? { borderColor: tokens.border.active, backgroundColor: tokens.semanticSurface.info } : { borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}><View className="flex-row items-center gap-1.5">{message.is_internal ? <Ionicons name="lock-closed-outline" size={12} color={tokens.brand.admin} /> : null}<Text className="text-[10px] font-black uppercase tracking-[0.6px] text-text-muted">{message.is_internal ? 'Comentario interno' : message.author_role === 'admin' ? 'Soporte' : selectedTicket.user_alias || 'Usuario'} · {formatAuditDate(message.created_at)}</Text></View><Text className="mt-2 text-[13px] leading-5 text-text-primary">{message.body}</Text>{attachments.filter((attachment) => attachment.message_id === message.id).map((attachment) => <AttachmentButton key={attachment.id} attachment={attachment} onPress={() => void openAttachment(attachment)} />)}</View>)}{attachments.filter((attachment) => attachment.message_id === null).map((attachment) => <AttachmentButton key={attachment.id} attachment={attachment} onPress={() => void openAttachment(attachment)} />)}{messages.length === 0 ? <Text className="py-4 text-center text-text-muted">Sin mensajes.</Text> : null}</View>}</View>
            <View className="mt-4 rounded-xl border border-border-default bg-surface-raised p-4"><Text className="text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Historial de cambios</Text><View className="mt-3 gap-3">{history.slice(0, 12).map((item) => <View key={item.id} className="flex-row items-start gap-3"><View className="mt-1 h-2 w-2 rounded-full bg-brand-admin" /><View className="min-w-0 flex-1"><Text className="text-[12px] font-black text-text-primary">{getHistoryLabel(item.event_type)}</Text><Text className="mt-1 text-[11px] text-text-muted">{formatAuditDate(item.created_at)}{item.comment ? ` · ${item.comment}` : ''}</Text></View></View>)}{history.length === 0 ? <Text className="text-[12px] text-text-muted">Aún no hay cambios administrativos.</Text> : null}</View></View>
          </View>

          <View className={isDesktop ? 'w-[420px]' : ''}>
            <AdminFilterSelect label="Asignado a" icon="person-add-outline" value={assignedAdminId} onChange={setAssignedAdminId} options={assigneeOptions} />
            {!selectedTicket.assigned_admin_id && !assignedAdminId ? <Text className="mt-2 text-[11px] leading-4 text-text-muted">El ticket seguirá sin asignar hasta que elijas un responsable.</Text> : null}
            <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Estado</Text><View className="mt-2 flex-row flex-wrap gap-2">{(['open', 'in_progress', 'resolved', 'closed'] as const).map((status) => <AdminChoiceChip key={status} active={editStatus === status} label={getSupportStatusLabel(status)} tone={SUPPORT_STATUS_TONES[status]} onPress={() => setEditStatus(status)} />)}</View>
            <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Prioridad</Text><View className="mt-2 flex-row flex-wrap gap-2">{(['low', 'medium', 'high'] as const).map((priority) => <AdminChoiceChip key={priority} active={editPriority === priority} label={t(`support.priority.${priority}`)} tone={SUPPORT_PRIORITY_TONES[priority]} onPress={() => setEditPriority(priority)} />)}</View>
            <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Etiquetas</Text><View className="mt-2 flex-row flex-wrap gap-2">{directory.tags.map((tag) => <AdminChoiceChip key={tag.slug} active={selectedTagSlugs.includes(tag.slug)} label={tag.label} tone="admin" onPress={() => setSelectedTagSlugs((current) => current.includes(tag.slug) ? current.filter((value) => value !== tag.slug) : [...current, tag.slug])} />)}</View>
            <View className="mt-4"><AdminFilterSelect label="Plantilla" icon="document-text-outline" value={templateId} onChange={applyTemplate} options={[{ value: '', label: 'Sin plantilla' }, ...directory.templates.map((template) => ({ value: String(template.id), label: template.title, subtitle: template.category || undefined }))]} /></View>
            <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Respuesta al usuario</Text><TextInput accessibilityLabel="Respuesta pública del administrador" className="mt-2 min-h-[130px] rounded-xl border border-border-default bg-surface-default px-4 py-3 text-[14px] leading-5 text-text-primary" multiline onChangeText={setAdminResponse} placeholder="Explica la solución o los siguientes pasos..." placeholderTextColor={tokens.text.muted} textAlignVertical="top" value={adminResponse} />
            <Pressable accessibilityRole="button" accessibilityLabel="Añadir adjunto" onPress={() => void chooseAttachment()} className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-default px-4 py-3"><Ionicons name="attach-outline" size={17} color={tokens.text.secondary} /><Text className="font-black text-text-secondary">{pickedAttachment ? pickedAttachment.fileName : 'Añadir adjunto'}</Text></Pressable>{pickedAttachment ? <Pressable accessibilityRole="button" accessibilityLabel="Quitar adjunto" onPress={() => setPickedAttachment(null)} className="mt-2 self-end"><Text className="text-[11px] font-black text-semantic-danger">Quitar adjunto</Text></Pressable> : null}
            <View className="mt-4 rounded-xl border p-3" style={{ borderColor: withAlpha(tokens.brand.admin, '70'), backgroundColor: withAlpha(tokens.brand.admin, '0D') }}><View className="flex-row items-center gap-2"><Ionicons name="lock-closed-outline" size={15} color={tokens.brand.admin} /><View className="min-w-0 flex-1"><Text className="text-[12px] font-black uppercase tracking-[0.7px] text-text-primary">Comentario interno</Text><Text className="mt-0.5 text-[11px] text-text-muted">Visible solo para administradores</Text></View></View><TextInput accessibilityLabel="Comentario interno del administrador" className="mt-3 min-h-[100px] rounded-xl border border-border-default bg-surface-default px-4 py-3 text-[14px] leading-5 text-text-primary" multiline onChangeText={setInternalComment} placeholder="Añade contexto para el equipo de soporte..." placeholderTextColor={tokens.text.muted} textAlignVertical="top" value={internalComment} /></View>
            <View className="mt-4 flex-row flex-wrap justify-end gap-2"><AppBackButton label="Volver a la cola" onPress={closeTicket} /><AdminButton label={saving ? 'Guardando...' : notifiesUser ? 'Guardar y notificar' : 'Guardar cambios'} icon="save-outline" loading={saving} disabled={saving || !canManage} onPress={() => void saveTicket()} /></View>
          </View>
        </View>
      </Panel> : null}

      {showQueue ? <Panel title="Cola de tickets" icon="headset-outline" className="mt-5">
        <AdminSearchBar search={search} onChangeSearch={setSearch} placeholder="Buscar tickets..." exporting={exportJobs.loading} onExport={isDesktop ? () => void exportJobs.request('support', exportFilters) : undefined} />
        {isDesktop ? <View className="mt-3">{filterFields(false)}</View> : <AdminMobileFilterShell activeFilters={activeFilters} mobileAction={exportButton} open={mobileFiltersOpen} setOpen={setMobileFiltersOpen} description="Refina la cola por estado, prioridad, rol, SLA, responsable o etiqueta.">{filterFields(true)}</AdminMobileFilterShell>}
        <View className="mt-4">{supportPage.loading && !supportPage.refreshing ? <ListLoadingState /> : null}<VirtualizedStack data={supportPage.rows} keyExtractor={(ticket) => String(ticket.id)} renderItem={(ticket) => <SupportTicketCard ticket={ticket} onManage={() => void openTicket(ticket)} />} emptyComponent={!supportPage.loading ? <EmptyState label="No hay tickets que coincidan con los filtros." /> : null} accessibilityLabel="Cola de tickets de soporte" /></View>
        <AdminPaginationControls page={supportPage.page} pageSize={supportPage.pageSize} total={supportPage.total} hasPrevious={supportPage.hasPrevious} hasNext={supportPage.hasNext} onPrevious={supportPage.previousPage} onNext={supportPage.nextPage} />
      </Panel> : null}
    </AdminScaffold>
  )
}

function AttachmentButton({ attachment, onPress }: { attachment: SupportAttachment; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir adjunto ${attachment.file_name}`} onPress={onPress} className="mt-3 flex-row items-center gap-2 rounded-lg border border-border-default px-3 py-2"><Ionicons name="document-attach-outline" size={16} /><Text className="min-w-0 flex-1 text-[11px] font-bold text-text-secondary" numberOfLines={1}>{attachment.file_name}</Text></Pressable> }
function getHistoryLabel(value: string) { const labels: Record<string, string> = { response_sent: 'Respuesta pública enviada', internal_comment: 'Comentario interno añadido', ticket_updated: 'Ticket actualizado', user_reply: 'Respuesta del usuario', attachment_added: 'Adjunto añadido' }; return labels[value] || value.replace(/[._-]+/g, ' ') }
function formatSupportDeadline(value: string | null, completed: boolean) { if (completed) return 'cumplida'; if (!value) return 'sin estimación'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'sin estimación'; return `${formatAuditDate(value)}${date.getTime() < Date.now() ? ' · vencida' : ''}` }
export const AdminSupportScreen = AdminSupportSection
