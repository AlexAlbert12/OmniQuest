import { Ionicons } from '@expo/vector-icons'

export type IconName = keyof typeof Ionicons.glyphMap
export type AppRole = 'student' | 'teacher'
export type PreferenceKey = 'language' | 'timezone' | 'dateFormat' | 'timeFormat' | 'weekStart'
export type NotificationSettingKey = 'push' | 'email' | 'daily' | 'activities' | 'news'
export type NotificationFrequency = 'instant' | 'daily' | 'weekly'
export type TeacherDigestFrequency = 'off' | 'daily' | 'weekly'
export type SettingsMenuSectionKey = | 'general' | 'personal' | 'teaching' | 'profile' | 'preferences' | 'notifications' | 'privacy' | 'data' | 'security' | 'about'
export type SettingsAnchorKey = | 'general' | 'personal' | 'teaching' | 'profile' | 'preferences' | 'notifications' | 'privacy' | 'data' | 'security' | 'about'
export type ProfileVisibility = 'public' | 'private'
export type SettingsMenuVariant = 'side' | 'tabs' | 'chips'

export type UserProfile = {
  id: string
  alias: string | null
  avatar: string | null
  points: number | null
  role_id?: string | null
  visibility?: ProfileVisibility | null
}

export type UserPreferencesState = {
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
  weekStart: string
  hapticsEnabled: boolean
  analyticsEnabled: boolean
}

export type UserPreferencesRow = {
  language: string | null
  timezone: string | null
  date_format: string | null
  time_format: string | null
  week_start: string | null
  haptics_enabled: boolean | null
  analytics_enabled: boolean | null
  analytics_consent_updated_at?: string | null
}

export type NotificationSettingsState = {
  push: boolean
  email: boolean
  daily: boolean
  activities: boolean
  news: boolean
  frequency: NotificationFrequency
}

export type NotificationSettingsRow = {
  push_enabled: boolean | null
  email_enabled: boolean | null
  daily_summary_enabled: boolean | null
  activity_enabled: boolean | null
  news_enabled: boolean | null
  frequency: string | null
}

export type TeacherNotificationSettingsState = {
  reminderEmail: string
  inactiveStudentAlerts: boolean
  openReviewAlerts: boolean
  sensitiveActionAlerts: boolean
  digestFrequency: TeacherDigestFrequency
}

export type TeacherNotificationSettingsRow = {
  teacher_reminder_email: string | null
  teacher_inactive_student_alerts: boolean | null
  teacher_open_review_alerts: boolean | null
  teacher_sensitive_action_alerts: boolean | null
  teacher_digest_frequency: string | null
}
