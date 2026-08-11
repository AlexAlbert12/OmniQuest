import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { callPlatformRpc } from '../../lib/platformRpc'
import { supabase } from '../../lib/supabase'
import { useI18n } from '../../lib/i18n'
import type { TeacherAuditConfiguration, TeacherAuditExport, TeacherAuditFilters, TeacherAuditPage } from '../../lib/teacherAudit'

const EMPTY_PAGE: TeacherAuditPage = { items: [], total: 0, stats: { last7Days: 0, critical: 0, warning: 0 }, actions: [] }
const EMPTY_CONFIG: TeacherAuditConfiguration = { retentionDays: 730, subjectsCount: 0, alerts: [], exports: [] }
const EXPORT_POLL_MS = 45_000

export function useTeacherAudit(pageSize: number) {
  const { locale } = useI18n()
  const [pageData, setPageData] = useState<TeacherAuditPage>(EMPTY_PAGE)
  const [configuration, setConfiguration] = useState<TeacherAuditConfiguration>(EMPTY_CONFIG)
  const [filters, setFilters] = useState<TeacherAuditFilters>({ category: 'all', search: '', action: null, severity: 'all', from: null, to: null })
  const [page, setPage] = useState(0)
  const [pageReady, setPageReady] = useState(false)
  const [contextReady, setContextReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAuditPage = useCallback(async () => {
    try {
      const result = await callPlatformRpc<TeacherAuditPage>('get_teacher_audit_logs_page_v2', {
        p_category: filters.category,
        p_search: filters.search.trim() || undefined,
        p_action: filters.action ?? undefined,
        p_severity: filters.severity === 'all' ? undefined : filters.severity,
        p_from: filters.from ?? undefined,
        p_to: filters.to ?? undefined,
        p_limit: pageSize,
        p_offset: page * pageSize,
      })
      if (result.error) throw result.error
      setPageData(result.data || EMPTY_PAGE)
    } catch (nextError: any) {
      setError(nextError?.message || 'No se pudo cargar el historial de auditoría.')
    } finally {
      setPageReady(true)
    }
  }, [filters.action, filters.category, filters.from, filters.search, filters.severity, filters.to, page, pageSize])

  const loadAuditContext = useCallback(async () => {
    try {
      const result = await callPlatformRpc<TeacherAuditConfiguration>('get_teacher_audit_configuration')
      if (result.error) throw result.error
      setConfiguration(result.data || EMPTY_CONFIG)
    } catch (nextError: any) {
      setError(nextError?.message || 'No se pudo cargar la configuración de auditoría.')
    } finally {
      setContextReady(true)
    }
  }, [])

  const loadExports = useCallback(async () => {
    const { data, error: exportsError } = await supabase
      .from('teacher_audit_export_requests')
      .select('id, teacher_id, status, filters, object_path, row_count, requested_at, started_at, completed_at, expires_at, error_message, updated_at')
      .order('requested_at', { ascending: false })
      .limit(10)
    if (exportsError) throw exportsError
    setConfiguration((current) => ({ ...current, exports: (data || []) as unknown as TeacherAuditExport[] }))
  }, [])

  useFocusEffect(useCallback(() => {
    setError(null)
    void loadAuditContext()
  }, [loadAuditContext]))

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => { setError(null); void loadAuditPage() }, filters.search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [filters.search, loadAuditPage]))

  const hasPendingExport = useMemo(() => configuration.exports.some((item) => item.status === 'queued' || item.status === 'processing'), [configuration.exports])
  useEffect(() => {
    if (!hasPendingExport) return
    const timer = setInterval(() => { void loadExports().catch(() => undefined) }, EXPORT_POLL_MS)
    return () => clearInterval(timer)
  }, [hasPendingExport, loadExports])

  const updateFilters = useCallback((patch: Partial<TeacherAuditFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(0)
  }, [])

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      await Promise.all([loadAuditPage(), loadAuditContext()])
    } finally {
      setRefreshing(false)
    }
  }, [loadAuditContext, loadAuditPage])

  const requestExport = useCallback(async () => {
    try {
      setBusy(true)
      setError(null)
      const result = await callPlatformRpc('request_teacher_audit_export', { p_filters: { ...filters, locale } })
      if (result.error) throw result.error
      await loadExports()
    } catch (nextError: any) {
      setError(nextError?.message || 'No se pudo solicitar la exportación.')
    } finally {
      setBusy(false)
    }
  }, [filters, loadExports, locale])

  const acknowledgeAlert = useCallback(async (alertId: number) => {
    try {
      setBusy(true)
      setError(null)
      const result = await callPlatformRpc('acknowledge_teacher_audit_alert', { p_alert_id: alertId })
      if (result.error) throw result.error
      await loadAuditContext()
    } catch (nextError: any) {
      setError(nextError?.message || 'No se pudo confirmar la alerta.')
    } finally {
      setBusy(false)
    }
  }, [loadAuditContext])

  const downloadExport = useCallback(async (objectPath: string) => {
    const { data, error: signedError } = await supabase.storage.from('teacher-audit-exports').createSignedUrl(objectPath, 300, { download: true })
    if (signedError) throw signedError
    if (typeof window !== 'undefined') window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    return data.signedUrl
  }, [])

  return {
    pageData,
    configuration,
    filters,
    page,
    subjectsCount: configuration.subjectsCount,
    loading: !pageReady || !contextReady,
    refreshing,
    busy,
    error,
    setPage,
    updateFilters,
    refresh: () => void refresh(),
    requestExport,
    acknowledgeAlert,
    downloadExport,
  }
}
