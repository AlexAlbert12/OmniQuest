import { supabase } from '../supabase'
import type { Tables } from '../../types/database.types'
import type { AppNotification, NotificationPreferenceState } from './types'

type NotificationPreferenceRow = Tables<'user_notification_preferences'>

export const defaultNotificationPreferences: NotificationPreferenceState = {
  activityEnabled: true,
  newsEnabled: false,
}

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferenceState> {
  try {
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('activity_enabled, news_enabled')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    const preferences = data as Pick<NotificationPreferenceRow, 'activity_enabled' | 'news_enabled'> | null

    return {
      activityEnabled: preferences?.activity_enabled ?? defaultNotificationPreferences.activityEnabled,
      newsEnabled: preferences?.news_enabled ?? defaultNotificationPreferences.newsEnabled,
    }
  } catch (error) {
    console.error('Error cargando preferencias de notificaciones:', error)
    return defaultNotificationPreferences
  }
}

export function filterNotificationsByPreferences(
  notifications: AppNotification[],
  preferences: NotificationPreferenceState
) {
  return notifications.filter((notification) => shouldShowNotificationForPreferences(notification, preferences))
}

export function shouldShowNotificationForPreferences(
  notification: AppNotification,
  preferences: NotificationPreferenceState
) {
  const category = getNotificationPreferenceCategory(notification)

  if (category === 'activity') return preferences.activityEnabled
  if (category === 'news') return preferences.newsEnabled

  return true
}

function getNotificationPreferenceCategory(notification: AppNotification): 'activity' | 'news' | 'system' {
  if (notification.type === 'announcement') return 'news'
  if (['enrollment', 'student_activity', 'achievement', 'new_class'].includes(notification.type)) return 'activity'
  return 'system'
}
