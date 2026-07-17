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
import { supabase } from '../../../../lib/supabase'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../../lib/mobileLayout'
import { getTimeAgo } from '../../../../lib/time'
import TeacherSidebar from '../../../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../../../components/teacher/TeacherBottomNav'
import NotificationBadge from '../../../../components/NotificationBadge'
import TeacherHeaderAvatar from '../../../../components/teacher/TeacherHeaderAvatar'
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
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [subjectScores, setSubjectScores] = useState<SubjectScoreRow[]>([])
  const [topicScores, setTopicScores] = useState<TopicScoreRow[]>([])
  const [attempts, setAttempts] = useState<NormalizedAttempt[]>([])
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isDesktop = width >= 1080
  const isWide = width >= 900
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
        (supabase.from('attempt_history') as any)
          .select(`
            id,
            student_id,
            question_id,
            answer_id,
            is_correct,
            time_taken_seconds,
            attempted_at,
            created_at,
            earned_points,
            hint_used,
            was_skipped,
            submitted_answer_text,
            submitted_answer_payload,
            manual_review_status,
            reviewed_at,
            review_notes,
            answers(id, text),
            questions!inner(
              id,
              text,
              type,
              subject_id,
              classroom_id,
              topic_id,
              difficulty,
              explanation,
              subjects!inner(id, name, teacher_id),
              classrooms(id, name, code),
              subject_topics(id, title)
            )
          `)
          .eq('student_id', studentId)
          .in('questions.subject_id', subjectIds)
          .order('attempted_at', { ascending: false })
          .limit(300),
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

      const normalizedAttempts = ((attemptsResult.error ? [] : attemptsResult.data || []) as AttemptRow[])
        .map(normalizeAttempt)
        .sort((a, b) => getTimeValue(b.attemptedAt) - getTimeValue(a.attemptedAt))

      setAttempts(normalizedAttempts)
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
  }, [studentId])

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
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando historial del alumno...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
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
          <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[260px] flex-1">
              <Pressable onPress={goBackToStudents} className="mb-4 flex-row items-center gap-2 self-start rounded-xl border border-[#20375E] bg-[#07162E] px-3 py-2">
                <Ionicons name="arrow-back" size={16} color="#DDE7F4" />
                <Text className="text-[12px] font-bold text-[#DDE7F4]">Volver a estudiantes</Text>
              </Pressable>
              <View className="flex-row items-center gap-3">
                <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#17315E]">
                  <Text className="text-[18px] font-black text-white">{getInitials(studentName)}</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[36px] font-black text-white" numberOfLines={2}>{studentName}</Text>
                  <Text className="mt-1 text-[13px] text-[#B7C4D7]" numberOfLines={2}>{headerSubtitle}</Text>
                </View>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              <NotificationBadge
                audience="teacher"
                onPress={() => router.push('/(teacher)/notifications' as any)}
              />
              <TeacherHeaderAvatar />
            </View>
          </View>

          {errorMessage ? (
            <View className="rounded-2xl border border-[#4A2B1A] bg-[#21140A] p-5">
              <View className="flex-row items-start gap-3">
                <Ionicons name="warning-outline" size={24} color="#F59E0B" />
                <View className="min-w-0 flex-1">
                  <Text className="text-[18px] font-black text-white">No se pudo mostrar el historial</Text>
                  <Text className="mt-2 text-[13px] leading-5 text-[#F8D7A1]">{errorMessage}</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View className={isWide ? 'flex-row flex-wrap gap-4' : 'gap-4'}>
            <MetricCard icon="flash-outline" title="XP global" value={(profile?.points ?? 0).toLocaleString()} detail="profiles.points sincronizado" color="#FBBF24" />
            <MetricCard icon="checkmark-circle-outline" title="Precisión" value={stats.accuracyPercent === null ? 'Sin datos' : `${stats.accuracyPercent}%`} detail={`${stats.correctAttempts}/${stats.totalAttempts} respuestas correctas`} color="#38BDF8" />
            <MetricCard icon="close-circle-outline" title="Preguntas falladas" value={String(stats.failedAttempts)} detail="Base para refuerzo" color="#FB7185" />
            <MetricCard icon="trophy-outline" title="XP en intentos" value={stats.earnedPoints.toLocaleString()} detail="attempt_history.earned_points" color="#8B5CF6" />
            <MetricCard icon="time-outline" title="Última actividad" value={stats.lastActivityAt ? getTimeAgo(stats.lastActivityAt) : 'Sin actividad'} detail={formatDateTime(stats.lastActivityAt)} color="#9FD6FF" />
            <MetricCard icon="analytics-outline" title="Cobertura" value={stats.coveragePercent === null ? 'Sin datos' : `${stats.coveragePercent}%`} detail={`${stats.answeredQuestions}/${stats.totalQuestions} preguntas vistas`} color="#34D399" />
          </View>

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <View className={isDesktop ? 'flex-[1.55] gap-5' : 'gap-5'}>
              <Panel title="Datos generales del alumno" action={profile?.active === false ? 'Usuario desactivado' : 'Usuario activo'}>
                <View className="flex-row flex-wrap gap-3">
                  <InfoPill icon="person-outline" label="ID" value={studentId || 'Sin ID'} />
                  <InfoPill icon="calendar-outline" label="Alta" value={formatDate(profile?.created_at)} />
                  <InfoPill icon="school-outline" label="Cursos del profesor" value={String(courseContexts.length)} />
                  <InfoPill icon="speedometer-outline" label="Tiempo medio" value={stats.averageTimeSeconds === null ? 'Sin datos' : `${stats.averageTimeSeconds}s`} />
                </View>
              </Panel>

              <Panel title="Cursos y clases">
                <View className={isWide ? 'flex-row flex-wrap gap-3' : 'gap-3'}>
                  {courseContexts.map((context) => (
                    <CourseCard key={`${context.subjectId}:${context.classroomId ?? 'general'}`} context={context} />
                  ))}
                  {courseContexts.length === 0 ? <EmptyText text="No hay cursos asociados a este profesor." /> : null}
                </View>
              </Panel>

              <Panel title="Evolución reciente" action="Últimos 10 días con actividad">
                <View style={{ gap: 10 }}>
                  {evolution.map((bucket) => (
                    <EvolutionRow key={bucket.dateKey} bucket={bucket} />
                  ))}
                  {evolution.length === 0 ? <EmptyText text="La evolución aparecerá cuando el alumno tenga intentos registrados." /> : null}
                </View>
              </Panel>

              <Panel title="Intentos recientes" action={`${attemptsInView.length} registros`}>
                <View style={{ gap: 10 }}>
                  {attemptsInView.slice(0, 16).map((attempt) => (
                    <AttemptHistoryRow key={attempt.id} attempt={attempt} onOpenQuestion={handleOpenQuestionReport} />
                  ))}
                  {attemptsInView.length === 0 ? <EmptyText text="Todavía no hay intentos en tus cursos para este alumno." /> : null}
                </View>
              </Panel>
            </View>

            <View className={isDesktop ? 'flex-1 gap-5' : 'gap-5'}>
              <Panel title="Acciones docentes">
                <View style={{ gap: 12 }}>
                  <TeacherActionCard
                    icon="add-circle-outline"
                    title="Asignar repaso"
                    detail={weakTopics[0] ? `Crear refuerzo sobre ${weakTopics[0].topicTitle}` : 'Crear una actividad de refuerzo para el alumno'}
                    onPress={handleAssignReview}
                    disabled={!mainCourse}
                  />
                  <TeacherActionCard
                    icon="book-outline"
                    title="Abrir curso principal"
                    detail={mainCourse ? `${mainCourse.subjectName} · ${mainCourse.classroomName}` : 'No hay curso disponible'}
                    onPress={handleOpenMainSubject}
                    disabled={!mainCourse}
                  />
                  <TeacherActionCard
                    icon="bug-outline"
                    title="Analizar pregunta fallada"
                    detail={failedAttempts[0] ? failedAttempts[0].questionText : 'No hay errores registrados'}
                    onPress={() => failedAttempts[0] ? handleOpenQuestionReport(failedAttempts[0].questionId) : undefined}
                    disabled={!failedAttempts[0]}
                  />
                  <TeacherActionCard
                    icon="download-outline"
                    title="Exportar historial"
                    detail="Descargar CSV con intentos, errores, revisión y contexto del alumno"
                    onPress={handleExportStudentHistoryCsv}
                  />
                  <TeacherActionCard
                    icon="people-outline"
                    title="Volver al listado filtrado"
                    detail="Gestionar matrícula, progreso y acciones masivas"
                    onPress={goBackToStudents}
                  />
                </View>
              </Panel>

              <Panel title="Temas débiles" action="Por errores acumulados">
                <View style={{ gap: 10 }}>
                  {weakTopics.map((topic) => (
                    <WeakTopicRow key={topic.key} topic={topic} />
                  ))}
                  {weakTopics.length === 0 ? <EmptyText text={attemptsInView.length === 0 ? 'Sin intentos todavía.' : 'No hay temas débiles detectados.'} /> : null}
                </View>
              </Panel>

              <Panel title="Preguntas falladas">
                <View style={{ gap: 10 }}>
                  {failedAttempts.map((attempt) => (
                    <FailedQuestionRow key={attempt.id} attempt={attempt} onOpenQuestion={handleOpenQuestionReport} />
                  ))}
                  {failedAttempts.length === 0 ? <EmptyText text="No hay preguntas falladas en el rango actual." /> : null}
                </View>
              </Panel>

              <Panel title="Revisión docente" action={pendingReviews.length > 0 ? `${pendingReviews.length} pendientes` : 'Sin pendientes'}>
                <View style={{ gap: 10 }}>
                  {pendingReviews.slice(0, 4).map((attempt) => (
                    <ReviewRow key={attempt.id} attempt={attempt} pending onOpenQuestion={handleOpenQuestionReport} />
                  ))}
                  {reviewedAttempts.map((attempt) => (
                    <ReviewRow key={attempt.id} attempt={attempt} onOpenQuestion={handleOpenQuestionReport} />
                  ))}
                  {pendingReviews.length === 0 && reviewedAttempts.length === 0 ? (
                    <EmptyText text="Aquí aparecerán respuestas abiertas pendientes o ya revisadas por el profesor." />
                  ) : null}
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
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="students" /> : null}
    </View>
  )
}

