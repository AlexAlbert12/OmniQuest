import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { AdminAccountExportRequest, IconName } from '../types/admin'

type ExportStatus = AdminAccountExportRequest['status']
type StatusTone = 'admin' | 'success' | 'danger' | 'muted'

const STATUS_META: Record<ExportStatus, { label: string; icon: IconName; tone: StatusTone }> = {
  queued: { label: 'En cola', icon: 'time-outline', tone: 'admin' },
  processing: { label: 'Procesando', icon: 'sync-outline', tone: 'admin' },
  ready: { label: 'Disponible', icon: 'checkmark-circle-outline', tone: 'success' },
  failed: { label: 'Fallida', icon: 'alert-circle-outline', tone: 'danger' },
  expired: { label: 'Caducada', icon: 'timer-outline', tone: 'muted' },
}

export default function AdminExportStatusBadge({ label, status }: { label?: string; status: ExportStatus }) {
  const { tokens } = useAppTheme()
  const meta = STATUS_META[status]
  const color = meta.tone === 'success' ? tokens.semantic.success : meta.tone === 'danger' ? tokens.semantic.danger : meta.tone === 'muted' ? tokens.text.muted : tokens.brand.admin
  const backgroundColor = meta.tone === 'success' ? tokens.semanticSurface.success : meta.tone === 'danger' ? tokens.semanticSurface.danger : meta.tone === 'muted' ? tokens.surface.interactive : withAlpha(tokens.brand.admin, '18')

  return (
    <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor }}>
      <Ionicons name={meta.icon} size={13} color={color} />
      <Text className="text-[11px] font-black" style={{ color }}>{label || meta.label}</Text>
    </View>
  )
}
