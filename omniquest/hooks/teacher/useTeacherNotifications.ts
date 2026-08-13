import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import type { AppNotification, NotificationCursor, NotificationType } from '../../lib/notifications/types'
import { deletePersistentNotifications, markAllPersistentNotificationsRead, markPersistentNotificationsRead } from '../../lib/notifications/persistent'
import { supabase } from '../../lib/supabase'
import { getErrorMessage, isRecord } from '../../lib/typeGuards'

export type TeacherNotificationBucket = 'all' | 'critical' | 'informative'
export type TeacherNotificationCategory = 'all' | 'students' | 'review' | 'courses' | 'system' | 'audit'

export type TeacherNotificationSummary = {
  pendingReviews: number
  inactiveStudents: number
  sensitiveActions: number
  unreadNotifications: number
  activeSubjects: number
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

type ResetLoadOptions = { initial?: boolean }

const EMPTY_SUMMARY: TeacherNotificationSummary = { pendingReviews: 0, inactiveStudents: 0, sensitiveActions: 0, unreadNotifications: 0, activeSubjects: 0, mutedUntil: null }
const EMPTY_PAGE: NotificationPage = { rows: [], cursor: null, hasMore: false, total: 0, unreadCount: 0, criticalCount: 0, informativeCount: 0 }
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
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const pageRef = useRef<NotificationPage>(EMPTY_PAGE)
  const loadingMoreRef = useRef(false)
  const initialPageLoadedRef = useRef(false)
  const backgroundRefreshingRef = useRef(false)

  const loadSummary = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('get_teacher_notification_center_summary')
    if (rpcError) throw rpcError
    const payload = isRecord(data) ? data : {}
    setSummary({
      pendingReviews: Number(payload.pending_reviews || 0),
      inactiveStudents: Number(payload.inactive_students || 0),
      sensitiveActions: Number(payload.sensitive_actions || 0),
      unreadNotifications: Number(payload.unread_notifications || 0),
      activeSubjects: Number(payload.active_subjects || 0),
      mutedUntil: typeof payload.muted_until === 'string' ? payload.muted_until : null,
    })
  }, [])

  const loadPage = useCallback(async (mode: 'reset' | 'more' = 'reset', options: ResetLoadOptions = {}) => {
    const currentPage = pageRef.current
    if (mode === 'more' && (!currentPage.hasMore || currentPage.cursor === null || loadingMoreRef.current)) return
    const currentRequest = ++requestId.current
    const showInitialLoading = mode === 'reset' && options.initial === true
    if (showInitialLoading) setLoading(true)
    if (mode === 'more') {
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
      const resolved = mode === 'more' ? { ...next, rows: mergeById(currentPage.rows, next.rows) } : next
      pageRef.current = resolved
      setPage(resolved)
      if (mode === 'reset') initialPageLoadedRef.current = true
    } catch (loadError) {
      if (requestId.current === currentRequest) setError(getErrorMessage(loadError, 'No se pudieron cargar las notificaciones docentes.'))
    } finally {
      if (requestId.current === currentRequest) {
        loadingMoreRef.current = false
        if (showInitialLoading) setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [bucket, category, subjectId, unreadOnly])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadPage('reset'), loadSummary()])
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, 'No se pudo actualizar el centro de notificaciones.'))
    } finally {
      setRefreshing(false)
    }
  }, [loadPage, loadSummary])

  const backgroundRefresh = useCallback(async () => {
    if (backgroundRefreshingRef.current) return
    backgroundRefreshingRef.current = true
    setBackgroundRefreshing(true)
    try {
      await Promise.all([loadPage('reset'), loadSummary()])
    } catch {

    } finally {
      backgroundRefreshingRef.current = false
      setBackgroundRefreshing(false)
    }
  }, [loadPage, loadSummary])

  useEffect(() => {
    void loadPage('reset', { initial: !initialPageLoadedRef.current })
  }, [loadPage])

  useEffect(() => {
    void loadSummary().catch((loadError) => setError(getErrorMessage(loadError, 'No se pudo cargar el resumen de notificaciones.')))
  }, [loadSummary])

  const backgroundRefreshRef = useRef(backgroundRefresh)

  useEffect(() => {
    backgroundRefreshRef.current = backgroundRefresh
  }, [backgroundRefresh])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let disposed = false
    const subscriptionId = `${Date.now()}:${Math.random().toString(36).slice(2)}`
    void supabase.auth.getUser().then(({ data }) => {
      if (disposed || !data.user) return
      const nextChannel = supabase
        .channel(`teacher-notification-center:${data.user.id}:${subscriptionId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${data.user.id}` }, (payload: RealtimePostgresInsertPayload<{ audience?: string }>) => {
          if (payload.new.audience === 'teacher') void backgroundRefreshRef.current()
        })
      if (disposed) {
        void supabase.removeChannel(nextChannel)
        return
      }
      channel = nextChannel.subscribe()
    })
    return () => {
      disposed = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  const markAsRead = useCallback(async (notification: AppNotification) => {
    if (notification.isRead) return
    await markPersistentNotificationsRead([notification.id])
    setPage((current) => {
      const rows = unreadOnly ? current.rows.filter((item) => item.id !== notification.id) : current.rows.map((item) => item.id === notification.id ? { ...item, isRead: true } : item)
      const next = { ...current, total: unreadOnly ? Math.max(0, current.total - 1) : current.total, unreadCount: Math.max(0, current.unreadCount - 1), rows }
      pageRef.current = next
      return next
    })
    setSummary((current) => ({ ...current, unreadNotifications: Math.max(0, current.unreadNotifications - 1) }))
    if (unreadOnly) void loadPage('reset')
  }, [loadPage, unreadOnly])

  const markAllAsRead = useCallback(async () => {
    await markAllPersistentNotificationsRead('teacher')
    setPage((current) => {
      const next: NotificationPage = unreadOnly
        ? { ...current, rows: [], cursor: null, hasMore: false, total: 0, unreadCount: 0 }
        : { ...current, unreadCount: 0, rows: current.rows.map((item) => ({ ...item, isRead: true })) }
      pageRef.current = next
      return next
    })
    setSummary((current) => ({ ...current, unreadNotifications: 0 }))
  }, [unreadOnly])

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
    if (!notification.isRead) setSummary((current) => ({ ...current, unreadNotifications: Math.max(0, current.unreadNotifications - 1) }))
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

  const clearError = useCallback(() => setError(null), [])

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
    backgroundRefreshing,
    error,
    clearError,
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
  const payload = isRecord(value) ? value : {}
  const rows = Array.isArray(payload.rows) ? payload.rows.map(mapNotification).filter(Boolean) as AppNotification[] : []
  return {
    rows,
    cursor: typeof payload.next_cursor_created_at === 'string' && typeof payload.next_cursor_id === 'string' ? { createdAt: payload.next_cursor_created_at, id: payload.next_cursor_id } : null,
    hasMore: payload.has_more === true,
    total: Number(payload.total || 0),
    unreadCount: Number(payload.unread_count || 0),
    criticalCount: Number(payload.critical_count || 0),
    informativeCount: Number(payload.informative_count || 0),
  }
}

function mapNotification(value: unknown): AppNotification | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  const metadata = isRecord(value.metadata) ? value.metadata : {}
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
  return typeof value === 'string' && value in Ionicons.glyphMap ? value as keyof typeof Ionicons.glyphMap : 'notifications-outline'
}

function isNotificationType(value: unknown): value is NotificationType {
  return value === 'enrollment' || value === 'student_activity' || value === 'achievement' || value === 'new_class' || value === 'announcement'
}

function mergeById(current: AppNotification[], next: AppNotification[]) {
  const seen = new Set(current.map((item) => item.id))
  return [...current, ...next.filter((item) => !seen.has(item.id))]
}
