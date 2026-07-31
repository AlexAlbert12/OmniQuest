import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import type { AppNotification, NotificationCursor, NotificationType } from '../../lib/notifications/types'
import { deletePersistentNotifications, markPersistentNotificationsRead } from '../../lib/notifications/persistent'
import { supabase } from '../../lib/supabase'

export type TeacherNotificationBucket = 'all' | 'critical' | 'informative'
export type TeacherNotificationCategory = 'all' | 'students' | 'review' | 'courses' | 'system' | 'audit'

export type TeacherNotificationSummary = {
  pendingReviews: number
  inactiveStudents: number
  sensitiveActions: number
  mutedUntil: string | null
}

type NotificationPage = {
  rows: AppNotification[]
  cursor: NotificationCursor | null
  hasMore: boolean
  total: number
  unreadCount: number
  criticalCount: number
  informativeCount: number
}

const EMPTY_SUMMARY: TeacherNotificationSummary = {
  pendingReviews: 0,
  inactiveStudents: 0,
  sensitiveActions: 0,
  mutedUntil: null,
}

const EMPTY_PAGE: NotificationPage = {
  rows: [],
  cursor: null,
  hasMore: false,
  total: 0,
  unreadCount: 0,
  criticalCount: 0,
  informativeCount: 0,
}

const PAGE_SIZE = 20

export function useTeacherNotifications() {
  const [bucket, setBucket] = useState<TeacherNotificationBucket>('all')
  const [category, setCategory] = useState<TeacherNotificationCategory>('all')
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState<NotificationPage>(EMPTY_PAGE)
  const [summary, setSummary] = useState<TeacherNotificationSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const pageRef = useRef<NotificationPage>(EMPTY_PAGE)
  const loadingMoreRef = useRef(false)

  const loadSummary = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('get_teacher_notification_center_summary')
    if (rpcError) throw rpcError
    const payload = isObject(data) ? data : {}
    setSummary({
      pendingReviews: Number(payload.pending_reviews || 0),
      inactiveStudents: Number(payload.inactive_students || 0),
      sensitiveActions: Number(payload.sensitive_actions || 0),
      mutedUntil: typeof payload.muted_until === 'string' ? payload.muted_until : null,
    })
  }, [])

  const loadPage = useCallback(async (mode: 'reset' | 'more' = 'reset') => {
    const currentPage = pageRef.current
    if (mode === 'more' && (!currentPage.hasMore || currentPage.cursor === null || loadingMoreRef.current)) return
    const currentRequest = ++requestId.current
    if (mode === 'reset') {
      setLoading(true)
    } else {
      loadingMoreRef.current = true
      setLoadingMore(true)
    }
    setError(null)
    try {
      const cursor = mode === 'more' ? currentPage.cursor : null
      const { data, error: rpcError } = await supabase.rpc('get_teacher_notifications_page', {
        p_bucket: bucket,
        p_category: category,
        p_subject_id: subjectId ?? undefined,
        p_unread_only: unreadOnly,
        p_limit: PAGE_SIZE,
        p_cursor_created_at: cursor?.createdAt,
        p_cursor_id: cursor?.id,
      })
      if (rpcError) throw rpcError
      if (requestId.current !== currentRequest) return
      const next = mapPage(data)
      const resolved = mode === 'more'
        ? { ...next, rows: mergeById(currentPage.rows, next.rows) }
        : next
      pageRef.current = resolved
      setPage(resolved)
    } catch (loadError) {
      if (requestId.current === currentRequest) {
        setError(getErrorMessage(loadError, 'No se pudieron cargar las notificaciones docentes.'))
      }
    } finally {
      if (requestId.current === currentRequest) {
        loadingMoreRef.current = false
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    }
  }, [bucket, category, subjectId, unreadOnly])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadPage('reset'), loadSummary()])
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, 'No se pudo actualizar el centro de notificaciones.'))
      setRefreshing(false)
    }
  }, [loadPage, loadSummary])

  useEffect(() => {
    void Promise.all([loadPage('reset'), loadSummary()]).catch((loadError) => {
      setError(getErrorMessage(loadError, 'No se pudo abrir el centro de notificaciones.'))
      setLoading(false)
    })
  }, [loadPage, loadSummary])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let disposed = false
    void supabase.auth.getUser().then(({ data }) => {
      if (disposed || !data.user) return
      channel = supabase
        .channel(`teacher-notification-center:${data.user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${data.user.id}` },
          (payload: RealtimePostgresInsertPayload<{ audience?: string }>) => {
            if (payload.new.audience === 'teacher') void refresh()
          },
        )
        .subscribe()
    })
    return () => {
      disposed = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [refresh])

  const markAsRead = useCallback(async (notification: AppNotification) => {
    if (notification.isRead) return
    await markPersistentNotificationsRead([notification.id])
    setPage((current) => {
      const next = {
        ...current,
        unreadCount: Math.max(0, current.unreadCount - 1),
        rows: current.rows.map((item) => item.id === notification.id ? { ...item, isRead: true } : item),
      }
      pageRef.current = next
      return next
    })
  }, [])

  const markAllAsRead = useCallback(async () => {
    const ids = page.rows.filter((item) => !item.isRead).map((item) => item.id)
    if (ids.length === 0) return
    await markPersistentNotificationsRead(ids)
    setPage((current) => {
      const next = {
        ...current,
        unreadCount: Math.max(0, current.unreadCount - ids.length),
        rows: current.rows.map((item) => ({ ...item, isRead: true })),
      }
      pageRef.current = next
      return next
    })
  }, [page.rows])

  const deleteNotification = useCallback(async (notification: AppNotification) => {
    await deletePersistentNotifications([notification.id])
    setPage((current) => {
      const next = {
        ...current,
        total: Math.max(0, current.total - 1),
        unreadCount: Math.max(0, current.unreadCount - (notification.isRead ? 0 : 1)),
        criticalCount: Math.max(0, current.criticalCount - (notification.severity === 'critical' ? 1 : 0)),
        informativeCount: Math.max(0, current.informativeCount - (notification.severity === 'informative' ? 1 : 0)),
        rows: current.rows.filter((item) => item.id !== notification.id),
      }
      pageRef.current = next
      return next
    })
  }, [])

  const muteUntil = useCallback(async (until: string | null) => {
    const { error: rpcError } = await supabase.rpc('set_teacher_notifications_mute', { p_until: until ?? undefined })
    if (rpcError) throw rpcError
    await loadSummary()
  }, [loadSummary])

  const activeFilterDescription = useMemo(() => {
    if (unreadOnly) return 'Solo notificaciones sin leer'
    if (bucket === 'critical') return 'Alertas críticas que requieren atención'
    if (bucket === 'informative') return 'Actualizaciones informativas'
    return 'Todas las notificaciones docentes'
  }, [bucket, unreadOnly])

  return {
    bucket,
    setBucket,
    category,
    setCategory,
    subjectId,
    setSubjectId,
    unreadOnly,
    setUnreadOnly,
    notifications: page.rows,
    total: page.total,
    unreadCount: page.unreadCount,
    criticalCount: page.criticalCount,
    informativeCount: page.informativeCount,
    hasMore: page.hasMore,
    summary,
    loading,
    loadingMore,
    refreshing,
    error,
    clearError: () => setError(null),
    activeFilterDescription,
    refresh,
    loadMore: () => loadPage('more'),
    markAsRead,
    markAllAsRead,
    deleteNotification,
    muteUntil,
  }
}

