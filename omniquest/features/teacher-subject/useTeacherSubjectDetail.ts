import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { type DifficultyLevel } from '../../lib/difficulty'
import { parseDateTimeInput } from '../../lib/calendar'
import { copyCourseCode, shareCourseCode } from '../../lib/courseCodeActions'
import { useI18n } from '../../lib/i18n'
import { useAppModal } from '../../components/AppModalProvider'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import type { StudentReport, SubjectScore } from '../../lib/teacherSubjectAnalytics'
import { useTeacherSubjectOverview } from '../../hooks/teacher/subject/useTeacherSubjectOverview'
import { useTeacherSubjectTopics } from '../../hooks/teacher/subject/useTeacherSubjectTopics'
import { useTeacherSubjectQuestions } from '../../hooks/teacher/subject/useTeacherSubjectQuestions'
import { useTeacherSubjectStudents } from '../../hooks/teacher/subject/useTeacherSubjectStudents'
import { useTeacherSubjectAnalytics } from '../../hooks/teacher/subject/useTeacherSubjectAnalytics'
import { archiveTeacherSubject, createTeacherClassroom, createTeacherTopic, deleteTeacherQuestion, duplicateTeacherSubject, signOutTeacherSubject } from './api'
import { teacherSubjectTabItems, type ActivityItem, type Classroom, type Question, type Subject, type SubjectTabKey, type Topic, type TopicRow } from './types'

export * from './types'
export function useTeacherSubjectDetail({ subjectId, tab, classroomId }: { subjectId: string; tab?: string | string[]; classroomId?: string | string[] }) {
  const router = useRouter()
  const { showModal } = useAppModal()
  const feedback = useAppFeedback()
  const { locale } = useI18n()
  const subjectIdNumber = Number(subjectId)
  const requestedClassroomId = getPositiveNumberParam(classroomId)
  const [activeTab, setActiveTab] = useState<SubjectTabKey>(() => getSubjectTabFromParam(tab))
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(requestedClassroomId)
  const [newClassroomName, setNewClassroomName] = useState('')
  const [creatingClassroom, setCreatingClassroom] = useState(false)
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicDescription, setNewTopicDescription] = useState('')
  const [newTopicAvailableUntil, setNewTopicAvailableUntil] = useState('')
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<DifficultyLevel>(1)
  const [creatingTopic, setCreatingTopic] = useState(false)
  const [showStudentImportModal, setShowStudentImportModal] = useState(false)

  useEffect(() => setActiveTab(getSubjectTabFromParam(tab)), [tab])
  useEffect(() => { if (requestedClassroomId) setSelectedClassroomId(requestedClassroomId) }, [requestedClassroomId])

  const resolveClassroom = useCallback((resolvedClassroomId: number) => {
    setSelectedClassroomId((current) => current === resolvedClassroomId ? current : resolvedClassroomId)
    if (requestedClassroomId !== resolvedClassroomId) router.setParams({ classroomId: String(resolvedClassroomId) } as any)
  }, [requestedClassroomId, router])

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

  const gradeDistribution = useMemo(() => {
    const rows = activeTab === 'summary'
      ? overview.data.gradeDistribution
      : activeTab === 'analytics'
        ? analyticsResource.data.gradeDistribution
        : studentsResource.data.gradeDistribution
    return addGradeColors(rows)
  }, [activeTab, analyticsResource.data.gradeDistribution, overview.data.gradeDistribution, studentsResource.data.gradeDistribution])

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
      const created = await createTeacherClassroom({ subjectId: subject.id, name: newClassroomName.trim(), academicYear: subject.academic_year })
      setNewClassroomName('')
      const createdClassroomId = Number(created.id)
      setSelectedClassroomId(createdClassroomId)
      router.setParams({ classroomId: String(createdClassroomId) } as any)
      await overview.refresh()
      showModal({ title: 'Clase creada', message: 'La clase se ha añadido al curso.', variant: 'success' })
    } catch (error) {
      showAlert('No se pudo crear la clase', error instanceof Error ? error.message : 'Inténtalo de nuevo.')
    } finally {
      setCreatingClassroom(false)
    }
  }, [newClassroomName, overview, router, showAlert, showModal, subject])

  const handleCreateTopic = useCallback(async () => {
    const cleanAvailableUntil = newTopicAvailableUntil.trim()
    const parsedAvailableUntil = cleanAvailableUntil ? parseDateTimeInput(cleanAvailableUntil) : null
    if (!newTopicTitle.trim()) return showAlert('Tema sin nombre', 'Escribe un nombre para el tema.')
    if (!selectedClassroomId) return showAlert('Selecciona una clase', 'Elige la clase donde quieres crear el tema.')
    if (cleanAvailableUntil && !parsedAvailableUntil) return showAlert('Fecha inválida', 'Usa el formato AAAA-MM-DD HH:mm.')

    setCreatingTopic(true)
    try {
      const topic = await createTeacherTopic({ subjectId: subjectIdNumber, classroomId: selectedClassroomId, title: newTopicTitle.trim(), description: newTopicDescription.trim() || null, sortOrder: topicsResource.data.total + 1, availableUntil: parsedAvailableUntil?.toISOString() || null })
      setNewTopicTitle('')
      setNewTopicDescription('')
      setNewTopicAvailableUntil('')
      await topicsResource.refresh()
      router.push(`/(teacher)/subject/add-question?subjectId=${subjectIdNumber}&classroomId=${selectedClassroomId}&topicId=${topic.id}&difficulty=${newTopicDifficulty}` as any)
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
                await deleteTeacherQuestion(questionId)
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
                await archiveTeacherSubject(subject.id)
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
      const id = await duplicateTeacherSubject(subject.id)
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
        { label: 'Duplicar', role: 'primary', onPress: handleDuplicate },
        { label: 'Archivar', role: 'danger', onPress: handleArchive },
        { label: 'Cancelar', role: 'cancel' },
      ],
    })
  }, [handleArchive, handleDuplicate, router, showModal, subject])

  const handleSignOut = useCallback(async () => {
    await signOutTeacherSubject()
    router.replace('/(auth)/login' as any)
  }, [router])

  const handleClassroomChange = useCallback((nextClassroomId: number) => {
    setSelectedClassroomId(nextClassroomId)
    questionsResource.setTopicId('all')
    router.setParams({ classroomId: String(nextClassroomId) } as any)
  }, [questionsResource, router])

  const handleCopyCode = useCallback(async () => {
    if (!subject) return
    try {
      await copyCourseCode(subject.code)
      feedback.success('Código copiado', `Código ${subject.code} copiado al portapapeles.`)
    } catch (error) {
      feedback.error('No se pudo copiar el código', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
    }
  }, [feedback, subject])

  const handleShareCode = useCallback(async () => {
    if (!subject) return
    try {
      const result = await shareCourseCode({ code: subject.code, subjectName: subject.name, locale })
      if (result === 'copied') feedback.success('Código copiado', `Código ${subject.code} copiado al portapapeles.`)
    } catch (error) {
      feedback.error('No se pudo compartir el código', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
    }
  }, [feedback, locale, subject])

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
    handleCopyCode,
    handleCreateClassroom,
    handleCreateTopic,
    handleShareCode,
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
    setStudentPage: studentsResource.setPage,
    setStudentSearch: studentsResource.setSearch,
    setStudentSortKey: studentsResource.setSort,
    setStudentStatusFilter: studentsResource.setStatus,
    showAlert,
    showStudentImportModal,
    studentListRows,
    studentPage: studentsResource.page,
    studentPageSize: studentsResource.pageSize,
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

function getPositiveNumberParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
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
