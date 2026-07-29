import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../../../components/ui/mobile/MobileMetricCard'
import PaginationControls from '../../../../components/ui/PaginationControls'
import { supabase } from '../../../../lib/supabase'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../../lib/mobileLayout'
import { getTimeAgo } from '../../../../lib/time'
import { useAppTheme } from '../../../../lib/appTheme'
import TeacherSidebar from '../../../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../../../components/teacher/TeacherPageHeader'
import AppButton from '../../../../components/ui/AppButton'
import AppTabs from '../../../../components/ui/AppTabs'
import { exportCsvFile, formatExportDateTime, slugifyFilename } from '../../../../lib/reportExports'

type IconName = keyof typeof Ionicons.glyphMap

type Related<T> = T | T[] | null | undefined

type StudentProfile = {
  id: string
  alias: string | null
  avatar: string | null
  points: number | null
  active?: boolean | null
  created_at?: string | null
}

type SubjectRelation = {
  id: number
  name: string | null
  teacher_id?: string | null
  academic_year?: string | null
  education_level?: string | null
  subject_label?: string | null
}

type ClassroomRelation = {
  id: number
  name: string | null
  code?: string | null
  academic_year?: string | null
}

type TopicRelation = {
  id: number
  title: string | null
}

type AnswerRelation = {
  id: number
  text: string | null
}

type EnrollmentRow = {
  id: number
  student_id: string
  subject_id: number
  classroom_id: number | null
  joined_at: string | null
  subjects?: Related<SubjectRelation>
  classrooms?: Related<ClassroomRelation>
}

type SubjectScoreRow = {
  id?: number
  student_id: string
  subject_id: number
  classroom_id?: number | null
  max_score: number | null
  correct_answers?: number | null
  played_days?: string[] | null
  played_at?: string | null
}

type TopicScoreRow = {
  id: number
  subject_id: number
  topic_id: number
  max_score: number | null
  played_at: string | null
  subject_topics?: Related<TopicRelation>
  subjects?: Related<SubjectRelation>
}

type QuestionRow = {
  id: number
  subject_id: number | null
  classroom_id: number | null
  topic_id: number | null
}

type AttemptRow = {
  id: number
  student_id: string
  question_id: number
  answer_id: number | null
  is_correct: boolean
  time_taken_seconds: number | null
  attempted_at: string | null
  created_at?: string | null
  earned_points?: number | null
  hint_used?: boolean | null
  was_skipped?: boolean | null
  submitted_answer_text?: string | null
  submitted_answer_payload?: unknown
  manual_review_status?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  questions?: Related<{
    id: number
    text: string | null
    type: string | null
    subject_id: number | null
    classroom_id: number | null
    topic_id: number | null
    difficulty: number | null
    explanation?: string | null
    subjects?: Related<SubjectRelation>
    classrooms?: Related<ClassroomRelation>
    subject_topics?: Related<TopicRelation>
  }>
  answers?: Related<AnswerRelation>
}

type CourseContext = {
  enrollmentId: number
  subjectId: number
  subjectName: string
  classroomId: number | null
  classroomName: string
  classroomCode: string | null
  academicYear: string | null
  joinedAt: string | null
}

type NormalizedAttempt = {
  id: number
  questionId: number
  questionText: string
  questionType: string
  subjectId: number | null
  subjectName: string
  classroomId: number | null
  classroomName: string
  topicId: number | null
  topicTitle: string
  answerText: string
  isCorrect: boolean
  earnedPoints: number
  timeTakenSeconds: number | null
  hintUsed: boolean
  wasSkipped: boolean
  attemptedAt: string | null
  manualReviewStatus: string
  reviewedAt: string | null
  reviewNotes: string | null
  difficulty: number | null
}

type WeakTopic = {
  key: string
  subjectName: string
  topicTitle: string
  totalAttempts: number
  mistakes: number
  accuracyPercent: number
  lastAttemptAt: string | null
}

type StudentHistoryTab = 'activity' | 'weaknesses' | 'reviews' | 'metrics'

type EvolutionBucket = {
  dateKey: string
  label: string
  total: number
  correct: number
  accuracyPercent: number
  earnedPoints: number
}

const questionTypeLabels: Record<string, string> = {
  multiple_choice: 'Tipo test',
  true_false: 'Verdadero/Falso',
  fill_blank: 'Rellenar huecos',
  match_pairs: 'Emparejar',
  ordering: 'Ordenar',
  open_answer: 'Respuesta abierta',
}

function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204'
}

