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
  pendingReviewQuestions?: number
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
  evaluatedAttempts: number
  pendingReviewAttempts: number
  accuracyPercent: number
  overallPercent: number
}


export type StudentRecentGame = {
  id: string
  subjectId: number
  subjectName: string
  classroomId: number | null
  classroomName: string | null
  topicId: number | null
  topicName: string | null
  difficulty: number | null
  startedAt: string
  finishedAt: string | null
  totalScore: number
  questionsTotal: number
  evaluatedTotal: number
  correctTotal: number
  incorrectTotal: number
  pendingTotal: number
  durationSeconds: number | null
}
