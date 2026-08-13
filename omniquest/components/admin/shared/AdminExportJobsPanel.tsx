import React from 'react'
import AdminButton from './AdminButton'
import { ActivityIndicator, Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import type { AdminExportJob } from '../types/admin'
import { formatAdminDate } from '../utils/adminUtils'
import AdminExportStatusBadge from './AdminExportStatusBadge'
import { AdminPaginationControls, EmptyState, Panel } from './AdminPrimitives'

const TYPE_LABELS: Record<AdminExportJob['export_type'], string> = { profiles: 'Usuarios', subjects: 'Cursos', classrooms: 'Clases', audit: 'Auditoría', support: 'Soporte' }

type Props = {
  error?: string | null
  jobs: AdminExportJob[]
  loading?: boolean
  page: number
  pageSize: number
  total: number
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onRetry: () => void
  onDownload: (id: string) => void
}

export default function AdminExportJobsPanel({ error, hasNext, hasPrevious, jobs, loading = false, onDownload, onNext, onPrevious, onRetry, page, pageSize, total }: Props) {
  const { tokens } = useAppTheme()
  return (
    <Panel title="Mis exportaciones en segundo plano" icon="cloud-download-outline" className="mt-5">
      <Text className="mb-4 text-[13px] leading-5 text-text-secondary">Los trabajos en cola o procesándose se actualizan automáticamente. No necesitas refrescar la pantalla.</Text>
      {loading && jobs.length === 0 ? <View className="items-center py-6"><ActivityIndicator color={tokens.brand.admin} /></View> : null}
      {error ? <View className="mb-3 items-start rounded-xl border border-semantic-danger bg-semantic-surface-danger p-3"><Text className="text-[12px] font-bold text-semantic-danger">No se pudieron cargar las exportaciones. {error}</Text><AdminButton label="Reintentar" icon="refresh" size="sm" variant="secondary" style={{ marginTop: 10 }} onPress={onRetry} /></View> : null}
      <View style={{ gap: 10 }}>
        {jobs.map((job) => (
          <View key={job.id} className="rounded-xl border border-border-default bg-surface-default p-4">
            <View className="flex-row flex-wrap items-center justify-between gap-3"><View><Text className="font-black text-text-primary">{TYPE_LABELS[job.export_type]}</Text><Text className="mt-1 text-[11px] text-text-muted">Solicitada {formatAdminDate(job.created_at)}</Text></View><AdminExportStatusBadge status={job.status} /></View>
            <Text className="mt-2 text-[12px] text-text-secondary">{job.processed_rows}{job.row_count ? ` de ${job.row_count}` : ''} filas procesadas</Text>
            {job.error_message ? <Text className="mt-2 text-[11px] text-semantic-danger">{job.error_message}</Text> : null}
            {job.status === 'ready' ? <View className="mt-3 items-start"><AdminButton label="Descargar" icon="download-outline" size="sm" onPress={() => onDownload(job.id)} /></View> : null}
          </View>
        ))}
        {!loading && !error && jobs.length === 0 ? <EmptyState label="No hay exportaciones administrativas recientes." /> : null}
      </View>
      {!error && total > 0 ? <AdminPaginationControls page={page} pageSize={pageSize} total={total} hasPrevious={hasPrevious} hasNext={hasNext} onPrevious={onPrevious} onNext={onNext} /> : null}
    </Panel>
  )
}
