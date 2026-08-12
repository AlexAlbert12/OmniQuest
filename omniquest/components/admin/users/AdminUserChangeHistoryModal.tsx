import React, { useEffect, useState } from 'react'
import AdminButton from '../shared/AdminButton'
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { fetchAdminUserChangeHistory } from '../api/adminApi'
import type { AdminUserChangeRow, ProfileRow } from '../types/admin'
import { formatAdminDate } from '../utils/adminUtils'

export default function AdminUserChangeHistoryModal({ profile, visible, onClose }: { profile: ProfileRow | null; visible: boolean; onClose: () => void }) {
  const { tokens } = useAppTheme()
  const [rows, setRows] = useState<AdminUserChangeRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible || !profile) return
    setLoading(true)
    fetchAdminUserChangeHistory(profile.id).then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }, [profile, visible])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <AppPressable accessibilityLabel="Cerrar historial" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.card, { backgroundColor: tokens.background.primary, borderColor: tokens.border.default }]}>
          <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.title, { color: tokens.text.primary }]}>Historial de {profile?.alias || 'usuario'}</Text><Text style={[styles.subtitle, { color: tokens.text.muted }]}>Registro inmutable de cambios administrativos.</Text></View><AdminButton accessibilityLabel="Cerrar" icon="close" iconOnly size="sm" variant="ghost" onPress={onClose} /></View>
          <ScrollView style={styles.scrollContent} contentContainerStyle={{ gap: 10 }}>
            {loading ? <ActivityIndicator color={tokens.brand.admin} /> : rows.map((row) => <View key={row.id} style={[styles.row, { borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }]}><Text style={[styles.rowTitle, { color: tokens.text.primary }]}>{row.action}</Text><Text style={[styles.rowMeta, { color: tokens.text.muted }]}>{formatAdminDate(row.created_at)} · {row.change_source === 'system' ? 'Sistema' : row.actor_alias || row.changed_by || 'Administrador'}</Text>{row.reason ? <Text style={[styles.reason, { color: tokens.text.secondary }]}>Motivo: {row.reason}</Text> : null}<Text style={[styles.code, { color: tokens.text.muted }]} numberOfLines={5}>Antes: {JSON.stringify(row.before_state || {})}{'\n'}Después: {JSON.stringify(row.after_state || {})}</Text></View>)}
            {!loading && rows.length === 0 ? <Text style={[styles.empty, { color: tokens.text.muted }]}>No hay cambios registrados.</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.62)' },
  card: { width: '100%', maxWidth: 720, maxHeight: '88%', borderWidth: 1, borderRadius: 24, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  headerCopy: { minWidth: 0, flex: 1 },
  scrollContent: { minHeight: 0, flexShrink: 1 },
  title: { fontSize: 20, fontWeight: '900' }, subtitle: { marginTop: 4, fontSize: 12 },
  row: { borderWidth: 1, borderRadius: 14, padding: 14 }, rowTitle: { fontSize: 13, fontWeight: '900' }, rowMeta: { marginTop: 4, fontSize: 11 }, reason: { marginTop: 7, fontSize: 12 }, code: { marginTop: 8, fontSize: 10, lineHeight: 15 }, empty: { paddingVertical: 30, textAlign: 'center' },
})
