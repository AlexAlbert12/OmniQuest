import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { ADMIN_PAGE_SIZE } from '../types/admin'
import { showAlert } from '../utils/adminUtils'

export function useAdminRpcPage<T extends { total_count?: number | null }>(
  functionName: string,
  args: Record<string, unknown>,
  refreshVersion: number,
  pageSize = ADMIN_PAGE_SIZE,
) {
  const [rows, setRows] = useState<T[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const argsKey = JSON.stringify(args)
  const stableArgs = useMemo(() => JSON.parse(argsKey) as Record<string, unknown>, [argsKey])

  useEffect(() => setPage(0), [argsKey])

  const fetchPage = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase.rpc(functionName as any, { ...stableArgs, p_limit: pageSize, p_offset: page * pageSize }) as any)
      if (error) throw error
      const nextRows = (data || []) as T[]
      setRows(nextRows)
      setTotal(Number(nextRows[0]?.total_count || 0))
    } catch (error: any) {
      setRows([])
      setTotal(0)
      showAlert('No se pudo cargar el listado', error.message || 'Revisa la conexión y las funciones RPC de administración.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [functionName, page, pageSize, stableArgs])

  useEffect(() => { void fetchPage() }, [fetchPage, refreshVersion])

  const refresh = () => { setRefreshing(true); void fetchPage() }
  return {
    rows, page, pageSize, total, loading, refreshing,
    hasPrevious: page > 0,
    hasNext: (page + 1) * pageSize < total,
    nextPage: () => setPage((value) => value + 1),
    previousPage: () => setPage((value) => Math.max(0, value - 1)),
    refresh,
  }
}
