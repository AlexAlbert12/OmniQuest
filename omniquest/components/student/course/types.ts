import type { DifficultyLevel } from '../../../lib/difficulty'

export type StudentCourseSubject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
}

export type StudentCourseClassroom = {
  id: number
  name: string
  code: string | null
  academic_year: string | null
}

export type DifficultyTopicStats = {
  difficulty: DifficultyLevel
  questionsCount: number
  answeredQuestions: number
  failedQuestions: number
  lastAttemptAt: string | null
}

export type StudentCourseTopic = {
  id: number | 'general'
  title: string
  description: string | null
  icon: string | null
  sort_order: number
  availableUntil: string | null
  questionsCount: number
  answeredQuestions: number
  failedQuestions: number
  lastAttemptAt: string | null
  bestScore?: number
  difficulties: DifficultyTopicStats[]
}

export type StudentCourseRecentAttempt = {
  id: string
  evaluationState: 'pending' | 'needs_changes' | 'correct' | 'incorrect'
  questionText: string
  topicTitle: string
  attemptedAt: string
}

export type StudentCourseFailedQuestion = {
  id: number
  text: string
  topicTitle: string
}

export type StudentCourseRankingItem = {
  studentId: string
  alias: string
  avatar: string | null
  points: number
}

export type StudentCourseTotals = {
  questions: number
  answered: number
  failed: number
  average: number
  earnedXp: number
  progress: number
}