export default function TeacherStudentHistoryScreen() {
  const { id, subjectId, classroomId } = useLocalSearchParams<{ id?: string; subjectId?: string; classroomId?: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { colors, tokens } = useAppTheme()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [subjectScores, setSubjectScores] = useState<SubjectScoreRow[]>([])
  const [topicScores, setTopicScores] = useState<TopicScoreRow[]>([])
  const [attempts, setAttempts] = useState<NormalizedAttempt[]>([])
  const [attemptPage, setAttemptPage] = useState(0)
  const [attemptTotal, setAttemptTotal] = useState(0)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeHistoryTab, setActiveHistoryTab] = useState<StudentHistoryTab>('activity')

  const isDesktop = width >= 1080
  const isWide = width >= 900
  const attemptPageSize = isDesktop ? 50 : 16
  const studentId = Array.isArray(id) ? id[0] : id
  const selectedSubjectId = Number(Array.isArray(subjectId) ? subjectId[0] : subjectId)
  const selectedClassroomId = Number(Array.isArray(classroomId) ? classroomId[0] : classroomId)

  const fetchHistory = useCallback(async () => {
    if (!studentId) {
      setErrorMessage('No se ha recibido el identificador del alumno.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      setErrorMessage(null)
      const { data: sessionData } = await supabase.auth.getSession()
      const teacherId = sessionData.session?.user.id
      if (!teacherId) {
        setErrorMessage('No se ha encontrado la sesión del profesor.')
        return
      }

      const [profileResult, enrollmentsResult, subjectsCountResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, alias, avatar, points, active, created_at')
          .eq('id', studentId)
          .maybeSingle(),
        (supabase.from('enrollments') as any)
          .select(`
            id,
            student_id,
            subject_id,
            classroom_id,
            joined_at,
            subjects!inner(id, name, teacher_id, academic_year, education_level, subject_label),
            classrooms(id, name, code, academic_year)
          `)
          .eq('student_id', studentId)
          .eq('subjects.teacher_id', teacherId),
        supabase
          .from('subjects')
          .select('id')
          .eq('teacher_id', teacherId)
          .eq('is_archived', false),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (subjectsCountResult.error) throw subjectsCountResult.error

      const nextProfile = profileResult.data as StudentProfile | null
      const nextEnrollments = (enrollmentsResult.data || []) as EnrollmentRow[]
      const subjectIds = Array.from(new Set(nextEnrollments.map((enrollment) => Number(enrollment.subject_id)).filter(Number.isFinite)))

      setProfile(nextProfile)
      setEnrollments(nextEnrollments)
      setSubjectsCount(subjectsCountResult.data?.length || 0)

      if (!nextProfile) {
        setErrorMessage('No se ha encontrado el perfil del alumno.')
        setSubjectScores([])
        setTopicScores([])
        setAttempts([])
        setQuestions([])
        return
      }

      if (subjectIds.length === 0) {
        setErrorMessage('Este alumno no está inscrito en ningún curso tuyo, o ya no tienes acceso a su historial.')
        setSubjectScores([])
        setTopicScores([])
        setAttempts([])
        setQuestions([])
        return
      }

      const [attemptsResult, subjectScoresResult, topicScoresResult, questionsResult] = await Promise.all([
        supabase.rpc('get_teacher_student_attempts_page', {
          p_student_id: studentId,
          p_subject_id: Number.isFinite(selectedSubjectId) ? selectedSubjectId : undefined,
          p_classroom_id: Number.isFinite(selectedClassroomId) ? selectedClassroomId : undefined,
          p_limit: attemptPageSize,
          p_offset: attemptPage * attemptPageSize,
        }),
        (supabase.from('subject_scores') as any)
          .select('id, student_id, subject_id, classroom_id, max_score, correct_answers, played_days, played_at')
          .eq('student_id', studentId)
          .in('subject_id', subjectIds),
        (supabase.from('topic_scores') as any)
          .select('id, subject_id, topic_id, max_score, played_at, subject_topics(id, title), subjects(id, name)')
          .eq('student_id', studentId)
          .in('subject_id', subjectIds)
          .order('played_at', { ascending: false }),
        supabase
          .from('questions')
          .select('id, subject_id, classroom_id, topic_id')
          .in('subject_id', subjectIds)
          .eq('active', true),
      ])

      if (attemptsResult.error && !isMissingSchemaError(attemptsResult.error.code)) throw attemptsResult.error
      if (subjectScoresResult.error && !isMissingSchemaError(subjectScoresResult.error.code)) throw subjectScoresResult.error
      if (topicScoresResult.error && !isMissingSchemaError(topicScoresResult.error.code)) throw topicScoresResult.error
      if (questionsResult.error && !isMissingSchemaError(questionsResult.error.code)) throw questionsResult.error

      const attemptsPayload = !attemptsResult.error && attemptsResult.data && typeof attemptsResult.data === 'object' && !Array.isArray(attemptsResult.data)
        ? attemptsResult.data as { rows?: AttemptRow[]; total?: number }
        : {}
      const normalizedAttempts = (Array.isArray(attemptsPayload.rows) ? attemptsPayload.rows : [])
        .map(normalizeAttempt)
        .sort((a, b) => getTimeValue(b.attemptedAt) - getTimeValue(a.attemptedAt))

      setAttempts(normalizedAttempts)
      setAttemptTotal(Math.max(0, Number(attemptsPayload.total || 0)))
      setSubjectScores((subjectScoresResult.error ? [] : subjectScoresResult.data || []) as SubjectScoreRow[])
      setTopicScores((topicScoresResult.error ? [] : topicScoresResult.data || []) as TopicScoreRow[])
      setQuestions((questionsResult.error ? [] : questionsResult.data || []) as QuestionRow[])
    } catch (error: any) {
      console.error('Error cargando historial del alumno:', error.message)
      setErrorMessage(error.message || 'No se pudo cargar el historial del alumno.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [attemptPage, attemptPageSize, selectedClassroomId, selectedSubjectId, studentId])

  useFocusEffect(
    useCallback(() => {
      fetchHistory()
    }, [fetchHistory])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchHistory()
  }

  const courseContexts = useMemo(() => buildCourseContexts(enrollments), [enrollments])
  const filteredCourseContexts = useMemo(() => {
    return courseContexts.filter((context) => {
      const matchesSubject = Number.isFinite(selectedSubjectId) ? context.subjectId === selectedSubjectId : true
      const matchesClassroom = Number.isFinite(selectedClassroomId) ? context.classroomId === selectedClassroomId : true
      return matchesSubject && matchesClassroom
    })
  }, [courseContexts, selectedClassroomId, selectedSubjectId])

  const subjectIdsInView = useMemo(() => {
    const contexts = filteredCourseContexts.length > 0 ? filteredCourseContexts : courseContexts
    return new Set(contexts.map((context) => context.subjectId))
  }, [courseContexts, filteredCourseContexts])

  const classroomIdsInView = useMemo(() => {
    const contexts = filteredCourseContexts.length > 0 ? filteredCourseContexts : courseContexts
    return new Set(contexts.map((context) => context.classroomId).filter((value): value is number => typeof value === 'number'))
  }, [courseContexts, filteredCourseContexts])

  const attemptsInView = useMemo(() => attempts.filter((attempt) => {
    const subjectMatches = attempt.subjectId === null || subjectIdsInView.has(attempt.subjectId)
    const classroomMatches = classroomIdsInView.size === 0 || attempt.classroomId === null || classroomIdsInView.has(attempt.classroomId)
    return subjectMatches && classroomMatches
  }), [attempts, classroomIdsInView, subjectIdsInView])

  const stats = useMemo(() => buildStats(attemptsInView, questions, subjectScores, subjectIdsInView), [attemptsInView, questions, subjectScores, subjectIdsInView])
  const weakTopics = useMemo(() => buildWeakTopics(attemptsInView), [attemptsInView])
  const evolution = useMemo(() => buildEvolution(attemptsInView), [attemptsInView])
  const failedAttempts = useMemo(() => attemptsInView.filter((attempt) => !attempt.isCorrect).slice(0, 12), [attemptsInView])
  const pendingReviews = useMemo(() => attemptsInView.filter((attempt) => attempt.manualReviewStatus === 'pending'), [attemptsInView])
  const reviewedAttempts = useMemo(() => attemptsInView.filter((attempt) => attempt.reviewedAt || ['approved', 'rejected'].includes(attempt.manualReviewStatus)).slice(0, 6), [attemptsInView])
  const topTopicScores = useMemo(() => normalizeTopicScores(topicScores).slice(0, 8), [topicScores])
  const mainCourse = filteredCourseContexts[0] || courseContexts[0] || null
  const studentName = profile?.alias?.trim() || 'Alumno'
  const studentHealth = getStudentHealth(stats, pendingReviews.length, profile?.active !== false)
  const recommendation = getStudentRecommendation(stats, weakTopics, pendingReviews.length, mainCourse)
  const headerSubtitle = mainCourse
    ? `${mainCourse.subjectName} · ${mainCourse.classroomName}`
    : 'Historial completo por alumno'

  const goBackToStudents = () => {
    router.push({
      pathname: '/(teacher)/students',
      params: {
        ...(Number.isFinite(selectedSubjectId) ? { subjectId: String(selectedSubjectId) } : {}),
        ...(Number.isFinite(selectedClassroomId) ? { classroomId: String(selectedClassroomId) } : {}),
      },
    } as any)
  }

  const handleAssignReview = () => {
    if (!mainCourse) return
    router.push({
      pathname: '/(teacher)/subject/add-question',
      params: {
        subjectId: String(mainCourse.subjectId),
        ...(mainCourse.classroomId ? { classroomId: String(mainCourse.classroomId) } : {}),
        ...(weakTopics[0]?.topicTitle && weakTopics[0].topicTitle !== 'Práctica general' ? { focus: weakTopics[0].topicTitle } : {}),
      },
    } as any)
  }

  const handleOpenMainSubject = () => {
    if (!mainCourse) return
    router.push({
      pathname: '/(teacher)/subject/[id]',
      params: {
        id: String(mainCourse.subjectId),
        ...(mainCourse.classroomId ? { classroomId: String(mainCourse.classroomId) } : {}),
      },
    } as any)
  }

  const handleOpenQuestionReport = (questionId: number) => {
    router.push({ pathname: '/(teacher)/question-report/[id]', params: { id: String(questionId) } } as any)
  }


  const handleExportStudentHistoryCsv = async () => {
    const exportedAt = new Date().toISOString().slice(0, 10)
    const filename = `omniquest_historial_${slugifyFilename(studentName)}_${exportedAt}.csv`
    const contextsLabel = (filteredCourseContexts.length > 0 ? filteredCourseContexts : courseContexts)
      .map((context) => `${context.subjectName} / ${context.classroomName}`)
      .join(' | ')

    const rows = attemptsInView.length > 0
      ? attemptsInView.map((attempt) => [
          studentId || '',
          studentName,
          profile?.points ?? 0,
          contextsLabel,
          stats.totalAttempts,
          stats.correctAttempts,
          stats.failedAttempts,
          stats.accuracyPercent ?? '',
          stats.coveragePercent ?? '',
          attempt.id,
          attempt.questionId,
          attempt.subjectName,
          attempt.classroomName,
          attempt.topicTitle,
          questionTypeLabels[attempt.questionType] || attempt.questionType,
          attempt.questionText,
          attempt.answerText,
          attempt.isCorrect ? 'Correcta' : 'Incorrecta',
          attempt.earnedPoints,
          attempt.timeTakenSeconds ?? '',
          attempt.hintUsed ? 'Sí' : 'No',
          attempt.wasSkipped ? 'Sí' : 'No',
          attempt.manualReviewStatus,
          formatExportDateTime(attempt.reviewedAt),
          attempt.reviewNotes || '',
          formatExportDateTime(attempt.attemptedAt),
        ])
      : (filteredCourseContexts.length > 0 ? filteredCourseContexts : courseContexts).map((context) => [
          studentId || '',
          studentName,
          profile?.points ?? 0,
          contextsLabel,
          stats.totalAttempts,
          stats.correctAttempts,
          stats.failedAttempts,
          stats.accuracyPercent ?? '',
          stats.coveragePercent ?? '',
          '',
          '',
          context.subjectName,
          context.classroomName,
          '',
          '',
          'Sin intentos registrados',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ])

    const exported = await exportCsvFile(
      filename,
      [
        'Alumno_ID',
        'Alumno',
        'XP_global',
        'Cursos_y_clases',
        'Intentos_totales',
        'Correctas',
        'Fallos',
        'Precision_pct',
        'Cobertura_pct',
        'Intento_ID',
        'Pregunta_ID',
        'Curso',
        'Clase',
        'Tema',
        'Tipo',
        'Pregunta',
        'Respuesta',
        'Resultado',
        'XP',
        'Tiempo_segundos',
        'Pista_usada',
        'Omitida',
        'Revision_manual',
        'Revisado_el',
        'Notas_revision',
        'Intentado_el',
      ],
      rows
    )

    if (!exported) {
      showAlert('No se pudo compartir el archivo', 'En web se descarga como CSV. En móvil, revisa que el dispositivo tenga opciones para compartir archivos.')
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4" style={{ color: colors.textMuted }}>Cargando historial del alumno...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar
            activeSection="students"
            subjectsCount={subjectsCount}
            onSignOut={() => supabase.auth.signOut()}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 24 : 18,
            paddingBottom: isDesktop ? 34 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <TeacherPageHeader
            backAction={{ label: 'Volver a estudiantes', onPress: goBackToStudents }}
            isDesktop={isDesktop}
            title={studentName}
            subtitle={headerSubtitle}
            titleNumberOfLines={2}
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
            leading={(
              <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-surface-selected">
                <Text className="text-[18px] font-black text-white">{getInitials(studentName)}</Text>
              </View>
            )}
          />

          {errorMessage ? (
            <View className="rounded-2xl border border-border-default bg-semantic-surface-danger p-5">
              <View className="flex-row items-start gap-3">
                <Ionicons name="warning-outline" size={24} color="#F59E0B" />
                <View className="min-w-0 flex-1">
                  <Text className="text-[18px] font-black text-white">No se pudo mostrar el historial</Text>
                  <Text className="mt-2 text-[13px] leading-5 text-semantic-warning">{errorMessage}</Text>
                </View>
              </View>
            </View>
          ) : null}

          <StudentSummaryHero
            studentName={studentName}
            course={mainCourse}
            status={studentHealth}
            recommendation={recommendation}
            points={profile?.points ?? 0}
            lastActivityAt={stats.lastActivityAt}
            onAssignReview={handleAssignReview}
            onOpenCourse={handleOpenMainSubject}
          />

          <View className="mt-5">
            <AppTabs<StudentHistoryTab>
              accessibilityLabel="Secciones del historial del alumno"
              role="teacher"
              value={activeHistoryTab}
              onChange={setActiveHistoryTab}
              items={[
                { key: 'activity', label: 'Actividad', icon: 'pulse-outline', badge: attemptTotal },
                { key: 'weaknesses', label: 'Áreas débiles', icon: 'warning-outline', badge: weakTopics.length },
                { key: 'reviews', label: 'Respuestas abiertas', icon: 'chatbox-ellipses-outline', badge: pendingReviews.length },
                { key: 'metrics', label: 'Métricas', icon: 'analytics-outline' },
              ]}
            />
          </View>

          {activeHistoryTab === 'activity' ? (
            <View className={isDesktop ? 'mt-5 flex-row items-start gap-5' : 'mt-5 gap-5'}>
              <View className={isDesktop ? 'min-w-0 flex-[1.55]' : ''}>
                <Panel title="Timeline de actividad" action={`${attemptTotal} registros`}>
                  <View style={{ gap: 10 }}>
                    {attemptsInView.map((attempt) => (
                      <AttemptHistoryRow key={attempt.id} attempt={attempt} onOpenQuestion={handleOpenQuestionReport} />
                    ))}
                    {attemptsInView.length === 0 ? <EmptyText text="Todavía no hay actividad registrada en los cursos del profesor." /> : null}
                    <PaginationControls
                      compact={!isDesktop}
                      page={attemptPage}
                      pageSize={attemptPageSize}
                      total={attemptTotal}
                      onPrevious={() => setAttemptPage((value) => Math.max(0, value - 1))}
                      onNext={() => setAttemptPage((value) => value + 1)}
                    />
                  </View>
                </Panel>
              </View>
              <View className={isDesktop ? 'min-w-0 flex-1' : ''}>
                <Panel title="Evolución reciente" action="Intentos de la página">
                  <View style={{ gap: 10 }}>
                    {evolution.map((bucket) => <EvolutionRow key={bucket.dateKey} bucket={bucket} />)}
                    {evolution.length === 0 ? <EmptyText text="La evolución aparecerá cuando existan intentos." /> : null}
                  </View>
                </Panel>
              </View>
            </View>
          ) : null}

          {activeHistoryTab === 'weaknesses' ? (
            <View className={isDesktop ? 'mt-5 flex-row items-start gap-5' : 'mt-5 gap-5'}>
              <Panel title="Áreas débiles" action="Prioridad docente">
                <View style={{ gap: 10 }}>
                  {weakTopics.map((topic) => <WeakTopicRow key={topic.key} topic={topic} />)}
                  {weakTopics.length === 0 ? <EmptyText text={attemptsInView.length === 0 ? 'Sin intentos todavía.' : 'No hay áreas débiles detectadas.'} /> : null}
                </View>
              </Panel>
              <Panel title="Preguntas que conviene revisar" action={`${failedAttempts.length} visibles`}>
                <View style={{ gap: 10 }}>
                  {failedAttempts.map((attempt) => (
                    <FailedQuestionRow key={attempt.id} attempt={attempt} onOpenQuestion={handleOpenQuestionReport} />
                  ))}
                  {failedAttempts.length === 0 ? <EmptyText text="No hay preguntas falladas en el rango actual." /> : null}
                </View>
              </Panel>
            </View>
          ) : null}

          {activeHistoryTab === 'reviews' ? (
            <View className="mt-5">
              <Panel title="Respuestas abiertas y revisión manual" action={pendingReviews.length > 0 ? `${pendingReviews.length} pendientes` : 'Sin pendientes'}>
                <View style={{ gap: 10 }}>
                  {pendingReviews.map((attempt) => (
                    <ReviewRow key={attempt.id} attempt={attempt} pending onOpenQuestion={handleOpenQuestionReport} />
                  ))}
                  {reviewedAttempts.map((attempt) => (
                    <ReviewRow key={attempt.id} attempt={attempt} onOpenQuestion={handleOpenQuestionReport} />
                  ))}
                  {pendingReviews.length === 0 && reviewedAttempts.length === 0 ? (
                    <EmptyText text="No hay respuestas abiertas pendientes ni revisiones recientes." />
                  ) : null}
                </View>
              </Panel>
            </View>
          ) : null}

          {activeHistoryTab === 'metrics' ? (
            <View className="mt-5 gap-5">
              <View className={isWide ? 'flex-row flex-wrap gap-4' : 'gap-4'}>
                <MetricCard icon="flash-outline" title="XP global" value={(profile?.points ?? 0).toLocaleString()} detail="Experiencia acumulada" color={tokens.gamification.xp} />
                <MetricCard icon="checkmark-circle-outline" title="Precisión" value={stats.accuracyPercent === null ? 'Sin datos' : `${stats.accuracyPercent}%`} detail={`${stats.correctAttempts}/${stats.totalAttempts} respuestas correctas`} color={tokens.semantic.info} />
                <MetricCard icon="close-circle-outline" title="Para practicar" value={String(stats.failedAttempts)} detail="Intentos visibles" color={tokens.semantic.warning} />
                <MetricCard icon="analytics-outline" title="Cobertura" value={stats.coveragePercent === null ? 'Sin datos' : `${stats.coveragePercent}%`} detail={`${stats.answeredQuestions}/${stats.totalQuestions} preguntas vistas`} color={tokens.semantic.success} />
              </View>
              <View className={isDesktop ? 'flex-row items-start gap-5' : 'gap-5'}>
                <Panel title="Cursos y clases">
                  <View className={isWide ? 'flex-row flex-wrap gap-3' : 'gap-3'}>
                    {courseContexts.map((context) => <CourseCard key={`${context.subjectId}:${context.classroomId ?? 'general'}`} context={context} />)}
                    {courseContexts.length === 0 ? <EmptyText text="No hay cursos asociados a este profesor." /> : null}
                  </View>
                </Panel>
                <Panel title="Progreso por tema" action="topic_scores">
                  <View style={{ gap: 10 }}>
                    {topTopicScores.map((score) => (
                      <TopicScoreRowView key={`${score.subjectName}:${score.topicTitle}:${score.playedAt ?? 'no-date'}`} score={score} />
                    ))}
                    {topTopicScores.length === 0 ? <EmptyText text="No hay progreso por tema todavía." /> : null}
                  </View>
                </Panel>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="students" /> : null}
    </View>
  )
}

type StudentHealth = {
  label: string
  detail: string
  color: string
  icon: IconName
}

function StudentSummaryHero({
  studentName,
  course,
  status,
  recommendation,
  points,
  lastActivityAt,
  onAssignReview,
  onOpenCourse,
}: {
  studentName: string
  course: CourseContext | null
  status: StudentHealth
  recommendation: string
  points: number
  lastActivityAt: string | null
  onAssignReview: () => void
  onOpenCourse: () => void
}) {
  const { tokens } = useAppTheme()
  return (
    <View
      className="rounded-2xl border p-5 md:p-6"
      style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}
    >
      <View className="flex-row flex-wrap items-start gap-5">
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${status.color}24` }}>
          <Text className="text-[20px] font-black" style={{ color: tokens.text.primary }}>{getInitials(studentName)}</Text>
        </View>
        <View className="min-w-[240px] flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[22px] font-black" style={{ color: tokens.text.primary }}>Resumen del alumno</Text>
            <View className="flex-row items-center gap-2 rounded-full px-3 py-1.5" style={{ backgroundColor: `${status.color}20` }}>
              <Ionicons name={status.icon} size={15} color={status.color} />
              <Text className="text-[11px] font-black" style={{ color: status.color }}>{status.label}</Text>
            </View>
          </View>
          <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>{status.detail}</Text>
          <View className="mt-4 rounded-xl border p-4" style={{ borderColor: tokens.border.active, backgroundColor: tokens.surface.interactive }}>
            <Text className="text-[11px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.brand.teacher }}>Recomendación docente</Text>
            <Text className="mt-2 text-[15px] font-bold leading-6" style={{ color: tokens.text.primary }}>{recommendation}</Text>
          </View>
        </View>
        <View className="min-w-[220px] gap-3">
          <View className="flex-row gap-3">
            <SummaryValue label="XP" value={points.toLocaleString()} />
            <SummaryValue label="Última actividad" value={lastActivityAt ? getTimeAgo(lastActivityAt) : 'Sin actividad'} />
          </View>
          <Text className="text-[12px]" style={{ color: tokens.text.secondary }} numberOfLines={2}>
            {course ? `${course.subjectName} · ${course.classroomName}` : 'Sin curso principal disponible'}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <AppButton label="Asignar repaso" icon="sparkles-outline" size="sm" role="teacher" disabled={!course} onPress={onAssignReview} />
            <AppButton label="Abrir curso" icon="book-outline" size="sm" variant="secondary" disabled={!course} onPress={onOpenCourse} />
          </View>
        </View>
      </View>
    </View>
  )
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  const { tokens } = useAppTheme()
  return (
    <View className="min-w-[96px] flex-1 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
      <Text className="text-[10px] font-black uppercase tracking-[0.6px]" style={{ color: tokens.text.muted }}>{label}</Text>
      <Text className="mt-1 text-[14px] font-black" style={{ color: tokens.text.primary }} numberOfLines={1}>{value}</Text>
    </View>
  )
}

function getStudentHealth(stats: ReturnType<typeof buildStats>, pendingReviewCount: number, active: boolean): StudentHealth {
  if (!active) return { label: 'Cuenta desactivada', detail: 'El alumno no puede acceder hasta que se reactive su cuenta.', color: '#FB7185', icon: 'lock-closed-outline' }
  if (pendingReviewCount > 0) return { label: 'Revisión pendiente', detail: `Hay ${pendingReviewCount} respuesta${pendingReviewCount === 1 ? '' : 's'} abierta${pendingReviewCount === 1 ? '' : 's'} por revisar.`, color: '#F59E0B', icon: 'chatbox-ellipses-outline' }
  if (stats.totalAttempts === 0) return { label: 'Sin actividad', detail: 'Todavía no hay intentos registrados para valorar su evolución.', color: '#38BDF8', icon: 'time-outline' }
  if ((stats.accuracyPercent ?? 100) < 50) return { label: 'Necesita apoyo', detail: 'La precisión reciente indica que conviene reforzar contenidos concretos.', color: '#F59E0B', icon: 'warning-outline' }
  if ((stats.accuracyPercent ?? 0) >= 80) return { label: 'Buen progreso', detail: 'Mantiene una precisión alta y una evolución positiva.', color: '#34D399', icon: 'checkmark-circle-outline' }
  return { label: 'En seguimiento', detail: 'La evolución es estable; revisa las áreas débiles antes de asignar nuevo contenido.', color: '#A78BFA', icon: 'pulse-outline' }
}

function getStudentRecommendation(
  stats: ReturnType<typeof buildStats>,
  weakTopics: WeakTopic[],
  pendingReviewCount: number,
  course: CourseContext | null,
) {
  if (pendingReviewCount > 0) return 'Revisa primero las respuestas abiertas pendientes para que la nota y el feedback reflejen su trabajo real.'
  if (stats.totalAttempts === 0) return course ? `Invítale a comenzar con una actividad breve de ${course.subjectName}.` : 'Asigna el alumno a un curso antes de crear una recomendación.'
  if (weakTopics[0]) return `Prepara un repaso breve sobre ${weakTopics[0].topicTitle}; concentra ${weakTopics[0].mistakes} error${weakTopics[0].mistakes === 1 ? '' : 'es'} recientes.`
  if ((stats.accuracyPercent ?? 0) >= 80) return 'Mantén el ritmo con una actividad de dificultad media o un reto de ampliación.'
  return 'Revisa la actividad reciente y asigna una práctica corta sobre el último contenido trabajado.'
}

function MetricCard({ icon, title, value, detail, color }: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  value: string
  detail?: string | null
  color: string
}) {
  return (
    <MobileMetricCard
      className="min-w-[190px] flex-1"
      color={color}
      detail={detail}
      icon={icon}
      label={title}
      value={value}
    />
  )
}

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-border-default bg-surface-default p-5">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-[17px] font-black text-white">{title}</Text>
        {action ? <Text className="text-[12px] font-semibold text-brand-student" numberOfLines={1}>{action}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function CourseCard({ context }: { context: CourseContext }) {
  return (
    <View className="min-w-[230px] flex-1 rounded-xl border border-border-default bg-surface-default p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[14px] font-black text-white" numberOfLines={2}>{context.subjectName}</Text>
          <Text className="mt-1 text-[12px] text-text-secondary" numberOfLines={1}>{context.classroomName}</Text>
        </View>
        <Ionicons name="school-outline" size={20} color="#9FD6FF" />
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Tag label={context.academicYear || 'Curso actual'} />
        {context.classroomCode ? <Tag label={`Código ${context.classroomCode}`} /> : null}
      </View>
      <Text className="mt-3 text-[11px] text-text-muted">Inscrito: {formatDate(context.joinedAt)}</Text>
    </View>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-border-default bg-surface-raised px-2.5 py-1">
      <Text className="text-[10px] font-bold text-text-secondary">{label}</Text>
    </View>
  )
}

function EvolutionRow({ bucket }: { bucket: EvolutionBucket }) {
  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-3">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className="text-[12px] font-black text-white">{bucket.label}</Text>
        <Text className="text-[12px] font-black text-semantic-info">{bucket.accuracyPercent}%</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-surface-interactive">
        <View className="h-full rounded-full bg-semantic-info" style={{ width: `${bucket.accuracyPercent}%` }} />
      </View>
      <Text className="mt-2 text-[11px] text-text-muted">
        {bucket.correct}/{bucket.total} aciertos · {bucket.earnedPoints} XP
      </Text>
    </View>
  )
}

function AttemptHistoryRow({ attempt, onOpenQuestion }: { attempt: NormalizedAttempt; onOpenQuestion: (questionId: number) => void }) {
  return (
    <Pressable
      onPress={() => onOpenQuestion(attempt.questionId)}
      className="rounded-xl border border-border-default bg-surface-default p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: attempt.isCorrect ? '#22C55E24' : '#EF444424' }}>
          <Ionicons name={attempt.isCorrect ? 'checkmark' : 'close'} size={17} color={attempt.isCorrect ? '#22C55E' : '#FB7185'} />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[12px] font-black" style={{ color: attempt.isCorrect ? '#58E28B' : '#FB7185' }}>
              {attempt.isCorrect ? 'Correcta' : 'Fallada'}
            </Text>
            <Text className="text-[11px] text-text-muted">{formatDateTime(attempt.attemptedAt)}</Text>
            <Text className="text-[11px] text-gamification-xp">+{attempt.earnedPoints} XP</Text>
          </View>
          <Text className="mt-1 text-[13px] font-bold text-white" numberOfLines={2}>{attempt.questionText}</Text>
          <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>
            {attempt.subjectName} · {attempt.topicTitle} · {questionTypeLabels[attempt.questionType] || attempt.questionType}
          </Text>
          <Text className="mt-1 text-[11px] text-text-secondary" numberOfLines={2}>
            Respuesta: {attempt.answerText}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#8FA7C7" />
      </View>
    </Pressable>
  )
}

function WeakTopicRow({ topic }: { topic: WeakTopic }) {
  const mistakePercent = Math.min(100, Math.round((topic.mistakes / Math.max(topic.totalAttempts, 1)) * 100))

  return (
    <View className="rounded-xl border border-border-default bg-semantic-surface-danger p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-black text-white" numberOfLines={2}>{topic.topicTitle}</Text>
          <Text className="mt-1 text-[11px] text-semantic-warning" numberOfLines={1}>{topic.subjectName}</Text>
        </View>
        <Text className="text-[12px] font-black text-semantic-warning">{topic.mistakes} errores</Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-semantic-surface-warning">
        <View className="h-full rounded-full bg-semantic-warning" style={{ width: `${mistakePercent}%` }} />
      </View>
      <Text className="mt-2 text-[11px] text-semantic-warning">
        {topic.accuracyPercent}% de acierto · Último intento: {getTimeAgo(topic.lastAttemptAt)}
      </Text>
    </View>
  )
}

function FailedQuestionRow({ attempt, onOpenQuestion }: { attempt: NormalizedAttempt; onOpenQuestion: (questionId: number) => void }) {
  return (
    <Pressable
      onPress={() => onOpenQuestion(attempt.questionId)}
      className="rounded-xl border border-border-subtle bg-background-primary p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="flex-row items-start gap-3">
        <Ionicons name="alert-circle-outline" size={18} color="#FB7185" />
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-bold text-white" numberOfLines={2}>{attempt.questionText}</Text>
          <Text className="mt-1 text-[11px] text-text-secondary" numberOfLines={1}>{attempt.subjectName} · {attempt.topicTitle}</Text>
          <Text className="mt-1 text-[11px] text-text-secondary" numberOfLines={2}>Respuesta del alumno: {attempt.answerText}</Text>
        </View>
      </View>
    </Pressable>
  )
}

function ReviewRow({ attempt, pending = false, onOpenQuestion }: { attempt: NormalizedAttempt; pending?: boolean; onOpenQuestion: (questionId: number) => void }) {
  const color = pending ? '#F59E0B' : attempt.manualReviewStatus === 'approved' ? '#22C55E' : '#FB7185'

  return (
    <Pressable
      onPress={() => onOpenQuestion(attempt.questionId)}
      className="rounded-xl border border-border-default bg-surface-default p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
          <Ionicons name={pending ? 'hourglass-outline' : 'checkmark-done-outline'} size={17} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] font-black" style={{ color }}>{getReviewStatusLabel(attempt.manualReviewStatus)}</Text>
          <Text className="mt-1 text-[13px] font-bold text-white" numberOfLines={2}>{attempt.questionText}</Text>
          <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>
            {attempt.reviewedAt ? `Revisado: ${formatDateTime(attempt.reviewedAt)}` : `Intento: ${formatDateTime(attempt.attemptedAt)}`}
          </Text>
          {attempt.reviewNotes ? <Text className="mt-1 text-[11px] text-text-secondary" numberOfLines={2}>Notas: {attempt.reviewNotes}</Text> : null}
        </View>
      </View>
    </Pressable>
  )
}

function TopicScoreRowView({ score }: { score: { subjectName: string; topicTitle: string; maxScore: number; playedAt: string | null } }) {
  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-black text-white" numberOfLines={2}>{score.topicTitle}</Text>
          <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>{score.subjectName}</Text>
        </View>
        <Text className="text-[14px] font-black text-gamification-xp">{score.maxScore} XP</Text>
      </View>
      <Text className="mt-2 text-[11px] text-text-muted">Última práctica: {formatDateTime(score.playedAt)}</Text>
    </View>
  )
}

function EmptyText({ text }: { text: string }) {
  return <Text className="text-[13px] leading-5 text-text-muted">{text}</Text>
}

function buildCourseContexts(enrollments: EnrollmentRow[]): CourseContext[] {
  const seen = new Set<string>()

  return enrollments.reduce<CourseContext[]>((items, enrollment) => {
    const subject = one(enrollment.subjects)
    const classroom = one(enrollment.classrooms)
    const subjectId = Number(enrollment.subject_id)
    const classroomId = typeof enrollment.classroom_id === 'number' ? enrollment.classroom_id : null
    const key = `${subjectId}:${classroomId ?? 'general'}`
    if (seen.has(key)) return items
    seen.add(key)

    items.push({
      enrollmentId: enrollment.id,
      subjectId,
      subjectName: subject?.name || 'Curso',
      classroomId,
      classroomName: classroom?.name || 'Clase principal',
      classroomCode: classroom?.code || null,
      academicYear: classroom?.academic_year || subject?.academic_year || null,
      joinedAt: enrollment.joined_at || null,
    })

    return items
  }, [])
}

function normalizeAttempt(row: AttemptRow): NormalizedAttempt {
  const question = one(row.questions)
  const subject = one(question?.subjects)
  const classroom = one(question?.classrooms)
  const topic = one(question?.subject_topics)
  const answer = one(row.answers)

  return {
    id: Number(row.id),
    questionId: Number(row.question_id),
    questionText: question?.text || 'Pregunta sin texto',
    questionType: question?.type || 'unknown',
    subjectId: typeof question?.subject_id === 'number' ? question.subject_id : null,
    subjectName: subject?.name || 'Curso',
    classroomId: typeof question?.classroom_id === 'number' ? question.classroom_id : null,
    classroomName: classroom?.name || 'Clase principal',
    topicId: typeof question?.topic_id === 'number' ? question.topic_id : null,
    topicTitle: topic?.title || 'Práctica general',
    answerText: getAttemptAnswerText(row, answer),
    isCorrect: Boolean(row.is_correct),
    earnedPoints: row.earned_points ?? 0,
    timeTakenSeconds: row.time_taken_seconds ?? null,
    hintUsed: Boolean(row.hint_used),
    wasSkipped: Boolean(row.was_skipped),
    attemptedAt: row.attempted_at || row.created_at || null,
    manualReviewStatus: row.manual_review_status || 'not_required',
    reviewedAt: row.reviewed_at || null,
    reviewNotes: row.review_notes || null,
    difficulty: question?.difficulty ?? null,
  }
}

function getAttemptAnswerText(row: AttemptRow, answer: AnswerRelation | null) {
  if (row.was_skipped) return 'Omitida'
  if (row.submitted_answer_text?.trim()) return row.submitted_answer_text.trim()
  if (answer?.text?.trim()) return answer.text.trim()
  if (row.submitted_answer_payload) return 'Respuesta interactiva'
  return 'Sin respuesta registrada'
}

function buildStats(
  attempts: NormalizedAttempt[],
  questions: QuestionRow[],
  subjectScores: SubjectScoreRow[],
  subjectIdsInView: Set<number>
) {
  const totalAttempts = attempts.length
  const correctAttempts = attempts.filter((attempt) => attempt.isCorrect).length
  const failedAttempts = totalAttempts - correctAttempts
  const earnedPoints = attempts.reduce((sum, attempt) => sum + attempt.earnedPoints, 0)
  const lastActivityAt = attempts.map((attempt) => attempt.attemptedAt).filter(Boolean).sort((a, b) => getTimeValue(b) - getTimeValue(a))[0] || null
  const totalTime = attempts.reduce((sum, attempt) => sum + (attempt.timeTakenSeconds ?? 0), 0)
  const attemptsWithTime = attempts.filter((attempt) => typeof attempt.timeTakenSeconds === 'number' && attempt.timeTakenSeconds >= 0).length
  const answeredQuestions = new Set(attempts.map((attempt) => attempt.questionId)).size
  const totalQuestions = questions.filter((question) => typeof question.subject_id === 'number' && subjectIdsInView.has(question.subject_id)).length
  const scoreXp = subjectScores
    .filter((score) => subjectIdsInView.has(Number(score.subject_id)))
    .reduce((sum, score) => sum + (score.max_score ?? 0), 0)

  return {
    totalAttempts,
    correctAttempts,
    failedAttempts,
    earnedPoints,
    scoreXp,
    accuracyPercent: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null,
    lastActivityAt,
    averageTimeSeconds: attemptsWithTime > 0 ? Math.round(totalTime / attemptsWithTime) : null,
    answeredQuestions,
    totalQuestions,
    coveragePercent: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : null,
  }
}

function buildWeakTopics(attempts: NormalizedAttempt[]): WeakTopic[] {
  const map = new Map<string, WeakTopic>()

  attempts.forEach((attempt) => {
    const key = `${attempt.subjectId ?? 'general'}:${attempt.topicId ?? 'general'}`
    const previous = map.get(key) || {
      key,
      subjectName: attempt.subjectName,
      topicTitle: attempt.topicTitle,
      totalAttempts: 0,
      mistakes: 0,
      accuracyPercent: 0,
      lastAttemptAt: null,
    }

    const totalAttempts = previous.totalAttempts + 1
    const mistakes = previous.mistakes + (attempt.isCorrect ? 0 : 1)
    const correct = totalAttempts - mistakes
    const lastAttemptAt = getTimeValue(attempt.attemptedAt) > getTimeValue(previous.lastAttemptAt) ? attempt.attemptedAt : previous.lastAttemptAt

    map.set(key, {
      ...previous,
      totalAttempts,
      mistakes,
      accuracyPercent: Math.round((correct / totalAttempts) * 100),
      lastAttemptAt,
    })
  })

  return Array.from(map.values())
    .filter((topic) => topic.mistakes > 0)
    .sort((a, b) => b.mistakes - a.mistakes || a.accuracyPercent - b.accuracyPercent || getTimeValue(b.lastAttemptAt) - getTimeValue(a.lastAttemptAt))
    .slice(0, 6)
}

function buildEvolution(attempts: NormalizedAttempt[]): EvolutionBucket[] {
  const map = new Map<string, { total: number; correct: number; earnedPoints: number }>()

  attempts.forEach((attempt) => {
    const dateKey = toDateKey(attempt.attemptedAt)
    if (!dateKey) return
    const previous = map.get(dateKey) || { total: 0, correct: 0, earnedPoints: 0 }
    map.set(dateKey, {
      total: previous.total + 1,
      correct: previous.correct + (attempt.isCorrect ? 1 : 0),
      earnedPoints: previous.earnedPoints + attempt.earnedPoints,
    })
  })

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([dateKey, value]) => ({
      dateKey,
      label: formatShortDate(dateKey),
      total: value.total,
      correct: value.correct,
      accuracyPercent: value.total > 0 ? Math.round((value.correct / value.total) * 100) : 0,
      earnedPoints: value.earnedPoints,
    }))
}

function normalizeTopicScores(rows: TopicScoreRow[]) {
  return rows
    .map((row) => {
      const topic = one(row.subject_topics)
      const subject = one(row.subjects)
      return {
        subjectName: subject?.name || 'Curso',
        topicTitle: topic?.title || 'Tema',
        maxScore: row.max_score ?? 0,
        playedAt: row.played_at || null,
      }
    })
    .sort((a, b) => getTimeValue(b.playedAt) - getTimeValue(a.playedAt) || b.maxScore - a.maxScore)
}

function getReviewStatusLabel(status: string) {
  if (status === 'pending') return 'Pendiente de revisión'
  if (status === 'approved') return 'Aprobada por el profesor'
  if (status === 'rejected') return 'Rechazada por el profesor'
  return 'Sin revisión manual'
}

function one<T>(value: Related<T>): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function toDateKey(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function getTimeValue(value: string | null | undefined) {
  if (!value) return 0
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}


function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`)
    return
  }

  Alert.alert(title, message)
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin registro'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin registro'
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Sin registro'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin registro'
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'AL'
}
