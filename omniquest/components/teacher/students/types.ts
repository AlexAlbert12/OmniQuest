import { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export type TeacherActionResult = {
  error?: string
  [key: string]: unknown
}

export type Subject = {
  id: number
  name: string
}

export type Classroom = {
  id: number
  subject_id: number | null
  name: string
  academic_year?: string | null
}

export type Enrollment = {
  student_id: string
  subject_id: number
  classroom_id?: number | null
  joined_at?: string | null
}

export type StudentProfile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
}

export type SubjectScore = {
  student_id: string
  subject_id: number
  classroom_id?: number | null
  max_score: number | null
  correct_answers?: number | null
  played_days?: string[] | null
  played_at?: string | null
}

export type QuestionSummary = {
  id: number
  subject_id: number | null
  classroom_id?: number | null
  topic_id?: number | null
  subject_topics?: { title: string | null } | null
}

export type AttemptHistoryRow = {
  id: number
  student_id: string
  question_id: number
  is_correct: boolean
  attempted_at: string | null
  created_at?: string | null
  earned_points?: number | null
  questions?: {
    text: string | null
    subject_id: number | null
    topic_id: number | null
    subject_topics?: { title: string | null } | null
  } | null
}

export type StudentCourseContext = {
  subjectId: number
  subjectName: string
  classroomId: number | null
  classroomName: string
  joinedAt: string | null
}

export type StudentWeakArea = {
  title: string
  detail: string
  mistakes: number
  accuracyPercent: number | null
}

export type StudentRecentAttempt = {
  id: number
  questionText: string
  topicTitle: string
  subjectName: string
  isCorrect: boolean
  manualReviewStatus?: string | null
  attemptedAt: string | null
  earnedPoints: number
}

export type StudentStatus = 'active' | 'inactive' | 'needs_help' | 'no_activity' | 'excellent'
export type StudentStatusFilter = 'all' | 'attention' | StudentStatus
export type StudentSortKey = 'attention' | 'accuracy' | 'xp' | 'last_activity' | 'name'

export type StudentRow = {
  id: string
  alias: string
  avatar: string | null
  handle: string
  globalPoints: number
  subjectScore: number
  averageScore: number
  accuracyPercent: number
  evaluatedAttempts: number
  pendingReviewAttempts: number
  challenges: number
  questions: number
  participation: number
  progress: number
  status: StudentStatus
  hasActivity: boolean
  subjectIds: number[]
  subjectNames: string[]
  classroomIds: number[]
  classroomNames: string[]
  courseContexts: StudentCourseContext[]
  weakAreas: StudentWeakArea[]
  recentAttempts: StudentRecentAttempt[]
  lastActivityAt: string | null
  importedAt: string | null
}

export type ConfirmDialog = {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}

export type MobileStudentsStats = {
  total: number
  active: number
  noActivity: number
  needsHelp: number
  inactive: number
  excellent: number
  attention: number
  withActivity: number
  averageXp: number | null
  averageGrade: number | null
  averageAccuracy: number | null
  completedChallenges: number
}

export const statusFilterOptions: { value: StudentStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'attention', label: 'Necesitan atención' },
  { value: 'needs_help', label: 'Necesita apoyo' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'no_activity', label: 'Sin actividad' },
  { value: 'active', label: 'Activos' },
  { value: 'excellent', label: 'Excelente' },
];

export const sortOptions: { value: StudentSortKey; label: string }[] = [
  { value: 'attention', label: 'Necesitan atención' },
  { value: 'accuracy', label: 'Precisión' },
  { value: 'xp', label: 'Puntuación' },
  { value: 'last_activity', label: 'Última actividad' },
  { value: 'name', label: 'Nombre' },
];
