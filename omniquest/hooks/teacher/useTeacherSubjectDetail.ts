import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { type DifficultyLevel } from '../../lib/difficulty'
import { parseDateTimeInput } from '../../lib/calendar'
import { useAppModal } from '../../components/AppModalProvider'
import type { IconName } from '../../components/teacher/subject/SubjectShared'
import type {
  StudentReport,
  StudentSortKey,
  StudentStatusFilter,
  SubjectScore,
} from '../../lib/teacherSubjectAnalytics'
import { useTeacherSubjectOverview } from './subject/useTeacherSubjectOverview'
import { useTeacherSubjectTopics } from './subject/useTeacherSubjectTopics'
import { useTeacherSubjectQuestions } from './subject/useTeacherSubjectQuestions'
import { useTeacherSubjectStudents } from './subject/useTeacherSubjectStudents'
import { useTeacherSubjectAnalytics } from './subject/useTeacherSubjectAnalytics'

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

export function useTeacherSubjectDetail({ subjectId, tab }: { subjectId: string; tab?: string | string[] }) {
  const router = useRouter()
  const { showModal } = useAppModal()
  const subjectIdNumber = Number(subjectId)
  const [activeTab, setActiveTab] = useState<SubjectTabKey>(() => getSubjectTabFromParam(tab))
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null)
  const [newClassroomName, setNewClassroomName] = useState('')
  const [creatingClassroom, setCreatingClassroom] = useState(false)
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicDescription, setNewTopicDescription] = useState('')
  const [newTopicAvailableUntil, setNewTopicAvailableUntil] = useState('')
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<DifficultyLevel>(1)
  const [creatingTopic, setCreatingTopic] = useState(false)
  const [showStudentImportModal, setShowStudentImportModal] = useState(false)

  useEffect(() => setActiveTab(getSubjectTabFromParam(tab)), [tab])

  const resolveClassroom = useCallback((classroomId: number) => {
    setSelectedClassroomId((current) => current || classroomId)
  }, [])

  const overview = useTeacherSubjectOverview({
    subjectId: subjectIdNumber,
    classroomId: selectedClassroomId,
    onResolvedClassroom: resolveClassroom,
  })
  const topicsResource = useTeacherSubjectTopics({
    subjectId: subjectIdNumber,
    classroomId: selectedClassroomId,
    enabled: activeTab === 'topics' || activeTab === 'questions',
  })
  const questionsResource = useTeacherSubjectQuestions({
    subjectId: subjectIdNumber,
    classroomId: selectedClassroomId,
    enabled: activeTab === 'questions',
  })
  const studentsResource = useTeacherSubjectStudents({
    subjectId: subjectIdNumber,
    classroomId: selectedClassroomId,
    enabled: activeTab === 'students',
  })
  const analyticsResource = useTeacherSubjectAnalytics({
    subjectId: subjectIdNumber,
    classroomId: selectedClassroomId,
    enabled: activeTab === 'analytics',
  })

  const subject = useMemo<Subject | null>(() => {
    const row = overview.data.subject
    if (!row.id) return null
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      code: row.code,
      education_level: row.educationLevel,
      academic_year: row.academicYear,
      subject_label: row.subjectLabel,
      theme_color: row.themeColor,
      created_at: row.createdAt,
    }
  }, [overview.data.subject])

  const classrooms = useMemo<Classroom[]>(() => overview.data.classrooms.map((row) => ({
    id: row.id,
    name: row.name,
    academic_year: row.academicYear,
    active: row.active,
    code: row.code,
  })), [overview.data.classrooms])

  const selectedClassroom = classrooms.find((classroom) => classroom.id === selectedClassroomId) || classrooms[0] || null

  const topicRows = useMemo<TopicRow[]>(() => topicsResource.data.items.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    availableUntil: row.availableUntil,
    questionsCount: row.questionsCount,
    playedCount: row.playedCount,
    averageScore: row.averageScore,
  })), [topicsResource.data.items])

  const topics = useMemo<Topic[]>(() => topicsResource.data.items
    .filter((row): row is typeof row & { id: number } => typeof row.id === 'number')
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      icon: row.icon,
      sort_order: row.sortOrder,
      available_until: row.availableUntil,
      classroom_id: selectedClassroomId,
    })), [selectedClassroomId, topicsResource.data.items])

  const questions = useMemo<Question[]>(() => questionsResource.data.items.map((row) => ({
    id: row.id,
    text: row.text,
    type: row.type,
    points_base: row.points_base,
    time_limit_seconds: row.time_limit_seconds,
    difficulty: row.difficulty,
    explanation: row.explanation,
    topic_id: row.topic_id,
    classroom_id: row.classroom_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    answers: row.answers,
  })), [questionsResource.data.items])

  const studentReportRows = studentsResource.data.items as StudentReport[]
  const studentListRows = studentReportRows
  const enrollments = useMemo(() => studentReportRows.map((student) => ({
    student_id: student.id,
    classroom_id: selectedClassroomId,
  })), [selectedClassroomId, studentReportRows])
  const scores = useMemo<SubjectScore[]>(() => studentReportRows.map((student) => ({
    student_id: student.id,
    classroom_id: selectedClassroomId,
    max_score: student.score,
    correct_answers: student.correctAnswers,
    played_days: [],
    played_at: student.lastActivity,
  })), [selectedClassroomId, studentReportRows])

  const gradeDistribution = useMemo(() => addGradeColors(
    activeTab === 'analytics' ? analyticsResource.data.gradeDistribution : studentsResource.data.gradeDistribution
  ), [activeTab, analyticsResource.data.gradeDistribution, studentsResource.data.gradeDistribution])

  const overviewActivity = useMemo<ActivityItem[]>(() => overview.data.recentActivity.map((row) => ({
    icon: row.isCorrect ? 'checkmark-circle-outline' : 'alert-circle-outline',
    color: row.isCorrect ? '#34D399' : '#F59E0B',
    title: `${row.studentName} respondió una pregunta`,
    detail: row.questionText,
    meta: `+${row.earnedPoints} XP`,
    time: formatRelative(row.attemptedAt),
    warning: !row.isCorrect,
  })), [overview.data.recentActivity])

  const selectedTopicLabel = questionsResource.topicId === 'all'
    ? 'Todos los temas'
    : questionsResource.topicId === 'general'
      ? 'Tema general'
      : topics.find((topic) => topic.id === questionsResource.topicId)?.title || 'Tema'

  const currentResource = activeTab === 'topics'
    ? topicsResource
    : activeTab === 'questions'
      ? questionsResource
      : activeTab === 'students'
        ? studentsResource
        : activeTab === 'analytics'
          ? analyticsResource
          : overview

  const refreshCurrent = useCallback(async () => {
    await Promise.all([
      overview.refresh().catch(() => undefined),
      activeTab === 'summary' ? Promise.resolve() : currentResource.refresh().catch(() => undefined),
    ])
  }, [activeTab, currentResource, overview])

  const showAlert = useCallback((title: string, message: string) => {
    showModal({ title, message, variant: title.toLowerCase().includes('error') || title.toLowerCase().includes('no se pudo') ? 'error' : 'info' })
  }, [showModal])

  const handleCreateClassroom = useCallback(async () => {
    if (!subject || !newClassroomName.trim()) {
      showAlert('Clase sin nombre', 'Escribe un nombre para crear la clase dentro del curso.')
      return
    }
    setCreatingClassroom(true)
    try {
      const { data, error } = await supabase.rpc('create_teacher_classroom', {
        p_subject_id: subject.id,
        p_name: newClassroomName.trim(),
        p_academic_year: subject.academic_year ?? undefined,
      })
      if (error) throw error
      const created = data as unknown as { id?: number }
      if (!created?.id) throw new Error('La base de datos no devolvió la clase creada.')
      setNewClassroomName('')
      setSelectedClassroomId(Number(created.id))
      await overview.refresh()
      showModal({ title: 'Clase creada', message: 'La clase se ha añadido al curso.', variant: 'success' })
    } catch (error) {
      showAlert('No se pudo crear la clase', error instanceof Error ? error.message : 'Inténtalo de nuevo.')
    } finally {
      setCreatingClassroom(false)
    }
  }, [newClassroomName, overview, showAlert, showModal, subject])

  const handleCreateTopic = useCallback(async () => {
    const cleanAvailableUntil = newTopicAvailableUntil.trim()
    const parsedAvailableUntil = cleanAvailableUntil ? parseDateTimeInput(cleanAvailableUntil) : null
    if (!newTopicTitle.trim()) return showAlert('Tema sin nombre', 'Escribe un nombre para el tema.')
    if (!selectedClassroomId) return showAlert('Selecciona una clase', 'Elige la clase donde quieres crear el tema.')
    if (cleanAvailableUntil && !parsedAvailableUntil) return showAlert('Fecha inválida', 'Usa el formato AAAA-MM-DD HH:mm.')

    setCreatingTopic(true)
    try {
      const { data, error } = await supabase.functions.invoke('teacher-create-topic', {
        body: {
          subjectId: subjectIdNumber,
          classroomId: selectedClassroomId,
          title: newTopicTitle.trim(),
          description: newTopicDescription.trim() || null,
          icon: '📘',
          sortOrder: topicsResource.data.total + 1,
          availableUntil: parsedAvailableUntil?.toISOString() || null,
        },
      })
      if (error) throw error
      const result = (data || {}) as { error?: string; topic?: { id: number } }
      if (result.error) throw new Error(result.error)
      if (!result.topic?.id) throw new Error('No se recibió el tema creado.')
      setNewTopicTitle('')
      setNewTopicDescription('')
      setNewTopicAvailableUntil('')
      await topicsResource.refresh()
      router.push(`/(teacher)/subject/add-question?subjectId=${subjectIdNumber}&classroomId=${selectedClassroomId}&topicId=${result.topic.id}&difficulty=${newTopicDifficulty}` as any)
    } catch (error) {
      showAlert('No se pudo crear el tema', error instanceof Error ? error.message : 'Inténtalo de nuevo.')
    } finally {
      setCreatingTopic(false)
    }
  }, [newTopicAvailableUntil, newTopicDescription, newTopicDifficulty, newTopicTitle, router, selectedClassroomId, showAlert, subjectIdNumber, topicsResource])

  const handleDelete = useCallback((questionId: number) => {
    showModal({
      title: 'Borrar pregunta',
      message: 'Esta acción no se puede deshacer.',
      variant: 'warning',
      buttons: [
        { label: 'Cancelar', role: 'cancel' },
        {
          label: 'Borrar',
          role: 'danger',
          onPress: () => {
            void (async () => {
              try {
                const { data, error } = await supabase.functions.invoke('teacher-delete-question', { body: { questionId } })
                if (error) throw error
                const result = (data || {}) as { error?: string }
                if (result.error) throw new Error(result.error)
                questionsResource.setData((current) => ({ ...current, items: current.items.filter((item) => item.id !== questionId), total: Math.max(0, current.total - 1) }))
                await overview.refresh()
              } catch (error) {
                showAlert('No se pudo borrar', error instanceof Error ? error.message : 'Inténtalo de nuevo.')
              }
            })()
          },
        },
      ],
    })
  }, [overview, questionsResource, showAlert, showModal])

  const handleArchive = useCallback(() => {
    if (!subject) return
    showModal({
      title: 'Archivar curso',
      message: 'El curso se ocultará de los cursos activos.',
      variant: 'warning',
      buttons: [
        { label: 'Cancelar', role: 'cancel' },
        {
          label: 'Archivar', role: 'danger', onPress: () => {
            void (async () => {
              try {
                const response = await supabase.functions.invoke('teacher-archive-subject', {
                  body: { archive: true, subjectId: subject.id },
                })
                if (response.error) throw response.error
                router.replace('/(teacher)/classes' as any)
              } catch (archiveError) {
                showAlert('No se pudo archivar', archiveError instanceof Error ? archiveError.message : 'Inténtalo de nuevo.')
              }
            })()
          },
        },
      ],
    })
  }, [router, showAlert, showModal, subject])

  const handleDuplicate = useCallback(async () => {
    if (!subject) return
    try {
      const { data, error } = await supabase.rpc('duplicate_teacher_subject', { p_subject_id: subject.id, p_name_suffix: ' (Copia)' })
      if (error) throw error
      const id = data && typeof data === 'object' && !Array.isArray(data) ? Number((data as { id?: number }).id) : 0
      if (!id) throw new Error('No se pudo obtener el curso duplicado.')
      router.push(`/(teacher)/subject/${id}` as any)
    } catch (error) {
      showAlert('No se pudo duplicar', error instanceof Error ? error.message : 'Inténtalo de nuevo.')
    }
  }, [router, showAlert, subject])

  const handleClassMenu = useCallback(() => {
    if (!subject) return
    showModal({
      title: 'Acciones del curso',
      message: 'Selecciona la acción que quieres realizar.',
      variant: 'info',
      buttons: [
        { label: 'Editar', role: 'primary', onPress: () => router.push(`/(teacher)/edit-subject?id=${subject.id}` as any) },
        { label: 'Duplicar', role: 'primary', onPress: () => { void handleDuplicate() } },
        { label: 'Archivar', role: 'danger', onPress: handleArchive },
        { label: 'Cancelar', role: 'cancel' },
      ],
    })
  }, [handleArchive, handleDuplicate, router, showModal, subject])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }, [router])

  const handleClassroomChange = useCallback((classroomId: number) => {
    setSelectedClassroomId(classroomId)
    questionsResource.setTopicId('all')
  }, [questionsResource])

  return {
    activeTab,
    analytics: analyticsResource.data,
    classrooms,
    creatingClassroom,
    creatingTopic,
    enrollments,
    fetchData: refreshCurrent,
    gradeDistribution,
    handleClassMenu,
    handleCreateClassroom,
    handleCreateTopic,
    handleDelete,
    handleSignOut,
    loading: overview.loading,
    newClassroomName,
    newTopicAvailableUntil,
    newTopicDescription,
    newTopicDifficulty,
    newTopicTitle,
    onRefresh: refreshCurrent,
    overview: overview.data,
    questions,
    questionTotal: questionsResource.data.total,
    recentActivity: overviewActivity,
    refreshing: overview.refreshing || currentResource.refreshing,
    scores,
    selectedClassroom,
    selectedClassroomId,
    selectedDifficulty: questionsResource.difficulty as DifficultyLevel | 'all',
    selectedTopicId: questionsResource.topicId,
    selectedTopicLabel,
    setActiveTab,
    setNewClassroomName,
    setNewTopicAvailableUntil,
    setNewTopicDescription,
    setNewTopicDifficulty,
    setNewTopicTitle,
    setSelectedClassroomId: handleClassroomChange,
    setSelectedDifficulty: questionsResource.setDifficulty as (value: DifficultyLevel | 'all') => void,
    setSelectedTopicId: questionsResource.setTopicId,
    setShowStudentImportModal,
    setStudentSearch: studentsResource.setSearch,
    setStudentSortKey: studentsResource.setSort,
    setStudentStatusFilter: studentsResource.setStatus,
    showAlert,
    showStudentImportModal,
    studentListRows,
    studentReportRows,
    studentSearch: studentsResource.search,
    studentSortKey: studentsResource.sort,
    studentStatusFilter: studentsResource.status,
    studentsSummary: studentsResource.data.summary,
    studentsTotal: studentsResource.data.total,
    subject,
    subjectsCount: overview.data.subjectsCount,
    tabError: currentResource.error,
    tabLoading: activeTab !== 'summary' && currentResource.loading,
    topicRows,
    topics,
  }
}

function getSubjectTabFromParam(value: string | string[] | undefined): SubjectTabKey {
  const raw = Array.isArray(value) ? value[0] : value
  return teacherSubjectTabItems.some((item) => item.key === raw) ? raw as SubjectTabKey : 'summary'
}

function addGradeColors(rows: Array<{ label: string; count: number }>) {
  const colors = ['#34D399', '#3B82F6', '#F59E0B', '#F43F5E']
  return rows.map((row, index) => ({ ...row, color: colors[index] || '#8FA7C7' }))
}

function formatRelative(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const hours = Math.max(1, Math.round((Date.now() - timestamp) / 3600000))
  if (hours < 24) return `Hace ${hours} h`
  if (hours < 48) return 'Ayer'
  return `Hace ${Math.round(hours / 24)} días`
}
