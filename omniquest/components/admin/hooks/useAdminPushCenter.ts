import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage } from '../../../lib/typeGuards'
import { cancelAdminPushDelivery, fetchAdminPushDeliveryDetail, fetchAdminPushDeliveryMetrics, fetchAdminPushDeliveryPage, processAdminPushDeliveryNow, retryAdminPushDelivery, sendAdminPushTest } from '../api/adminApi'
import type { AdminPushDeliveryDetail, AdminPushDeliveryMetrics, AdminPushDeliveryRow } from '../types/admin'

const PAGE_SIZE = 25

export type AdminPushFilters = { search: string; status: string | null; role: string | null; type: string | null; from: string | null; to: string | null }
const EMPTY_FILTERS: AdminPushFilters = { search: '', status: null, role: null, type: null, from: null, to: null }

export function useAdminPushCenter(adminUserId: string | null, enabled = true) {
  const feedback = useAppFeedback()
  const [filters, setFilters] = useState<AdminPushFilters>(EMPTY_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<AdminPushDeliveryRow[]>([])
  const [metrics, setMetrics] = useState<AdminPushDeliveryMetrics | null>(null)
  const [detail, setDetail] = useState<AdminPushDeliveryDetail | null>(null)
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(filters.search.trim()), 300)
    return () => clearTimeout(timeout)
  }, [filters.search])

  useEffect(() => { setPage(0) }, [debouncedSearch, filters.status, filters.role, filters.type, filters.from, filters.to])

  const loadPage = useCallback(async (silent = false) => {
    if (!enabled) { if (!silent) setLoading(false); return }
    if (!silent) setLoading(true)
    try {
      const [nextRows, nextMetrics] = await Promise.all([
        fetchAdminPushDeliveryPage({ search: debouncedSearch, status: filters.status, role: filters.role, type: filters.type, from: filters.from, to: filters.to, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
        fetchAdminPushDeliveryMetrics(30),
      ])
      setRows(nextRows)
      setMetrics(nextMetrics)
    } catch (error: unknown) {
      if (!silent) feedback.error('No se pudo cargar el centro push', getErrorMessage(error, 'Revisa la conexión e inténtalo de nuevo.'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [debouncedSearch, enabled, feedback, filters.from, filters.role, filters.status, filters.to, filters.type, page])

  useEffect(() => { void loadPage(false) }, [loadPage])

  const hasActiveWork = useMemo(() => Boolean(enabled && metrics && metrics.queued + metrics.processing + metrics.waiting_receipt > 0), [enabled, metrics])
  useEffect(() => {
    if (!hasActiveWork) return
    const interval = setInterval(() => void loadPage(true), 15000)
    return () => clearInterval(interval)
  }, [hasActiveWork, loadPage])

  const loadDetail = useCallback(async (queueId: number, silent = false) => {
    if (!silent) setDetailLoading(true)
    try {
      const nextDetail = await fetchAdminPushDeliveryDetail(queueId)
      setDetail(nextDetail)
    } catch (error: unknown) {
      if (!silent) feedback.error('No se pudo abrir el envío push', getErrorMessage(error, 'No se pudo consultar el detalle.'))
    } finally {
      if (!silent) setDetailLoading(false)
    }
  }, [feedback])

  const openDetail = useCallback((queueId: number) => { setSelectedQueueId(queueId); setDetail(null); void loadDetail(queueId) }, [loadDetail])
  const closeDetail = useCallback(() => { setSelectedQueueId(null); setDetail(null) }, [])

  const runQueueAction = useCallback(async (action: 'retry' | 'cancel' | 'process') => {
    if (!selectedQueueId || acting) return
    setActing(true)
    try {
      if (action === 'retry') await retryAdminPushDelivery(selectedQueueId)
      else if (action === 'cancel') await cancelAdminPushDelivery(selectedQueueId)
      else await processAdminPushDeliveryNow(selectedQueueId)
      feedback.success(action === 'retry' ? 'Reintento solicitado' : action === 'cancel' ? 'Envío cancelado' : 'Procesamiento solicitado', action === 'cancel' ? 'La notificación seguirá existiendo en OmniQuest, pero este envío push no se procesará.' : 'El envío volverá a pasar por las preferencias y dispositivos válidos del destinatario.')
      await Promise.all([loadPage(true), loadDetail(selectedQueueId, true)])
    } catch (error: unknown) {
      feedback.error('No se pudo completar la acción', getErrorMessage(error, 'Inténtalo de nuevo.'))
    } finally {
      setActing(false)
    }
  }, [acting, feedback, loadDetail, loadPage, selectedQueueId])

  const sendTest = useCallback(async () => {
    if (!adminUserId || acting) return
    setActing(true)
    try {
      await sendAdminPushTest(adminUserId)
      feedback.success('Prueba en cola', 'La prueba respeta tus preferencias push y solo se entregará a dispositivos activos de tu propia cuenta.')
      await loadPage(true)
    } catch (error: unknown) {
      feedback.error('No se pudo enviar la prueba', getErrorMessage(error, 'Comprueba que tu cuenta tenga un dispositivo push registrado.'))
    } finally {
      setActing(false)
    }
  }, [acting, adminUserId, feedback, loadPage])

  const total = rows[0]?.total_count || 0
  return {
    acting, closeDetail, detail, detailLoading, filters, loading, metrics, openDetail, page, pageSize: PAGE_SIZE, rows, selectedQueueId, sendTest, setFilters: (patch: Partial<AdminPushFilters>) => setFilters((current) => ({ ...current, ...patch })), setPage, total,
    retry: () => void runQueueAction('retry'), cancel: () => void runQueueAction('cancel'), processNow: () => void runQueueAction('process'), refresh: () => void loadPage(true),
  }
}
