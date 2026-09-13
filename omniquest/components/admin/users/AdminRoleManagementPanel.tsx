import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TextInput, View } from 'react-native'
import { AppBottomSheet, AppDropdown } from '../../ui'
import { useAppTheme } from '../../../lib/appTheme'
import { assignAdminRole, fetchAdminRoleAssignments, fetchAdminRoles, inviteAdmin, revokeAdminRole } from '../api/adminApi'
import AdminButton from '../shared/AdminButton'
import { AdminInput, Panel } from '../shared/AdminPrimitives'
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
  const [inviteVisible, setInviteVisible] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteAlias, setInviteAlias] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')
  const [inviteReason, setInviteReason] = useState('')
  const [inviting, setInviting] = useState(false)
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
  const normalizedInviteEmail = inviteEmail.trim().toLowerCase()
  const normalizedInviteAlias = inviteAlias.trim()
  const normalizedInviteReason = inviteReason.trim()
  const canSubmitInvite = isValidInviteEmail(normalizedInviteEmail) && normalizedInviteAlias.length >= 2 && normalizedInviteAlias.length <= 80 && Boolean(inviteRoleId) && normalizedInviteReason.length >= 5 && normalizedInviteReason.length <= 500 && !inviting

  const resetInviteForm = useCallback(() => {
    setInviteEmail('')
    setInviteAlias('')
    setInviteRoleId('')
    setInviteReason('')
  }, [])

  const closeInvite = useCallback(() => {
    if (inviting) return
    setInviteVisible(false)
    resetInviteForm()
  }, [inviting, resetInviteForm])

  const performInvite = async () => {
    setInviting(true)
    try {
      const result = await inviteAdmin({ email: normalizedInviteEmail, alias: normalizedInviteAlias, roleId: inviteRoleId, reason: normalizedInviteReason })
      const invitedAlias = result.admin?.alias || normalizedInviteAlias
      const roleName = result.admin?.roleName || roles.find((role) => role.id === inviteRoleId)?.name || 'Administrador'
      setInviteVisible(false)
      resetInviteForm()
      feedback.success(
        'Invitación enviada',
        result.deliveryMode === 'redirect'
          ? `Se ha preparado la invitación de ${invitedAlias} como ${roleName}. En modo de prueba, el correo se ha redirigido al destinatario configurado en Supabase.`
          : `Se ha invitado a ${invitedAlias} como ${roleName}.`,
      )
      await load()
    } catch (error: unknown) {
      feedback.error('No se pudo enviar la invitación', getErrorMessage(error, 'Revisa los datos y tus permisos administrativos.'))
    } finally {
      setInviting(false)
    }
  }

  const requestInvite = () => {
    if (!isValidInviteEmail(normalizedInviteEmail)) return feedback.warning('Correo no válido', 'Introduce un correo electrónico válido para el nuevo administrador.')
    if (normalizedInviteAlias.length < 2 || normalizedInviteAlias.length > 80) return feedback.warning('Alias obligatorio', 'El nombre visible debe tener entre 2 y 80 caracteres.')
    if (!inviteRoleId) return feedback.warning('Selecciona un perfil', 'Debes seleccionar el perfil de permisos del nuevo administrador.')
    if (normalizedInviteReason.length < 5 || normalizedInviteReason.length > 500) return feedback.warning('Motivo obligatorio', 'Explica el motivo de la invitación con entre 5 y 500 caracteres.')
    if (inviteRoleId === 'super_admin') {
      showModal({
        title: 'Conceder acceso de administrador global',
        message: `Estás invitando a ${normalizedInviteAlias} con acceso completo a usuarios, contenido, soporte, auditoría y gestión de otros administradores.`,
        variant: 'warning',
        buttons: [
          { label: 'Cancelar', role: 'cancel' },
          { label: 'Enviar invitación', role: 'danger', onPress: performInvite },
        ],
      })
      return
    }
    void performInvite()
  }

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
    <>
      <Panel title="Roles administrativos limitados" icon="key-outline" className="mt-5">
        <View className="mb-4 flex-row flex-wrap items-start justify-between gap-3">
          <Text className="min-w-[240px] flex-1 text-[13px] leading-5 text-text-secondary">Asigna solo los permisos necesarios. El primer administrador se crea mediante bootstrap; los siguientes se incorporan mediante una invitación segura.</Text>
          <AdminButton accessibilityLabel="Añadir administrador" label="Añadir administrador" icon="person-add-outline" size={responsive.isMobile ? 'md' : 'sm'} fullWidth={responsive.isMobile} onPress={() => setInviteVisible(true)} />
        </View>
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

      <AppBottomSheet
        visible={inviteVisible}
        onClose={closeInvite}
        closeOnBackdropPress={!inviting}
        title="Añadir administrador"
        description="Envía una invitación segura. La persona invitada establecerá su propia contraseña."
        testID="admin-invite-sheet"
        footer={(
          <View className={`flex-row flex-wrap ${responsive.isMobile ? 'gap-2' : 'justify-end gap-2'}`}>
            <AdminButton label="Cancelar" variant="secondary" fullWidth={responsive.isMobile} disabled={inviting} onPress={closeInvite} />
            <AdminButton accessibilityLabel="Enviar invitación de administrador" label={inviting ? 'Enviando...' : 'Enviar invitación'} icon="mail-outline" fullWidth={responsive.isMobile} loading={inviting} disabled={!canSubmitInvite} onPress={requestInvite} />
          </View>
        )}
      >
        <View style={{ gap: 14 }}>
          <AdminInput autoCapitalize="none" label="Correo del nuevo administrador" value={inviteEmail} onChangeText={setInviteEmail} placeholder="administrador@centro.es" />
          <AdminInput label="Alias / nombre visible" value={inviteAlias} onChangeText={setInviteAlias} placeholder="Ej. Laura García" />
          <AppDropdown role="admin" label="Perfil de permisos" value={inviteRoleId} placeholder="Selecciona un perfil" options={roleOptions} onChange={setInviteRoleId} disabled={inviting} />
          <View>
            <Text className="mb-2 text-[12px] font-bold text-text-secondary">Motivo de la invitación</Text>
            <TextInput
              accessibilityLabel="Motivo de la invitación"
              value={inviteReason}
              onChangeText={setInviteReason}
              multiline
              textAlignVertical="top"
              placeholder="Ej. Incorporación al equipo de soporte académico"
              placeholderTextColor={tokens.text.muted}
              className="min-h-[100px] rounded-xl border border-border-default bg-surface-default px-4 py-3 text-[13px] leading-5 text-text-primary"
              maxLength={500}
            />
            <Text className="mt-2 text-[11px] leading-4 text-text-muted">El motivo es obligatorio y quedará registrado en auditoría. No se solicita ni se genera una contraseña en esta pantalla.</Text>
          </View>
        </View>
      </AppBottomSheet>
    </>
  )
}

function isValidInviteEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
