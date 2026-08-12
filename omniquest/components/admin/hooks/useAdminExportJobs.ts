import { useCallback, useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage } from '../../../lib/typeGuards'
import { fetchAdminExportJobs, getAdminExportDownloadUrl, requestAdminExportJob, type AdminExportFilters } from '../api/adminApi'
import type { AdminExportJob } from '../types/admin'

type AdminExportJobOptions = { loadJobs?: boolean; pollPending?: boolean }

export function useAdminExportJobs({ loadJobs = false, pollPending = false }: AdminExportJobOptions = {}) {
  const feedback = useAppFeedback()
  const [jobs, setJobs] = useState<AdminExportJob[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setJobs(await fetchAdminExportJobs())
    } catch (error: unknown) {
      console.warn('[admin exports]', getErrorMessage(error, 'No se pudo actualizar la cola de exportaciones.'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { if (loadJobs) void refresh() }, [loadJobs, refresh])

  useEffect(() => {
    if (!loadJobs || !pollPending || !jobs.some((job) => job.status === 'queued' || job.status === 'processing')) return
    const timer = setInterval(() => { void refresh(true) }, 15000)
    return () => clearInterval(timer)
  }, [jobs, loadJobs, pollPending, refresh])

  const request = useCallback(async (type: AdminExportJob['export_type'], filters: AdminExportFilters) => {
    setLoading(true)
    try {
      await requestAdminExportJob(type, filters)
      feedback.success('Exportación en cola', 'El archivo se generará en segundo plano. Podrás descargarlo desde Más → Exportaciones.')
      if (loadJobs) await refresh(true)
    } catch (error: unknown) {
      feedback.error('No se pudo crear la exportación', getErrorMessage(error, 'Inténtalo de nuevo.'))
    } finally {
      setLoading(false)
    }
  }, [feedback, loadJobs, refresh])

  const download = useCallback(async (jobId: string) => {
    try {
      await Linking.openURL(await getAdminExportDownloadUrl(jobId))
    } catch (error: unknown) {
      feedback.error('Descarga no disponible', getErrorMessage(error, 'La exportación puede seguir procesándose.'))
    }
  }, [feedback])

  return { jobs, loading, refresh, request, download }
}
