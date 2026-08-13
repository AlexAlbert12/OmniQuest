import { useCallback, useEffect, useState } from 'react'
import { fetchAdminAccountExportRequests } from '../api/adminApi'
import type { AdminAccountExportRequest } from '../types/admin'
import { getErrorMessage } from '../../../lib/typeGuards'

type Options = { enabled?: boolean; pollPending?: boolean }

export function useAdminAccountExportRequests({ enabled = false, pollPending = false }: Options = {}) {
  const [requests, setRequests] = useState<AdminAccountExportRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (silent = false) => {
    if (!enabled) return
    if (!silent) setLoading(true)
    try {
      setRequests(await fetchAdminAccountExportRequests())
      setError(null)
    } catch (caught: unknown) {
      const message = getErrorMessage(caught, 'No se pudieron cargar las solicitudes personales de exportación.')
      setError(message)
      console.warn('[admin account exports]', message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setRequests([])
      setError(null)
      return
    }
    void refresh()
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled || !pollPending || !requests.some((request) => request.status === 'queued' || request.status === 'processing')) return
    const timer = setInterval(() => { void refresh(true) }, 15000)
    return () => clearInterval(timer)
  }, [enabled, pollPending, refresh, requests])

  return { requests, loading, error, refresh }
}
