import type { AuthChangeEvent, RealtimePostgresInsertPayload, Session } from '@supabase/supabase-js'
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppNotification,
  AudienceState,
  NotificationAudience,
  NotificationCursor,
  NotificationType,
} from '../lib/notifications/types'
import { fetchStudentNotifications } from '../lib/notifications/derivedStudent'
import { fetchTeacherNotifications } from '../lib/notifications/derivedTeacher'
import {
  deletePersistentNotifications,
  fetchPersistentNotificationPage,
  getDatabaseNotificationId,
  loadNotificationStateFromDB,
  markAllPersistentNotificationsRead,
  markPersistentNotificationsRead,
  mergeNotificationSources,
  shouldLoadDerivedNotifications,
} from '../lib/notifications/persistent'
import { filterNotificationsByPreferences, loadNotificationPreferences } from '../lib/notifications/preferences'
import { supabase } from '../lib/supabase'
import {
  isJwtIssuedInFutureError,
  retrySupabaseRequestAfterJwtRecovery,
} from '../lib/supabaseJwtRecovery'
import { readThroughCache, updateOfflineCache } from '../lib/offlineCache'
import { enqueueOfflineMutation } from '../lib/offlineMutations'

export type { AppNotification, NotificationAudience, NotificationType }

const NOTIFICATION_PAGE_SIZE = 20

type NotificationContextValue = {
  activeAudience: NotificationAudience | null
  getAudienceState: (audience: NotificationAudience) => AudienceState
  refresh: (audience: NotificationAudience) => Promise<void>
  loadMore: (audience: NotificationAudience) => Promise<void>
  markAsRead: (audience: NotificationAudience, id: string) => Promise<void>
  markAllAsRead: (audience: NotificationAudience) => Promise<void>
  deleteNotification: (audience: NotificationAudience, id: string) => Promise<void>
  deleteNotifications: (audience: NotificationAudience, ids: string[]) => Promise<void>
  clearError: (audience: NotificationAudience) => void
}

