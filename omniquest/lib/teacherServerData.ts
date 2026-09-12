import { supabase } from './supabase'

export type TeacherCourseAnalytics = {
  enrolledCount: number
  activeStudentsCount: number
  playedCount: number
  answeredQuestionsCount: number
  availableQuestionsCount: number
  averageScore: number
  questionsCount: number
  topicsCount: number
  enrolledThisWeek: number
  activeStudentsThisWeek: number
  playedThisWeek: number
  questionsThisWeek: number
}

export type TeacherCourseRow = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  themeColor: string | null
  createdAt: string | null
  active: boolean
  isArchived: boolean
  archivedAt: string | null
  archiveReason: string | null
  retentionUntil: string | null
  status: 'unconfigured' | 'no_activity' | 'in_progress' | 'completed'
  analytics: TeacherCourseAnalytics
}

export type TeacherClassroomRow = {
  classroom: {
    id: number
    subjectId: number
    name: string
    code: string | null
    academicYear: string | null
    createdAt: string | null
    active: boolean
  }
  course: {
    id: number
    name: string
    description: string | null
    icon: string | null
    code: string
    themeColor: string | null
    createdAt: string | null
  }
  analytics: {
    studentsCount: number
    questionsCount: number
    topicsCount: number
  }
}

export type TeacherDashboardSummary = {
  teacherAlias: string
  totals: {
    courses: number
    classrooms: number
    students: number
    questions: number
    attempts: number
    weeklyActiveStudents: number
  }
  openReviewCount: number
  emptyCourses: { id: number; name: string }[]
  recentCourses: Array<{
    id: number
    name: string
    description: string | null
    icon: string | null
    code: string
    themeColor: string | null
    enrolledCount: number
    playedCount: number
    averageScore: number
    questionsCount: number
    classroomCount: number
  }>
  problematicQuestions: Array<{
    id: number
    subjectId: number
    subjectName: string
    text: string
    failures: number
    totalAttempts: number
    failureRate: number
  }>
}

export type TeacherAttentionStudent = {
  id: string
  studentId: string
  studentName: string
  subjectId: number
  subjectName: string
  classroomId: number | null
  classroomName: string | null
  lastActivity: string | null
  daysInactive: number
  accuracyPercent: number
  reason: 'no_activity' | 'needs_help' | 'inactive'
}

export type TeacherRecentActivity = {
  id: string
  type: 'enrollment' | 'attempt'
  eventAt: string
  studentId: string
  studentName: string
  subjectId: number
  subjectName: string
  classroomId: number | null
  classroomName: string | null
  questionId: number | null
  questionText: string | null
  isCorrect: boolean | null
  earnedPoints: number | null
}

export type PagedPayload<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
}

export type TeacherCoursesPayload = PagedPayload<TeacherCourseRow> & {
  summary: {
    courses: number
    archivedCourses: number
    students: number
    activeStudents: number
    questions: number
    played: number
    answeredQuestions: number
    availableQuestions: number
    weightedScore: number
    enrolledThisWeek: number
    activeStudentsThisWeek: number
    playedThisWeek: number
    questionsThisWeek: number
  }
}

export type TeacherClassroomsPayload = PagedPayload<TeacherClassroomRow> & {
  summary: { classrooms: number; courses: number }
}

export type TeacherSubject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  educationLevel: string | null
  academicYear: string | null
  subjectLabel: string | null
  themeColor: string | null
  createdAt: string | null
}

export type TeacherSubjectClassroom = {
  id: number
  name: string
  academicYear: string | null
  active: boolean
  code: string | null
}

export type TeacherSubjectOverview = {
  subject: TeacherSubject
  classrooms: TeacherSubjectClassroom[]
  selectedClassroomId: number
  subjectsCount: number
  summary: {
    enrolledCount: number
    questionsCount: number
    totalAnswers: number
    correctAnswers: number
    answeredClassQuestions: number
    possibleClassQuestions: number
    activeStudents: number
    evaluatedStudents: number
    unassessedStudents: number
    averageXp: number
    averageAccuracy: number
    averageGrade: number
    participation: number
    progress: number
  }
  latestQuestion: { id: number; text: string; createdAt: string } | null
  gradeDistribution: Array<{ label: string; count: number }>
  recentActivity: Array<{
    id: number
    studentName: string
    questionText: string
    isCorrect: boolean
    earnedPoints: number
    attemptedAt: string
  }>
}

