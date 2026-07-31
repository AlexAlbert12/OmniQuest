import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TextInput, View } from 'react-native'
import { AppButton, AppDropdown } from '../../ui'
import { useAppTheme } from '../../../lib/appTheme'
import { assignAdminRole, fetchAdminRoleAssignments, fetchAdminRoles } from '../api/adminApi'
import { Panel } from '../shared/AdminPrimitives'
import type { AdminRoleAssignmentRow, AdminRoleRow } from '../types/admin'
import { formatAdminDate, showAlert } from '../utils/adminUtils'

export default function AdminRoleManagementPanel({ canManage }: { canManage: boolean }) {
  const { tokens } = useAppTheme()
  const [roles, setRoles] = useState<AdminRoleRow[]>([])
  const [assignments, setAssignments] = useState<AdminRoleAssignmentRow[]>([])
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextRoles, nextAssignments] = await Promise.all([fetchAdminRoles(), fetchAdminRoleAssignments()])
      setRoles(nextRoles)
      setAssignments(nextAssignments)
      setSelectedRoles(Object.fromEntries(nextAssignments.map((item) => [item.user_id, item.role_id])))
    } catch (error: any) {
      showAlert('Roles administrativos no disponibles', error.message || 'No se pudieron cargar los roles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const roleOptions = useMemo(() => roles.map((role) => ({ value: role.id, label: role.name, description: role.description || `${role.permissions.length} permisos` })), [roles])

  const save = async (assignment: AdminRoleAssignmentRow) => {
    const roleId = selectedRoles[assignment.user_id]
    const reason = (reasons[assignment.user_id] || '').trim()
    if (!roleId) return showAlert('Selecciona un rol', 'Debes seleccionar el perfil de permisos.')
    if (reason.length < 5) return showAlert('Motivo obligatorio', 'Explica el motivo del cambio con al menos cinco caracteres.')
    setSavingUserId(assignment.user_id)
    try {
      await assignAdminRole(assignment.user_id, roleId, reason)
      setReasons((current) => ({ ...current, [assignment.user_id]: '' }))
      showAlert('Rol actualizado', `Los permisos de ${assignment.alias} se han actualizado.`)
      await load()
    } catch (error: any) {
      showAlert('No se pudo actualizar el rol', error.message || 'Revisa tus permisos administrativos.')
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <Panel title="Roles administrativos limitados" icon="key-outline" className="mt-5">
      <Text className="mb-4 text-[13px] leading-5 text-text-secondary">Asigna solo los permisos necesarios. Los cambios quedan auditados y no sustituyen la protección contra la autodesactivación.</Text>
      {loading ? <View className="items-center py-6"><ActivityIndicator color={tokens.brand.admin} /></View> : null}
      <View style={{ gap: 12 }}>
        {assignments.map((assignment) => (
          <View key={assignment.user_id} className="rounded-2xl border border-border-default bg-surface-interactive p-4">
            <View className="mb-3 flex-row flex-wrap items-start justify-between gap-3">
              <View className="min-w-[220px] flex-1"><Text className="font-black text-text-primary">{assignment.alias}</Text><Text className="mt-1 text-[12px] text-text-muted">{assignment.email || 'Sin correo'} · Asignado {formatAdminDate(assignment.assigned_at)}</Text></View>
              <Text className="rounded-full bg-surface-selected px-3 py-1 text-[11px] font-black text-brand-admin">{assignment.role_name}</Text>
            </View>
            <AppDropdown label="Perfil de permisos" value={selectedRoles[assignment.user_id] || assignment.role_id} options={roleOptions} onChange={(value) => setSelectedRoles((current) => ({ ...current, [assignment.user_id]: value }))} disabled={!canManage || savingUserId === assignment.user_id} />
            <TextInput accessibilityLabel={`Motivo del cambio para ${assignment.alias}`} value={reasons[assignment.user_id] || ''} onChangeText={(value) => setReasons((current) => ({ ...current, [assignment.user_id]: value }))} editable={canManage} placeholder="Motivo obligatorio del cambio" placeholderTextColor={tokens.text.muted} className="mt-3 min-h-12 rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default, color: tokens.text.primary }} />
            {canManage ? <View className="mt-3 items-start"><AppButton label={savingUserId === assignment.user_id ? 'Guardando...' : 'Guardar permisos'} icon="save-outline" size="sm" loading={savingUserId === assignment.user_id} onPress={() => void save(assignment)} /></View> : null}
          </View>
        ))}
        {!loading && assignments.length === 0 ? <Text className="text-[13px] text-text-muted">No hay cuentas administradoras activas.</Text> : null}
      </View>
    </Panel>
  )
}