type NotificationCacheSnapshot = {
  notifications: AppNotification[]
  readIds: string[]
  deletedIds: string[]
  cursor: NotificationCursor | null
  hasMore: boolean
  total: number
  unreadCount: number
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [audienceState, setAudienceState] = useState<Record<NotificationAudience, AudienceState>>(createInitialState)
  const stateRef = useRef(audienceState)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [activeAudience, setActiveAudience] = useState<NotificationAudience | null>(null)

  useEffect(() => {
    stateRef.current = audienceState
  }, [audienceState])

  useEffect(() => {
    let isMounted = true
    const retryTimers = new Set<ReturnType<typeof setTimeout>>()

    const syncUser = async (nextSession: Session | null, retryAttempt = 0) => {
      if (!isMounted) return

      const nextUserId = nextSession?.user.id || null
      setUserId(nextUserId)
      setAudienceState(createInitialState())

      if (!nextUserId || nextSession?.user.is_anonymous) {
        setUserId(null)
        setActiveAudience(null)
        setReadIds(new Set())
        setDeletedIds(new Set())
        return
      }

      try {
        const [{ data: profile, error: profileError }, notificationState] = await Promise.all([
          retrySupabaseRequestAfterJwtRecovery(() => (
            supabase.from('profiles').select('role_id, active').eq('id', nextUserId).single()
          )),
          loadNotificationStateFromDB(nextUserId),
        ])
        if (profileError) throw profileError
        if (!isMounted) return

        const nextAudience = profile?.active === false ? null : audienceForRole(profile?.role_id)
        setActiveAudience(nextAudience)
        setReadIds(notificationState.read)
        setDeletedIds(notificationState.deleted)
        setAudienceState((current) => ({
          ...current,
          teacher: nextAudience === 'teacher' ? current.teacher : createEmptyAudienceState(false),
          student: nextAudience === 'student' ? current.student : createEmptyAudienceState(false),
        }))
      } catch (error) {
        if (isJwtIssuedInFutureError(error)) {
          if (isMounted && retryAttempt < 2) {
            const retryDelay = retryAttempt === 0 ? 1_500 : 4_000
            const timer = setTimeout(() => {
              retryTimers.delete(timer)
              void syncUser(nextSession, retryAttempt + 1)
            }, retryDelay)
            retryTimers.add(timer)
          }
          return
        }

        console.error('Error resolviendo el rol para notificaciones:', error)
        if (isMounted) {
          setActiveAudience(null)
          setAudienceState({
            teacher: createEmptyAudienceState(false),
            student: createEmptyAudienceState(false),
          })
        }
      }
    }

    const syncInitialSession = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        await syncUser(session.session)
      } catch (error) {
        console.error('Error sincronizando sesión para notificaciones:', error)
        await syncUser(null)
      }
    }

    void syncInitialSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      void syncUser(session)
    })

    return () => {
      isMounted = false
      retryTimers.forEach((timer) => clearTimeout(timer))
      retryTimers.clear()
      authListener.subscription.unsubscribe()
    }
  }, [])

  const applySnapshot = useCallback((audience: NotificationAudience, snapshot: NotificationCacheSnapshot) => {
    const normalized = normalizeNotificationSnapshot(snapshot)
    setReadIds(new Set(normalized.readIds))
    setDeletedIds(new Set(normalized.deletedIds))
    setAudienceState((current) => ({
      ...current,
      [audience]: {
        notifications: normalized.notifications,
        loading: false,
        loadingMore: false,
        error: null,
        hasMore: normalized.hasMore,
        total: normalized.total,
        unreadCount: normalized.unreadCount,
        cursor: normalized.cursor,
      },
    }))
  }, [])

  const buildPageSnapshot = useCallback(async (
    audience: NotificationAudience,
    cursor: NotificationCursor | null,
  ): Promise<NotificationCacheSnapshot> => {
    if (!userId) return emptyCacheSnapshot()

    const [{ read: latestRead, deleted: latestDeleted }, preferences, persistentPage] = await Promise.all([
      loadNotificationStateFromDB(userId),
      loadNotificationPreferences(userId),
      fetchPersistentNotificationPage({
        userId,
        audience,
        cursor,
        pageSize: NOTIFICATION_PAGE_SIZE,
      }),
    ])

    const derivedNotifications = cursor === null && shouldLoadDerivedNotifications(persistentPage.available)
      ? filterNotificationsByPreferences(
          audience === 'student'
            ? await fetchStudentNotifications({ userId, readIds: latestRead, deletedIds: latestDeleted })
            : await fetchTeacherNotifications({ userId, readIds: latestRead, deletedIds: latestDeleted }),
          preferences
        )
      : []

    const persistentNotifications = persistentPage.notifications
    const notifications = cursor === null
      ? mergeNotificationSources(persistentNotifications, derivedNotifications)
      : persistentNotifications

    return {
      notifications,
      readIds: [...latestRead],
      deletedIds: [...latestDeleted],
      cursor: persistentPage.cursor,
      hasMore: persistentPage.hasMore,
      total: Math.max(persistentPage.total, notifications.length),
      unreadCount: Math.max(
        persistentPage.unreadCount,
        notifications.filter((notification) => !notification.isRead).length
      ),
    }
  }, [userId])

  const fetchNotifications = useCallback(async (
    audience: NotificationAudience,
    mode: 'reset' | 'more' = 'reset',
  ) => {
    if (!userId || activeAudience !== audience) {
      setAudienceState((current) => ({ ...current, [audience]: createEmptyAudienceState(false) }))
      return
    }

    const currentState = stateRef.current[audience]
    if (mode === 'more' && (!currentState.hasMore || currentState.loadingMore || !currentState.cursor)) return

    setAudienceState((current) => ({
      ...current,
      [audience]: {
        ...current[audience],
        loading: mode === 'reset',
        loadingMore: mode === 'more',
        error: null,
      },
    }))

    try {
      if (mode === 'reset') {
        await readThroughCache<NotificationCacheSnapshot>({
          userId,
          resource: `notifications:${audience}`,
          fetcher: () => buildPageSnapshot(audience, null),
          onData: (snapshot) => applySnapshot(audience, snapshot),
        })
        return
      }

      const nextPage = await buildPageSnapshot(audience, currentState.cursor)
      const mergedNotifications = mergeById(currentState.notifications, nextPage.notifications)
      const nextSnapshot: NotificationCacheSnapshot = {
        ...nextPage,
        notifications: mergedNotifications,
        total: Math.max(currentState.total, nextPage.total, mergedNotifications.length),
        unreadCount: Math.max(0, nextPage.unreadCount),
      }
      applySnapshot(audience, nextSnapshot)
      await updateOfflineCache<NotificationCacheSnapshot>(userId, `notifications:${audience}`, () => nextSnapshot)
    } catch (error: any) {
      const recoverableJwtClockSkew = isJwtIssuedInFutureError(error)
      if (!recoverableJwtClockSkew) {
        console.error('Error cargando notificaciones:', error?.message || error)
      }
      setAudienceState((current) => ({
        ...current,
        [audience]: {
          ...current[audience],
          loading: false,
          loadingMore: false,
          error: recoverableJwtClockSkew
            ? null
            : 'No se pudieron cargar las notificaciones. Revisa tu conexión o vuelve a iniciar sesión.',
        },
      }))
    }
  }, [activeAudience, applySnapshot, buildPageSnapshot, userId])

  useEffect(() => {
    if (!userId || !activeAudience) return
    void fetchNotifications(activeAudience, 'reset')
  }, [activeAudience, fetchNotifications, userId])

  useEffect(() => {
    if (!userId || !activeAudience) return

    const channel = supabase
      .channel(`notifications:${userId}:${activeAudience}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresInsertPayload<{ audience?: string }>) => {
          const row = payload.new
          if (row.audience === activeAudience) void fetchNotifications(activeAudience, 'reset')
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeAudience, fetchNotifications, userId])

  const persistBatchState = useCallback(async ({
    ids,
    read,
    deleted,
  }: {
    ids: string[]
    read?: boolean
    deleted?: boolean
  }) => {
    if (!userId || ids.length === 0) return

    const databaseIds = ids.filter((id) => Boolean(getDatabaseNotificationId(id)))
    const derivedIds = ids.filter((id) => !getDatabaseNotificationId(id))

    try {
      if (databaseIds.length > 0) {
        if (deleted) await deletePersistentNotifications(databaseIds)
        else if (read) await markPersistentNotificationsRead(databaseIds)
      }
    } catch (error) {
      console.warn('La actualización de notificaciones se sincronizará más tarde:', error)
      derivedIds.push(...databaseIds)
    }

    await Promise.all(derivedIds.map((notificationId) => enqueueOfflineMutation({
      userId,
      kind: 'notification.state',
      entityKey: `notification:${notificationId}`,
      conflictPolicy: 'merge',
      payload: {
        notificationId,
        isRead: read === true || readIds.has(notificationId),
        isDeleted: deleted === true || deletedIds.has(notificationId),
      },
    })))
  }, [deletedIds, readIds, userId])

  const markIdsAsRead = useCallback(async (audience: NotificationAudience, ids: string[]) => {
    if (!userId || ids.length === 0) return
    const uniqueIds = [...new Set(ids)]

    setReadIds((current) => new Set([...current, ...uniqueIds]))
    setAudienceState((current) => ({
      ...current,
      [audience]: {
        ...current[audience],
        notifications: current[audience].notifications.map((notification) => uniqueIds.includes(notification.id)
          ? { ...notification, isRead: true }
          : notification),
        unreadCount: Math.max(0, current[audience].unreadCount - uniqueIds.filter((id) => current[audience].notifications.some((item) => item.id === id && !item.isRead)).length),
      },
    }))
    await patchNotificationCacheBatch(userId, audience, uniqueIds, { read: true })
    await persistBatchState({ ids: uniqueIds, read: true })
  }, [persistBatchState, userId])

  const deleteIds = useCallback(async (audience: NotificationAudience, ids: string[]) => {
    if (!userId || ids.length === 0) return
    const uniqueIds = [...new Set(ids)]

    setDeletedIds((current) => new Set([...current, ...uniqueIds]))
    setAudienceState((current) => {
      const removedUnread = current[audience].notifications.filter((item) => uniqueIds.includes(item.id) && !item.isRead).length
      const remaining = current[audience].notifications.filter((notification) => !uniqueIds.includes(notification.id))
      return {
        ...current,
        [audience]: {
          ...current[audience],
          notifications: remaining,
          total: Math.max(0, current[audience].total - uniqueIds.length),
          unreadCount: Math.max(0, current[audience].unreadCount - removedUnread),
        },
      }
    })
    await patchNotificationCacheBatch(userId, audience, uniqueIds, { deleted: true })
    await persistBatchState({ ids: uniqueIds, deleted: true })
  }, [persistBatchState, userId])

  const markAsRead = useCallback(
    async (audience: NotificationAudience, id: string) => markIdsAsRead(audience, [id]),
    [markIdsAsRead]
  )

  const markAllAsRead = useCallback(async (audience: NotificationAudience) => {
    if (!userId) return
    const currentState = stateRef.current[audience]
    const loadedUnreadIds = currentState.notifications.filter((notification) => !notification.isRead).map((notification) => notification.id)

    try {
      await markAllPersistentNotificationsRead(audience)
      const derivedUnreadIds = loadedUnreadIds.filter((id) => !getDatabaseNotificationId(id))
      setReadIds((current) => new Set([...current, ...loadedUnreadIds]))
      setAudienceState((current) => ({
        ...current,
        [audience]: {
          ...current[audience],
          notifications: current[audience].notifications.map((notification) => ({ ...notification, isRead: true })),
          unreadCount: 0,
        },
      }))
      await patchNotificationCacheMarkAllRead(userId, audience)
      await persistBatchState({ ids: derivedUnreadIds, read: true })
    } catch (error) {
      console.warn('No se pudieron marcar todas las notificaciones remotas; se actualizarán las visibles:', error)
      await markIdsAsRead(audience, loadedUnreadIds)
    }
  }, [markIdsAsRead, persistBatchState, userId])

  const deleteNotification = useCallback(
    async (audience: NotificationAudience, id: string) => deleteIds(audience, [id]),
    [deleteIds]
  )

  const deleteNotifications = useCallback(
    async (audience: NotificationAudience, ids: string[]) => deleteIds(audience, ids),
    [deleteIds]
  )

  const refresh = useCallback(
    async (audience: NotificationAudience) => fetchNotifications(audience, 'reset'),
    [fetchNotifications]
  )

  const loadMore = useCallback(
    async (audience: NotificationAudience) => fetchNotifications(audience, 'more'),
    [fetchNotifications]
  )

  const clearError = useCallback((audience: NotificationAudience) => {
    setAudienceState((current) => ({
      ...current,
      [audience]: { ...current[audience], error: null },
    }))
  }, [])

  const value = useMemo<NotificationContextValue>(() => ({
    activeAudience,
    getAudienceState: (audience) => audienceState[audience] || createEmptyAudienceState(false),
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteNotifications,
    clearError,
  }), [
    activeAudience,
    audienceState,
    clearError,
    deleteNotification,
    deleteNotifications,
    loadMore,
    markAllAsRead,
    markAsRead,
    refresh,
  ])

  return createElement(NotificationContext.Provider, { value }, children)
}

export function useNotifications(audience: NotificationAudience = 'teacher') {
  const context = useContext(NotificationContext)
  const contextMarkAsRead = context?.markAsRead
  const contextMarkAllAsRead = context?.markAllAsRead
  const contextDeleteNotification = context?.deleteNotification
  const contextDeleteNotifications = context?.deleteNotifications
  const contextRefresh = context?.refresh
  const contextLoadMore = context?.loadMore
  const contextClearError = context?.clearError
  const markAsRead = useCallback((id: string) => { if (!contextMarkAsRead) throw new Error('useNotifications debe usarse dentro de NotificationProvider'); return contextMarkAsRead(audience, id) }, [audience, contextMarkAsRead])
  const markAllAsRead = useCallback(() => { if (!contextMarkAllAsRead) throw new Error('useNotifications debe usarse dentro de NotificationProvider'); return contextMarkAllAsRead(audience) }, [audience, contextMarkAllAsRead])
  const deleteNotification = useCallback((id: string) => { if (!contextDeleteNotification) throw new Error('useNotifications debe usarse dentro de NotificationProvider'); return contextDeleteNotification(audience, id) }, [audience, contextDeleteNotification])
  const deleteNotifications = useCallback((ids: string[]) => { if (!contextDeleteNotifications) throw new Error('useNotifications debe usarse dentro de NotificationProvider'); return contextDeleteNotifications(audience, ids) }, [audience, contextDeleteNotifications])
  const refresh = useCallback(() => { if (!contextRefresh) throw new Error('useNotifications debe usarse dentro de NotificationProvider'); return contextRefresh(audience) }, [audience, contextRefresh])
  const loadMore = useCallback(() => { if (!contextLoadMore) throw new Error('useNotifications debe usarse dentro de NotificationProvider'); return contextLoadMore(audience) }, [audience, contextLoadMore])
  const clearError = useCallback(() => { if (!contextClearError) throw new Error('useNotifications debe usarse dentro de NotificationProvider'); return contextClearError(audience) }, [audience, contextClearError])

  if (!context) throw new Error('useNotifications debe usarse dentro de NotificationProvider')

  const state = context.getAudienceState(audience)

  return {
    ...state,
    activeAudience: context.activeAudience,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteNotifications,
    refresh,
    loadMore,
    clearError,
  }
}

function normalizeNotificationSnapshot(snapshot: NotificationCacheSnapshot): NotificationCacheSnapshot {
  const loadedUnread = snapshot.notifications.filter((notification) => !notification.isRead).length
  const hasNoRenderableRows = snapshot.notifications.length === 0 && !snapshot.hasMore
  const total = hasNoRenderableRows ? 0 : Math.max(snapshot.total, snapshot.notifications.length)
  const unreadCount = total === 0 ? 0 : Math.min(total, Math.max(snapshot.unreadCount, loadedUnread))

  return { ...snapshot, total, unreadCount }
}

async function patchNotificationCacheMarkAllRead(userId: string, audience: NotificationAudience) {
  await updateOfflineCache<NotificationCacheSnapshot>(userId, `notifications:${audience}`, (snapshot) => ({
    ...snapshot,
    notifications: snapshot.notifications.map((notification) => ({ ...notification, isRead: true })),
    unreadCount: 0,
    readIds: [...new Set([...snapshot.readIds, ...snapshot.notifications.map((notification) => notification.id)])],
  }))
}

async function patchNotificationCacheBatch(
  userId: string,
  audience: NotificationAudience,
  notificationIds: string[],
  state: { read?: boolean; deleted?: boolean },
) {
  const ids = new Set(notificationIds)
  await updateOfflineCache<NotificationCacheSnapshot>(userId, `notifications:${audience}`, (snapshot) => {
    const removedUnread = snapshot.notifications.filter((notification) => ids.has(notification.id) && !notification.isRead).length
    const notifications = state.deleted
      ? snapshot.notifications.filter((notification) => !ids.has(notification.id))
      : snapshot.notifications.map((notification) => ids.has(notification.id)
        ? { ...notification, isRead: state.read ? true : notification.isRead }
        : notification)

    return {
      ...snapshot,
      notifications,
      total: state.deleted ? Math.max(0, snapshot.total - ids.size) : snapshot.total,
      unreadCount: Math.max(0, snapshot.unreadCount - removedUnread),
      readIds: state.read ? [...new Set([...snapshot.readIds, ...notificationIds])] : snapshot.readIds,
      deletedIds: state.deleted ? [...new Set([...snapshot.deletedIds, ...notificationIds])] : snapshot.deletedIds,
    }
  })
}

function audienceForRole(roleId: string | null | undefined): NotificationAudience | null {
  if (roleId === 'teacher') return 'teacher'
  if (roleId === 'student' || roleId === 'guest') return 'student'
  return null
}

function createInitialState(): Record<NotificationAudience, AudienceState> {
  return {
    teacher: createEmptyAudienceState(true),
    student: createEmptyAudienceState(true),
  }
}

function createEmptyAudienceState(loading: boolean): AudienceState {
  return {
    notifications: [],
    loading,
    loadingMore: false,
    error: null,
    hasMore: false,
    total: 0,
    unreadCount: 0,
    cursor: null,
  }
}

function emptyCacheSnapshot(): NotificationCacheSnapshot {
  return {
    notifications: [],
    readIds: [],
    deletedIds: [],
    cursor: null,
    hasMore: false,
    total: 0,
    unreadCount: 0,
  }
}

function mergeById(current: AppNotification[], next: AppNotification[]) {
  const seen = new Set(current.map((notification) => notification.id))
  return [...current, ...next.filter((notification) => !seen.has(notification.id))]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
}