export type TeacherSubjectTopic = {
  id: number | 'general'
  title: string
  description: string | null
  icon: string | null
  sortOrder: number
  availableUntil: string | null
  questionsCount: number
  playedCount: number
  averageScore: number
}

export type TeacherSubjectQuestion = {
  id: number
  text: string
  type: string
  points_base: number | null
  time_limit_seconds: number | null
  difficulty: number | null
  explanation: string | null
  topic_id: number | null
  classroom_id: number | null
  created_at: string | null
  updated_at: string | null
  media_type: string | null
  media_path: string | null
  media_alt_text: string | null
  media_caption: string | null
  topicTitle: string | null
  answers: Array<{ id: number; text: string; is_correct: boolean; sort_order: number }>
}

export type TeacherSubjectStudent = {
  id: string
  name: string
  avatar: string | null
  score: number
  grade: number
  accuracyPercent: number
  correctAnswers: number
  failedAnswers: number
  participation: number
  playedSessions: number
  lastActivity: string | null
  hasActivity: boolean
  status: 'active' | 'inactive' | 'needs_help' | 'no_activity'
}

export type TeacherSubjectStudentsPayload = PagedPayload<TeacherSubjectStudent> & {
  summary: {
    enrolled: number
    answered: number
    participation: number
    averageGrade: number
    averageAccuracy: number
    failedAnswers: number
    correctAnswers: number
    averageXp: number
    questionsCount: number
    activeThisWeek: number
    unassessed: number
    generatedXp: number
    playedSessionsTotal: number
    bestStudent: TeacherSubjectStudent | null
    attention: TeacherSubjectStudent[]
  }
  gradeDistribution: Array<{ label: string; count: number }>
}

export type TeacherSubjectAnalyticsPayload = TeacherSubjectStudentsPayload & {
  failedQuestions: Array<{
    id: number
    text: string
    topic: string
    actualFailures: number
    totalAttempts: number
    failureRate: number
  }>
  temporalEvolution: Array<{
    label: string
    activityCount: number
    averageScore: number
  }>
}

export async function callTeacherRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = supabase as unknown as {
    rpc: (functionName: string, parameters?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>
  }
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(error.message || `No se pudo ejecutar ${name}`)
  if (data == null) throw new Error(`La operación ${name} no devolvió datos`)
  return data as T
}

export type TeacherTopicSummaryPayload = {
  topic: {
    id: number
    subjectId: number
    classroomId: number | null
    title: string
    description: string | null
    icon: string | null
    sortOrder: number | null
    active: boolean
    availableUntil: string | null
    createdAt: string | null
    visibility: 'visible' | 'archived'
    availability: 'unlimited' | 'scheduled' | 'closed' | 'archived'
  }
  subject: {
    id: number
    name: string
    description: string | null
    icon: string | null
    code: string
    themeColor: string | null
  }
  classroom: { id: number; name: string | null } | null
  summary: {
    questionsCount: number
    visibleQuestionsCount: number
    archivedQuestionsCount: number
    averageDifficulty: number
    attemptsCount: number
    averageXp: number
    enrolledStudents: number
    participatingStudents: number
    participation: number
    lastActivityAt: string | null
  }
  subjectsCount: number
}

export type TeacherTopicQuestion = {
  id: number
  subjectId: number
  classroomId: number | null
  topicId: number
  type: string
  text: string
  pointsBase: number | null
  timeLimitSeconds: number | null
  difficulty: number | null
  explanation: string | null
  active: boolean
  createdAt: string | null
  updatedAt: string | null
  mediaType: string | null
  mediaPath: string | null
  answersCount: number
  correctAnswer: string | null
  attemptsCount: number
  accuracyPercent: number | null
}

