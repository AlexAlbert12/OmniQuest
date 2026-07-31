import { useCallback, useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { fetchAdminExportJobs, getAdminExportDownloadUrl, requestAdminExportJob } from '../api/adminApi'
import type { AdminExportJob } from '../types/admin'
import { showAlert } from '../utils/adminUtils'

export function useAdminExportJobs() {
  const [jobs, setJobs] = useState<AdminExportJob[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setJobs(await fetchAdminExportJobs()) }
    catch (error: any) { console.warn('[admin exports]', error.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const request = useCallback(async (type: AdminExportJob['export_type'], filters: Record<string, unknown>) => {
    setLoading(true)
    try {
      await requestAdminExportJob(type, filters)
      showAlert('Exportación en cola', 'El archivo se generará en segundo plano. Podrás descargarlo desde el panel de exportaciones.')
      await refresh()
    } catch (error: any) {
      showAlert('No se pudo crear la exportación', error.message)
    } finally { setLoading(false) }
  }, [refresh])

  const download = useCallback(async (jobId: string) => {
    try { await Linking.openURL(await getAdminExportDownloadUrl(jobId)) }
    catch (error: any) { showAlert('Descarga no disponible', error.message) }
  }, [])

  return { jobs, loading, refresh, request, download }
}