function MetricCard({
  icon,
  title,
  value,
  detail,
  color,
}: {
  icon: IconName
  title: string
  value: string
  detail?: string
  color: string
}) {
  return (
    <View className="min-w-[176px] flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="flex-row items-center gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${color}30` }}>
          <Ionicons name={icon} size={26} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] text-[#B7C4D7]">{title}</Text>
          <Text className="mt-1 text-[24px] font-black text-white" numberOfLines={1}>{value}</Text>
          {detail ? <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={2}>{detail}</Text> : null}
        </View>
      </View>
    </View>
  )
}

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-[17px] font-black text-white">{title}</Text>
        {action ? <Text className="text-[12px] font-semibold text-[#B9A7FF]" numberOfLines={1}>{action}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function InfoPill({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View className="min-w-[160px] flex-1 rounded-xl border border-[#20375E] bg-[#07162E] p-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={15} color="#9FD6FF" />
        <Text className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#8FA7C7]">{label}</Text>
      </View>
      <Text className="mt-2 text-[13px] font-black text-white" numberOfLines={2}>{value}</Text>
    </View>
  )
}

function CourseCard({ context }: { context: CourseContext }) {
  return (
    <View className="min-w-[230px] flex-1 rounded-xl border border-[#20375E] bg-[#071A32] p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[14px] font-black text-white" numberOfLines={2}>{context.subjectName}</Text>
          <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>{context.classroomName}</Text>
        </View>
        <Ionicons name="school-outline" size={20} color="#9FD6FF" />
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Tag label={context.academicYear || 'Curso actual'} />
        {context.classroomCode ? <Tag label={`Código ${context.classroomCode}`} /> : null}
      </View>
      <Text className="mt-3 text-[11px] text-[#8FA7C7]">Inscrito: {formatDate(context.joinedAt)}</Text>
    </View>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-[#28446D] bg-[#0D1D3B] px-2.5 py-1">
      <Text className="text-[10px] font-bold text-[#B7C4D7]">{label}</Text>
    </View>
  )
}

function EvolutionRow({ bucket }: { bucket: EvolutionBucket }) {
  return (
    <View className="rounded-xl border border-[#20375E] bg-[#07162E] p-3">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className="text-[12px] font-black text-white">{bucket.label}</Text>
        <Text className="text-[12px] font-black text-[#9FD6FF]">{bucket.accuracyPercent}%</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
        <View className="h-full rounded-full bg-[#38BDF8]" style={{ width: `${bucket.accuracyPercent}%` }} />
      </View>
      <Text className="mt-2 text-[11px] text-[#8FA7C7]">
        {bucket.correct}/{bucket.total} aciertos · {bucket.earnedPoints} XP
      </Text>
    </View>
  )
}

function AttemptHistoryRow({ attempt, onOpenQuestion }: { attempt: NormalizedAttempt; onOpenQuestion: (questionId: number) => void }) {
  return (
    <Pressable
      onPress={() => onOpenQuestion(attempt.questionId)}
      className="rounded-xl border border-[#20375E] bg-[#071A32] p-3"
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
            <Text className="text-[11px] text-[#8FA7C7]">{formatDateTime(attempt.attemptedAt)}</Text>
            <Text className="text-[11px] text-[#FBBF24]">+{attempt.earnedPoints} XP</Text>
          </View>
          <Text className="mt-1 text-[13px] font-bold text-white" numberOfLines={2}>{attempt.questionText}</Text>
          <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={1}>
            {attempt.subjectName} · {attempt.topicTitle} · {questionTypeLabels[attempt.questionType] || attempt.questionType}
          </Text>
          <Text className="mt-1 text-[11px] text-[#AFC2DB]" numberOfLines={2}>
            Respuesta: {attempt.answerText}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#8FA7C7" />
      </View>
    </Pressable>
  )
}

function TeacherActionCard({
  icon,
  title,
  detail,
  disabled = false,
  onPress,
}: {
  icon: IconName
  title: string
  detail: string
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      className="flex-row items-center gap-3 rounded-xl border border-[#20375E] bg-[#07162E] p-3"
      style={({ pressed }) => ({ opacity: disabled ? 0.48 : pressed ? 0.82 : 1 })}
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#5A46D833]">
        <Ionicons name={icon} size={20} color="#B9A7FF" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-black text-white">{title}</Text>
        <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={2}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8FA7C7" />
    </Pressable>
  )
}

function WeakTopicRow({ topic }: { topic: WeakTopic }) {
  const mistakePercent = Math.min(100, Math.round((topic.mistakes / Math.max(topic.totalAttempts, 1)) * 100))

  return (
    <View className="rounded-xl border border-[#4A2B1A] bg-[#21140A] p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-black text-white" numberOfLines={2}>{topic.topicTitle}</Text>
          <Text className="mt-1 text-[11px] text-[#F8D7A1]" numberOfLines={1}>{topic.subjectName}</Text>
        </View>
        <Text className="text-[12px] font-black text-[#F59E0B]">{topic.mistakes} errores</Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#3A2511]">
        <View className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${mistakePercent}%` }} />
      </View>
      <Text className="mt-2 text-[11px] text-[#F8D7A1]">
        {topic.accuracyPercent}% de acierto · Último intento: {getTimeAgo(topic.lastAttemptAt)}
      </Text>
    </View>
  )
}

