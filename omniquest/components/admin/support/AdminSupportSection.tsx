import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { fetchSupportThread, openSupportAttachment, type SupportAttachment, type SupportMessage } from '../../../lib/support'
import { exportAdminSupport } from '../../../lib/adminExports'
import AdminSearchBar from '../shared/AdminSearchBar'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminExportJobs } from '../hooks/useAdminExportJobs'
import { useAdminRpcPage } from '../hooks/useAdminRpcPage'
import { AdminScaffold } from '../shared/AdminScaffold'
import { AdminChoiceChip, AdminFilterRow, AdminPaginationControls, EmptyState, ListLoadingState, MiniPill, Panel, SupportPriorityPill, SupportStatusPill, SupportTicketCard } from '../shared/AdminPrimitives'
import type { AdminSupportTicketRow } from '../types/admin'
import { formatAuditDate, getSupportPriorityLabel, getSupportStatusLabel, runAdminExport, showAlert } from '../utils/adminUtils'

export function AdminSupportSection() {
  const params = useLocalSearchParams<{ ticket?: string }>()
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const pageSize = isDesktop ? 25 : 8
  const data = useAdminData()
  const exportJobs = useAdminExportJobs()
  const canManage = !data.portalContext || data.portalContext.permissions.includes('support.manage')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [exporting, setExporting] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<AdminSupportTicketRow | null>(null)
  const [editStatus, setEditStatus] = useState<AdminSupportTicketRow['status']>('in_progress')
  const [editPriority, setEditPriority] = useState<AdminSupportTicketRow['priority']>('medium')
  const [adminResponse, setAdminResponse] = useState('')
  const [saving, setSaving] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [attachments, setAttachments] = useState<SupportAttachment[]>([])

  const supportPage = useAdminRpcPage<AdminSupportTicketRow>('get_admin_support_tickets_page_secured', {
    p_search: search.trim() || undefined,
    p_status: statusFilter === 'all' ? undefined : statusFilter,
    p_priority: priorityFilter === 'all' ? undefined : priorityFilter,
    p_role: roleFilter === 'all' ? undefined : roleFilter,
  }, data.version, pageSize)

  const openTicket = useCallback(async (ticket: AdminSupportTicketRow) => {
    setSelectedTicket(ticket)
    setEditStatus(ticket.status === 'open' ? 'in_progress' : ticket.status)
    setEditPriority(ticket.priority)
    setAdminResponse('')
    setThreadLoading(true)
    try {
      const thread = await fetchSupportThread(ticket.id)
      setMessages(thread.messages)
      setAttachments(thread.attachments)
    } catch (error: any) {
      showAlert('No se pudo cargar la conversación', error?.message || 'Inténtalo de nuevo.')
    } finally {
      setThreadLoading(false)
    }
  }, [])

  useEffect(() => {
    const requestedId = Number(params.ticket)
    if (!Number.isFinite(requestedId) || selectedTicket?.id === requestedId) return
    const requestedTicket = supportPage.rows.find((ticket) => ticket.id === requestedId)
    if (requestedTicket) void openTicket(requestedTicket)
  }, [openTicket, params.ticket, selectedTicket?.id, supportPage.rows])

  const openAttachment = async (attachment: SupportAttachment) => {
    try {
      await openSupportAttachment(attachment)
    } catch (error: any) {
      showAlert('No se pudo abrir el adjunto', error?.message || 'El enlace puede haber caducado.')
    }
  }

  const saveTicket = async () => {
    if (!selectedTicket || !canManage) return
    if ((editStatus === 'resolved' || editStatus === 'closed') && adminResponse.trim().length < 5) {
      showAlert('Respuesta necesaria', 'Escribe una respuesta antes de resolver o cerrar el ticket.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.rpc('admin_update_support_ticket_secured' as any, {
        p_ticket_id: selectedTicket.id,
        p_status: editStatus,
        p_priority: editPriority,
        p_admin_response: adminResponse.trim() || undefined,
      })
      if (error) throw error

      setSelectedTicket(null)
      setAdminResponse('')
      supportPage.refresh()
      await data.refresh()
      showAlert('Ticket actualizado', 'La respuesta y el estado se han guardado correctamente.')
    } catch (error: any) {
      showAlert('No se pudo actualizar el ticket', error?.message || 'Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminScaffold activeSection="support" title="Soporte" subtitle="Gestiona solicitudes de alumnos y profesores desde una cola priorizada." data={data}>

      {selectedTicket ? (
        <Panel title={`Gestionar ticket #${selectedTicket.id}`} icon="chatbubble-ellipses-outline" className="mt-5">
          <View className={isDesktop ? 'flex-row gap-5' : 'gap-4'}>
            <View className="min-w-0 flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <SupportStatusPill status={selectedTicket.status} />
                <SupportPriorityPill priority={selectedTicket.priority} />
                <MiniPill icon={selectedTicket.role === 'teacher' ? 'school-outline' : 'person-outline'} label={selectedTicket.role === 'teacher' ? 'Profesor' : 'Alumno'} />
              </View>
              <Text className="mt-4 text-[18px] font-black text-text-primary">{selectedTicket.subject}</Text>
              <Text className="mt-1 text-[12px] font-semibold text-text-muted">
                {selectedTicket.user_alias || 'Usuario'} · {selectedTicket.user_email || selectedTicket.contact_email || 'Sin correo'} · {formatAuditDate(selectedTicket.created_at)}
              </Text>
              <View className="mt-4 flex-row flex-wrap gap-2">
                <MiniPill icon="chatbubbles-outline" label={`${selectedTicket.message_count || messages.length} mensajes`} />
                <MiniPill icon="attach-outline" label={`${selectedTicket.attachment_count || attachments.length} adjuntos`} />
              </View>
              <View className="mt-3 rounded-xl border border-border-default bg-surface-default p-4">
                <Text className="text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">SLA estimado</Text>
                <Text className="mt-2 text-[12px] font-semibold text-text-secondary">
                  Primera respuesta: {formatSupportDeadline(selectedTicket.first_response_due_at, Boolean(selectedTicket.first_responded_at))}
                </Text>
                <Text className="mt-1 text-[12px] font-semibold text-text-secondary">
                  Resolución: {formatSupportDeadline(selectedTicket.resolution_due_at, ['resolved', 'closed'].includes(selectedTicket.status))}
                </Text>
              </View>

              <View className="mt-4 rounded-xl border border-border-default bg-surface-raised p-4">
                <Text className="text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Conversación</Text>
                {threadLoading ? <ActivityIndicator className="my-6" /> : (
                  <View className="mt-3 gap-3">
                    {messages.map((message) => (
                      <View
                        key={message.id}
                        className={`max-w-[92%] rounded-xl border p-3 ${message.author_role === 'admin' ? 'self-end border-border-active bg-semantic-surface-info' : 'self-start border-border-default bg-surface-default'}`}
                      >
                        <Text className="text-[10px] font-black uppercase tracking-[0.6px] text-text-muted">
                          {message.author_role === 'admin' ? 'Soporte' : selectedTicket.user_alias || 'Usuario'} · {formatAuditDate(message.created_at)}
                        </Text>
                        <Text className="mt-2 text-[13px] leading-5 text-text-primary">{message.body}</Text>
                        {attachments.filter((attachment) => attachment.message_id === message.id).map((attachment) => (
                          <Pressable key={attachment.id} onPress={() => void openAttachment(attachment)} className="mt-3 flex-row items-center gap-2 rounded-lg border border-border-default px-3 py-2">
                            <Ionicons name="document-attach-outline" size={16} />
                            <Text className="min-w-0 flex-1 text-[11px] font-bold text-text-secondary" numberOfLines={1}>{attachment.file_name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ))}
                    {attachments.filter((attachment) => attachment.message_id === null).map((attachment) => (
                      <Pressable key={attachment.id} onPress={() => void openAttachment(attachment)} className="flex-row items-center gap-2 rounded-lg border border-border-default px-3 py-2">
                        <Ionicons name="document-attach-outline" size={16} />
                        <Text className="min-w-0 flex-1 text-[11px] font-bold text-text-secondary" numberOfLines={1}>{attachment.file_name}</Text>
                      </Pressable>
                    ))}
                    {messages.length === 0 ? <Text className="py-4 text-center text-text-muted">Sin mensajes.</Text> : null}
                  </View>
                )}
              </View>
            </View>

            <View className={isDesktop ? 'w-[420px]' : ''}>
              <Text className="text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Estado</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {(['open', 'in_progress', 'resolved', 'closed'] as const).map((status) => (
                  <AdminChoiceChip key={status} active={editStatus === status} label={getSupportStatusLabel(status)} onPress={() => setEditStatus(status)} />
                ))}
              </View>

              <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Prioridad</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {(['low', 'medium', 'high'] as const).map((priority) => (
                  <AdminChoiceChip key={priority} active={editPriority === priority} label={getSupportPriorityLabel(priority)} onPress={() => setEditPriority(priority)} />
                ))}
              </View>

              <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-text-muted">Respuesta al usuario</Text>
              <TextInput
                accessibilityLabel="Respuesta del administrador"
                className="mt-2 min-h-[130px] rounded-xl border border-border-default bg-surface-default px-4 py-3 text-[14px] leading-5 text-text-primary"
                multiline
                onChangeText={setAdminResponse}
                placeholder="Explica la solución o los siguientes pasos..."
                placeholderTextColor="#8FA7C7"
                textAlignVertical="top"
                value={adminResponse}
              />

              <View className="mt-4 flex-row flex-wrap justify-end gap-2">
                <Pressable
                  accessibilityLabel="Cancelar edición del ticket"
                  accessibilityRole="button"
                  onPress={() => setSelectedTicket(null)}
                  className="h-11 items-center justify-center rounded-xl border border-border-default bg-surface-default px-4"
                >
                  <Text className="font-black text-text-secondary">Cancelar</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Guardar respuesta del ticket"
                  accessibilityRole="button"
                  disabled={saving || !canManage}
                  onPress={() => void saveTicket()}
                  className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-brand-admin px-5"
                  style={({ pressed }) => ({ opacity: saving ? 0.55 : pressed ? 0.8 : 1 })}
                >
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send-outline" size={17} color="#FFFFFF" />}
                  <Text className="font-black text-white">{saving ? 'Guardando...' : 'Guardar y notificar'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Panel>
      ) : null}

      <Panel title="Cola de tickets" icon="headset-outline" className="mt-5">
        <AdminSearchBar
          search={search}
          onChangeSearch={setSearch}
          placeholder="Buscar por usuario, asunto, mensaje o correo..."
          exporting={exporting || exportJobs.loading}
          onExport={() => void (supportPage.total >= 1000
            ? exportJobs.request('support', { search, status: statusFilter === 'all' ? null : statusFilter, priority: priorityFilter === 'all' ? null : priorityFilter, role: roleFilter === 'all' ? null : roleFilter })
            : runAdminExport(setExporting, () => exportAdminSupport({ search, status: statusFilter === 'all' ? null : statusFilter, priority: priorityFilter === 'all' ? null : priorityFilter, role: roleFilter === 'all' ? null : roleFilter })))}
        />

        <View className="mt-3 gap-3">
          <AdminFilterRow
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'open', label: 'Abiertos' },
              { value: 'in_progress', label: 'En proceso' },
              { value: 'resolved', label: 'Resueltos' },
              { value: 'closed', label: 'Cerrados' },
            ]}
          />
          <AdminFilterRow
            label="Prioridad"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'high', label: 'Alta' },
              { value: 'medium', label: 'Media' },
              { value: 'low', label: 'Baja' },
            ]}
          />
          <AdminFilterRow
            label="Rol"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'student', label: 'Alumnos' },
              { value: 'teacher', label: 'Profesores' },
            ]}
          />
        </View>

        <View className="mt-4" style={{ gap: 12 }}>
          {supportPage.loading && !supportPage.refreshing ? <ListLoadingState /> : null}
          {supportPage.rows.map((ticket) => (
            <SupportTicketCard key={ticket.id} ticket={ticket} onManage={() => void openTicket(ticket)} />
          ))}
          {!supportPage.loading && supportPage.rows.length === 0 ? <EmptyState label="No hay tickets que coincidan con los filtros." /> : null}
        </View>

        <AdminPaginationControls
          page={supportPage.page}
          pageSize={supportPage.pageSize}
          total={supportPage.total}
          hasPrevious={supportPage.hasPrevious}
          hasNext={supportPage.hasNext}
          onPrevious={supportPage.previousPage}
          onNext={supportPage.nextPage}
        />
      </Panel>
    </AdminScaffold>
  )
}


export const AdminSupportScreen = AdminSupportSection

function formatSupportDeadline(value: string | null, completed: boolean) {
  if (completed) return 'cumplida'
  if (!value) return 'sin estimación'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'sin estimación'
  return `${formatAuditDate(value)}${date.getTime() < Date.now() ? ' · vencida' : ''}`
}
