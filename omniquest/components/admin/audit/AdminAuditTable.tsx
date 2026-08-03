import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import type { AdminAuditLogRow } from '../types/admin'
import { AuditChangePreview } from './AdminAuditComponents'
import { formatAuditDate, getAdminAuditSeverityMeta, getAuditActionLabel, getAuditTargetLabel } from '../utils/adminUtils'

export default function AdminAuditTable({ rows }: { rows: AdminAuditLogRow[] }) {
  const { tokens } = useAppTheme()
  return (
    <View style={[styles.table, { borderColor: tokens.border.default }]}>
      <View style={[styles.header, { backgroundColor: tokens.surface.raised, borderBottomColor: tokens.border.default }]}><HeaderCell label="Fecha" style={styles.dateColumn} /><HeaderCell label="Actor" style={styles.actorColumn} /><HeaderCell label="Acción" style={styles.actionColumn} /><HeaderCell label="Entidad" style={styles.entityColumn} /><HeaderCell label="Antes → después" style={styles.changeColumn} /><HeaderCell label="Severidad" style={styles.severityColumn} /></View>
      {rows.map((log, index) => {
        const severityMeta = getAdminAuditSeverityMeta(log.severity || 'info', tokens)
        return <View key={`${log.id}-${log.created_at}`} style={[styles.row, { backgroundColor: index % 2 === 0 ? tokens.surface.default : tokens.surface.interactive, borderBottomColor: tokens.border.default }]}>
          <View style={styles.dateColumn}><Text style={[styles.primary, { color: tokens.text.primary }]} numberOfLines={1}>{formatAuditDate(log.created_at)}</Text><Text style={[styles.secondary, { color: tokens.text.muted }]} numberOfLines={1}>#{log.chain_seq || log.id}{log.chain_hash ? ` · ${log.chain_hash.slice(0, 8)}` : ''}</Text></View>
          <View style={styles.actorColumn}><Text style={[styles.primary, { color: tokens.text.primary }]} numberOfLines={1}>{log.actor_alias || 'Admin desconocido'}</Text><Text style={[styles.secondary, { color: tokens.text.muted }]} numberOfLines={1}>{log.actor_email || log.admin_id}</Text></View>
          <View style={styles.actionColumn}><Text style={[styles.primary, { color: tokens.text.primary }]} numberOfLines={2}>{getAuditActionLabel(log.action)}</Text><Text style={[styles.code, { color: tokens.text.muted }]} numberOfLines={1}>{log.action}</Text></View>
          <View style={styles.entityColumn}><View style={styles.entityTitle}><Ionicons name="cube-outline" size={14} color={tokens.text.secondary} /><Text style={[styles.primary, { color: tokens.text.primary }]} numberOfLines={1}>{log.target_table || 'sistema'}</Text></View><Text style={[styles.secondary, { color: tokens.text.muted }]} numberOfLines={2}>{getAuditTargetLabel(log)}</Text></View>
          <View style={styles.changeColumn}><AuditChangePreview before={log.before_state} after={log.after_state} compact /></View>
          <View style={styles.severityColumn}><View style={[styles.severityPill, { backgroundColor: severityMeta.background }]}><Text style={[styles.severityText, { color: severityMeta.color }]}>{severityMeta.label}</Text></View></View>
        </View>
      })}
    </View>
  )
}

function HeaderCell({ label, style }: { label: string; style: object }) { const { tokens } = useAppTheme(); return <Text style={[styles.headerText, style, { color: tokens.text.muted }]}>{label}</Text> }

const styles = StyleSheet.create({
  table: { overflow: 'hidden', borderWidth: 1, borderRadius: 16 }, header: { minHeight: 44, borderBottomWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, headerText: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' }, row: { minHeight: 92, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, dateColumn: { width: 148 }, actorColumn: { width: 190 }, actionColumn: { width: 220 }, entityColumn: { width: 205 }, changeColumn: { width: 260 }, severityColumn: { width: 116, alignItems: 'flex-end' }, primary: { fontSize: 12, lineHeight: 17, fontWeight: '900' }, secondary: { marginTop: 3, fontSize: 10, lineHeight: 14, fontWeight: '600' }, code: { marginTop: 4, fontFamily: 'monospace', fontSize: 9, lineHeight: 12 }, entityTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 }, severityPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, severityText: { fontSize: 9, lineHeight: 11, fontWeight: '900', textTransform: 'uppercase' },
})
