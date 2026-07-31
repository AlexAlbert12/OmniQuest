import React from 'react'
import { Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import type { AdminAuditLogRow, AdminData } from '../types/admin'
import { EmptyState, MiniPill, Panel } from '../shared/AdminPrimitives'
import { formatAuditDate, getAdminAuditSeverity, getAdminAuditSeverityMeta, getAuditActionLabel, getAuditTargetLabel } from '../utils/adminUtils'

export function RecentAuditPanel({ data }: { data: AdminData }) {
  const latestLogs = data.auditLogs.slice(0, 5)
  return (
    <Panel title="Últimas acciones admin" icon="receipt-outline" compact>
      <View style={{ gap: 10 }}>{latestLogs.map((log) => <AuditLogCard key={log.id} log={log} data={data} compact />)}{latestLogs.length === 0 ? <EmptyState label="Todavía no hay acciones de auditoría registradas." /> : null}</View>
    </Panel>
  )
}

export function AuditLogCard({ compact, data, log }: { compact?: boolean; data: AdminData; log: AdminAuditLogRow }) {
  const { tokens } = useAppTheme()
  const admin = data.profiles.find((profile) => profile.id === log.admin_id)
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
      {!compact ? <Text className="mt-2 font-mono text-[12px] leading-5 text-text-secondary" numberOfLines={4}>{JSON.stringify(log.metadata || {}, null, 2)}</Text> : null}
    </View>
  )
}
