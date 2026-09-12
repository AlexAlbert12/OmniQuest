export type QuestionReportPeriod = 'all' | '7d' | '30d' | '90d'

export type TeacherQuestionReportQuestion = {
  id: number
  text: string
  type: string
  subjectId: number
  classroomId: number | null
  topicId: number | null
  explanation: string | null
  mediaType: 'image' | 'audio' | 'video' | null
  mediaPath: string | null
  mediaAltText: string | null
  mediaCaption: string | null
  pointsBase: number | null
  timeLimitSeconds: number | null
  difficulty: number | null
  active: boolean | null
  subjectName: string
  classroomName: string | null
  topicName: string | null
}

export type TeacherQuestionReportSummary = {
  totalAttempts: number
  correctAttempts: number
  failedAttempts: number
  evaluatedAttempts: number
  pendingAttempts: number
  sampleSize: number
  lowSample: boolean
  abandonmentPercent: number
  averageTimeSeconds: number | null
  discrimination: number | null
  failureTrendPoints: number
}

export type AnswerDistributionPoint = {
  label: string
  count: number
  correct: boolean
  percent: number
}

export type ClassroomComparisonPoint = {
  classroom_id: number
  classroom_name: string
  attempts: number
  correct: number
  failed: number
  evaluated: number
  pending: number
  failure_percent: number
  average_time_seconds: number | null
}

export type TemporalTrendPoint = {
  day: string
  attempts: number
  failure_percent: number
  average_time_seconds: number | null
}

export type QuestionReportClassOption = { id: number; name: string }

export type TeacherQuestionReport = {
  question: TeacherQuestionReportQuestion
  summary: TeacherQuestionReportSummary
  answerDistribution: AnswerDistributionPoint[]
  classComparison: ClassroomComparisonPoint[]
  temporalTrend: TemporalTrendPoint[]
  classOptions: QuestionReportClassOption[]
}

export type AffectedStudent = {
  student_id: string
  alias: string
  avatar: string | null
  failures: number
  attempts: number
  average_time_seconds: number | null
  last_attempt_at: string | null
  classroom_name: string
}

export type AffectedStudentsPage = {
  items: AffectedStudent[]
  total: number
}
