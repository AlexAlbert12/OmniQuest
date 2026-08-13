import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AdminButton from '../shared/AdminButton'
import { ActivityIndicator, Text, TextInput, View } from 'react-native'
import { AppDropdown } from '../../ui'
import { useAppTheme } from '../../../lib/appTheme'
import { assignAdminRole, fetchAdminRoleAssignments, fetchAdminRoles, revokeAdminRole } from '../api/adminApi'
import { Panel } from '../shared/AdminPrimitives'
import type { AdminRoleAssignmentRow, AdminRoleRow } from '../types/admin'
import { formatAdminDate } from '../utils/adminUtils'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage } from '../../../lib/typeGuards'
import { useAppModal } from '../../AppModalProvider'
import { useResponsiveLayout } from '../../../lib/responsive'

export default function AdminRoleManagementPanel({ canManage, currentAdminId }: { canManage: boolean; currentAdminId?: string | null }) {
  const { tokens } = useAppTheme()
  const responsive = useResponsiveLayout()
  const { showModal } = useAppModal()
  const [roles, setRoles] = useState<AdminRoleRow[]>([])
  const [assignments, setAssignments] = useState<AdminRoleAssignmentRow[]>([])
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(canManage)
  const feedback = useAppFeedback()

  const load = useCallback(async () => {
    if (!canManage) return
    setLoading(true)
    try {
      const [nextRoles, nextAssignments] = await Promise.all([fetchAdminRoles(), fetchAdminRoleAssignments()])
      setRoles(nextRoles)
      setAssignments(nextAssignments)
      setSelectedRoles(Object.fromEntries(nextAssignments.map((item) => [item.user_id, item.role_id === 'unassigned' ? '' : item.role_id])))
    } catch (error: unknown) {
      feedback.error('Roles administrativos no disponibles', getErrorMessage(error, 'No se pudieron cargar los roles.'))
    } finally {
      setLoading(false)
    }
  }, [canManage, feedback])

  useEffect(() => { if (canManage) void load() }, [canManage, load])

  const roleOptions = useMemo(() => roles.map((role) => ({ value: role.id, label: role.name, description: role.description || `${role.permissions.length} permisos` })), [roles])

  const performSave = async (assignment: AdminRoleAssignmentRow, roleId: string, reason: string) => {
    setSavingUserId(assignment.user_id)
    try {
      await assignAdminRole(assignment.user_id, roleId, reason)
      setReasons((current) => ({ ...current, [assignment.user_id]: '' }))
      feedback.success('Rol actualizado', `Los permisos de ${assignment.alias} se han actualizado.`)
      await load()
    } catch (error: unknown) {
      feedback.error('No se pudo actualizar el rol', getErrorMessage(error, 'Revisa tus permisos administrativos.'))
    } finally {
      setSavingUserId(null)
    }
  }

  const performRevoke = async (assignment: AdminRoleAssignmentRow, reason: string) => {
    setSavingUserId(assignment.user_id)
    try {
      await revokeAdminRole(assignment.user_id, reason)
      setReasons((current) => ({ ...current, [assignment.user_id]: '' }))
      feedback.success('Acceso retirado', `${assignment.alias} ya no tiene acceso operativo al portal administrativo.`)
      await load()
    } catch (error: unknown) {
      feedback.error('No se pudo retirar el acceso', getErrorMessage(error, 'Revisa tus permisos administrativos.'))
    } finally {
      setSavingUserId(null)
    }
  }

  const save = (assignment: AdminRoleAssignmentRow) => {
    const roleId = selectedRoles[assignment.user_id]
    const reason = (reasons[assignment.user_id] || '').trim()
    if (!roleId) return feedback.warning('Selecciona un rol', 'Debes seleccionar el perfil de permisos.')
    if (roleId === assignment.role_id) return feedback.warning('Sin cambios', 'Selecciona un perfil distinto antes de guardar.')
    if (reason.length < 5) return feedback.warning('Motivo obligatorio', 'Explica el motivo del cambio con al menos cinco caracteres.')
    if (assignment.user_id === currentAdminId && roleId !== assignment.role_id) return feedback.warning('Cambio no disponible', 'No puedes reducir ni modificar los permisos de tu propia cuenta desde esta pantalla.')
    if (roleId === 'super_admin' && assignment.role_id !== 'super_admin') {
      showModal({ title: 'Conceder acceso de administrador global', message: `Estás concediendo a ${assignment.alias} acceso completo a usuarios, contenido, soporte, auditoría y permisos administrativos.`, variant: 'warning', buttons: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Conceder acceso', role: 'danger', onPress: () => performSave(assignment, roleId, reason) }] })
      return
    }
    if (assignment.role_id === 'super_admin' && roleId !== 'super_admin') {
      showModal({ title: 'Reducir privilegios administrativos', message: `${assignment.alias} perderá acceso a determinadas áreas y acciones del portal. El cambio quedará registrado en auditoría.`, variant: 'warning', buttons: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Cambiar permisos', role: 'danger', onPress: () => performSave(assignment, roleId, reason) }] })
      return
    }
    void performSave(assignment, roleId, reason)
  }

  const requestRevoke = (assignment: AdminRoleAssignmentRow) => {
    const reason = (reasons[assignment.user_id] || '').trim()
    if (assignment.user_id === currentAdminId) return feedback.warning('Acción no disponible', 'No puedes retirar el acceso administrativo de tu propia cuenta.')
    if (assignment.role_id === 'unassigned') return
    if (reason.length < 5) return feedback.warning('Motivo obligatorio', 'Explica el motivo de la retirada con al menos cinco caracteres.')
    showModal({ title: 'Retirar acceso administrativo', message: `${assignment.alias} quedará sin acceso operativo al portal hasta que vuelva a recibir un perfil explícito. La retirada y su motivo quedarán registrados en auditoría.`, variant: 'warning', buttons: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Retirar acceso', role: 'danger', onPress: () => performRevoke(assignment, reason) }] })
  }

  if (!canManage) return null

  return (
    <Panel title="Roles administrativos limitados" icon="key-outline" className="mt-5">
      <Text className="mb-4 text-[13px] leading-5 text-text-secondary">Asigna solo los permisos necesarios. Las cuentas administradoras nuevas permanecen sin acceso hasta recibir un perfil explícito.</Text>
      {loading ? <View className="items-center py-6"><ActivityIndicator color={tokens.brand.admin} /></View> : null}
      <View style={{ gap: 12 }}>
        {assignments.map((assignment) => {
          const isSelf = assignment.user_id === currentAdminId
          const selectedRole = selectedRoles[assignment.user_id] || ''
          const reason = (reasons[assignment.user_id] || '').trim()
          const hasRoleChange = Boolean(selectedRole) && selectedRole !== assignment.role_id
          const canSave = hasRoleChange && reason.length >= 5 && !isSelf && savingUserId !== assignment.user_id
          const canRevoke = assignment.role_id !== 'unassigned' && reason.length >= 5 && !isSelf && savingUserId !== assignment.user_id
          const options = roleOptions.map((option) => isSelf && option.value !== assignment.role_id ? { ...option, disabled: true, description: `${option.description} No disponible para tu propia cuenta.` } : option)
          return (
            <View key={assignment.user_id} className="rounded-2xl border border-border-default bg-surface-interactive p-4">
              <View className="mb-3 flex-row flex-wrap items-start justify-between gap-3">
                <View className="min-w-[220px] flex-1"><Text className="font-black text-text-primary">{assignment.alias}{isSelf ? ' (tú)' : ''}</Text><Text className="mt-1 text-[12px] text-text-muted">{assignment.email || 'Sin correo'} · {assignment.assigned_at ? `Asignado ${formatAdminDate(assignment.assigned_at)}` : 'Sin perfil asignado'}</Text></View>
                <Text className="rounded-full bg-surface-selected px-3 py-1 text-[11px] font-black text-brand-admin">{assignment.role_name}</Text>
              </View>
              <AppDropdown role="admin" label="Perfil de permisos" value={selectedRole} placeholder="Selecciona un perfil" options={options} onChange={(value) => setSelectedRoles((current) => ({ ...current, [assignment.user_id]: value }))} disabled={savingUserId === assignment.user_id} />
              {isSelf ? <Text className="mt-2 text-[11px] leading-4 text-text-muted">No puedes reducir ni retirar los permisos de tu propia cuenta administrativa.</Text> : null}
              <TextInput accessibilityLabel={`Motivo del cambio para ${assignment.alias}`} value={reasons[assignment.user_id] || ''} onChangeText={(value) => setReasons((current) => ({ ...current, [assignment.user_id]: value }))} placeholder="Motivo obligatorio del cambio" placeholderTextColor={tokens.text.muted} className="mt-3 min-h-12 rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default, color: tokens.text.primary }} />
              <View className="mt-3 flex-row flex-wrap items-center gap-2"><AdminButton label={savingUserId === assignment.user_id ? 'Guardando...' : 'Guardar permisos'} icon="save-outline" size={responsive.isMobile ? 'md' : 'sm'} loading={savingUserId === assignment.user_id} disabled={!canSave} onPress={() => save(assignment)} />{assignment.role_id !== 'unassigned' ? <AdminButton label="Retirar acceso administrativo" icon="remove-circle-outline" variant="danger" size={responsive.isMobile ? 'md' : 'sm'} disabled={!canRevoke} onPress={() => requestRevoke(assignment)} /> : null}</View>
            </View>
          )
        })}
        {!loading && assignments.length === 0 ? <Text className="text-[13px] text-text-muted">No hay cuentas administradoras activas.</Text> : null}
      </View>
    </Panel>
  )
}
