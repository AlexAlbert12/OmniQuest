import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage, isRecord } from '../../../lib/typeGuards'
import { ADMIN_PAGE_SIZE } from '../types/admin'

type AdminPageRpcName =
  | 'get_admin_profiles_page'
  | 'get_admin_subjects_page'
  | 'get_admin_classrooms_page'
  | 'get_admin_support_tickets_page_secured'
  | 'get_admin_audit_logs_page_secured'
  | 'get_admin_role_assignments_page'
  | 'get_admin_profile_activity_page'

type DynamicRpcResponse = {
  data: unknown
  error: { message: string } | null
}
type DynamicRpcClient = {
  rpc: (functionName: string, args: Record<string, unknown>) => PromiseLike<DynamicRpcResponse>
}

export function useAdminRpcPage<T extends { total_count?: number | null }>(
  functionName: AdminPageRpcName,
  args: Record<string, unknown>,
  refreshVersion: number,
  pageSize = ADMIN_PAGE_SIZE,
  enabled = true,
) {
  const feedback = useAppFeedback()
  const [rows, setRows] = useState<T[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const argsKey = JSON.stringify(args)
  const stableArgs = useMemo(() => {
    const parsed: unknown = JSON.parse(argsKey)
    return isRecord(parsed) ? parsed : {}
  }, [argsKey])

  useEffect(() => setPage(0), [argsKey])

  const fetchPage = useCallback(async () => {
    if (!enabled) { setRows([]); setTotal(0); setLoading(false); setRefreshing(false); return }
    setLoading(true)
    try {
      const dynamicClient = supabase as unknown as DynamicRpcClient
      const response = await dynamicClient.rpc(functionName, { ...stableArgs, p_limit: pageSize, p_offset: page * pageSize })
      if (response.error) throw response.error
      const nextRows = Array.isArray(response.data) ? response.data as T[] : []
      setRows(nextRows)
      setTotal(Number(nextRows[0]?.total_count || 0))
    } catch (error: unknown) {
      setRows([])
      setTotal(0)
      feedback.error('No se pudo cargar el listado', getErrorMessage(error, 'Revisa la conexión y las funciones RPC de administración.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [enabled, feedback, functionName, page, pageSize, stableArgs])

  useEffect(() => { void fetchPage() }, [fetchPage, refreshVersion])

  const refresh = useCallback(() => { setRefreshing(true); void fetchPage() }, [fetchPage])
  const nextPage = useCallback(() => setPage((value) => value + 1), [])
  const previousPage = useCallback(() => setPage((value) => Math.max(0, value - 1)), [])

  return {
    rows, page, pageSize, total, loading, refreshing,
    hasPrevious: page > 0,
    hasNext: (page + 1) * pageSize < total,
    nextPage,
    previousPage,
    refresh,
  }
}
