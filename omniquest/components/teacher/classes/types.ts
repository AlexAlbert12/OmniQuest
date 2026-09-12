export type TeacherCourse = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  theme_color: string | null
  created_at?: string | null
  active?: boolean
  is_archived?: boolean
  archived_at?: string | null
  archive_reason?: string | null
  retention_until?: string | null
}

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

export type TeacherClassroom = {
  id: number
  subject_id: number | null
  name: string
  code: string | null
  academic_year: string | null
  created_at?: string | null
  active?: boolean | null
}

export type TeacherClassroomAnalytics = {
  studentsCount: number
  questionsCount: number
  topicsCount: number
}

export const emptyTeacherCourseAnalytics: TeacherCourseAnalytics = {
  enrolledCount: 0,
  activeStudentsCount: 0,
  playedCount: 0,
  answeredQuestionsCount: 0,
  availableQuestionsCount: 0,
  averageScore: 0,
  questionsCount: 0,
  topicsCount: 0,
  enrolledThisWeek: 0,
  activeStudentsThisWeek: 0,
  playedThisWeek: 0,
  questionsThisWeek: 0,
}