function mapPage(value: unknown): NotificationPage {
  const payload = isObject(value) ? value : {}
  const rows = Array.isArray(payload.rows) ? payload.rows.map(mapNotification).filter(Boolean) as AppNotification[] : []
  return {
    rows,
    cursor: typeof payload.next_cursor_created_at === 'string' && typeof payload.next_cursor_id === 'string'
      ? { createdAt: payload.next_cursor_created_at, id: payload.next_cursor_id }
      : null,
    hasMore: payload.has_more === true,
    total: Number(payload.total || 0),
    unreadCount: Number(payload.unread_count || 0),
    criticalCount: Number(payload.critical_count || 0),
    informativeCount: Number(payload.informative_count || 0),
  }
}

function mapNotification(value: unknown): AppNotification | null {
  if (!isObject(value) || typeof value.id !== 'string') return null
  const metadata = isObject(value.metadata) ? value.metadata : {}
  const type = isNotificationType(value.type) ? value.type : 'announcement'
  return {
    id: `db:${value.id}`,
    type,
    title: String(value.title || 'Notificación'),
    description: String(value.description || ''),
    icon: safeIcon(value.icon),
    color: String(value.color || '#8B5CF6'),
    timestamp: String(value.created_at || new Date().toISOString()),
    isRead: Boolean(value.read_at),
    relatedId: value.related_id && /^\d+$/.test(String(value.related_id)) ? Number(value.related_id) : undefined,
    subjectName: typeof metadata.subject_name === 'string' ? metadata.subject_name : undefined,
    studentName: typeof metadata.student_name === 'string' ? metadata.student_name : undefined,
    actionUrl: typeof value.action_url === 'string' ? value.action_url : undefined,
    source: 'database',
    severity: value.severity === 'critical' ? 'critical' : 'informative',
    category: typeof value.category === 'string' ? value.category : 'system',
    subjectId: value.subject_id == null ? undefined : Number(value.subject_id),
  }
}

function safeIcon(value: unknown): keyof typeof Ionicons.glyphMap {
  return typeof value === 'string' && value in Ionicons.glyphMap
    ? value as keyof typeof Ionicons.glyphMap
    : 'notifications-outline'
}

function isNotificationType(value: unknown): value is NotificationType {
  return value === 'enrollment' || value === 'student_activity' || value === 'achievement' || value === 'new_class' || value === 'announcement'
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function mergeById(current: AppNotification[], next: AppNotification[]) {
  const seen = new Set(current.map((item) => item.id))
  return [...current, ...next.filter((item) => !seen.has(item.id))]
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
