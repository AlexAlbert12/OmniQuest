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
import { supabase } from '../../../lib/supabase'
import { getTimeAgo } from '../../../lib/time'
import TeacherSidebar from '../../../components/teacher/TeacherSidebar'
import BrandLogo from '../../../components/BrandLogo'
import NotificationBadge from '../../../components/NotificationBadge'
import TeacherHeaderAvatar from '../../../components/teacher/TeacherHeaderAvatar'
import { exportCsvFile, formatExportDateTime, slugifyFilename } from '../../../lib/reportExports'

type QuestionDetail = {
  id: number
  text: string
  type: string | null
  subject_id: number | null
  classroom_id: number | null
  topic_id: number | null
  explanation: string | null
  points_base: number | null
  time_limit_seconds: number | null
  difficulty: number | null
  active: boolean | null
  subjects?: { id: number; name: string | null; teacher_id: string | null } | { id: number; name: string | null; teacher_id: string | null }[] | null
  classrooms?: { id: number; name: string | null; code: string | null } | { id: number; name: string | null; code: string | null }[] | null
  subject_topics?: { id: number; title: string | null } | { id: number; title: string | null }[] | null
}

type AnswerRow = {
  id: number
  text: string
  is_correct: boolean | null
  sort_order: number | null
}

type AttemptRow = {
  id: number
  student_id: string | null
  answer_id: number | null
  is_correct: boolean | null
  time_taken_seconds: number | null
  attempted_at: string | null
  submitted_answer_text?: string | null
  submitted_answer_payload?: unknown
  earned_points?: number | null
  hint_used?: boolean | null
  was_skipped?: boolean | null
  manual_review_status?: string | null
}

type StudentProfile = {
  id: string
  alias: string | null
  avatar: string | null
}

type AttemptDetail = AttemptRow & {
  studentAlias: string
  answerLabel: string
  classroomId: number | null
  classroomName: string
}

type AnswerDistributionItem = {
  label: string
  count: number
  correct: boolean
  percent: number
}

type ClassroomPerformanceRow = {
  key: string
  classroomName: string
  attempts: number
  correct: number
  failed: number
  failureRate: number
  affectedStudents: number
}

type TemporalPerformanceRow = {
  key: string
  label: string
  attempts: number
  correct: number
  failed: number
  failureRate: number
}

type ClassroomOption = {
  id: number
  name: string | null
  code: string | null
}

type EnrollmentRow = {
  student_id: string
  classroom_id: number | null
}

type AttemptStatusFilter = 'all' | 'correct' | 'incorrect'
type AttemptDateFilter = 'all' | 'today' | '7d' | '30d'

const attemptStatusFilters: { value: AttemptStatusFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'all', label: 'Todos', icon: 'list-outline' },
  { value: 'correct', label: 'Correctas', icon: 'checkmark-circle-outline' },
  { value: 'incorrect', label: 'Incorrectas', icon: 'close-circle-outline' },
]

const attemptDateFilters: { value: AttemptDateFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'all', label: 'Todas las fechas', icon: 'calendar-outline' },
  { value: 'today', label: 'Hoy', icon: 'today-outline' },
  { value: '7d', label: '7 días', icon: 'calendar-number-outline' },
  { value: '30d', label: '30 días', icon: 'calendar-clear-outline' },
]

const questionTypeLabels: Record<string, string> = {
  multiple_choice: 'Tipo test',
  true_false: 'Verdadero/Falso',
  fill_blank: 'Rellenar huecos',
  match_pairs: 'Emparejar',
  ordering: 'Ordenar',
  open_answer: 'Respuesta abierta',
}

