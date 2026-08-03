import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage, isRecord } from '../../../lib/typeGuards'
import { fetchAdminSupportDirectory, fetchSupportThread, openSupportAttachment, pickSupportAttachment, uploadAdminSupportAttachment, type PickedSupportAttachment, type SupportAttachment, type SupportDirectory, type SupportHistory, type SupportMessage } from '../../../lib/support'
import AdminSearchBar from '../shared/AdminSearchBar'
import VirtualizedStack from '../../ui/VirtualizedStack'
import { AdminFilterSelect } from '../shared/AdminAdvancedFilters'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminExportJobs } from '../hooks/useAdminExportJobs'
import { useAdminRpcPage } from '../hooks/useAdminRpcPage'
import { AdminScaffold } from '../shared/AdminScaffold'
import { AdminChoiceChip, AdminFilterRow, AdminPaginationControls, EmptyState, ListLoadingState, MiniPill, Panel, SupportPriorityPill, SupportStatusPill, SupportTicketCard } from '../shared/AdminPrimitives'
import type { AdminSupportTicketRow } from '../types/admin'
import { formatAuditDate, getSupportPriorityLabel, getSupportStatusLabel } from '../utils/adminUtils'

const EMPTY_DIRECTORY: SupportDirectory = { admins: [], tags: [], templates: [] }

