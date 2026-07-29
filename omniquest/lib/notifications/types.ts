import { Ionicons } from '@expo/vector-icons'

export type NotificationType = 'enrollment' | 'student_activity' | 'achievement' | 'new_class' | 'announcement'
export type NotificationAudience = 'teacher' | 'student'

export type NotificationCursor = {
  createdAt: string
  id: string
}

export type AppNotification = {
  id: string
  type: NotificationType
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  timestamp: string
  isRead: boolean
  relatedId?: number
  subjectName?: string
  studentName?: string
  actionUrl?: string
  source?: 'database' | 'derived'
}

export type AudienceState = {
  notifications: AppNotification[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  total: number
  unreadCount: number
  cursor: NotificationCursor | null
}

export type NotificationPreferenceState = {
  activityEnabled: boolean
  newsEnabled: boolean
}

export type SubjectRow = {
  id: number
  name: string
  created_at?: string | null
}

export type EnrollmentRow = {
  subject_id: number | null
  student_id: string | null
  joined_at?: string | null
}

export type SubjectScoreRow = {
  subject_id: number | null
  student_id: string | null
  max_score: number | null
  correct_answers?: number | null
  played_days?: string[] | null
  played_at?: string | null
}

export type StudentBadgeAwardRow = {
  badge_id: string | null
  awarded_at: string | null
  reward_xp: number | null
}

export type QuestionRow = {
  subject_id: number | null
  created_at?: string | null
}

export type ProfileRow = {
  id: string
  alias: string | null
}

export type NotificationBuildState = {
  readIds: Set<string>
  deletedIds: Set<string>
}
