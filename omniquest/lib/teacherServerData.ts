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
