import { useCallback, useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage } from '../../../lib/typeGuards'
import { fetchAdminExportJobs, getAdminExportDownloadUrl, requestAdminExportJob } from '../api/adminApi'
import type { AdminExportJob } from '../types/admin'

export function useAdminExportJobs() {
  const feedback = useAppFeedback()
  const [jobs, setJobs] = useState<AdminExportJob[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setJobs(await fetchAdminExportJobs())
    } catch (error: unknown) {
      console.warn('[admin exports]', getErrorMessage(error, 'No se pudo actualizar la cola de exportaciones.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const request = useCallback(async (type: AdminExportJob['export_type'], filters: Record<string, unknown>) => {
    setLoading(true)
    try {
      await requestAdminExportJob(type, filters)
      feedback.success('Exportación en cola', 'El archivo se generará en segundo plano. Podrás descargarlo desde el panel de exportaciones.')
      await refresh()
    } catch (error: unknown) {
      feedback.error('No se pudo crear la exportación', getErrorMessage(error, 'Inténtalo de nuevo.'))
    } finally {
      setLoading(false)
    }
  }, [feedback, refresh])

  const download = useCallback(async (jobId: string) => {
    try {
      await Linking.openURL(await getAdminExportDownloadUrl(jobId))
    } catch (error: unknown) {
      feedback.error('Descarga no disponible', getErrorMessage(error, 'La exportación puede seguir procesándose.'))
    }
  }, [feedback])

  return { jobs, loading, refresh, request, download }
}
