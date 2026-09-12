import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../supabase'
import {
  isJwtIssuedInFutureError,
  retrySupabaseRequestAfterJwtRecovery,
} from '../supabaseJwtRecovery'
import type { Json, Tables } from '../../types/database.types'
import type {
  AppNotification,
  NotificationAudience,
  NotificationCursor,
  NotificationType,
} from './types'

type PersistentNotificationRow = Tables<'notifications'>
type NotificationStateRow = Pick<Tables<'notification_state'>, 'notification_id' | 'is_read' | 'is_deleted'>

type NotificationPagePayload = {
  rows?: unknown
  has_more?: unknown
  next_cursor_created_at?: unknown
  next_cursor_id?: unknown
  total?: unknown
  unread_count?: unknown
}

export type PersistentNotificationSource = {
  notifications: AppNotification[]
  available: boolean
}

export type PersistentNotificationPage = PersistentNotificationSource & {
  cursor: NotificationCursor | null
  hasMore: boolean
  total: number
  unreadCount: number
}

export async function fetchPersistentNotificationPage({
  userId,
  audience,
  cursor = null,
  pageSize = 20,
}: {
  userId: string
  audience: NotificationAudience
  cursor?: NotificationCursor | null
  pageSize?: number
}): Promise<PersistentNotificationPage> {
  const safePageSize = Math.min(Math.max(pageSize, 1), 50)

  try {
    const { data, error } = await retrySupabaseRequestAfterJwtRecovery(() => (
      supabase.rpc('get_notifications_page', {
        p_audience: audience,
        p_limit: safePageSize,
        p_cursor_created_at: cursor?.createdAt,
        p_cursor_id: cursor?.id,
      })
    ))

    if (error) {
      if (isMissingNotificationRpcError(error)) return emptyPersistentPage(false)
      throw error
    }

    const payload = data && typeof data === 'object' && !Array.isArray(data)
      ? data as NotificationPagePayload
      : {}
    const rows = Array.isArray(payload.rows) ? payload.rows : []

    return {
      notifications: rows.map(mapPersistentRow).filter((row): row is AppNotification => Boolean(row)),
      available: true,
      hasMore: payload.has_more === true,
      cursor: typeof payload.next_cursor_created_at === 'string' && typeof payload.next_cursor_id === 'string'
        ? { createdAt: payload.next_cursor_created_at, id: payload.next_cursor_id }
        : null,
      total: Math.max(0, Number(payload.total || 0)),
      unreadCount: Math.max(0, Number(payload.unread_count || 0)),
    }
  } catch (error: any) {
    if (isMissingNotificationTableError(error)) {
      return emptyPersistentPage(false)
    }

    if (!isJwtIssuedInFutureError(error)) {
      console.error('Error cargando notificaciones persistentes:', error)
    }
    throw error
  }
}

export async function fetchPersistentNotificationSource({
  userId,
  audience,
}: {
  userId: string
  audience: NotificationAudience
}): Promise<PersistentNotificationSource> {
  const page = await fetchPersistentNotificationPage({ userId, audience, pageSize: 50 })
  return { notifications: page.notifications, available: page.available }
}

export async function fetchPersistentNotifications({
  userId,
  audience,
}: {
  userId: string
  audience: NotificationAudience
}): Promise<AppNotification[]> {
  const result = await fetchPersistentNotificationSource({ userId, audience })
  return result.notifications
}

export function shouldLoadDerivedNotifications(persistentSourceAvailable: boolean) {
  return !persistentSourceAvailable || isDerivedNotificationsFeatureEnabled()
}

