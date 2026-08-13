import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { AdminAccountExportRequest, IconName } from '../types/admin'
import { formatAdminDate } from '../utils/adminUtils'
import { EmptyState, Panel } from './AdminPrimitives'

const STATUS_META: Record<AdminAccountExportRequest['status'], { label: string; icon: IconName; tone: 'admin' | 'success' | 'danger' | 'muted' }> = {
  queued: { label: 'En cola', icon: 'time-outline', tone: 'admin' },
  processing: { label: 'Procesando', icon: 'sync-outline', tone: 'admin' },
  ready: { label: 'Disponible para el usuario', icon: 'checkmark-circle-outline', tone: 'success' },
  failed: { label: 'Fallida', icon: 'alert-circle-outline', tone: 'danger' },
  expired: { label: 'Caducada', icon: 'timer-outline', tone: 'muted' },
}

export default function AdminAccountExportRequestsPanel({ error, loading, requests }: { error?: string | null; loading?: boolean; requests: AdminAccountExportRequest[] }) {
  const { tokens } = useAppTheme()
  return (
    <Panel title="Solicitudes personales de exportación" icon="person-circle-outline" className="mt-5">
      <Text className="mb-1 text-[13px] leading-5 text-text-secondary">Solicitudes realizadas desde las cuentas de alumnos y profesores. El estado se actualiza automáticamente mientras se procesan.</Text>
      <View className="mb-4 flex-row items-start gap-2 rounded-xl border border-border-default bg-surface-interactive px-3 py-3">
        <Ionicons name="lock-closed-outline" size={16} color={tokens.brand.admin} />
        <Text className="min-w-0 flex-1 text-[12px] leading-5 text-text-muted">Por privacidad, el archivo generado solo puede descargarlo su propietario. El administrador supervisa el estado, pero no recibe la ruta ni el contenido del archivo.</Text>
      </View>
      {loading && requests.length === 0 ? <View className="items-center py-6"><ActivityIndicator color={tokens.brand.admin} /></View> : null}
      {error ? <View className="mb-3 rounded-xl border px-3 py-3" style={{ borderColor: withAlpha(tokens.semantic.danger, '70'), backgroundColor: tokens.semanticSurface.danger }}><Text className="text-[12px] font-bold text-semantic-danger">{error}</Text></View> : null}
      <View style={{ gap: 10 }}>
        {requests.map((request) => <AccountExportRequestCard key={request.id} request={request} />)}
        {!loading && !error && requests.length === 0 ? <EmptyState label="No hay solicitudes personales de exportación recientes." /> : null}
      </View>
    </Panel>
  )
}

function AccountExportRequestCard({ request }: { request: AdminAccountExportRequest }) {
  const { tokens } = useAppTheme()
  const status = STATUS_META[request.status]
  const toneColor = status.tone === 'success' ? tokens.semantic.success : status.tone === 'danger' ? tokens.semantic.danger : status.tone === 'muted' ? tokens.text.muted : tokens.brand.admin
  const toneBackground = status.tone === 'success' ? tokens.semanticSurface.success : status.tone === 'danger' ? tokens.semanticSurface.danger : status.tone === 'muted' ? tokens.surface.interactive : withAlpha(tokens.brand.admin, '18')
  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-[180px] flex-1">
          <Text className="font-black text-text-primary">{request.user_alias}</Text>
          <Text className="mt-1 text-[11px] text-text-muted">{getRoleLabel(request.user_role)} · Solicitada {formatAdminDate(request.requested_at)}</Text>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: toneBackground }}>
          <Ionicons name={status.icon} size={13} color={toneColor} />
          <Text className="text-[11px] font-black" style={{ color: toneColor }}>{status.label}</Text>
        </View>
      </View>
      <View className="mt-3 flex-row flex-wrap gap-x-5 gap-y-2">
        {request.started_at ? <Fact icon="play-outline" label={`Iniciada ${formatAdminDate(request.started_at)}`} /> : null}
        {request.completed_at ? <Fact icon="checkmark-outline" label={`Completada ${formatAdminDate(request.completed_at)}`} /> : null}
        {request.file_size_bytes != null ? <Fact icon="document-outline" label={formatBytes(request.file_size_bytes)} /> : null}
        {request.expires_at && request.status === 'ready' ? <Fact icon="timer-outline" label={`Disponible hasta ${formatAdminDate(request.expires_at)}`} /> : null}
      </View>
      {request.error_message ? <Text className="mt-3 text-[11px] leading-5 text-semantic-danger">{request.error_message}</Text> : null}
    </View>
  )
}

function Fact({ icon, label }: { icon: IconName; label: string }) {
  const { tokens } = useAppTheme()
  return <View className="flex-row items-center gap-1.5"><Ionicons name={icon} size={13} color={tokens.text.muted} /><Text className="text-[11px] text-text-muted">{label}</Text></View>
}

function getRoleLabel(role: string) { return role === 'teacher' ? 'Profesor' : role === 'guest' ? 'Invitado' : role === 'admin' ? 'Administrador' : 'Alumno' }
function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB` }
