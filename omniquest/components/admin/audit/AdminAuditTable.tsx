import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AdminButton from '../shared/AdminButton'
import { useAppTheme } from '../../../lib/appTheme'
import type { AdminAuditLogRow } from '../types/admin'
import { AuditChangePreview } from './AdminAuditComponents'
import { formatAuditDate, getAdminAuditSeverityMeta, getAuditActionLabel, getAuditTargetReferenceLabel, getAuditTargetTypeLabel } from '../utils/adminUtils'

function AdminAuditTable({ onShowDetails, rows }: { onShowDetails: (log: AdminAuditLogRow) => void; rows: AdminAuditLogRow[] }) {
  const { tokens } = useAppTheme()
  return (
    <View style={[styles.table, { borderColor: tokens.border.default }]}>
      <View style={[styles.header, { backgroundColor: tokens.surface.raised, borderBottomColor: tokens.border.default }]}><HeaderCell label="Fecha" style={styles.dateColumn} /><HeaderCell label="Actor" style={styles.actorColumn} /><HeaderCell label="Acción" style={styles.actionColumn} /><HeaderCell label="Entidad" style={styles.entityColumn} /><HeaderCell label="Antes → después" style={styles.changeColumn} /><HeaderCell label="Severidad" style={styles.severityColumn} /></View>
      {rows.map((log, index) => <AdminAuditRow key={`${log.id}-${log.created_at}`} log={log} alternate={index % 2 !== 0} onShowDetails={onShowDetails} />)}
    </View>
  )
}

export default React.memo(AdminAuditTable)

const AdminAuditRow = React.memo(function AdminAuditRow({ log, alternate, onShowDetails }: { log: AdminAuditLogRow; alternate: boolean; onShowDetails: (log: AdminAuditLogRow) => void }) {
  const { tokens } = useAppTheme()
  const severityMeta = getAdminAuditSeverityMeta(log.severity || 'info', tokens)
  return (
    <View style={[styles.row, { backgroundColor: alternate ? tokens.surface.interactive : tokens.surface.default, borderBottomColor: tokens.border.default }]}>
      <View style={styles.dateColumn}><Text style={[styles.primary, { color: tokens.text.primary }]} numberOfLines={1}>{formatAuditDate(log.created_at)}</Text><Text style={[styles.secondary, { color: tokens.text.muted }]} numberOfLines={1}>Cadena #{log.chain_seq || log.id}</Text></View>
      <View style={styles.actorColumn}><Text style={[styles.primary, { color: tokens.text.primary }]} numberOfLines={1}>{log.actor_alias || 'Admin desconocido'}</Text><Text style={[styles.secondary, { color: tokens.text.muted }]} numberOfLines={1}>{log.actor_email || 'Cuenta administrativa'}</Text></View>
      <View style={styles.actionColumn}><Text style={[styles.primary, { color: tokens.text.primary }]} numberOfLines={2}>{getAuditActionLabel(log.action)}</Text><View style={styles.detailsButton}><AdminButton label="Detalles" icon="code-slash-outline" size="sm" variant="ghost" onPress={() => onShowDetails(log)} /></View></View>
      <View style={styles.entityColumn}><View style={styles.entityTitle}><Ionicons name="cube-outline" size={14} color={tokens.brand.admin} /><Text style={[styles.primary, { color: tokens.text.primary }]} numberOfLines={1}>{getAuditTargetTypeLabel(log.target_table)}</Text></View><Text style={[styles.secondary, { color: tokens.text.muted }]} numberOfLines={2}>{getAuditTargetReferenceLabel(log)}</Text></View>
      <View style={styles.changeColumn}><AuditChangePreview before={log.before_state} after={log.after_state} compact /></View>
      <View style={styles.severityColumn}><View style={[styles.severityPill, { backgroundColor: severityMeta.background }]}><Text style={[styles.severityText, { color: severityMeta.color }]}>{severityMeta.label}</Text></View></View>
    </View>
  )
})

const HeaderCell = React.memo(function HeaderCell({ label, style }: { label: string; style: object }) {
  const { tokens } = useAppTheme()
  return <Text style={[styles.headerText, style, { color: tokens.text.muted }]}>{label}</Text>
})

const styles = StyleSheet.create({
  table: { overflow: 'hidden', borderWidth: 1, borderRadius: 16 }, header: { minHeight: 44, borderBottomWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, headerText: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' }, row: { minHeight: 96, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, dateColumn: { width: 148 }, actorColumn: { width: 190 }, actionColumn: { width: 220 }, entityColumn: { width: 205 }, changeColumn: { width: 260 }, severityColumn: { width: 116, alignItems: 'flex-end' }, primary: { fontSize: 12, lineHeight: 17, fontWeight: '900' }, secondary: { marginTop: 3, fontSize: 10, lineHeight: 14, fontWeight: '600' }, detailsButton: { marginTop: 4, alignSelf: 'flex-start' }, entityTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 }, severityPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, severityText: { fontSize: 9, lineHeight: 11, fontWeight: '900', textTransform: 'uppercase' },
})