export default function TeacherQuestionReportScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [question, setQuestion] = useState<QuestionDetail | null>(null)
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [attempts, setAttempts] = useState<AttemptDetail[]>([])
  const [classroomOptions, setClassroomOptions] = useState<ClassroomOption[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | 'all'>('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<AttemptStatusFilter>('all')
  const [selectedDateFilter, setSelectedDateFilter] = useState<AttemptDateFilter>('all')
  const [duplicating, setDuplicating] = useState(false)
  const [creatingReview, setCreatingReview] = useState(false)
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isDesktop = width >= 1080
  const isWide = width >= 900
  const isPhone = width < 640
  const questionId = Number(Array.isArray(id) ? id[0] : id)

  const fetchReport = useCallback(async () => {
    if (!Number.isFinite(questionId)) {
      setErrorMessage('La pregunta no es válida.')
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

      const [questionResult, answersResult, attemptsResult, subjectsResult] = await Promise.all([
        supabase
          .from('questions')
          .select(`
            id,
            text,
            type,
            subject_id,
            classroom_id,
            topic_id,
            explanation,
            points_base,
            time_limit_seconds,
            difficulty,
            active,
            subjects(id, name, teacher_id),
            classrooms(id, name, code),
            subject_topics(id, title)
          `)
          .eq('id', questionId)
          .maybeSingle(),
        supabase
          .from('answers')
          .select('id, text, is_correct, sort_order')
          .eq('question_id', questionId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('attempt_history')
          .select(`
            id,
            student_id,
            answer_id,
            is_correct,
            time_taken_seconds,
            attempted_at,
            submitted_answer_text,
            submitted_answer_payload,
            earned_points,
            hint_used,
            was_skipped,
            manual_review_status
          `)
          .eq('question_id', questionId)
          .order('attempted_at', { ascending: false })
          .limit(250),
        supabase
          .from('subjects')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', teacherId)
          .eq('is_archived', false),
      ])

      if (questionResult.error) throw questionResult.error
      if (answersResult.error) throw answersResult.error
      if (attemptsResult.error) throw attemptsResult.error
      if (subjectsResult.error) throw subjectsResult.error

      const nextQuestion = questionResult.data as QuestionDetail | null
      const subject = normalizeRelation(nextQuestion?.subjects)

      if (!nextQuestion || subject?.teacher_id !== teacherId) {
        setQuestion(null)
        setAttempts([])
        setAnswers([])
        setClassroomOptions([])
        setSubjectsCount(subjectsResult.count || 0)
        setErrorMessage('No tienes acceso a este informe o la pregunta no existe.')
        return
      }

      const nextAnswers = ((answersResult.data || []) as AnswerRow[])
      const nextAttempts = ((attemptsResult.data || []) as AttemptRow[])
      const studentIds = Array.from(
        new Set(nextAttempts.map((attempt) => attempt.student_id).filter((value): value is string => Boolean(value)))
      )
      const profilesById = studentIds.length > 0 ? await fetchProfilesById(studentIds) : new Map<string, StudentProfile>()
      const answersById = new Map(nextAnswers.map((answer) => [answer.id, answer]))
      let nextClassrooms: ClassroomOption[] = []
      let enrollmentsByStudentId = new Map<string, EnrollmentRow[]>()

      if (typeof nextQuestion.subject_id === 'number') {
        const classroomsResult = await supabase
          .from('classrooms')
          .select('id, name, code')
          .eq('subject_id', nextQuestion.subject_id)
          .neq('active', false)
          .order('created_at', { ascending: false })

        if (classroomsResult.error) throw classroomsResult.error
        nextClassrooms = (classroomsResult.data || []) as ClassroomOption[]

        if (studentIds.length > 0) {
          const enrollmentsResult = await supabase
            .from('enrollments')
            .select('student_id, classroom_id')
            .eq('subject_id', nextQuestion.subject_id)
            .in('student_id', studentIds)

          if (enrollmentsResult.error) throw enrollmentsResult.error
          enrollmentsByStudentId = groupEnrollmentsByStudent((enrollmentsResult.data || []) as EnrollmentRow[])
        }
      }

      const classroomsById = new Map(nextClassrooms.map((classroom) => [classroom.id, classroom]))
      const decoratedAttempts = nextAttempts.map((attempt) => {
        const classroomInfo = getAttemptClassroomInfo(attempt, nextQuestion, enrollmentsByStudentId, classroomsById)
        return {
          ...attempt,
          studentAlias: getStudentAlias(attempt.student_id, profilesById),
          answerLabel: getAttemptAnswerLabel(attempt, answersById),
          classroomId: classroomInfo.id,
          classroomName: classroomInfo.name,
        }
      })

      setQuestion(nextQuestion)
      setAnswers(nextAnswers)
      setClassroomOptions(nextClassrooms)
      setSubjectsCount(subjectsResult.count || 0)
      setAttempts(decoratedAttempts)
    } catch (error: any) {
      console.error('Error cargando informe de pregunta:', error)
      setErrorMessage(error?.message || 'No se pudo cargar el informe de la pregunta.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [questionId])

  useFocusEffect(
    useCallback(() => {
      void fetchReport()
    }, [fetchReport])
  )

  const filteredAttempts = useMemo(
    () => attempts.filter((attempt) => matchesAttemptFilters(attempt, selectedClassroomId, selectedStatusFilter, selectedDateFilter)),
    [attempts, selectedClassroomId, selectedDateFilter, selectedStatusFilter]
  )
  const stats = useMemo(() => buildReportStats(filteredAttempts), [filteredAttempts])
  const answerDistribution = useMemo(() => buildAnswerDistribution(filteredAttempts, answers), [answers, filteredAttempts])
  const mostFailedStudents = useMemo(() => buildAffectedStudentRows(filteredAttempts), [filteredAttempts])
  const classroomPerformance = useMemo(() => buildClassroomPerformanceRows(filteredAttempts), [filteredAttempts])
  const temporalPerformance = useMemo(() => buildTemporalPerformanceRows(filteredAttempts), [filteredAttempts])
  const affectedStudents = useMemo(
    () => Array.from(
      new Set(
        filteredAttempts
          .filter((attempt) => attempt.is_correct === false)
          .map((attempt) => attempt.student_id)
          .filter((value): value is string => Boolean(value))
      )
    ).length,
    [filteredAttempts]
  )

  const subject = normalizeRelation(question?.subjects)
  const classroom = normalizeRelation(question?.classrooms)
  const topic = normalizeRelation(question?.subject_topics)
  const subjectName = subject?.name || 'Curso'
  const questionTypeLabel = question?.type ? questionTypeLabels[question.type] || question.type : 'Pregunta'

  const onRefresh = () => {
    setRefreshing(true)
    void fetchReport()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  const handleCreateReviewQuestion = async () => {
    await createQuestionFromCurrent({ review: true })
  }

  const handleDuplicateQuestion = async () => {
    await createQuestionFromCurrent({ review: false })
  }

  const createQuestionFromCurrent = async ({ review }: { review: boolean }) => {
    if (!question || typeof question.subject_id !== 'number') {
      showAlert('Pregunta no disponible', 'No se pudo identificar el curso de la pregunta original.')
      return
    }

    const answerPayload = buildQuestionAnswerPayload(answers)
    if (answerPayload.length === 0) {
      showAlert('Sin respuestas', 'La pregunta original no tiene respuestas para copiar.')
      return
    }

    const setBusy = review ? setCreatingReview : setDuplicating
    setBusy(true)
    try {
      const nextText = review ? `Repaso: ${question.text}` : `Copia de ${question.text}`
      const nextExplanation = review
        ? [question.explanation, 'Pregunta creada desde el informe para reforzar una pregunta con fallos.'].filter(Boolean).join('\n\n')
        : question.explanation

      const { data: newQuestionId, error } = await supabase.rpc('save_teacher_question', {
        p_subject_id: question.subject_id,
        p_question_id: null,
        p_classroom_id: question.classroom_id,
        p_topic_id: question.topic_id,
        p_type: question.type || 'multiple_choice',
        p_text: nextText,
        p_points_base: question.points_base ?? 10,
        p_time_limit_seconds: question.time_limit_seconds ?? 30,
        p_difficulty: question.difficulty ?? 1,
        p_explanation: nextExplanation || null,
        p_answers: answerPayload as any,
      })

      if (error) throw error

      showAlert(
        review ? 'Pregunta de repaso creada' : 'Pregunta duplicada',
        review
          ? 'Se ha creado una copia pensada para repaso. Puedes editarla antes de usarla con tus alumnos.'
          : 'Se ha creado una copia editable de la pregunta.'
      )

      if (newQuestionId) {
        router.push(`/(teacher)/subject/edit-question?subjectId=${question.subject_id}&questionId=${newQuestionId}` as any)
      }
    } catch (error: any) {
      showAlert('No se pudo crear la pregunta', error?.message || 'Revisa la conexión e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }


  const handleExportQuestionReportCsv = () => {
    if (!question) return

    const statusLabel = attemptStatusFilters.find((filter) => filter.value === selectedStatusFilter)?.label || 'Todos'
    const dateLabel = attemptDateFilters.find((filter) => filter.value === selectedDateFilter)?.label || 'Todas las fechas'
    const classroomLabel = selectedClassroomId === 'all'
      ? 'Todas las clases'
      : classroomOptions.find((option) => option.id === selectedClassroomId)?.name || `Clase ${selectedClassroomId}`
    const exportedAt = new Date().toISOString().slice(0, 10)
    const filename = `omniquest_informe_pregunta_${question.id}_${slugifyFilename(subjectName)}_${exportedAt}.csv`

    const rows = filteredAttempts.map((attempt) => [
      question.id,
      subjectName,
      classroom?.name || '',
      topic?.title || '',
      questionTypeLabel,
      classroomLabel,
      dateLabel,
      statusLabel,
      stats.totalAttempts,
      stats.correctAttempts,
      stats.failedAttempts,
      Math.max(0, 100 - stats.failureRate),
      attempt.id,
      attempt.studentAlias,
      attempt.classroomName,
      attempt.is_correct ? 'Correcta' : 'Incorrecta',
      attempt.answerLabel,
      attempt.earned_points ?? 0,
      attempt.time_taken_seconds ?? '',
      attempt.hint_used ? 'Sí' : 'No',
      attempt.was_skipped ? 'Sí' : 'No',
      attempt.manual_review_status || '',
      formatExportDateTime(attempt.attempted_at),
    ])

    const exported = exportCsvFile(
      filename,
      [
        'Pregunta_ID',
        'Curso',
        'Clase_de_la_pregunta',
        'Tema',
        'Tipo',
        'Filtro_clase',
        'Filtro_fecha',
        'Filtro_resultado',
        'Intentos_filtrados',
        'Correctas_filtradas',
        'Incorrectas_filtradas',
        'Precision_filtrada_pct',
        'Intento_ID',
        'Alumno',
        'Clase_alumno',
        'Resultado',
        'Respuesta',
        'XP',
        'Tiempo_segundos',
        'Pista_usada',
        'Omitida',
        'Revision_manual',
        'Intentado_el',
      ],
      rows.length > 0 ? rows : [[question.id, subjectName, classroom?.name || '', topic?.title || '', questionTypeLabel, classroomLabel, dateLabel, statusLabel, 0, 0, 0, 0, '', '', '', '', '', '', '', '', '', '', '']]
    )

    if (!exported) {
      showAlert('Exportación disponible en web', 'La descarga CSV está disponible desde la versión web.')
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Preparando informe...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar activeSection="classes" subjectsCount={subjectsCount} onSignOut={handleSignOut} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 24 : 18,
            paddingBottom: 48,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[280px] flex-1">
              {!isDesktop ? <BrandLogo size={28} style={{ marginBottom: 12 }} /> : null}
              <Pressable onPress={() => router.back()} className="mb-4 flex-row items-center gap-2">
                <Ionicons name="arrow-back" size={18} color="#AFC2DB" />
                <Text className="text-[13px] font-bold text-[#AFC2DB]">Volver</Text>
              </Pressable>
              <View className="flex-row items-center gap-3">
                <Ionicons name="analytics" size={40} color="#9FD6FF" />
                <Text className="text-[38px] font-black text-white">Informe de pregunta</Text>
              </View>
              <Text className="mt-2 max-w-[780px] text-[13px] leading-5 text-[#B7C4D7]">
                Revisa intentos, alumnos afectados, tasa de fallo y edita rápidamente la pregunta si detectas problemas.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <NotificationBadge audience="teacher" onPress={() => router.push('/(teacher)/notifications' as any)} />
              <TeacherHeaderAvatar />
            </View>
          </View>

          {errorMessage ? (
            <View className="rounded-2xl border border-[#3F2430] bg-[#160D19] p-5">
              <Ionicons name="warning-outline" size={28} color="#FB7185" />
              <Text className="mt-3 text-xl font-black text-white">No se pudo abrir el informe</Text>
              <Text className="mt-2 text-[13px] leading-5 text-[#FCA5A5]">{errorMessage}</Text>
            </View>
          ) : null}

          {question && !errorMessage ? (
            <>
              <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
                <View className={isWide ? 'flex-row items-start justify-between gap-5' : 'gap-4'}>
                  <View className="min-w-0 flex-1">
                    <View className="mb-3 flex-row flex-wrap items-center gap-2">
                      <Badge label={questionTypeLabel} color="#8B5CF6" />
                      <Badge label={subjectName} color="#58B5FF" />
                      {classroom?.name ? <Badge label={classroom.name} color="#43D991" /> : null}
                      {topic?.title ? <Badge label={topic.title} color="#F6A64A" /> : null}
                    </View>
                    <Text className={`${isPhone ? 'text-[22px] leading-7' : 'text-[26px] leading-8'} font-black text-white`}>{question.text}</Text>
                    {question.explanation ? (
                      <Text className="mt-3 text-[13px] leading-5 text-[#AFC2DB]">
                        Explicación: {question.explanation}
                      </Text>
                    ) : null}
                  </View>

                  <View className={`${isPhone ? 'gap-2' : 'flex-row flex-wrap gap-2'}`}>
                    <Pressable
                      onPress={handleCreateReviewQuestion}
                      disabled={creatingReview || duplicating}
                      className={`${isPhone ? 'justify-center py-4' : 'px-4 py-3'} flex-row items-center gap-2 rounded-xl bg-[#5A46D8]`}
                      style={({ pressed }) => ({ opacity: creatingReview || duplicating ? 0.62 : pressed ? 0.82 : 1 })}
                    >
                      <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                      <Text className="text-[12px] font-black text-white">{creatingReview ? 'Creando...' : 'Crear repaso'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleDuplicateQuestion}
                      disabled={creatingReview || duplicating}
                      className={`${isPhone ? 'justify-center py-4' : 'px-4 py-3'} flex-row items-center gap-2 rounded-xl border border-[#4F46E5] bg-[#312E8126]`}
                      style={({ pressed }) => ({ opacity: creatingReview || duplicating ? 0.62 : pressed ? 0.82 : 1 })}
                    >
                      <Ionicons name="copy-outline" size={16} color="#C4B5FD" />
                      <Text className="text-[12px] font-black text-[#C4B5FD]">{duplicating ? 'Duplicando...' : 'Duplicar'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleExportQuestionReportCsv}
                      className={`${isPhone ? 'justify-center py-4' : 'px-4 py-3'} flex-row items-center gap-2 rounded-xl border border-[#2563EB] bg-[#0B244B]`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                    >
                      <Ionicons name="download-outline" size={16} color="#BFDBFE" />
                      <Text className="text-[12px] font-black text-[#BFDBFE]">Exportar CSV</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push(`/(teacher)/subject/edit-question?subjectId=${question.subject_id}&questionId=${question.id}` as any)}
                      className={`${isPhone ? 'justify-center py-4' : 'px-4 py-3'} flex-row items-center gap-2 rounded-xl bg-[#7C5CFF]`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                    >
                      <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                      <Text className="text-[12px] font-black text-white">Editar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push(`/(teacher)/subject/${question.subject_id}` as any)}
                      className={`${isPhone ? 'justify-center py-4' : 'px-4 py-3'} flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#07162E]`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                    >
                      <Ionicons name="book-outline" size={16} color="#DDE7F4" />
                      <Text className="text-[12px] font-black text-[#DDE7F4]">Ver curso</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <Panel title="Filtros del informe" action={`${filteredAttempts.length} de ${attempts.length} intentos`} className="mt-5">
                <View className="gap-4">
                  <View>
                    <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#8FA7C7]">Clase</Text>
                    <ScrollView
                      horizontal={isPhone}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, flexWrap: isPhone ? 'nowrap' : 'wrap', paddingRight: isPhone ? 8 : 0 }}
                    >
                      <FilterChip
                        icon="albums-outline"
                        label="Todas las clases"
                        active={selectedClassroomId === 'all'}
                        onPress={() => setSelectedClassroomId('all')}
                      />
                      {classroomOptions.map((classroomOption) => (
                        <FilterChip
                          key={classroomOption.id}
                          icon="people-outline"
                          label={classroomOption.name || `Clase ${classroomOption.id}`}
                          active={selectedClassroomId === classroomOption.id}
                          onPress={() => setSelectedClassroomId(classroomOption.id)}
                        />
                      ))}
                    </ScrollView>
                  </View>

                  <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
                    <View className="flex-1">
                      <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#8FA7C7]">Fecha</Text>
                      <ScrollView
                        horizontal={isPhone}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, flexWrap: isPhone ? 'nowrap' : 'wrap', paddingRight: isPhone ? 8 : 0 }}
                      >
                        {attemptDateFilters.map((filter) => (
                          <FilterChip
                            key={filter.value}
                            icon={filter.icon}
                            label={filter.label}
                            active={selectedDateFilter === filter.value}
                            onPress={() => setSelectedDateFilter(filter.value)}
                          />
                        ))}
                      </ScrollView>
                    </View>

                    <View className="flex-1">
                      <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#8FA7C7]">Resultado</Text>
                      <ScrollView
                        horizontal={isPhone}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, flexWrap: isPhone ? 'nowrap' : 'wrap', paddingRight: isPhone ? 8 : 0 }}
                      >
                        {attemptStatusFilters.map((filter) => (
                          <FilterChip
                            key={filter.value}
                            icon={filter.icon}
                            label={filter.label}
                            active={selectedStatusFilter === filter.value}
                            onPress={() => setSelectedStatusFilter(filter.value)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </View>
              </Panel>

              <View className={isWide ? 'mt-5 flex-row gap-4' : 'mt-5 gap-4'}>
                <ReportMetricCard icon="people" title="Alumnos afectados" value={String(affectedStudents)} detail="Fallaron al menos una vez" color="#F43F5E" />
                <ReportMetricCard icon="close-circle" title="Tasa de fallo" value={`${stats.failureRate}%`} detail={`${stats.failedAttempts} de ${stats.totalAttempts} intentos`} color="#FB7185" />
                <ReportMetricCard icon="checkmark-circle" title="Aciertos" value={String(stats.correctAttempts)} detail="Intentos correctos" color="#43D991" />
                <ReportMetricCard icon="time" title="Tiempo medio" value={stats.averageTimeLabel} detail="Por intento" color="#58B5FF" />
              </View>

              <View className={isWide ? 'mt-5 flex-row items-start gap-5' : 'mt-5 gap-5'}>
                <Panel title="Rendimiento por clase" action={`${classroomPerformance.length} clases`} className={isWide ? 'flex-1' : ''}>
                  <View className="gap-3">
                    {classroomPerformance.map((item) => (
                      <ClassroomPerformanceRowItem key={item.key} item={item} />
                    ))}
                    {classroomPerformance.length === 0 ? (
                      <EmptyBox text="Aún no hay intentos suficientes para comparar clases." />
                    ) : null}
                  </View>
                </Panel>

                <Panel title="Evolución temporal" action="Últimos 7 días" className={isWide ? 'flex-1' : ''}>
                  <TemporalPerformanceChart rows={temporalPerformance} />
                </Panel>
              </View>

              <View className={isWide ? 'mt-5 flex-row items-start gap-5' : 'mt-5 gap-5'}>
                <Panel title="Distribución de respuestas" action={`${answerDistribution.length} opciones`} className={isWide ? 'flex-1' : ''}>
                  <View className="gap-3">
                    {answerDistribution.length > 0 ? (
                      answerDistribution.map((item) => (
                        <AnswerDistributionRow key={item.label} item={item} />
                      ))
                    ) : (
                      <EmptyBox text="Todavía no hay respuestas registradas para esta pregunta." />
                    )}
                  </View>
                </Panel>

                <Panel title="Últimos intentos" action={`${filteredAttempts.length} filtrados`} className={isWide ? 'flex-1' : ''}>
                  <View className="gap-3">
                    {filteredAttempts.slice(0, 8).map((attempt) => (
                      <AttemptRowItem key={attempt.id} attempt={attempt} />
                    ))}
                    {filteredAttempts.length === 0 ? <EmptyBox text="No hay intentos con los filtros seleccionados." /> : null}
                  </View>
                </Panel>
              </View>

              <Panel title="Alumnos que más la fallaron" action={`${affectedStudents} alumnos`} className="mt-5">
                <View className="gap-3">
                  {mostFailedStudents.map((item) => (
                    <AffectedStudentRow key={item.studentId} item={item} />
                  ))}
                  {affectedStudents === 0 ? <EmptyBox text="Ningún alumno ha fallado esta pregunta todavía." /> : null}
                </View>
              </Panel>
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  )
}

function ReportMetricCard({
  icon,
  title,
  value,
  detail,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  value: string
  detail: string
  color: string
}) {
  return (
    <View className="min-w-[180px] flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-4 h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${color}29` }}>
        <Ionicons name={icon} size={23} color={color} />
      </View>
      <Text className="text-[12px] font-bold text-[#AFC2DB]">{title}</Text>
      <Text className="mt-2 text-[28px] font-black text-white">{value}</Text>
      <Text className="mt-1 text-[12px] text-[#8FA7C7]">{detail}</Text>
    </View>
  )
}

function Panel({
  title,
  action,
  className = '',
  children,
}: {
  title: string
  action?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <View className={`rounded-2xl border border-[#1A3155] bg-[#09162C] p-5 ${className}`}>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="font-black text-white">{title}</Text>
        {action ? <Text className="text-[12px] font-semibold text-[#B9A7FF]">{action}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${color}24` }}>
      <Text className="text-[11px] font-black" style={{ color }}>{label}</Text>
    </View>
  )
}

function FilterChip({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  active: boolean
  onPress: () => void
}) {
  const { width } = useWindowDimensions()
  const isPhone = width < 640

  return (
    <Pressable
      onPress={onPress}
      className={`${isPhone ? 'min-h-[44px] px-4 py-3' : 'px-3 py-2'} flex-row items-center gap-2 rounded-xl border`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
        borderColor: active ? '#8B5CF6' : '#20375E',
        backgroundColor: active ? '#4C2FA633' : '#07162E',
      })}
    >
      <Ionicons name={icon} size={15} color={active ? '#C4B5FD' : '#AFC2DB'} />
      <Text className="text-[12px] font-black" style={{ color: active ? '#FFFFFF' : '#DDE7F4' }}>
        {label}
      </Text>
    </Pressable>
  )
}

function AnswerDistributionRow({ item }: { item: AnswerDistributionItem }) {
  return (
    <View className="rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-bold text-white" numberOfLines={2}>{item.label}</Text>
          <Text className="mt-1 text-[11px]" style={{ color: item.correct ? '#43D991' : '#FB7185' }}>
            {item.correct ? 'Respuesta correcta' : 'Respuesta incorrecta o enviada por alumnos'}
          </Text>
        </View>
        <Text className="text-[18px] font-black text-white">{item.percent}%</Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13294C]">
        <View className="h-full rounded-full" style={{ width: `${item.percent}%`, backgroundColor: item.correct ? '#43D991' : '#FB7185' }} />
      </View>
      <Text className="mt-2 text-[11px] text-[#8FA7C7]">{item.count} intento{item.count === 1 ? '' : 's'}</Text>
    </View>
  )
}

function ClassroomPerformanceRowItem({ item }: { item: ClassroomPerformanceRow }) {
  const color = item.failureRate >= 60 ? '#FB7185' : item.failureRate >= 35 ? '#F6A64A' : '#43D991'

  return (
    <View className="rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-black text-white" numberOfLines={1}>
            {item.classroomName}
          </Text>
          <Text className="mt-1 text-[12px] text-[#AFC2DB]">
            {item.failed} fallos · {item.correct} aciertos · {item.affectedStudents} alumno{item.affectedStudents === 1 ? '' : 's'} afectado{item.affectedStudents === 1 ? '' : 's'}
          </Text>
        </View>
        <Text className="text-[20px] font-black" style={{ color }}>
          {item.failureRate}%
        </Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13294C]">
        <View className="h-full rounded-full" style={{ width: `${item.failureRate}%`, backgroundColor: color }} />
      </View>
      <Text className="mt-2 text-[12px] text-[#AFC2DB]">
        {item.attempts} intento{item.attempts === 1 ? '' : 's'} registrados
      </Text>
    </View>
  )
}

function TemporalPerformanceChart({ rows }: { rows: TemporalPerformanceRow[] }) {
  const hasAttempts = rows.some((row) => row.attempts > 0)
  const maxAttempts = Math.max(1, ...rows.map((row) => row.attempts))

  if (!hasAttempts) {
    return <EmptyBox text="Todavía no hay intentos recientes para dibujar la evolución." />
  }

  return (
    <View className="gap-3">
      {rows.map((row) => {
        const color = row.failureRate >= 60 ? '#FB7185' : row.failureRate >= 35 ? '#F6A64A' : '#43D991'
        const width = row.attempts > 0 ? Math.max(8, Math.round((row.attempts / maxAttempts) * 100)) : 0

        return (
          <View key={row.key} className="rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-3">
            <View className="mb-2 flex-row items-center justify-between gap-3">
              <Text className="text-[12px] font-black uppercase text-[#DDE7F4]">{row.label}</Text>
              <Text className="text-[12px] font-black" style={{ color }}>
                {row.failureRate}% fallos
              </Text>
            </View>
            <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
              {width > 0 ? (
                <View className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
              ) : null}
            </View>
            <Text className="mt-2 text-[12px] text-[#AFC2DB]">
              {row.attempts} intento{row.attempts === 1 ? '' : 's'} · {row.failed} fallos · {row.correct} aciertos
            </Text>
          </View>
        )
      })}
    </View>
  )
}

function AttemptRowItem({ attempt }: { attempt: AttemptDetail }) {
  const color = attempt.is_correct ? '#43D991' : '#FB7185'
  return (
    <View className="flex-row items-start gap-3 rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-3">
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={attempt.is_correct ? 'checkmark' : 'close'} size={18} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-bold text-white" numberOfLines={1}>{attempt.studentAlias}</Text>
          <Text className="text-[11px] font-bold" style={{ color }}>{attempt.is_correct ? 'Correcta' : 'Incorrecta'}</Text>
        </View>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={2}>{attempt.answerLabel}</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]">
          {attempt.attempted_at ? getTimeAgo(attempt.attempted_at) : 'Sin fecha'} · {attempt.earned_points ?? 0} XP · {attempt.classroomName}
        </Text>
      </View>
    </View>
  )
}

function AffectedStudentRow({ item }: { item: { studentId: string; alias: string; failures: number; attempts: number; lastAttemptAt: string | null } }) {
  const failureRate = item.attempts > 0 ? Math.round((item.failures / item.attempts) * 100) : 0
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#17315E]">
        <Ionicons name="person" size={18} color="#9FD6FF" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white" numberOfLines={1}>{item.alias}</Text>
        <Text className="mt-1 text-[11px] text-[#8FA7C7]">
          {item.failures} fallos de {item.attempts} intentos · {item.lastAttemptAt ? getTimeAgo(item.lastAttemptAt) : 'Sin fecha'}
        </Text>
      </View>
      <Text className="text-[16px] font-black text-[#FB7185]">{failureRate}%</Text>
    </View>
  )
}

function EmptyBox({ text }: { text: string }) {
  return (
    <View className="rounded-xl border border-dashed border-[#253C67] bg-[#0D1D3B] px-4 py-5">
      <Text className="text-center text-[12px] text-[#8FA7C7]">{text}</Text>
    </View>
  )
}

function buildReportStats(attempts: AttemptDetail[]) {
  const totalAttempts = attempts.length
  const correctAttempts = attempts.filter((attempt) => attempt.is_correct === true).length
  const failedAttempts = attempts.filter((attempt) => attempt.is_correct === false).length
  const failureRate = totalAttempts > 0 ? Math.round((failedAttempts / totalAttempts) * 100) : 0
  const attemptsWithTime = attempts.filter((attempt) => typeof attempt.time_taken_seconds === 'number')
  const averageTime = attemptsWithTime.length > 0
    ? Math.round(attemptsWithTime.reduce((total, attempt) => total + (attempt.time_taken_seconds || 0), 0) / attemptsWithTime.length)
    : 0

  return {
    totalAttempts,
    correctAttempts,
    failedAttempts,
    failureRate,
    averageTimeLabel: averageTime > 0 ? `${averageTime}s` : 'Sin datos',
  }
}

function buildAnswerDistribution(attempts: AttemptDetail[], answers: AnswerRow[]): AnswerDistributionItem[] {
  const total = Math.max(attempts.length, 1)
  const correctAnswerIds = new Set(answers.filter((answer) => answer.is_correct).map((answer) => answer.id))
  const counts = new Map<string, { count: number; correct: boolean }>()

  attempts.forEach((attempt) => {
    const label = attempt.answerLabel || 'Sin respuesta'
    const current = counts.get(label) || { count: 0, correct: Boolean(attempt.answer_id && correctAnswerIds.has(attempt.answer_id)) }
    current.count += 1
    current.correct = current.correct || Boolean(attempt.answer_id && correctAnswerIds.has(attempt.answer_id)) || attempt.is_correct === true
    counts.set(label, current)
  })

  return Array.from(counts.entries())
    .map(([label, value]) => ({
      label,
      count: value.count,
      correct: value.correct,
      percent: Math.round((value.count / total) * 100),
    }))
    .sort((left, right) => right.count - left.count)
}

function buildClassroomPerformanceRows(attempts: AttemptDetail[]): ClassroomPerformanceRow[] {
  const rows = new Map<string, ClassroomPerformanceRow & { failedStudentIds: Set<string> }>()

  attempts.forEach((attempt) => {
    const key = typeof attempt.classroomId === 'number' ? String(attempt.classroomId) : 'unknown'
    const current = rows.get(key) || {
      key,
      classroomName: attempt.classroomName || 'Clase sin identificar',
      attempts: 0,
      correct: 0,
      failed: 0,
      failureRate: 0,
      affectedStudents: 0,
      failedStudentIds: new Set<string>(),
    }

    current.attempts += 1
    if (attempt.is_correct === true) current.correct += 1
    if (attempt.is_correct === false) {
      current.failed += 1
      if (attempt.student_id) current.failedStudentIds.add(attempt.student_id)
    }
    rows.set(key, current)
  })

  return Array.from(rows.values())
    .map((row) => ({
      key: row.key,
      classroomName: row.classroomName,
      attempts: row.attempts,
      correct: row.correct,
      failed: row.failed,
      failureRate: row.attempts > 0 ? Math.round((row.failed / row.attempts) * 100) : 0,
      affectedStudents: row.failedStudentIds.size,
    }))
    .sort((left, right) => right.failureRate - left.failureRate || right.failed - left.failed || right.attempts - left.attempts)
}

function buildTemporalPerformanceRows(attempts: AttemptDetail[]): TemporalPerformanceRow[] {
  const today = new Date()
  const rows = new Map<string, TemporalPerformanceRow>()

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(today)
    date.setHours(0, 0, 0, 0)
    date.setDate(today.getDate() - index)
    const key = getDateKey(date)
    rows.set(key, {
      key,
      label: formatShortDate(date),
      attempts: 0,
      correct: 0,
      failed: 0,
      failureRate: 0,
    })
  }

  attempts.forEach((attempt) => {
    if (!attempt.attempted_at) return
    const date = new Date(attempt.attempted_at)
    if (Number.isNaN(date.getTime())) return

    const key = getDateKey(date)
    const current = rows.get(key)
    if (!current) return

    current.attempts += 1
    if (attempt.is_correct === true) current.correct += 1
    if (attempt.is_correct === false) current.failed += 1
    current.failureRate = current.attempts > 0 ? Math.round((current.failed / current.attempts) * 100) : 0
  })

  return Array.from(rows.values())
}

function buildAffectedStudentRows(attempts: AttemptDetail[]) {
  const rows = new Map<string, { studentId: string; alias: string; failures: number; attempts: number; lastAttemptAt: string | null }>()

  attempts.forEach((attempt) => {
    if (!attempt.student_id) return

    const current = rows.get(attempt.student_id) || {
      studentId: attempt.student_id,
      alias: attempt.studentAlias,
      failures: 0,
      attempts: 0,
      lastAttemptAt: attempt.attempted_at || null,
    }

    current.attempts += 1
    if (attempt.is_correct === false) current.failures += 1
    if (attempt.attempted_at && (!current.lastAttemptAt || new Date(attempt.attempted_at).getTime() > new Date(current.lastAttemptAt).getTime())) {
      current.lastAttemptAt = attempt.attempted_at
    }
    rows.set(attempt.student_id, current)
  })

  return Array.from(rows.values())
    .filter((item) => item.failures > 0)
    .sort((left, right) => right.failures - left.failures)
}

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date)
}

async function fetchProfilesById(studentIds: string[]) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, alias, avatar')
    .in('id', studentIds)

  if (error) throw error

  return new Map(((data || []) as StudentProfile[]).map((profile) => [profile.id, profile]))
}

function getStudentAlias(studentId: string | null | undefined, profilesById: Map<string, StudentProfile>) {
  if (!studentId) return 'Alumno'
  return profilesById.get(studentId)?.alias || 'Alumno'
}

function getAttemptAnswerLabel(attempt: AttemptRow, answersById: Map<number, AnswerRow>) {
  if (attempt.was_skipped) return 'Omitida'
  if (attempt.submitted_answer_text) return attempt.submitted_answer_text
  if (attempt.answer_id && answersById.has(attempt.answer_id)) return answersById.get(attempt.answer_id)?.text || 'Respuesta seleccionada'
  if (attempt.submitted_answer_payload) {
    try {
      return JSON.stringify(attempt.submitted_answer_payload)
    } catch {
      return 'Respuesta interactiva'
    }
  }
  return 'Sin respuesta registrada'
}


function groupEnrollmentsByStudent(enrollments: EnrollmentRow[]) {
  const map = new Map<string, EnrollmentRow[]>()
  enrollments.forEach((enrollment) => {
    const rows = map.get(enrollment.student_id) || []
    rows.push(enrollment)
    map.set(enrollment.student_id, rows)
  })
  return map
}

function getAttemptClassroomInfo(
  attempt: AttemptRow,
  question: QuestionDetail,
  enrollmentsByStudentId: Map<string, EnrollmentRow[]>,
  classroomsById: Map<number, ClassroomOption>
): { id: number | null; name: string } {
  const fallback = { id: null, name: 'Clase sin identificar' }

  if (typeof question.classroom_id === 'number') {
    const classroom = classroomsById.get(question.classroom_id)
    return {
      id: question.classroom_id,
      name: classroom?.name || 'Clase de la pregunta',
    }
  }

  if (!attempt.student_id) return fallback

  const enrollment = (enrollmentsByStudentId.get(attempt.student_id) || [])
    .find((item) => typeof item.classroom_id === 'number')

  if (!enrollment || typeof enrollment.classroom_id !== 'number') return fallback

  const classroom = classroomsById.get(enrollment.classroom_id)
  return {
    id: enrollment.classroom_id,
    name: classroom?.name || `Clase ${enrollment.classroom_id}`,
  }
}

function matchesAttemptFilters(
  attempt: AttemptDetail,
  classroomId: number | 'all',
  statusFilter: AttemptStatusFilter,
  dateFilter: AttemptDateFilter
) {
  if (classroomId !== 'all' && attempt.classroomId !== classroomId) return false
  if (statusFilter === 'correct' && attempt.is_correct !== true) return false
  if (statusFilter === 'incorrect' && attempt.is_correct !== false) return false
  return matchesDateFilter(attempt.attempted_at, dateFilter)
}

function matchesDateFilter(value: string | null | undefined, filter: AttemptDateFilter) {
  if (filter === 'all') return true
  if (!value) return false

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false

  const now = new Date()
  if (filter === 'today') {
    return date.toDateString() === now.toDateString()
  }

  const days = filter === '7d' ? 7 : 30
  const threshold = new Date(now)
  threshold.setDate(now.getDate() - days)
  return date.getTime() >= threshold.getTime()
}

function buildQuestionAnswerPayload(answers: AnswerRow[]) {
  return answers
    .slice()
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
    .map((answer, index) => ({
      text: answer.text.trim(),
      is_correct: Boolean(answer.is_correct),
      sort_order: answer.sort_order ?? index + 1,
    }))
    .filter((answer) => answer.text.length > 0)
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`)
    return
  }

  Alert.alert(title, message)
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}