export type TeacherStudentsPageSummary = {
  total: number
  active: number
  noActivity: number
  needsHelp: number
  inactive: number
  excellent: number
  attention: number
  withActivity: number
  averageXp: number
  averageGrade: number
  averageAccuracy: number
  completedChallenges: number
}

export type TeacherStudentsPagePayload<TStudent> = PagedPayload<TStudent> & {
  summary: TeacherStudentsPageSummary
  subjects: Array<{ id: number; name: string }>
  classrooms: Array<{ id: number; subject_id: number; name: string; academic_year: string | null }>
  attention: TStudent[]
  pending: TStudent[]
}

export type TeacherStudentHistoryNote = {
  id: number
  body: string
  subjectId: number | null
  classroomId: number | null
  createdAt: string
  updatedAt: string
}

export type TeacherStudentHistorySummaryPayload = {
  profile: {
    id: string
    alias: string
    avatar: string | null
    points: number | null
    active: boolean | null
    createdAt: string | null
  }
  subjectsCount: number
  courseContexts: Array<{
    enrollmentId: number
    subjectId: number
    subjectName: string
    classroomId: number | null
    classroomName: string
    classroomCode: string | null
    academicYear: string | null
    joinedAt: string | null
  }>
  summary: {
    periodDays: number
    attempts: number
    evaluatedAttempts: number
    pendingEvaluation: number
    correct: number
    accuracyPercent: number | null
    earnedXp: number
    lastActivityAt: string | null
    pendingReviews: number
    answeredQuestions: number
    availableQuestions: number
    coveragePercent: number | null
  }
  comparison: {
    current: { attempts: number; evaluatedAttempts: number; accuracyPercent: number | null; earnedXp: number }
    previous: { attempts: number; evaluatedAttempts: number; accuracyPercent: number | null; earnedXp: number }
    delta: { attempts: number; accuracyPoints: number; earnedXp: number }
  }
  recommendation: {
    code: 'start' | 'review' | 'practice' | 'reengage' | 'challenge'
    title: string
    reason: string
    actionLabel: string
    subjectId: number | null
    classroomId: number | null
    topicId: number | null
  }
  notes: TeacherStudentHistoryNote[]
  notesTotal: number
}

export type TeacherStudentHistoryTimelineItem = {
  id: number
  question_id: number
  question_text: string
  question_type: string
  subject_id: number
  subject_name: string
  classroom_id: number | null
  classroom_name: string
  topic_id: number | null
  topic_title: string
  answer_text: string
  is_correct: boolean
  earned_points: number
  time_taken_seconds: number | null
  hint_used: boolean
  was_skipped: boolean
  attempted_at: string
  manual_review_status: string
  reviewed_at: string | null
  review_notes: string | null
  difficulty: number | null
  comments_count: number
}

export type TeacherStudentHistoryWeakness = {
  subject_id: number
  subject_name: string
  topic_id: number | null
  topic_title: string
  attempts: number
  mistakes: number
  accuracy_percent: number
  last_attempt_at: string | null
}

export type TeacherStudentHistoryReview = {
  id: number
  question_id: number
  question_text: string
  subject_id: number
  classroom_id: number | null
  subject_name: string
  topic_title: string
  answer_text: string | null
  status: string
  reviewed_at: string | null
  review_notes: string | null
  attempted_at: string
  comments_count: number
}

export type TeacherStudentHistoryMetricsPayload = {
  periodDays: number
  evolution: Array<{
    date: string
    attempts: number
    evaluated: number
    pending: number
    correct: number
    accuracyPercent: number | null
    earnedXp: number
  }>
  topics: Array<{
    subject_id: number
    subject_name: string
    topic_id: number | null
    topic_title: string
    attempts: number
    evaluated: number
    pending: number
    correct: number
    accuracy_percent: number | null
    earned_xp: number
    last_activity_at: string | null
  }>
}
