import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import PaginationControls from '../../ui/PaginationControls'
import { useAppTheme } from '../../../lib/appTheme'
import type { TeacherAuditLog } from '../../../lib/teacherAudit'

export default function TeacherAuditTimeline({ items, total, page, pageSize, onPage }: { items: TeacherAuditLog[]; total: number; page: number; pageSize: number; onPage: (page: number) => void }) {
  const { tokens } = useAppTheme()
  if (!items.length) {
    return <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}><Ionicons name="shield-checkmark-outline" size={44} color={tokens.text.muted} /><Text className="mt-3 text-center" style={{ color: tokens.text.muted }}>No hay eventos con los filtros seleccionados.</Text></View>
  }
  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="mb-4 flex-row items-center justify-between gap-3"><Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>Timeline inmutable</Text><Text className="text-[12px] font-black" style={{ color: tokens.brand.teacher }}>{total} registros</Text></View>
      <View className="gap-3">{items.map((item) => <AuditRow key={item.id} item={item} />)}</View>
      <PaginationControls page={page} pageSize={pageSize} total={total} onPrevious={() => onPage(Math.max(0, page - 1))} onNext={() => onPage(page + 1)} />
    </View>
  )
}

function AuditRow({ item }: { item: TeacherAuditLog }) {
  const { tokens } = useAppTheme()
  const [expanded, setExpanded] = useState(false)
  const color = item.severity === 'critical' ? tokens.semantic.danger : item.severity === 'warning' ? tokens.semantic.warning : tokens.semantic.info
  const beforeKeys = Object.keys(item.before_state || {})
  const afterKeys = Object.keys(item.after_state || {})
  return (
    <View className="rounded-xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
      <View className="flex-row flex-wrap items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}22` }}><Ionicons name="shield-outline" size={20} color={color} /></View>
        <View className="min-w-[220px] flex-1">
          <View className="flex-row flex-wrap items-center gap-2"><Text className="font-black" style={{ color: tokens.text.primary }}>{humanizeAction(item.action)}</Text><Text className="rounded-full px-2 py-1 text-[9px] font-black" style={{ color, backgroundColor: `${color}20` }}>{item.severity.toUpperCase()}</Text></View>
          <Text className="mt-1 text-[12px]" style={{ color: tokens.text.secondary }}>{item.target_table || 'sistema'} · {item.target_id || 'sin identificador'}</Text>
          <Text className="mt-1 text-[10px]" style={{ color: tokens.text.muted }}>{new Date(item.created_at).toLocaleString('es-ES')} {item.request_id ? `· petición ${item.request_id.slice(0, 8)}` : ''}</Text>
        </View>
        {(beforeKeys.length || afterKeys.length) ? <AppButton label={expanded ? 'Ocultar cambios' : 'Ver antes/después'} icon={expanded ? 'chevron-up' : 'git-compare-outline'} variant="secondary" size="sm" onPress={() => setExpanded((value) => !value)} /> : null}
      </View>
      {expanded ? (
        <View className="mt-4 flex-row flex-wrap gap-3">
          <StateBox title="Antes" value={item.before_state} />
          <StateBox title="Después" value={item.after_state} />
        </View>
      ) : null}
    </View>
  )
}

function StateBox({ title, value }: { title: string; value: Record<string, unknown> }) {
  const { tokens } = useAppTheme()
  const entries = Object.entries(value || {})
  return (
    <View className="min-w-[220px] flex-1 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.background.primary }}>
      <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>{title}</Text>
      {entries.length ? entries.map(([key, item]) => <Text key={key} className="mb-1 text-[11px]" style={{ color: tokens.text.secondary }}>{key}: {formatValue(item)}</Text>) : <Text className="text-[11px]" style={{ color: tokens.text.muted }}>Sin cambios declarados</Text>}
    </View>
  )
}
function formatValue(value: unknown) { return typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—') }
function humanizeAction(value: string) { return value.replaceAll('.', ' · ').replaceAll('_', ' ') }
