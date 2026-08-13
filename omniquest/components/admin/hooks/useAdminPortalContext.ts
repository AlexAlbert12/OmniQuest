import { useCallback, useEffect, useState } from 'react'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage } from '../../../lib/typeGuards'
import { fetchAdminPortalContext } from '../api/adminApi'
import type { AdminPortalContext } from '../types/admin'

export type AdminPortalContextState = {
  portalContext: AdminPortalContext | null
  portalContextError: string | null
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
  refresh: () => Promise<void>
}

export function useAdminPortalContext(): AdminPortalContextState {
  const feedback = useAppFeedback()
  const [portalContext, setPortalContext] = useState<AdminPortalContext | null>(null)
  const [portalContextError, setPortalContextError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchContext = useCallback(async () => {
    setPortalContextError(null)
    try {
      setPortalContext(await fetchAdminPortalContext())
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'No se ha podido verificar el perfil de permisos.')
      setPortalContext(null)
      setPortalContextError(message)
      feedback.error('No se pudo verificar el acceso administrativo', message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [feedback])

  useEffect(() => { void fetchContext() }, [fetchContext])

  const onRefresh = useCallback(() => { setRefreshing(true); void fetchContext() }, [fetchContext])
  return { portalContext, portalContextError, loading, refreshing, onRefresh, refresh: fetchContext }
}
