import type { StudentProgressSummary } from '../../lib/studentProgress'
import type {
  StudentHomeProfile,
  StudentHomeRankingProfile,
  StudentHomeSubject,
  StudentHomeViewModel,
} from '../../components/student/home/types'

export type StudentHomeDashboardPayload = {
  currentUserId: string
  profile: StudentHomeProfile
  subjects: StudentHomeSubject[]
  progressSummary: StudentProgressSummary
  ranking: StudentHomeRankingProfile[]
  todayAttemptCount: number
  weeklyAttemptCount: number
  streakDays: number
}

export type StudentHomeState = StudentHomeViewModel & {
  loading: boolean
  refreshing: boolean
  error: string | null
  refresh: () => void
}

export type {
  StudentHomeAchievementPreview,
  StudentHomeAction,
  StudentHomeProfile,
  StudentHomeRankingProfile,
  StudentHomeRankingPreviewRow,
  StudentHomeRankingSummary,
  StudentHomeSubject,
  StudentHomeSubjectRow,
  StudentHomeViewModel,
} from '../../components/student/home/types'
