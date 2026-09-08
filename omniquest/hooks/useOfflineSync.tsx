import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clearOfflineCacheForUser, subscribeOfflineCacheActivity } from '../lib/offlineCache'
import { getNetworkAvailability, subscribeToNetworkAvailability } from '../lib/gameOffline'
import {
  clearOfflineMutationsForUser,
  discardOfflineMutationFailures,
  flushOfflineMutations,
  getOfflineMutationSummary,
  retryOfflineMutations,
  subscribeOfflineMutations,
  type OfflineMutationSummary,
} from '../lib/offlineMutations'
import { supabase } from '../lib/supabase'

type OfflineSyncContextValue = OfflineMutationSummary & {
  online: boolean
  showingCachedData: boolean
  cachedAt: number | null
  lastSyncedAt: number | null
  retryNow: () => Promise<void>
  discardFailures: () => Promise<void>
}

const EMPTY_SUMMARY: OfflineMutationSummary = { pending: 0, failed: 0, conflicts: 0, syncing: false }
const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null)

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [showingCachedData, setShowingCachedData] = useState(false)
  const [cachedAt, setCachedAt] = useState<number | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const userIdRef = useRef<string | null>(null)

  const refreshSummary = useCallback(async (nextUserId?: string | null) => {
    const resolvedUserId = nextUserId === undefined ? userIdRef.current : nextUserId
    const nextSummary = await getOfflineMutationSummary(resolvedUserId)
    setSummary((current) => {
      if (current.pending > 0 && nextSummary.pending === 0) setLastSyncedAt(Date.now())
      return nextSummary
    })
  }, [])

  const syncNow = useCallback(async (nextUserId?: string | null) => {
    const resolvedUserId = nextUserId === undefined ? userIdRef.current : nextUserId
    if (!resolvedUserId || !await getNetworkAvailability()) return
    await flushOfflineMutations(resolvedUserId)
    setLastSyncedAt(Date.now())
    await refreshSummary(resolvedUserId)
  }, [refreshSummary])

  useEffect(() => {
    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const guestUserId = data.session?.user.is_anonymous ? data.session.user.id : null
      const nextUserId = guestUserId ? null : data.session?.user.id || null
      userIdRef.current = nextUserId
      setUserId(nextUserId)
      void refreshSummary(nextUserId)
      if (guestUserId) {
        void Promise.all([
          clearOfflineCacheForUser(guestUserId),
          clearOfflineMutationsForUser(guestUserId),
        ])
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const previousUserId = userIdRef.current
      const guestUserId = session?.user.is_anonymous ? session.user.id : null
      const nextUserId = guestUserId ? null : session?.user.id || null
      userIdRef.current = nextUserId
      setUserId(nextUserId)
      void refreshSummary(nextUserId)
      if (guestUserId) {
        void Promise.all([
          clearOfflineCacheForUser(guestUserId),
          clearOfflineMutationsForUser(guestUserId),
        ])
      }
      if (event === 'SIGNED_OUT' && previousUserId) {
        void Promise.all([
          clearOfflineCacheForUser(previousUserId),
          clearOfflineMutationsForUser(previousUserId),
        ])
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [refreshSummary])

  useEffect(() => {
    let mounted = true
    void getNetworkAvailability().then((available) => {
      if (!mounted) return
      setOnline(available)
      if (available) void syncNow()
    })
    const unsubscribe = subscribeToNetworkAvailability((available) => {
      setOnline(available)
      if (available) void syncNow()
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [syncNow])

  useEffect(() => subscribeOfflineMutations((event) => {
    if (event.type === 'synced' && event.userId === userIdRef.current) setLastSyncedAt(Date.now())
    void refreshSummary()
  }), [refreshSummary])

  useEffect(() => subscribeOfflineCacheActivity((activity) => {
    if (activity.userId !== userIdRef.current) return
    setShowingCachedData(activity.source === 'cache')
    setCachedAt(activity.source === 'cache' ? activity.savedAt : null)
  }), [])

  useEffect(() => {
    if (!online || !userId || summary.pending === 0) return
    const timer = setInterval(() => void syncNow(userId), 30_000)
    return () => clearInterval(timer)
  }, [online, summary.pending, syncNow, userId])

  const retryNow = useCallback(async () => {
    if (!userId) return
    await retryOfflineMutations(userId)
    setLastSyncedAt(Date.now())
    await refreshSummary(userId)
  }, [refreshSummary, userId])

  const discardFailures = useCallback(async () => {
    if (!userId) return
    await discardOfflineMutationFailures(userId)
    await refreshSummary(userId)
  }, [refreshSummary, userId])

  const value = useMemo<OfflineSyncContextValue>(() => ({
    ...summary,
    online,
    showingCachedData,
    cachedAt,
    lastSyncedAt,
    retryNow,
    discardFailures,
  }), [cachedAt, discardFailures, lastSyncedAt, online, retryNow, showingCachedData, summary])

  return createElement(OfflineSyncContext.Provider, { value }, children)
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext)
  if (!context) throw new Error('useOfflineSync debe usarse dentro de OfflineSyncProvider')
  return context
}
