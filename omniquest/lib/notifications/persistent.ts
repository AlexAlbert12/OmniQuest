import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../supabase'
import type { Database, Json, Tables } from '../../types/database.types'
import type { AppNotification, NotificationAudience, NotificationType } from './types'

type PersistentNotificationRow = Tables<'notifications'>
type PersistentNotificationUpdate = Database['public']['Tables']['notifications']['Update']

export type PersistentNotificationSource = {
  notifications: AppNotification[]
  available: boolean
}

export async function fetchPersistentNotificationSource({
  userId,
  audience,
}: {
  userId: string
  audience: NotificationAudience
}): Promise<PersistentNotificationSource> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, audience, type, title, description, icon, color, created_at, read_at, action_url, related_id, metadata')
      .eq('user_id', userId)
      .eq('audience', audience)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(60)

    if (error) throw error

    const notifications = ((data || []) as PersistentNotificationRow[])
      .filter((row) => isNotificationType(row.type))
      .map((row) => {
        const type = row.type as NotificationType
        const metadata = getNotificationMetadata(row.metadata)

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
          source: 'database' as const,
        }
      })

    return { notifications, available: true }
  } catch (error: any) {
    if (isMissingNotificationTableError(error)) {
      return { notifications: [], available: false }
    }

    console.error('Error cargando notificaciones persistentes:', error)
    throw error
  }
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
    .slice(0, 60)
}

export function getDatabaseNotificationId(id: string) {
  return id.startsWith('db:') ? id.slice(3) : null
}

export async function updatePersistentNotificationState(id: string, state: { read?: boolean; deleted?: boolean }) {
  const payload: PersistentNotificationUpdate = { updated_at: new Date().toISOString() }

  if (state.read) payload.read_at = new Date().toISOString()
  if (state.deleted) payload.deleted_at = new Date().toISOString()

  const { error } = await supabase
    .from('notifications')
    .update(payload)
    .eq('id', id)

  if (error) throw error
}

export async function loadNotificationStateFromDB(userId: string): Promise<{ read: Set<string>; deleted: Set<string> }> {
  try {
    const { data, error } = await supabase
      .from('notification_state')
      .select('notification_id, is_read, is_deleted')
      .eq('user_id', userId)

    if (error) throw error

    const read = new Set<string>()
    const deleted = new Set<string>()

    data?.forEach((row: any) => {
      if (row.is_read) read.add(row.notification_id)
      if (row.is_deleted) deleted.add(row.notification_id)
    })

    return { read, deleted }
  } catch (error: any) {
    if (isMissingNotificationTableError(error)) {
      return { read: new Set(), deleted: new Set() }
    }

    console.error('Error loading notification state from DB:', error)
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

function getNotificationMetadata(value: Json | null): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function isNotificationType(value: string): value is NotificationType {
  return ['enrollment', 'student_activity', 'achievement', 'new_class', 'announcement'].includes(value)
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
  return '#F97316'
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
