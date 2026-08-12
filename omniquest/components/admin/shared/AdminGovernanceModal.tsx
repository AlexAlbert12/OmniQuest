import React, { useEffect, useState } from 'react'
import AdminButton from './AdminButton'
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { AdminDateField, AdminFilterSelect, type AdminFilterOption } from './AdminAdvancedFilters'

export type AdminGovernanceMode = 'deactivate-user' | 'archive-course' | 'transfer-course' | 'deactivate-classroom' | 'delete-student-progress'

export type AdminGovernanceResult = {
  reason: string
  reactivateAt: string | null
  targetTeacherId: string | null
  deactivateClassrooms: boolean
}

export default function AdminGovernanceModal({
  count,
  mode,
  onCancel,
  onConfirm,
  teacherOptions = [],
  targetLabel,
  visible,
}: {
  count: number
  mode: AdminGovernanceMode
  onCancel: () => void
  onConfirm: (result: AdminGovernanceResult) => Promise<void> | void
  teacherOptions?: AdminFilterOption[]
  targetLabel?: string
  visible: boolean
}) {
  const { tokens } = useAppTheme()
  const [reason, setReason] = useState('')
  const [reactivateAt, setReactivateAt] = useState('')
  const [targetTeacherId, setTargetTeacherId] = useState('')
  const [deactivateClassrooms, setDeactivateClassrooms] = useState(true)
  const [confirmationValue, setConfirmationValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible) return
    setReason('')
    setReactivateAt('')
    setTargetTeacherId('')
    setDeactivateClassrooms(true)
    setConfirmationValue('')
  }, [visible, mode])

  const title = mode === 'deactivate-user' ? 'Desactivar usuarios' : mode === 'archive-course' ? 'Archivar cursos' : mode === 'transfer-course' ? 'Transferir propietario' : mode === 'delete-student-progress' ? 'Eliminar progreso académico' : 'Desactivar clases'
  const icon: keyof typeof Ionicons.glyphMap = mode === 'transfer-course' ? 'swap-horizontal-outline' : mode === 'archive-course' ? 'archive-outline' : mode === 'delete-student-progress' ? 'trash-outline' : 'ban-outline'
  const reasonRequired = true
  const requiresDeleteConfirmation = mode === 'delete-student-progress'
  const canSubmit = reason.trim().length >= 5 && (mode !== 'transfer-course' || Boolean(targetTeacherId)) && (!requiresDeleteConfirmation || confirmationValue.trim().toUpperCase() === 'ELIMINAR')

  const submit = async () => {
    if (!canSubmit || saving) return
    setSaving(true)
    try {
      await onConfirm({ reason: reason.trim(), reactivateAt: reactivateAt.trim() || null, targetTeacherId: targetTeacherId || null, deactivateClassrooms })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <AppPressable accessibilityLabel="Cerrar diálogo" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View style={[styles.card, { backgroundColor: tokens.background.primary, borderColor: tokens.border.default }]}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: tokens.surface.selected }]}><Ionicons name={icon} size={24} color={tokens.brand.admin} /></View>
            <View style={styles.headerText}><Text style={[styles.title, { color: tokens.text.primary }]}>{title}</Text><Text style={[styles.subtitle, { color: tokens.text.muted }]}>{mode === 'delete-student-progress' ? 'Esta acción es irreversible y quedará registrada con el motivo administrativo.' : `${count} elemento(s) seleccionado(s). La acción quedará en el historial inmutable.`}</Text></View>
          </View>
          <ScrollView contentContainerStyle={{ gap: 16 }}>
            {mode === 'transfer-course' ? <AdminFilterSelect label="Nuevo profesor propietario" value={targetTeacherId} onChange={setTargetTeacherId} options={[{ value: '', label: 'Selecciona profesor' }, ...teacherOptions]} /> : null}
            <View>
              <Text style={[styles.label, { color: tokens.text.secondary }]}>Motivo {reasonRequired ? 'obligatorio' : ''}</Text>
              <TextInput accessibilityLabel="Motivo de la acción" value={reason} onChangeText={setReason} multiline placeholder="Explica el motivo administrativo..." placeholderTextColor={tokens.text.muted} style={[styles.textArea, { color: tokens.text.primary, borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }]} />
              <Text style={[styles.hint, { color: tokens.text.muted }]}>Mínimo 5 caracteres. No incluyas datos sensibles.</Text>
            </View>
            {mode === 'delete-student-progress' ? (
              <View style={[styles.warningBox, { borderColor: tokens.semantic.danger, backgroundColor: tokens.semanticSurface.danger }]}>
                <Text style={[styles.warningTitle, { color: tokens.semantic.danger }]}>Se eliminarán las puntuaciones, progreso por tema, intentos e insignias de {targetLabel || 'este alumno'}.</Text>
                <Text style={[styles.warningText, { color: tokens.text.secondary }]}>Las matrículas y la cuenta del alumno se conservarán. Esta acción no se puede deshacer.</Text>
                <Text style={[styles.label, { marginTop: 12, color: tokens.text.secondary }]}>Escribe ELIMINAR para continuar</Text>
                <TextInput accessibilityLabel="Escribe ELIMINAR para confirmar" autoCapitalize="characters" autoCorrect={false} value={confirmationValue} onChangeText={setConfirmationValue} placeholder="ELIMINAR" placeholderTextColor={tokens.text.muted} style={[styles.input, { color: tokens.text.primary, borderColor: confirmationValue.trim().toUpperCase() === 'ELIMINAR' ? tokens.semantic.success : tokens.border.default, backgroundColor: tokens.surface.interactive }]} />
              </View>
            ) : null}
            {mode === 'deactivate-user' ? (
              <AdminDateField label="Fecha de reactivación opcional" value={reactivateAt} onChange={setReactivateAt} minWidth={0} />
            ) : null}
            {mode === 'archive-course' ? (
              <AppPressable accessibilityLabel="Desactivar clases vinculadas" accessibilityRole="checkbox" accessibilityState={{ checked: deactivateClassrooms }} onPress={() => setDeactivateClassrooms((value) => !value)} style={[styles.checkboxRow, { borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }]}>
                <Ionicons name={deactivateClassrooms ? 'checkbox' : 'square-outline'} size={21} color={deactivateClassrooms ? tokens.brand.admin : tokens.text.muted} />
                <View style={{ flex: 1 }}><Text style={[styles.checkboxTitle, { color: tokens.text.primary }]}>Desactivar clases vinculadas</Text><Text style={[styles.hint, { color: tokens.text.muted }]}>Archivar el curso desactiva sus clases para evitar actividad incoherente. Al restaurar, las clases se revisan manualmente.</Text></View>
              </AppPressable>
            ) : null}
          </ScrollView>
          <View style={styles.actions}><AdminButton label="Cancelar" variant="ghost" onPress={onCancel} /><AdminButton label={saving ? 'Aplicando...' : mode === 'delete-student-progress' ? 'Eliminar progreso' : 'Confirmar'} variant="danger" loading={saving} disabled={!canSubmit || saving} onPress={() => void submit()} /></View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.62)' },
  card: { width: '100%', maxWidth: 560, maxHeight: '90%', borderWidth: 1, borderRadius: 24, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 }, title: { fontSize: 20, fontWeight: '900' }, subtitle: { marginTop: 4, fontSize: 12, lineHeight: 18 },
  label: { marginBottom: 7, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  textArea: { minHeight: 110, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, textAlignVertical: 'top' },
  hint: { marginTop: 5, fontSize: 11, lineHeight: 16 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14 },
  checkboxTitle: { fontSize: 13, fontWeight: '900' },
  warningBox: { borderWidth: 1, borderRadius: 14, padding: 14 },
  warningTitle: { fontSize: 13, lineHeight: 18, fontWeight: '900' },
  warningText: { marginTop: 5, fontSize: 12, lineHeight: 18 },
  actions: { marginTop: 18, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
})
