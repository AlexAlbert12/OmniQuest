import React, { useMemo } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import type { AdminAuditLogRow, AdminData } from '../types/admin'
import { EmptyState, MiniPill, Panel } from '../shared/AdminPrimitives'
import { formatAuditDate, getAdminAuditSeverity, getAdminAuditSeverityMeta, getAuditActionLabel, getAuditTargetLabel } from '../utils/adminUtils'

export const RecentAuditPanel = React.memo(function RecentAuditPanel({ data }: { data: AdminData }) {
  const latestLogs = useMemo(() => data.auditLogs.slice(0, 5), [data.auditLogs])
  return <Panel title="Últimas acciones admin" icon="receipt-outline" compact><View style={{ gap: 10 }}>{latestLogs.map((log) => <AuditLogCard key={log.id} log={log} data={data} compact />)}{latestLogs.length === 0 ? <EmptyState label="Todavía no hay acciones de auditoría registradas." /> : null}</View></Panel>
})

export const AuditLogCard = React.memo(function AuditLogCard({ compact, data, log }: { compact?: boolean; data: AdminData; log: AdminAuditLogRow }) {
  const { tokens } = useAppTheme()
  const admin = useMemo(() => data.profiles.find((profile) => profile.id === log.admin_id), [data.profiles, log.admin_id])
  const actorLabel = log.actor_alias || admin?.alias || 'Admin desconocido'
  const severity = log.severity || getAdminAuditSeverity(log.action)
  const severityMeta = getAdminAuditSeverityMeta(severity, tokens)
  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-[220px] flex-1"><Text className="font-black text-text-primary">{getAuditActionLabel(log.action)}</Text><Text className="mt-1 text-[12px] text-text-muted">{actorLabel} · {formatAuditDate(log.created_at)}</Text></View>
        <View className="flex-row flex-wrap items-center gap-2"><View className="rounded-full px-3 py-1" style={{ backgroundColor: severityMeta.background }}><Text className="text-[10px] font-black uppercase" style={{ color: severityMeta.color }}>{severityMeta.label}</Text></View><MiniPill icon="shield-checkmark-outline" label={log.target_table || 'sistema'} /></View>
      </View>
      <Text className="mt-3 text-[13px] text-text-secondary">{getAuditTargetLabel(log)}</Text>
      {!compact ? <AuditChangePreview before={log.before_state} after={log.after_state} /> : null}
      {!compact && log.chain_hash ? <View className="mt-3 flex-row items-center gap-2"><Ionicons name="link-outline" size={14} color={tokens.text.muted} /><Text className="font-mono text-[10px] text-text-muted" numberOfLines={1}>Cadena #{log.chain_seq || log.id} · {log.chain_hash.slice(0, 16)}…</Text></View> : null}
      {!compact && !log.before_state && !log.after_state && Object.keys(log.metadata || {}).length > 0 ? <Text className="mt-3 font-mono text-[11px] leading-5 text-text-secondary" numberOfLines={4}>{JSON.stringify(log.metadata || {}, null, 2)}</Text> : null}
    </View>
  )
})

export const AuditChangePreview = React.memo(function AuditChangePreview({ before, after, compact = false }: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null; compact?: boolean }) {
  const changes = useMemo(() => getChangedFields(before, after), [after, before])
  if (changes.length === 0) return compact ? <Text className="text-[11px] text-text-muted">Sin cambios estructurados</Text> : null
  const visibleCount = compact ? 2 : 6
  return (
    <View className={compact ? '' : 'mt-3 rounded-xl border border-border-default bg-surface-raised p-3'}>
      {!compact ? <Text className="mb-2 text-[10px] font-black uppercase tracking-[0.7px] text-text-muted">Antes → después</Text> : null}
      <View style={{ gap: 7 }}>{changes.slice(0, visibleCount).map((change) => <View key={change.key} className="flex-row items-start gap-2"><Text className="w-[96px] text-[10px] font-black text-text-muted" numberOfLines={1}>{change.key}</Text><Text className="min-w-0 flex-1 text-[11px] text-text-secondary" numberOfLines={compact ? 1 : 3}>{formatAuditValue(change.before)} → {formatAuditValue(change.after)}</Text></View>)}</View>
      {changes.length > visibleCount ? <Text className="mt-2 text-[10px] font-bold text-text-muted">+{changes.length - visibleCount} cambios adicionales</Text> : null}
    </View>
  )
})

function getChangedFields(before?: Record<string, unknown> | null, after?: Record<string, unknown> | null) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].sort()
  return keys.map((key) => ({ key, before: before?.[key], after: after?.[key] })).filter((item) => JSON.stringify(item.before) !== JSON.stringify(item.after))
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