export function AdminSupportSection() {
  const params = useLocalSearchParams<{ ticket?: string }>()
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const pageSize = isDesktop ? 25 : 8
  const feedback = useAppFeedback()
  const data = useAdminData()
  const exportJobs = useAdminExportJobs()
  const canManage = !data.portalContext || data.portalContext.permissions.includes('support.manage')
  const [directory, setDirectory] = useState<SupportDirectory>(EMPTY_DIRECTORY)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [slaFilter, setSlaFilter] = useState('all')
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

  useEffect(() => { void fetchAdminSupportDirectory().then(setDirectory).catch((error: unknown) => console.warn('[support directory]', getErrorMessage(error, 'No se pudo cargar el directorio.'))) }, [])

  const supportPage = useAdminRpcPage<AdminSupportTicketRow>('get_admin_support_tickets_page_secured', {
    p_search: search.trim() || undefined,
    p_status: statusFilter === 'all' ? undefined : statusFilter,
    p_priority: priorityFilter === 'all' ? undefined : priorityFilter,
    p_role: roleFilter === 'all' ? undefined : roleFilter,
    p_assigned_admin_id: assigneeFilter === 'all' ? undefined : assigneeFilter,
    p_tag: tagFilter === 'all' ? undefined : tagFilter,
    p_sla_state: slaFilter === 'all' ? undefined : slaFilter,
  }, data.version, pageSize)

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
    setEditStatus(ticket.status === 'open' ? 'in_progress' : ticket.status)
    setEditPriority(ticket.priority)
    setAssignedAdminId(ticket.assigned_admin_id || data.portalContext?.user_id || '')
    setSelectedTagSlugs((ticket.tags || []).map((tag) => tag.slug))
    setTemplateId('')
    setAdminResponse('')
    setInternalComment('')
    setPickedAttachment(null)
    await loadThread(ticket.id)
  }, [data.portalContext?.user_id, loadThread])

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
      const { data: result, error } = await supabase.rpc('admin_update_support_ticket_secured', {
        p_ticket_id: selectedTicket.id,
        p_status: editStatus,
        p_priority: editPriority,
        p_public_response: adminResponse.trim() || undefined,
        p_internal_comment: internalComment.trim() || undefined,
        p_assigned_admin_id: assignedAdminId || undefined,
        p_tag_slugs: selectedTagSlugs,
        p_template_id: templateId ? Number(templateId) : undefined,
      })
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

  const exportFilters = useMemo(() => ({ search, status: statusFilter === 'all' ? null : statusFilter, priority: priorityFilter === 'all' ? null : priorityFilter, role: roleFilter === 'all' ? null : roleFilter, assignedAdminId: assigneeFilter === 'all' ? null : assigneeFilter, tag: tagFilter === 'all' ? null : tagFilter, slaState: slaFilter === 'all' ? null : slaFilter }), [assigneeFilter, priorityFilter, roleFilter, search, slaFilter, statusFilter, tagFilter])
  const notifiesUser = Boolean(adminResponse.trim()) || selectedTicket?.status !== editStatus

  return (
    <AdminScaffold activeSection="support" title="Soporte" subtitle="Gestiona solicitudes, conversación, SLA y coordinación interna desde una única cola." data={data}>
      {selectedTicket ? <Panel title={`Gestionar ticket #${selectedTicket.id}`} icon="chatbubble-ellipses-outline" className="mt-5">
        <View className={isDesktop ? 'flex-row gap-5' : 'gap-4'}>
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2"><SupportStatusPill status={selectedTicket.status} /><SupportPriorityPill priority={selectedTicket.priority} /><MiniPill icon={selectedTicket.role === 'teacher' ? 'school-outline' : 'person-outline'} label={selectedTicket.role === 'teacher' ? 'Profesor' : 'Alumno'} /><SlaPill state={selectedTicket.sla_state} /></View>
            <Text className="mt-4 text-[18px] font-black text-text-primary">{selectedTicket.subject}</Text>
            <Text className="mt-1 text-[12px] font-semibold text-text-muted">{selectedTicket.user_alias || 'Usuario'} · {selectedTicket.user_email || selectedTicket.contact_email || 'Sin correo'} · {formatAuditDate(selectedTicket.created_at)}</Text>
            <View className="mt-4 flex-row flex-wrap gap-2"><MiniPill icon="person-circle-outline" label={selectedTicket.assigned_admin_alias || 'Sin asignar'} /><MiniPill icon="chatbubbles-outline" label={`${selectedTicket.message_count || messages.length} mensajes`} /><MiniPill icon="attach-outline" label={`${selectedTicket.attachment_count || attachments.length} adjuntos`} />{selectedTicket.priority_source === 'automatic' ? <MiniPill icon="sparkles-outline" label={`Prioridad automática · ${selectedTicket.auto_priority_score || 0}/100`} /> : null}</View>
            <View className="mt-3 rounded-xl border border-border-default bg-surface-default p-4"><Text className="text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">SLA</Text><Text className="mt-2 text-[12px] font-semibold text-text-secondary">Primera respuesta: {formatSupportDeadline(selectedTicket.first_response_due_at, Boolean(selectedTicket.first_responded_at))}</Text><Text className="mt-1 text-[12px] font-semibold text-text-secondary">Resolución: {formatSupportDeadline(selectedTicket.resolution_due_at, ['resolved', 'closed'].includes(selectedTicket.status))}</Text></View>
            <View className="mt-4 rounded-xl border border-border-default bg-surface-raised p-4"><Text className="text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Conversación</Text>{threadLoading ? <ActivityIndicator className="my-6" /> : <View className="mt-3 gap-3">{messages.map((message) => <View key={message.id} className={`max-w-[92%] rounded-xl border p-3 ${message.is_internal ? 'self-end border-semantic-warning bg-semantic-surface-warning' : message.author_role === 'admin' ? 'self-end border-border-active bg-semantic-surface-info' : 'self-start border-border-default bg-surface-default'}`}><Text className="text-[10px] font-black uppercase tracking-[0.6px] text-text-muted">{message.is_internal ? 'Nota interna' : message.author_role === 'admin' ? 'Soporte' : selectedTicket.user_alias || 'Usuario'} · {formatAuditDate(message.created_at)}</Text><Text className="mt-2 text-[13px] leading-5 text-text-primary">{message.body}</Text>{attachments.filter((attachment) => attachment.message_id === message.id).map((attachment) => <AttachmentButton key={attachment.id} attachment={attachment} onPress={() => void openAttachment(attachment)} />)}</View>)}{attachments.filter((attachment) => attachment.message_id === null).map((attachment) => <AttachmentButton key={attachment.id} attachment={attachment} onPress={() => void openAttachment(attachment)} />)}{messages.length === 0 ? <Text className="py-4 text-center text-text-muted">Sin mensajes.</Text> : null}</View>}</View>
            <View className="mt-4 rounded-xl border border-border-default bg-surface-raised p-4"><Text className="text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Historial de cambios</Text><View className="mt-3 gap-3">{history.slice(0, 12).map((item) => <View key={item.id} className="flex-row items-start gap-3"><View className="mt-1 h-2 w-2 rounded-full bg-brand-admin" /><View className="min-w-0 flex-1"><Text className="text-[12px] font-black text-text-primary">{getHistoryLabel(item.event_type)}</Text><Text className="mt-1 text-[11px] text-text-muted">{formatAuditDate(item.created_at)}{item.comment ? ` · ${item.comment}` : ''}</Text></View></View>)}{history.length === 0 ? <Text className="text-[12px] text-text-muted">Aún no hay cambios administrativos.</Text> : null}</View></View>
          </View>

          <View className={isDesktop ? 'w-[420px]' : ''}>
            <AdminFilterSelect label="Asignado a" icon="person-add-outline" value={assignedAdminId} onChange={setAssignedAdminId} options={[{ value: '', label: 'Asignarme automáticamente' }, ...directory.admins.map((admin) => ({ value: admin.id, label: admin.alias, subtitle: admin.email || undefined }))]} />
            <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Estado</Text><View className="mt-2 flex-row flex-wrap gap-2">{(['open', 'in_progress', 'resolved', 'closed'] as const).map((status) => <AdminChoiceChip key={status} active={editStatus === status} label={getSupportStatusLabel(status)} onPress={() => setEditStatus(status)} />)}</View>
            <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Prioridad</Text><View className="mt-2 flex-row flex-wrap gap-2">{(['low', 'medium', 'high'] as const).map((priority) => <AdminChoiceChip key={priority} active={editPriority === priority} label={getSupportPriorityLabel(priority)} onPress={() => setEditPriority(priority)} />)}</View>
            <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Etiquetas</Text><View className="mt-2 flex-row flex-wrap gap-2">{directory.tags.map((tag) => <AdminChoiceChip key={tag.slug} active={selectedTagSlugs.includes(tag.slug)} label={tag.label} onPress={() => setSelectedTagSlugs((current) => current.includes(tag.slug) ? current.filter((value) => value !== tag.slug) : [...current, tag.slug])} />)}</View>
            <View className="mt-4"><AdminFilterSelect label="Plantilla" icon="document-text-outline" value={templateId} onChange={applyTemplate} options={[{ value: '', label: 'Sin plantilla' }, ...directory.templates.map((template) => ({ value: String(template.id), label: template.title, subtitle: template.category || undefined }))]} /></View>
            <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Respuesta al usuario</Text><TextInput accessibilityLabel="Respuesta pública del administrador" className="mt-2 min-h-[130px] rounded-xl border border-border-default bg-surface-default px-4 py-3 text-[14px] leading-5 text-text-primary" multiline onChangeText={setAdminResponse} placeholder="Explica la solución o los siguientes pasos..." placeholderTextColor="#8FA7C7" textAlignVertical="top" value={adminResponse} />
            <Pressable accessibilityRole="button" accessibilityLabel="Añadir adjunto" onPress={() => void chooseAttachment()} className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-default px-4 py-3"><Ionicons name="attach-outline" size={17} /><Text className="font-black text-text-secondary">{pickedAttachment ? pickedAttachment.fileName : 'Añadir adjunto'}</Text></Pressable>{pickedAttachment ? <Pressable accessibilityRole="button" accessibilityLabel="Quitar adjunto" onPress={() => setPickedAttachment(null)} className="mt-2 self-end"><Text className="text-[11px] font-black text-semantic-danger">Quitar adjunto</Text></Pressable> : null}
            <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Comentario interno</Text><TextInput accessibilityLabel="Comentario interno del administrador" className="mt-2 min-h-[100px] rounded-xl border border-semantic-warning bg-semantic-surface-warning px-4 py-3 text-[14px] leading-5 text-text-primary" multiline onChangeText={setInternalComment} placeholder="Visible solo para administradores..." placeholderTextColor="#8FA7C7" textAlignVertical="top" value={internalComment} />
            <View className="mt-4 flex-row flex-wrap justify-end gap-2"><Pressable accessibilityRole="button" accessibilityLabel="Cerrar edición" onPress={() => setSelectedTicket(null)} className="h-11 items-center justify-center rounded-xl border border-border-default bg-surface-default px-4"><Text className="font-black text-text-secondary">Cerrar</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Guardar cambios del ticket" disabled={saving || !canManage} onPress={() => void saveTicket()} className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-brand-admin px-5" style={({ pressed }) => ({ opacity: saving || !canManage ? 0.55 : pressed ? 0.8 : 1 })}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="save-outline" size={17} color="#FFFFFF" />}<Text className="font-black text-white">{saving ? 'Guardando...' : notifiesUser ? 'Guardar y notificar' : 'Guardar cambios'}</Text></Pressable></View>
          </View>
        </View>
      </Panel> : null}

      <Panel title="Cola de tickets" icon="headset-outline" className="mt-5">
        <AdminSearchBar search={search} onChangeSearch={setSearch} placeholder="Buscar por usuario, asunto, mensaje, etiqueta o responsable..." exporting={exportJobs.loading} onExport={() => void exportJobs.request('support', exportFilters)} />
        <View className="mt-3 gap-3"><AdminFilterRow label="Estado" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'open', label: 'Abiertos' }, { value: 'in_progress', label: 'En proceso' }, { value: 'resolved', label: 'Resueltos' }, { value: 'closed', label: 'Cerrados' }]} /><AdminFilterRow label="Prioridad" value={priorityFilter} onChange={setPriorityFilter} options={[{ value: 'all', label: 'Todas' }, { value: 'high', label: 'Alta' }, { value: 'medium', label: 'Media' }, { value: 'low', label: 'Baja' }]} /><AdminFilterRow label="Rol" value={roleFilter} onChange={setRoleFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'student', label: 'Alumnos' }, { value: 'teacher', label: 'Profesores' }]} /><AdminFilterRow label="SLA" value={slaFilter} onChange={setSlaFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'breached', label: 'Vencidos' }, { value: 'at_risk', label: 'En riesgo' }, { value: 'on_track', label: 'En plazo' }, { value: 'completed', label: 'Completados' }]} /></View>
        <View className="mt-3 flex-row flex-wrap gap-3"><AdminFilterSelect label="Responsable" icon="person-outline" value={assigneeFilter} onChange={setAssigneeFilter} options={[{ value: 'all', label: 'Todos los responsables' }, ...directory.admins.map((admin) => ({ value: admin.id, label: admin.alias }))]} /><AdminFilterSelect label="Etiqueta" icon="pricetag-outline" value={tagFilter} onChange={setTagFilter} options={[{ value: 'all', label: 'Todas las etiquetas' }, ...directory.tags.map((tag) => ({ value: tag.slug, label: tag.label }))]} /></View>
        <View className="mt-4">{supportPage.loading && !supportPage.refreshing ? <ListLoadingState /> : null}<VirtualizedStack data={supportPage.rows} keyExtractor={(ticket) => String(ticket.id)} renderItem={(ticket) => <View><SupportTicketCard ticket={ticket} onManage={() => void openTicket(ticket)} /><View className="mt-2 flex-row flex-wrap gap-2 px-2"><SlaPill state={ticket.sla_state} />{ticket.assigned_admin_alias ? <MiniPill icon="person-outline" label={ticket.assigned_admin_alias} /> : null}{(ticket.tags || []).map((tag) => <MiniPill key={tag.slug} icon="pricetag-outline" label={tag.label} />)}</View></View>} emptyComponent={!supportPage.loading ? <EmptyState label="No hay tickets que coincidan con los filtros." /> : null} accessibilityLabel="Cola de tickets de soporte" /></View>
        <AdminPaginationControls page={supportPage.page} pageSize={supportPage.pageSize} total={supportPage.total} hasPrevious={supportPage.hasPrevious} hasNext={supportPage.hasNext} onPrevious={supportPage.previousPage} onNext={supportPage.nextPage} />
      </Panel>
    </AdminScaffold>
  )
}

