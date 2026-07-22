import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import AdminSearchBar from './AdminSearchBar'
import { AdminPagination } from './AdminPagination'
import {
  exportAdminAudit,
  exportAdminClassrooms,
  exportAdminProfiles,
  exportAdminSubjects,
  exportAdminSupport,
} from '../../../lib/adminExports'
import {
  ADMIN_PAGE_SIZE,
  AdminFilterRow,
  AdminInput,
  AdminListToolbar,
  AdminMetrics,
  AdminPaginationControls,
  AdminScaffold,
  AdminChoiceChip,
  AuditLogCard,
  ClassroomRowCard,
  CourseRowCard,
  EmptyState,
  HomeShortcut,
  ListLoadingState,
  MiniPill,
  Panel,
  ProfileRowCard,
  RecentAuditPanel,
  SideFact,
  SupportPriorityPill,
  SupportStatusPill,
  SupportTicketCard,
  SystemAlertRow,
  formatAuditDate,
  getNumericParam,
  getSearchParam,
  getSupportPriorityLabel,
  getSupportStatusLabel,
  runAdminExport,
  showAlert,
  useAdminActions,
  useAdminDashboard,
  useAdminData,
  useAdminRpcPage,
  type AdminAuditLogRow,
  type AdminSupportTicketRow,
  type ClassroomRow,
  type CreateTeacherResult,
  type ProfileRow,
  type SubjectRow,
} from './AdminPortalCore'

export function AdminSupportSection() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const pageSize = isDesktop ? 25 : 8
  const data = useAdminData()
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

  const supportPage = useAdminRpcPage<AdminSupportTicketRow>('get_admin_support_tickets_page', {
    p_search: search.trim() || null,
    p_status: statusFilter === 'all' ? null : statusFilter,
    p_priority: priorityFilter === 'all' ? null : priorityFilter,
    p_role: roleFilter === 'all' ? null : roleFilter,
  }, data.version, pageSize)

  const openTicket = (ticket: AdminSupportTicketRow) => {
    setSelectedTicket(ticket)
    setEditStatus(ticket.status === 'open' ? 'in_progress' : ticket.status)
    setEditPriority(ticket.priority)
    setAdminResponse(ticket.admin_response || '')
  }

  const saveTicket = async () => {
    if (!selectedTicket) return
    if ((editStatus === 'resolved' || editStatus === 'closed') && adminResponse.trim().length < 5) {
      showAlert('Respuesta necesaria', 'Escribe una respuesta antes de resolver o cerrar el ticket.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.rpc('admin_update_support_ticket', {
        p_ticket_id: selectedTicket.id,
        p_status: editStatus,
        p_priority: editPriority,
        p_admin_response: adminResponse.trim() || null,
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
              <Text className="mt-4 text-[18px] font-black text-white">{selectedTicket.subject}</Text>
              <Text className="mt-1 text-[12px] font-semibold text-[#8FA7C7]">
                {selectedTicket.user_alias || 'Usuario'} · {selectedTicket.user_email || selectedTicket.contact_email || 'Sin correo'} · {formatAuditDate(selectedTicket.created_at)}
              </Text>
              <View className="mt-4 rounded-xl border border-[#20375E] bg-[#09162C] p-4">
                <Text className="text-[12px] font-black uppercase tracking-[0.7px] text-[#8FA7C7]">Mensaje</Text>
                <Text className="mt-2 text-[14px] leading-6 text-[#DDE7F4]">{selectedTicket.message}</Text>
              </View>
            </View>

            <View className={isDesktop ? 'w-[420px]' : ''}>
              <Text className="text-[12px] font-black uppercase tracking-[0.7px] text-[#8FA7C7]">Estado</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {(['open', 'in_progress', 'resolved', 'closed'] as const).map((status) => (
                  <AdminChoiceChip key={status} active={editStatus === status} label={getSupportStatusLabel(status)} onPress={() => setEditStatus(status)} />
                ))}
              </View>

              <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-[#8FA7C7]">Prioridad</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {(['low', 'medium', 'high'] as const).map((priority) => (
                  <AdminChoiceChip key={priority} active={editPriority === priority} label={getSupportPriorityLabel(priority)} onPress={() => setEditPriority(priority)} />
                ))}
              </View>

              <Text className="mt-4 text-[12px] font-black uppercase tracking-[0.7px] text-[#8FA7C7]">Respuesta al usuario</Text>
              <TextInput
                accessibilityLabel="Respuesta del administrador"
                className="mt-2 min-h-[130px] rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3 text-[14px] leading-5 text-white"
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
                  className="h-11 items-center justify-center rounded-xl border border-[#20375E] bg-[#09162C] px-4"
                >
                  <Text className="font-black text-[#DDE7F4]">Cancelar</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Guardar respuesta del ticket"
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void saveTicket()}
                  className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-[#5A46D8] px-5"
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
          exporting={exporting}
          onExport={() => void runAdminExport(setExporting, () => exportAdminSupport({
            search,
            status: statusFilter === 'all' ? null : statusFilter,
            priority: priorityFilter === 'all' ? null : priorityFilter,
            role: roleFilter === 'all' ? null : roleFilter,
          }))}
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
            <SupportTicketCard key={ticket.id} ticket={ticket} onManage={() => openTicket(ticket)} />
          ))}
          {!supportPage.loading && supportPage.rows.length === 0 ? <EmptyState label="No hay tickets que coincidan con los filtros." /> : null}
        </View>

        <AdminPagination
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
