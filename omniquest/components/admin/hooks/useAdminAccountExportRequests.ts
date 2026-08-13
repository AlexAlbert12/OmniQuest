import { useCallback, useEffect, useState } from 'react'
import { fetchAdminAccountExportRequests } from '../api/adminApi'
import type { AdminAccountExportRequest } from '../types/admin'
import { getErrorMessage } from '../../../lib/typeGuards'

type Options = { enabled?: boolean; pageSize?: number; pollPending?: boolean }

export function useAdminAccountExportRequests({ enabled = false, pageSize = 25, pollPending = false }: Options = {}) {
  const [requests, setRequests] = useState<AdminAccountExportRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const refresh = useCallback(async (silent = false) => {
    if (!enabled) return
    if (!silent) setLoading(true)
    try {
      const result = await fetchAdminAccountExportRequests(pageSize, page * pageSize)
      setRequests(result.rows)
      setTotal(result.total)
      setError(null)
    } catch (caught: unknown) {
      const message = getErrorMessage(caught, 'No se pudieron cargar las solicitudes personales de exportación.')
      setError(message)
      console.warn('[admin account exports]', message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [enabled, page, pageSize])

  useEffect(() => {
    if (!enabled) {
      setRequests([])
      setTotal(0)
      setError(null)
      setPage(0)
      return
    }
    void refresh()
  }, [enabled, refresh])

  useEffect(() => { setPage(0) }, [pageSize])

  useEffect(() => {
    if (!enabled || !pollPending || !requests.some((request) => request.status === 'queued' || request.status === 'processing')) return
    const timer = setInterval(() => { void refresh(true) }, 15000)
    return () => clearInterval(timer)
  }, [enabled, pollPending, refresh, requests])

  return {
    requests,
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
  }
}
