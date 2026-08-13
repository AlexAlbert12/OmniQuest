import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { AdminAccountExportRequest, IconName } from '../types/admin'
import { formatAdminDate } from '../utils/adminUtils'
import AdminButton from './AdminButton'
import AdminExportStatusBadge from './AdminExportStatusBadge'
import { AdminPaginationControls, EmptyState, Panel } from './AdminPrimitives'

type Props = {
  error?: string | null
  loading?: boolean
  requests: AdminAccountExportRequest[]
  page: number
  pageSize: number
  total: number
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onRetry: () => void
}

export default function AdminAccountExportRequestsPanel({ error, hasNext, hasPrevious, loading, onNext, onPrevious, onRetry, page, pageSize, requests, total }: Props) {
  const { tokens } = useAppTheme()
  return (
    <Panel title="Solicitudes de exportación de usuarios" icon="person-circle-outline" className="mt-5">
      <Text className="mb-1 text-[13px] leading-5 text-text-secondary">Solicitudes realizadas desde las cuentas de alumnos y profesores. El estado se actualiza automáticamente mientras se procesan.</Text>
      <View className="mb-4 flex-row items-start gap-2 rounded-xl border border-border-default bg-surface-interactive px-3 py-3">
        <Ionicons name="lock-closed-outline" size={16} color={tokens.brand.admin} />
        <Text className="min-w-0 flex-1 text-[12px] leading-5 text-text-muted">El administrador solo puede consultar el estado. Por privacidad, únicamente puede descargarlo la persona que lo solicitó; el portal no recibe la ruta ni el contenido del archivo.</Text>
      </View>
      {loading && requests.length === 0 ? <View className="items-center py-6"><ActivityIndicator color={tokens.brand.admin} /></View> : null}
      {error ? <View className="mb-3 items-start rounded-xl border px-3 py-3" style={{ borderColor: withAlpha(tokens.semantic.danger, '70'), backgroundColor: tokens.semanticSurface.danger }}><Text className="text-[12px] font-bold text-semantic-danger">{error}</Text><AdminButton label="Reintentar" icon="refresh" size="sm" variant="secondary" style={{ marginTop: 10 }} onPress={onRetry} /></View> : null}
      <View style={{ gap: 10 }}>
        {requests.map((request) => <AccountExportRequestCard key={request.id} request={request} />)}
        {!loading && !error && requests.length === 0 ? <EmptyState label="No hay solicitudes personales de exportación recientes." /> : null}
      </View>
      {!error && total > 0 ? <AdminPaginationControls page={page} pageSize={pageSize} total={total} hasPrevious={hasPrevious} hasNext={hasNext} onPrevious={onPrevious} onNext={onNext} /> : null}
    </Panel>
  )
}

function AccountExportRequestCard({ request }: { request: AdminAccountExportRequest }) {
  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-[180px] flex-1">
          <Text className="font-black text-text-primary">{request.user_alias}</Text>
          <Text className="mt-1 text-[11px] text-text-muted">{getRoleLabel(request.user_role)} · Solicitada {formatAdminDate(request.requested_at)}</Text>
        </View>
        <AdminExportStatusBadge status={request.status} label={request.status === 'ready' ? 'Disponible para el usuario' : undefined} />
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