function AttachmentButton({ attachment, onPress }: { attachment: SupportAttachment; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir adjunto ${attachment.file_name}`} onPress={onPress} className="mt-3 flex-row items-center gap-2 rounded-lg border border-border-default px-3 py-2"><Ionicons name="document-attach-outline" size={16} /><Text className="min-w-0 flex-1 text-[11px] font-bold text-text-secondary" numberOfLines={1}>{attachment.file_name}</Text></Pressable> }
function SlaPill({ state }: { state?: string | null }) { const labels: Record<string, string> = { breached: 'SLA vencido', at_risk: 'SLA en riesgo', on_track: 'SLA en plazo', completed: 'SLA completado' }; const icons: Record<string, keyof typeof Ionicons.glyphMap> = { breached: 'alert-circle-outline', at_risk: 'time-outline', on_track: 'checkmark-circle-outline', completed: 'shield-checkmark-outline' }; return state ? <MiniPill icon={icons[state] || 'time-outline'} label={labels[state] || state} /> : null }
function getHistoryLabel(value: string) { const labels: Record<string, string> = { response_sent: 'Respuesta pública enviada', internal_comment: 'Comentario interno añadido', ticket_updated: 'Ticket actualizado', user_reply: 'Respuesta del usuario', attachment_added: 'Adjunto añadido' }; return labels[value] || value.replace(/[._-]+/g, ' ') }
function formatSupportDeadline(value: string | null, completed: boolean) { if (completed) return 'cumplida'; if (!value) return 'sin estimación'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'sin estimación'; return `${formatAuditDate(value)}${date.getTime() < Date.now() ? ' · vencida' : ''}` }
export const AdminSupportScreen = AdminSupportSection
