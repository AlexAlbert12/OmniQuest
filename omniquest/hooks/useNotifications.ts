import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppNotification, AudienceState, NotificationAudience, NotificationType } from '../lib/notifications/types'
import { fetchStudentNotifications } from '../lib/notifications/derivedStudent'
import { fetchTeacherNotifications } from '../lib/notifications/derivedTeacher'
import {
  fetchPersistentNotifications,
  getDatabaseNotificationId,
  loadNotificationStateFromDB,
  mergeNotificationSources,
  persistNotificationStateToDb,
  updatePersistentNotificationState,
} from '../lib/notifications/persistent'
import { filterNotificationsByPreferences, loadNotificationPreferences } from '../lib/notifications/preferences'
import { supabase } from '../lib/supabase'

export type { AppNotification, NotificationAudience, NotificationType }

type NotificationContextValue = {
  getAudienceState: (audience: NotificationAudience) => AudienceState
  refresh: (audience: NotificationAudience) => Promise<void>
  markAsRead: (audience: NotificationAudience, id: string) => Promise<void>
  markAllAsRead: (audience: NotificationAudience) => Promise<void>
  deleteNotification: (audience: NotificationAudience, id: string) => Promise<void>
  clearError: (audience: NotificationAudience) => void
}

const emptyAudienceState: AudienceState = {
  notifications: [],
  loading: true,
  error: null,
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [audienceState, setAudienceState] = useState<Record<NotificationAudience, AudienceState>>({
    teacher: emptyAudienceState,
    student: emptyAudienceState,
  })
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const syncUser = async (nextUserId: string | null) => {
      if (!isMounted) return

      setUserId(nextUserId)

      if (nextUserId) {
        let read = new Set<string>()
        let deleted = new Set<string>()

        try {
          const state = await loadNotificationStateFromDB(nextUserId)
          read = state.read
          deleted = state.deleted
        } catch (error) {
          console.error('Error cargando estado inicial de notificaciones:', error)
        }

        if (!isMounted) return

        setReadIds(read)
        setDeletedIds(deleted)
      } else {
        setReadIds(new Set())
        setDeletedIds(new Set())
        setAudienceState({
          teacher: { notifications: [], loading: false, error: null },
          student: { notifications: [], loading: false, error: null },
        })
      }
    }

    const syncInitialSession = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        await syncUser(session.session?.user.id || null)
      } catch (error) {
        console.error('Error sincronizando sesión para notificaciones:', error)
        await syncUser(null)
      }
    }

    void syncInitialSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user.id || null)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const setAudienceLoading = useCallback((audience: NotificationAudience, loading: boolean) => {
    setAudienceState((current) => ({
      ...current,
      [audience]: {
        ...current[audience],
        loading,
        error: loading ? null : current[audience].error,
      },
    }))
  }, [])

  const setAudienceNotifications = useCallback((audience: NotificationAudience, notifications: AppNotification[]) => {
    setAudienceState((current) => ({
      ...current,
      [audience]: {
        notifications,
        loading: false,
        error: null,
      },
    }))
  }, [])

  const setAudienceError = useCallback((audience: NotificationAudience, error: string) => {
    setAudienceState((current) => ({
      ...current,
      [audience]: {
        ...current[audience],
        loading: false,
        error,
      },
    }))
  }, [])

  const fetchNotifications = useCallback(async (audience: NotificationAudience) => {
    setAudienceLoading(audience, true)

    try {
      if (!userId) {
        setAudienceNotifications(audience, [])
        return
      }

      const { read: latestRead, deleted: latestDeleted } = await loadNotificationStateFromDB(userId)
      setReadIds(latestRead)
      setDeletedIds(latestDeleted)

      const preferences = await loadNotificationPreferences(userId)
      const persistentNotifications = filterNotificationsByPreferences(
        await fetchPersistentNotifications({ userId, audience }),
        preferences
      )

      const derivedNotifications = filterNotificationsByPreferences(
        audience === 'student'
          ? await fetchStudentNotifications({ userId, readIds: latestRead, deletedIds: latestDeleted })
          : await fetchTeacherNotifications({ userId, readIds: latestRead, deletedIds: latestDeleted }),
        preferences
      )

      setAudienceNotifications(audience, mergeNotificationSources(persistentNotifications, derivedNotifications))
    } catch (error: any) {
      console.error('Error cargando notificaciones:', error.message)
      setAudienceError(
        audience,
        'No se pudieron cargar las notificaciones. Revisa tu conexión o vuelve a iniciar sesión.'
      )
    }
  }, [setAudienceError, setAudienceLoading, setAudienceNotifications, userId])

  useEffect(() => {
    if (!userId) return
    void fetchNotifications('teacher')
    void fetchNotifications('student')
  }, [fetchNotifications, userId])

  const markAsRead = useCallback(
    async (_audience: NotificationAudience, id: string) => {
      if (!userId) return

      setReadIds((current) => {
        const next = new Set(current)
        next.add(id)
        return next
      })

      setAudienceState((current) => markNotificationReadInState(current, id))
      try {
        const dbNotificationId = getDatabaseNotificationId(id)
        if (dbNotificationId) {
          await updatePersistentNotificationState(dbNotificationId, { read: true })
        } else {
          await persistNotificationStateToDb(userId, id, { isRead: true, isDeleted: deletedIds.has(id) })
        }
      } catch (error) {
        console.error('Error marcando notificación como leída:', error)
      }
    },
    [deletedIds, userId]
  )

  const markAllAsRead = useCallback(async (audience: NotificationAudience) => {
    if (!userId) return

    const notifications = audienceState[audience].notifications
    const unreadNotifications = notifications.filter((notification) => !notification.isRead)
    if (unreadNotifications.length === 0) return

    setReadIds((current) => {
      const next = new Set(current)
      unreadNotifications.forEach((notification) => next.add(notification.id))
      return next
    })

    setAudienceState((current) => markAllAudienceNotificationsReadInState(current, audience))

    try {
      for (const notification of unreadNotifications) {
        const dbNotificationId = getDatabaseNotificationId(notification.id)
        if (dbNotificationId) {
          await updatePersistentNotificationState(dbNotificationId, { read: true })
        } else {
          await persistNotificationStateToDb(userId, notification.id, {
            isRead: true,
            isDeleted: deletedIds.has(notification.id),
          })
        }
      }
    } catch (error) {
      console.error('Error marcando todas las notificaciones como leídas:', error)
    }
  }, [audienceState, deletedIds, userId])

  const deleteNotification = useCallback(
    async (_audience: NotificationAudience, id: string) => {
      if (!userId) return

      setDeletedIds((current) => {
        const next = new Set(current)
        next.add(id)
        return next
      })

      setAudienceState((current) => deleteNotificationFromState(current, id))
      try {
        const dbNotificationId = getDatabaseNotificationId(id)
        if (dbNotificationId) {
          await updatePersistentNotificationState(dbNotificationId, { deleted: true })
        } else {
          await persistNotificationStateToDb(userId, id, { isRead: readIds.has(id), isDeleted: true })
        }
      } catch (error) {
        console.error('Error eliminando notificación:', error)
      }
    },
    [readIds, userId]
  )

  const refresh = useCallback(async (audience: NotificationAudience) => {
    await fetchNotifications(audience)
  }, [fetchNotifications])

  const clearError = useCallback((audience: NotificationAudience) => {
    setAudienceState((current) => ({
      ...current,
      [audience]: {
        ...current[audience],
        error: null,
      },
    }))
  }, [])

  const value = useMemo<NotificationContextValue>(() => ({
    getAudienceState: (audience) => audienceState[audience] || emptyAudienceState,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearError,
  }), [audienceState, clearError, deleteNotification, markAllAsRead, markAsRead, refresh])

  return createElement(NotificationContext.Provider, { value }, children)
}

