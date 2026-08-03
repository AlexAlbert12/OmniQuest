export type StudentProgressSubject = {
  id: number
  classroomId: number | null
  classroomName: string | null
  classroomCode: string | null
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
  totalTopics: number
  completedTopics: number
  totalQuestions: number
  answeredQuestions: number
  pendingQuestions: number
  failedQuestions: number
  percent: number
  isCompleted: boolean
}

export type StudentProgressSummary = {
  subjects: StudentProgressSubject[]
  totalClasses: number
  completedClasses: number
  totalQuestions: number
  answeredQuestions: number
  totalAttempts: number
  correctAttempts: number
  accuracyPercent: number
  overallPercent: number
}
