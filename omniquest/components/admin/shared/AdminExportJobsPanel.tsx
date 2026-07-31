import React from 'react'
import { Text, View } from 'react-native'
import { AppButton } from '../../ui'
import type { AdminExportJob } from '../types/admin'
import { formatAdminDate } from '../utils/adminUtils'
import { EmptyState, Panel, StatusPill } from './AdminPrimitives'

export default function AdminExportJobsPanel({ jobs, onDownload, onRefresh }: { jobs: AdminExportJob[]; onDownload: (id: string) => void; onRefresh: () => void }) {
  return (
    <Panel title="Exportaciones asíncronas" icon="cloud-download-outline" className="mt-5">
      <View className="mb-3 items-start"><AppButton label="Actualizar trabajos" icon="refresh-outline" size="sm" variant="secondary" onPress={onRefresh} /></View>
      <View style={{ gap: 10 }}>
        {jobs.map((job) => (
          <View key={job.id} className="rounded-xl border border-border-default bg-surface-default p-4">
            <View className="flex-row flex-wrap items-center justify-between gap-3"><View><Text className="font-black text-text-primary">{job.export_type}</Text><Text className="mt-1 text-[11px] text-text-muted">Solicitada {formatAdminDate(job.created_at)}</Text></View><StatusPill active={job.status === 'ready'} label={job.status} /></View>
            <Text className="mt-2 text-[12px] text-text-secondary">{job.processed_rows}{job.row_count ? ` de ${job.row_count}` : ''} filas procesadas</Text>
            {job.error_message ? <Text className="mt-2 text-[11px] text-semantic-danger">{job.error_message}</Text> : null}
            {job.status === 'ready' ? <View className="mt-3 items-start"><AppButton label="Descargar" icon="download-outline" size="sm" onPress={() => onDownload(job.id)} /></View> : null}
          </View>
        ))}
        {jobs.length === 0 ? <EmptyState label="No hay exportaciones recientes." /> : null}
      </View>
    </Panel>
  )
}
