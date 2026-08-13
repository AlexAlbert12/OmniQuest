import { useCallback, useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage } from '../../../lib/typeGuards'
import { fetchAdminExportJobs, getAdminExportDownloadUrl, requestAdminExportJob, type AdminExportFilters } from '../api/adminApi'
import type { AdminExportJob } from '../types/admin'

type AdminExportJobOptions = { loadJobs?: boolean; pageSize?: number; pollPending?: boolean }

export function useAdminExportJobs({ loadJobs = false, pageSize = 10, pollPending = false }: AdminExportJobOptions = {}) {
  const feedback = useAppFeedback()
  const [jobs, setJobs] = useState<AdminExportJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const refresh = useCallback(async (silent = false) => {
    if (!loadJobs) return
    if (!silent) setLoading(true)
    try {
      const result = await fetchAdminExportJobs(pageSize, page * pageSize)
      setJobs(result.rows)
      setTotal(result.total)
      setError(null)
    } catch (caught: unknown) {
      const message = getErrorMessage(caught, 'No se pudieron cargar las exportaciones administrativas.')
      setError(message)
      console.warn('[admin exports]', message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [loadJobs, page, pageSize])

  useEffect(() => {
    if (!loadJobs) {
      setJobs([])
      setTotal(0)
      setError(null)
      setPage(0)
      return
    }
    void refresh()
  }, [loadJobs, refresh])

  useEffect(() => { setPage(0) }, [pageSize])

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

  return {
    jobs,
    loading,
    error,
    page,
    pageSize,
    total,
    hasPrevious: page > 0,
    hasNext: (page + 1) * pageSize < total,
    previousPage: () => setPage((current) => Math.max(0, current - 1)),
    nextPage: () => setPage((current) => current + 1),
    refresh,
    request,
    download,
  }
}
