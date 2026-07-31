import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { callPlatformRpc } from '../../lib/platformRpc'
import { supabase } from '../../lib/supabase'
import type {
  TeacherAuditConfiguration,
  TeacherAuditFilters,
  TeacherAuditPage,
} from '../../lib/teacherAudit'

const EMPTY_PAGE: TeacherAuditPage = {
  items: [],
  total: 0,
  stats: { last7Days: 0, critical: 0, warning: 0 },
  actions: [],
  targetTables: [],
}

const EMPTY_CONFIG: TeacherAuditConfiguration = {
  retentionDays: 730,
  savedFilters: [],
  alerts: [],
  exports: [],
}

export function useTeacherAudit(pageSize: number) {
  const [pageData, setPageData] = useState<TeacherAuditPage>(EMPTY_PAGE)
  const [configuration, setConfiguration] = useState<TeacherAuditConfiguration>(EMPTY_CONFIG)
  const [filters, setFilters] = useState<TeacherAuditFilters>({
    category: 'all',
    search: '',
    action: null,
    targetTable: null,
    severity: 'all',
    from: null,
    to: null,
  })
  const [page, setPage] = useState(0)
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [pageResult, configResult, sessionResult] = await Promise.all([
        callPlatformRpc<TeacherAuditPage>('get_teacher_audit_logs_page_v2', {
          p_category: filters.category,
          p_search: filters.search.trim() || undefined,
          p_action: filters.action ?? undefined,
          p_target_table: filters.targetTable ?? undefined,
          p_severity: filters.severity === 'all' ? undefined : filters.severity,
          p_from: filters.from ?? undefined,
          p_to: filters.to ?? undefined,
          p_limit: pageSize,
          p_offset: page * pageSize,
        }),
        callPlatformRpc<TeacherAuditConfiguration>('get_teacher_audit_configuration'),
        supabase.auth.getSession(),
      ])
      if (pageResult.error) throw pageResult.error
      if (configResult.error) throw configResult.error
      setPageData(pageResult.data || EMPTY_PAGE)
      setConfiguration(configResult.data || EMPTY_CONFIG)

      const teacherId = sessionResult.data.session?.user.id
      if (teacherId) {
        const countResult = await supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId).eq('is_archived', false)
        if (!countResult.error) setSubjectsCount(countResult.count || 0)
      }
    } catch (nextError: any) {
      setError(nextError?.message || 'No se pudo cargar la auditoría.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filters.action, filters.category, filters.from, filters.search, filters.severity, filters.targetTable, filters.to, page, pageSize])

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => void load(), filters.search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [filters.search, load]))

  const updateFilters = useCallback((patch: Partial<TeacherAuditFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(0)
  }, [])

  const run = useCallback(async (task: () => Promise<void>) => {
    try {
      setBusy(true)
      setError(null)
      await task()
      await load()
    } catch (nextError: any) {
      setError(nextError?.message || 'No se pudo completar la acción.')
      throw nextError
    } finally {
      setBusy(false)
    }
  }, [load])

  const saveFilter = useCallback((name: string) => run(async () => {
    const result = await callPlatformRpc('save_teacher_audit_filter', {
      p_id: undefined,
      p_name: name,
      p_filters: filters,
    })
    if (result.error) throw result.error
  }), [filters, run])

  const requestExport = useCallback(() => run(async () => {
    const result = await callPlatformRpc('request_teacher_audit_export', { p_filters: filters })
    if (result.error) throw result.error
  }), [filters, run])

  const acknowledgeAlert = useCallback((alertId: number) => run(async () => {
    const result = await callPlatformRpc('acknowledge_teacher_audit_alert', { p_alert_id: alertId })
    if (result.error) throw result.error
  }), [run])

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
    subjectsCount,
    loading,
    refreshing,
    busy,
    error,
    setPage,
    updateFilters,
    refresh: () => { setRefreshing(true); void load() },
    saveFilter,
    requestExport,
    acknowledgeAlert,
    downloadExport,
  }
}
