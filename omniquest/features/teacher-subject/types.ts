import type { IconName } from '../../components/teacher/subject/SubjectShared'

export type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  education_level?: string | null
  academic_year?: string | null
  subject_label?: string | null
  theme_color: string | null
  created_at?: string | null
}

export type Question = {
  id: number
  active: boolean
  text: string
  type?: string
  points_base: number | null
  time_limit_seconds?: number | null
  difficulty?: number | null
  explanation?: string | null
  topic_id: number | null
  classroom_id?: number | null
  created_at?: string | null
  updated_at?: string | null
  answers?: { id?: number; text: string; is_correct: boolean; sort_order?: number }[]
}

export type Topic = {
  id: number
  classroom_id?: number | null
  title: string
  description: string | null
  icon: string | null
  sort_order: number | null
  available_until?: string | null
}

export type Classroom = {
  id: number
  name: string
  academic_year: string | null
  active: boolean | null
  code?: string | null
}

export type ActivityItem = {
  icon: IconName
  color: string
  title: string
  detail: string
  meta: string
  time: string
  warning: boolean
}

export type FailedQuestionReport = {
  id: number
  text: string
  topic: string
  actualFailures: number
  totalAttempts: number
  failureRate: number
}

export type TopicRow = {
  id: number | 'general'
  active: boolean
  title: string
  description: string | null
  icon: string | null
  availableUntil: string | null
  questionsCount: number
  playedCount: number
  averageScore: number
}

export type SubjectTabKey = 'summary' | 'topics' | 'questions' | 'students' | 'analytics'

export const teacherSubjectTabItems: { key: SubjectTabKey; label: string; icon: IconName }[] = [
  { key: 'summary', label: 'Resumen', icon: 'document-text-outline' },
  { key: 'topics', label: 'Temas', icon: 'albums-outline' },
  { key: 'questions', label: 'Preguntas', icon: 'help-circle-outline' },
  { key: 'students', label: 'Alumnos', icon: 'people-outline' },
  { key: 'analytics', label: 'Analítica', icon: 'bar-chart-outline' },
]