export function isDerivedNotificationsFeatureEnabled() {
  const value = String(process.env.EXPO_PUBLIC_ENABLE_DERIVED_NOTIFICATIONS || '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

export function mergeNotificationSources(persistent: AppNotification[], derived: AppNotification[]) {
  const seen = new Set<string>()

  return [...persistent, ...derived.map((notification) => ({ ...notification, source: 'derived' as const }))]
    .filter((notification) => {
      const key = [notification.type, notification.title, notification.description, notification.actionUrl || ''].join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp))
}

export function getDatabaseNotificationId(id: string) {
  return id.startsWith('db:') ? id.slice(3) : null
}

export async function markPersistentNotificationsRead(ids: string[]) {
  const uniqueIds = uniqueDatabaseIds(ids)
  if (uniqueIds.length === 0) return 0

  const { data, error } = await supabase.rpc('mark_notifications_read', { p_ids: uniqueIds })
  if (!error) return Number(data || 0)
  if (!isMissingNotificationRpcError(error)) throw error

  throw missingNotificationApiError(error)
}

export async function markAllPersistentNotificationsRead(audience: NotificationAudience) {
  const { data, error } = await supabase.rpc('mark_all_notifications_read', { p_audience: audience })
  if (!error) return Number(data || 0)
  if (!isMissingNotificationRpcError(error)) throw error

  throw missingNotificationApiError(error)
}

export async function deletePersistentNotifications(ids: string[]) {
  const uniqueIds = uniqueDatabaseIds(ids)
  if (uniqueIds.length === 0) return 0

  const { data, error } = await supabase.rpc('delete_notifications', { p_ids: uniqueIds })
  if (!error) return Number(data || 0)
  if (!isMissingNotificationRpcError(error)) throw error

  throw missingNotificationApiError(error)
}

export async function updatePersistentNotificationState(id: string, state: { read?: boolean; deleted?: boolean }) {
  if (state.deleted) {
    await deletePersistentNotifications([id])
    return
  }
  if (state.read) {
    await markPersistentNotificationsRead([id])
  }
}

export async function loadNotificationStateFromDB(userId: string): Promise<{ read: Set<string>; deleted: Set<string> }> {
  try {
    const { data, error } = await retrySupabaseRequestAfterJwtRecovery(() => (
      supabase
        .from('notification_state')
        .select('notification_id, is_read, is_deleted')
        .eq('user_id', userId)
    ))

    if (error) throw error

    const read = new Set<string>()
    const deleted = new Set<string>()

    ;(data as NotificationStateRow[] | null)?.forEach((row) => {
      if (row.is_read) read.add(row.notification_id)
      if (row.is_deleted) deleted.add(row.notification_id)
    })

    return { read, deleted }
  } catch (error: any) {
    if (isMissingNotificationTableError(error)) {
      return { read: new Set(), deleted: new Set() }
    }

    if (!isJwtIssuedInFutureError(error)) {
      console.error('Error loading notification state from DB:', error)
    }
    throw error
  }
}

export async function persistNotificationStateToDb(
  userId: string,
  notificationId: string,
  state: { isRead: boolean; isDeleted: boolean }
) {
  try {
    const now = new Date().toISOString()
    const { data: existingRows, error: selectError } = await supabase
      .from('notification_state')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_id', notificationId)
      .limit(1)

    if (selectError) throw selectError

    const existingId = existingRows?.[0]?.id

    if (typeof existingId === 'number') {
      const { error: updateError } = await supabase
        .from('notification_state')
        .update({
          is_read: state.isRead,
          is_deleted: state.isDeleted,
          updated_at: now,
        })
        .eq('id', existingId)

      if (updateError) throw updateError
      return
    }

    const { error: insertError } = await supabase
      .from('notification_state')
      .insert({
        user_id: userId,
        notification_id: notificationId,
        is_read: state.isRead,
        is_deleted: state.isDeleted,
        updated_at: now,
      })

    if (insertError) throw insertError
  } catch (error: any) {
    if (isMissingNotificationTableError(error)) return

    console.error('Error persisting notification state to DB:', error)
    throw error
  }
}

function mapPersistentRow(value: unknown): AppNotification | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Partial<PersistentNotificationRow>
  if (!row.id || !row.title || !row.description || !row.type || !isNotificationType(row.type)) return null

  const metadata = getNotificationMetadata(row.metadata ?? null)
  const type = row.type

  return {
    id: `db:${row.id}`,
    type,
    title: row.title,
    description: row.description,
    icon: getSafeNotificationIcon(row.icon),
    color: row.color || getNotificationTypeColor(type),
    timestamp: row.created_at || new Date().toISOString(),
    isRead: Boolean(row.read_at),
    relatedId: row.related_id && /^\d+$/.test(row.related_id) ? Number(row.related_id) : undefined,
    subjectName: typeof metadata.subject_name === 'string' ? metadata.subject_name : undefined,
    studentName: typeof metadata.student_name === 'string' ? metadata.student_name : undefined,
    actionUrl: row.action_url || undefined,
    source: 'database',
  }
}

function emptyPersistentPage(available: boolean): PersistentNotificationPage {
  return {
    notifications: [],
    available,
    cursor: null,
    hasMore: false,
    total: 0,
    unreadCount: 0,
  }
}

function uniqueDatabaseIds(ids: string[]) {
  return [...new Set(ids.map((id) => getDatabaseNotificationId(id) || id).filter(isUuid))]
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function getNotificationMetadata(value: Json | null): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function isNotificationType(value: string): value is NotificationType {
  return ['enrollment', 'student_activity', 'achievement', 'new_class', 'announcement', 'manual_review'].includes(value)
}

function getSafeNotificationIcon(icon: string | null | undefined): keyof typeof Ionicons.glyphMap {
  if (icon && icon in Ionicons.glyphMap) return icon as keyof typeof Ionicons.glyphMap
  return 'notifications-outline'
}

function getNotificationTypeColor(type: NotificationType) {
  if (type === 'enrollment') return '#8B5CF6'
  if (type === 'student_activity') return '#43D991'
  if (type === 'achievement') return '#F6A64A'
  if (type === 'new_class') return '#58B5FF'
  if (type === 'manual_review') return '#A78BFA'
  return '#F97316'
}

function isMissingNotificationRpcError(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === 'PGRST202' || code === '42883' || message.includes('function') && message.includes('does not exist')
}

function missingNotificationApiError(error: unknown) {
  const failure = new Error('La API protegida de notificaciones no está disponible. Aplica las migraciones pendientes antes de continuar.')
  ;(failure as Error & { cause?: unknown }).cause = error
  return failure
}

function isMissingNotificationTableError(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  const details = String(error?.details || '').toLowerCase()

  return code === '42P01'
    || code === 'PGRST200'
    || code === 'PGRST204'
    || code === 'PGRST205'
    || message.includes('could not find')
    || message.includes('schema cache')
    || details.includes('could not find')
    || details.includes('schema cache')
}

function toTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