export function useNotifications(audience: NotificationAudience = 'teacher') {
  const context = useContext(NotificationContext)

  if (!context) {
    throw new Error('useNotifications debe usarse dentro de NotificationProvider')
  }

  const {
    clearError: clearAudienceError,
    deleteNotification: deleteAudienceNotification,
    getAudienceState,
    markAllAsRead: markAllAudienceAsRead,
    markAsRead: markAudienceAsRead,
    refresh: refreshAudience,
  } = context
  const { notifications, loading, error } = getAudienceState(audience)
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  )
  const markAsRead = useCallback(
    (id: string) => markAudienceAsRead(audience, id),
    [audience, markAudienceAsRead]
  )
  const deleteNotification = useCallback(
    (id: string) => deleteAudienceNotification(audience, id),
    [audience, deleteAudienceNotification]
  )
  const markAllAsRead = useCallback(
    () => markAllAudienceAsRead(audience),
    [audience, markAllAudienceAsRead]
  )
  const refresh = useCallback(
    () => refreshAudience(audience),
    [audience, refreshAudience]
  )
  const clearError = useCallback(
    () => clearAudienceError(audience),
    [audience, clearAudienceError]
  )

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    clearError,
  }
}

function markNotificationReadInState(
  current: Record<NotificationAudience, AudienceState>,
  notificationId: string
) {
  return mapAudienceNotifications(current, (notification) =>
    notification.id === notificationId ? { ...notification, isRead: true } : notification
  )
}

function markAllAudienceNotificationsReadInState(
  current: Record<NotificationAudience, AudienceState>,
  audience: NotificationAudience
) {
  return {
    ...current,
    [audience]: {
      ...current[audience],
      notifications: current[audience].notifications.map((notification) => ({ ...notification, isRead: true })),
    },
  }
}

function deleteNotificationFromState(
  current: Record<NotificationAudience, AudienceState>,
  notificationId: string
) {
  return {
    teacher: {
      ...current.teacher,
      notifications: current.teacher.notifications.filter((notification) => notification.id !== notificationId),
    },
    student: {
      ...current.student,
      notifications: current.student.notifications.filter((notification) => notification.id !== notificationId),
    },
  }
}

function mapAudienceNotifications(
  current: Record<NotificationAudience, AudienceState>,
  mapper: (notification: AppNotification) => AppNotification
) {
  return {
    teacher: {
      ...current.teacher,
      notifications: current.teacher.notifications.map(mapper),
    },
    student: {
      ...current.student,
      notifications: current.student.notifications.map(mapper),
    },
  }
}
