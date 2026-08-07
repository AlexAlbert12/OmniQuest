import type { Ionicons } from '@expo/vector-icons'
import type { StudentProgressSubject, StudentProgressSummary } from '../../../lib/studentProgress'

export type StudentHomeSubject = {
  id: number
  classroom_id: number | null
  classroom_name: string | null
  classroom_code: string | null
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
}

export type StudentHomeProfile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
  role_id?: string | null
  visibility?: string | null
}

export type StudentHomeRankingProfile = {
  id: string
  alias: string | null
  avatar: string | null
  points: number | null
}

export type StudentHomeRankingPreviewRow = StudentHomeRankingProfile & {
  position: number
  estimated: boolean
}

export type StudentHomeAction = {
  title: string
  description: string
  buttonLabel: string
  icon: keyof typeof Ionicons.glyphMap
  href: unknown
  tone: 'review' | 'continue' | 'start' | 'explore'
}

export type StudentHomeSubjectRow = {
  subject: StudentHomeSubject
  progress?: StudentProgressSubject
}

export type StudentHomeAchievementPreview = {
  id: string
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  current: number
  target: number
  unlocked: boolean
  colorRole: 'xp' | 'streak' | 'success' | 'info'
}

export type StudentHomeRankingSummary = {
  position: number
  total: number
  points: number
  leaderAlias: string
  leaderPoints: number
  estimated: boolean
}

export type StudentHomeViewModel = {
  profile: StudentHomeProfile | null
  subjects: StudentHomeSubject[]
  subjectRows: StudentHomeSubjectRow[]
  progressSummary: StudentProgressSummary | null
  ranking: StudentHomeRankingProfile[]
  rankingSummary: StudentHomeRankingSummary | null
  rankingPreview: StudentHomeRankingPreviewRow[]
  achievements: StudentHomeAchievementPreview[]
  recommendedAction: StudentHomeAction
  continueRow: StudentHomeSubjectRow | null
  currentUserId: string | null
  attemptCount: number
  todayAttemptCount: number
  weeklyAttemptCount: number
  streakDays: number
  failedQuestions: number
  dailyMissionTarget: number
  weeklyGoalTarget: number
}