function FailedQuestionRow({ attempt, onOpenQuestion }: { attempt: NormalizedAttempt; onOpenQuestion: (questionId: number) => void }) {
  return (
    <Pressable
      onPress={() => onOpenQuestion(attempt.questionId)}
      className="rounded-xl border border-[#3E2232] bg-[#1B1020] p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="flex-row items-start gap-3">
        <Ionicons name="alert-circle-outline" size={18} color="#FB7185" />
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-bold text-white" numberOfLines={2}>{attempt.questionText}</Text>
          <Text className="mt-1 text-[11px] text-[#F8B4C4]" numberOfLines={1}>{attempt.subjectName} · {attempt.topicTitle}</Text>
          <Text className="mt-1 text-[11px] text-[#AFC2DB]" numberOfLines={2}>Respuesta del alumno: {attempt.answerText}</Text>
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
      className="rounded-xl border border-[#20375E] bg-[#071A32] p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
          <Ionicons name={pending ? 'hourglass-outline' : 'checkmark-done-outline'} size={17} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] font-black" style={{ color }}>{getReviewStatusLabel(attempt.manualReviewStatus)}</Text>
          <Text className="mt-1 text-[13px] font-bold text-white" numberOfLines={2}>{attempt.questionText}</Text>
          <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={1}>
            {attempt.reviewedAt ? `Revisado: ${formatDateTime(attempt.reviewedAt)}` : `Intento: ${formatDateTime(attempt.attemptedAt)}`}
          </Text>
          {attempt.reviewNotes ? <Text className="mt-1 text-[11px] text-[#AFC2DB]" numberOfLines={2}>Notas: {attempt.reviewNotes}</Text> : null}
        </View>
      </View>
    </Pressable>
  )
}

function TopicScoreRowView({ score }: { score: { subjectName: string; topicTitle: string; maxScore: number; playedAt: string | null } }) {
  return (
    <View className="rounded-xl border border-[#20375E] bg-[#07162E] p-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-black text-white" numberOfLines={2}>{score.topicTitle}</Text>
          <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={1}>{score.subjectName}</Text>
        </View>
        <Text className="text-[14px] font-black text-[#FBBF24]">{score.maxScore} XP</Text>
      </View>
      <Text className="mt-2 text-[11px] text-[#8FA7C7]">Última práctica: {formatDateTime(score.playedAt)}</Text>
    </View>
  )
}

function EmptyText({ text }: { text: string }) {
  return <Text className="text-[13px] leading-5 text-[#8FA7C7]">{text}</Text>
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
