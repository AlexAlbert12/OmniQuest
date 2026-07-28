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
import MobileMetricCard from '../../../components/ui/mobile/MobileMetricCard'
import { supabase } from '../../../lib/supabase'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout'
import { getTimeAgo } from '../../../lib/time'
import TeacherSidebar from '../../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../../components/teacher/TeacherPageHeader'
import { exportCsvFile, formatExportDateTime, slugifyFilename } from '../../../lib/reportExports'
import QuestionMedia from '../../../components/questions/QuestionMedia'
import { cloneQuestionMedia, getQuestionMediaManifest, removeQuestionMedia } from '../../../lib/questionMedia'
import type { SemanticIconKey } from '../../../lib/designTokens'
import AppButton from '../../../components/ui/AppButton'
import AppTabs from '../../../components/ui/AppTabs'

type QuestionDetail = {
  id: number
  text: string
  type: string | null
  subject_id: number | null
  classroom_id: number | null
  topic_id: number | null
  explanation: string | null
  media_type: 'image' | 'audio' | 'video' | null
  media_url: string | null
  media_path: string | null
  media_alt_text: string | null
  media_caption: string | null
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
  const [archiving, setArchiving] = useState(false)
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
            media_type,
            media_url,
            media_path,
            media_alt_text,
            media_caption,
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

  const pendingManualReviews = filteredAttempts.filter((attempt) => ['pending', 'in_review', 'needs_changes'].includes(attempt.manual_review_status || '')).length
  const reportRecommendation = buildReportRecommendation(stats.failureRate, affectedStudents, pendingManualReviews)

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

  const handleDuplicateQuestion = async () => {
    await createQuestionFromCurrent({ review: false })
  }

  const createQuestionFromCurrent = async ({ review = false }: { review?: boolean } = {}) => {
    if (!question || typeof question.subject_id !== 'number') {
      showAlert('Pregunta no disponible', 'No se pudo identificar el curso de la pregunta original.')
      return
    }

    const answerPayload = buildQuestionAnswerPayload(answers)
    if (answerPayload.length === 0) {
      showAlert('Sin respuestas', 'La pregunta original no tiene respuestas para copiar.')
      return
    }

    setDuplicating(true)
    let clonedMediaPath: string | null = null
    try {
      const nextText = review ? `Repaso: ${question.text}` : `Copia de ${question.text}`
      const nextExplanation = review
        ? [question.explanation, 'Pregunta creada desde el informe para reforzar una pregunta con fallos.'].filter(Boolean).join('\n\n')
        : question.explanation

      const sourceManifest = question.media_type && question.media_path
        ? await getQuestionMediaManifest(question.id)
        : null
      const clonedMedia = question.media_type && question.media_path && sourceManifest?.url
        ? await cloneQuestionMedia({
            type: question.media_type,
            url: sourceManifest.url,
            sourcePath: question.media_path,
            subjectId: question.subject_id,
            durationSeconds: sourceManifest.durationSeconds,
          })
        : null
      clonedMediaPath = clonedMedia?.path ?? null

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
        p_media_type: clonedMedia?.type ?? null,
        p_media_url: null,
        p_media_path: clonedMedia?.path ?? null,
        p_media_alt_text: question.media_alt_text,
        p_media_caption: question.media_caption,
        p_media_duration_seconds: clonedMedia?.durationSeconds ?? null,
        p_media_transcript: clonedMedia?.type === 'audio' ? sourceManifest?.transcript ?? null : null,
        p_media_subtitles_vtt: clonedMedia?.type === 'video' ? sourceManifest?.subtitlesVtt ?? null : null,
      } as any)

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
      if (clonedMediaPath) {
        try {
          await removeQuestionMedia(clonedMediaPath)
        } catch {
        }
      }
      showAlert('No se pudo crear la pregunta', error?.message || 'Revisa la conexión e inténtalo de nuevo.')
    } finally {
      setDuplicating(false)
    }
  }

  const handleArchiveQuestion = async () => {
    if (!question || archiving) return
    const confirmed = Platform.OS === 'web'
      ? window.confirm('¿Archivar esta pregunta? Dejará de estar disponible para nuevas partidas.')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Archivar pregunta',
            'La pregunta dejará de estar disponible para nuevas partidas. Podrás conservar sus datos históricos.',
            [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Archivar', style: 'destructive', onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
          )
        })
    if (!confirmed) return
    setArchiving(true)
    try {
      const { error } = await supabase.from('questions').update({ active: false }).eq('id', question.id)
      if (error) throw error
      setQuestion((current) => current ? { ...current, active: false } : current)
      showAlert('Pregunta archivada', 'La pregunta ya no aparecerá en nuevas partidas.')
    } catch (error: any) {
      showAlert('No se pudo archivar', error?.message || 'Inténtalo de nuevo.')
    } finally {
      setArchiving(false)
    }
  }

  const handleOpenManualReview = () => {
    router.push('/(teacher)/reviews' as any)
  }

  const handleExportQuestionReportCsv = async () => {
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

    const exported = await exportCsvFile(
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
      showAlert('No se pudo compartir el archivo', 'En web se descarga como CSV. En móvil, revisa que el dispositivo tenga opciones para compartir archivos.')
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-text-muted">Preparando informe...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background-primary">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar activeSection="classes" subjectsCount={subjectsCount} onSignOut={handleSignOut} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 24 : 18,
            paddingBottom: isDesktop ? 48 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <TeacherPageHeader
            backAction={{ label: 'Volver', onPress: () => router.back() }}
            icon="analytics"
            isDesktop={isDesktop}
            title="Informe de pregunta"
            subtitle="Revisa intentos, alumnos afectados, tasa de fallo y edita rápidamente la pregunta si detectas problemas."
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
          />

          {errorMessage ? (
            <View className="rounded-2xl border border-border-default bg-background-primary p-5">
              <Ionicons name="warning-outline" size={28} color="#FB7185" />
              <Text className="mt-3 text-xl font-black text-white">No se pudo abrir el informe</Text>
              <Text className="mt-2 text-[13px] leading-5 text-semantic-danger">{errorMessage}</Text>
            </View>
          ) : null}

          {question && !errorMessage ? (
            <>
              <QuestionInsightHero
                question={question}
                questionTypeLabel={questionTypeLabel}
                subjectName={subjectName}
                classroomName={classroom?.name || null}
                topicName={topic?.title || null}
                failureRate={stats.failureRate}
                affectedStudents={affectedStudents}
                pendingManualReviews={pendingManualReviews}
                recommendation={reportRecommendation}
                isPhone={isPhone}
                duplicating={duplicating}
                archiving={archiving}
                onEdit={() => router.push(`/(teacher)/subject/edit-question?subjectId=${question.subject_id}&questionId=${question.id}` as any)}
                onDuplicate={handleDuplicateQuestion}
                onArchive={handleArchiveQuestion}
                onManualReview={handleOpenManualReview}
              />

              <Panel title="Filtros del informe" action={`${filteredAttempts.length} de ${attempts.length} intentos`} className="mt-5">
                <View className="gap-4">
                  <View>
                    <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.08em] text-text-muted">Clase</Text>
                    <AppTabs<number | 'all'>
                      accessibilityLabel="Filtrar intentos por clase"
                      compact
                      role="teacher"
                      items={[
                        { key: 'all', label: 'Todas las clases', icon: 'albums-outline' },
                        ...classroomOptions.map((classroomOption) => ({
                          key: classroomOption.id,
                          label: classroomOption.name || `Clase ${classroomOption.id}`,
                          icon: 'people-outline' as const,
                        })),
                      ]}
                      value={selectedClassroomId}
                      onChange={setSelectedClassroomId}
                    />
                  </View>

                  <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
                    <View className="min-w-0 flex-1">
                      <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.08em] text-text-muted">Fecha</Text>
                      <AppTabs<AttemptDateFilter>
                        accessibilityLabel="Filtrar intentos por fecha"
                        compact
                        role="teacher"
                        items={attemptDateFilters.map((filter) => ({ key: filter.value, label: filter.label, icon: filter.icon }))}
                        value={selectedDateFilter}
                        onChange={setSelectedDateFilter}
                      />
                    </View>

                    <View className="min-w-0 flex-1">
                      <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.08em] text-text-muted">Resultado</Text>
                      <AppTabs<AttemptStatusFilter>
                        accessibilityLabel="Filtrar intentos por resultado"
                        compact
                        role="teacher"
                        items={attemptStatusFilters.map((filter) => ({ key: filter.value, label: filter.label, icon: filter.icon }))}
                        value={selectedStatusFilter}
                        onChange={setSelectedStatusFilter}
                      />
                    </View>
                  </View>
                </View>
              </Panel>

              <View className={isWide ? 'mt-5 flex-row gap-4' : 'mt-5 gap-4'}>
                <ReportMetricCard icon="layers-outline" title="Intentos analizados" value={String(stats.totalAttempts)} detail={`${stats.correctAttempts} correctos · ${stats.failedAttempts} para revisar`} color="#8B5CF6" />
                <ReportMetricCard icon="time" title="Tiempo medio" value={stats.averageTimeLabel} detail="Por intento" color="#38BDF8" />
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
      {!isDesktop ? <TeacherBottomNav active="classes" /> : null}
    </View>
  )
}

function QuestionInsightHero({
  question,
  questionTypeLabel,
  subjectName,
  classroomName,
  topicName,
  failureRate,
  affectedStudents,
  pendingManualReviews,
  recommendation,
  isPhone,
  duplicating,
  archiving,
  onEdit,
  onDuplicate,
  onArchive,
  onManualReview,
}: {
  question: QuestionDetail
  questionTypeLabel: string
  subjectName: string
  classroomName: string | null
  topicName: string | null
  failureRate: number
  affectedStudents: number
  pendingManualReviews: number
  recommendation: string
  isPhone: boolean
  duplicating: boolean
  archiving: boolean
  onEdit: () => void
  onDuplicate: () => void
  onArchive: () => void
  onManualReview: () => void
}) {
  const severityColor = failureRate >= 60 ? '#FB7185' : failureRate >= 35 ? '#F59E0B' : '#34D399'
  return (
    <View className="rounded-2xl border border-border-default bg-surface-default p-5 md:p-6">
      <View className={isPhone ? 'gap-5' : 'flex-row items-start gap-6'}>
        <View className="min-w-0 flex-[1.5]">
          <View className="mb-3 flex-row flex-wrap items-center gap-2">
            <Badge label={questionTypeLabel} color="#8B5CF6" />
            <Badge label={subjectName} color="#58B5FF" />
            {classroomName ? <Badge label={classroomName} color="#43D991" /> : null}
            {topicName ? <Badge label={topicName} color="#F6A64A" /> : null}
            {question.active === false ? <Badge label="Archivada" color="#FB7185" /> : null}
          </View>
          <Text className={`${isPhone ? 'text-[22px] leading-7' : 'text-[28px] leading-9'} font-black text-white`}>{question.text}</Text>
          <QuestionMedia
            questionId={question.id}
            type={question.media_type}
            path={question.media_path}
            altText={question.media_alt_text}
            caption={question.media_caption}
            compact={isPhone}
          />
          {question.explanation ? (
            <Text className="mt-3 text-[13px] leading-5 text-text-secondary">Explicación: {question.explanation}</Text>
          ) : null}
        </View>

        <View className="min-w-[280px] flex-1 gap-3">
          <View className="flex-row gap-3">
            <InsightMetric label="Tasa de fallo" value={`${failureRate}%`} color={severityColor} />
            <InsightMetric label="Alumnos afectados" value={String(affectedStudents)} color="#F59E0B" />
          </View>
          <View className="rounded-xl border border-border-default bg-surface-raised p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="bulb-outline" size={18} color="#FBBF24" />
              <Text className="text-[11px] font-black uppercase tracking-[0.7px] text-gamification-xp">Recomendación</Text>
            </View>
            <Text className="mt-2 text-[14px] font-bold leading-6 text-white">{recommendation}</Text>
            {pendingManualReviews > 0 ? (
              <Text className="mt-2 text-[12px] text-gamification-badge">{pendingManualReviews} respuesta{pendingManualReviews === 1 ? '' : 's'} pendiente{pendingManualReviews === 1 ? '' : 's'} de revisión manual.</Text>
            ) : null}
          </View>
        </View>
      </View>

      <View className={`${isPhone ? 'gap-2' : 'mt-5 flex-row flex-wrap gap-2'}`}>
        <AppButton label="Editar pregunta" icon="create-outline" role="teacher" fullWidth={isPhone} onPress={onEdit} />
        <AppButton label="Duplicar" icon="copy-outline" variant="secondary" fullWidth={isPhone} loading={duplicating} onPress={onDuplicate} />
        <AppButton label="Revisar manualmente" icon="chatbox-ellipses-outline" variant="secondary" fullWidth={isPhone} onPress={onManualReview} />
        <AppButton label={question.active === false ? 'Archivada' : 'Archivar'} icon="archive-outline" variant="danger" fullWidth={isPhone} loading={archiving} disabled={question.active === false} onPress={onArchive} />
      </View>
    </View>
  )
}

function InsightMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="min-w-[120px] flex-1 rounded-xl border border-border-default bg-surface-default p-3">
      <Text className="text-[10px] font-black uppercase tracking-[0.6px] text-text-muted">{label}</Text>
      <Text className="mt-2 text-[25px] font-black" style={{ color }}>{value}</Text>
    </View>
  )
}

function buildReportRecommendation(failureRate: number, affectedStudents: number, pendingManualReviews: number) {
  if (pendingManualReviews > 0) return 'Revisa primero las respuestas abiertas pendientes antes de modificar la pregunta o interpretar la tasa de fallo.'
  if (affectedStudents === 0) return 'La pregunta no presenta incidencias. Mantén el enunciado y úsala como referencia para crear variantes.'
  if (failureRate >= 60) return 'Revisa el enunciado y los distractores; la tasa de fallo sugiere una dificultad o ambigüedad excesiva.'
  if (failureRate >= 35) return 'Crea un repaso breve y comprueba qué opción incorrecta concentra más respuestas.'
  return 'La pregunta funciona de forma estable. Observa la distribución antes de realizar cambios.'
}

function ReportMetricCard({ icon, semantic, title, value, detail, color }: {
  icon?: keyof typeof Ionicons.glyphMap
  semantic?: SemanticIconKey
  title: string
  value: string
  detail: string
  color?: string
}) {
  return (
    <MobileMetricCard
      className="min-w-[190px] flex-1"
      color={color}
      detail={detail}
      icon={icon}
      semantic={semantic}
      label={title}
      value={value}
    />
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
    <View className={`rounded-2xl border border-border-default bg-surface-default p-5 ${className}`}>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="font-black text-white">{title}</Text>
        {action ? <Text className="text-[12px] font-semibold text-brand-teacher">{action}</Text> : null}
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

function AnswerDistributionRow({ item }: { item: AnswerDistributionItem }) {
  return (
    <View className="rounded-xl border border-border-subtle bg-surface-raised p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-bold text-white" numberOfLines={2}>{item.label}</Text>
          <Text className="mt-1 text-[11px]" style={{ color: item.correct ? '#43D991' : '#FB7185' }}>
            {item.correct ? 'Respuesta correcta' : 'Respuesta incorrecta o enviada por alumnos'}
          </Text>
        </View>
        <Text className="text-[18px] font-black text-white">{item.percent}%</Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-surface-interactive">
        <View className="h-full rounded-full" style={{ width: `${item.percent}%`, backgroundColor: item.correct ? '#43D991' : '#FB7185' }} />
      </View>
      <Text className="mt-2 text-[11px] text-text-muted">{item.count} intento{item.count === 1 ? '' : 's'}</Text>
    </View>
  )
}

function ClassroomPerformanceRowItem({ item }: { item: ClassroomPerformanceRow }) {
  const color = item.failureRate >= 60 ? '#FB7185' : item.failureRate >= 35 ? '#F6A64A' : '#43D991'

  return (
    <View className="rounded-xl border border-border-subtle bg-surface-raised p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-black text-white" numberOfLines={1}>
            {item.classroomName}
          </Text>
          <Text className="mt-1 text-[12px] text-text-secondary">
            {item.failed} fallos · {item.correct} aciertos · {item.affectedStudents} alumno{item.affectedStudents === 1 ? '' : 's'} afectado{item.affectedStudents === 1 ? '' : 's'}
          </Text>
        </View>
        <Text className="text-[20px] font-black" style={{ color }}>
          {item.failureRate}%
        </Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-surface-interactive">
        <View className="h-full rounded-full" style={{ width: `${item.failureRate}%`, backgroundColor: color }} />
      </View>
      <Text className="mt-2 text-[12px] text-text-secondary">
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
          <View key={row.key} className="rounded-xl border border-border-subtle bg-surface-raised p-3">
            <View className="mb-2 flex-row items-center justify-between gap-3">
              <Text className="text-[12px] font-black uppercase text-text-secondary">{row.label}</Text>
              <Text className="text-[12px] font-black" style={{ color }}>
                {row.failureRate}% fallos
              </Text>
            </View>
            <View className="h-2 overflow-hidden rounded-full bg-surface-interactive">
              {width > 0 ? (
                <View className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
              ) : null}
            </View>
            <Text className="mt-2 text-[12px] text-text-secondary">
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
    <View className="flex-row items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised p-3">
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={attempt.is_correct ? 'checkmark' : 'close'} size={18} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-bold text-white" numberOfLines={1}>{attempt.studentAlias}</Text>
          <Text className="text-[11px] font-bold" style={{ color }}>{attempt.is_correct ? 'Correcta' : 'Incorrecta'}</Text>
        </View>
        <Text className="mt-1 text-[12px] text-text-secondary" numberOfLines={2}>{attempt.answerLabel}</Text>
        <Text className="mt-1 text-[12px] text-text-secondary">
          {attempt.attempted_at ? getTimeAgo(attempt.attempted_at) : 'Sin fecha'} · {attempt.earned_points ?? 0} XP · {attempt.classroomName}
        </Text>
      </View>
    </View>
  )
}

function AffectedStudentRow({ item }: { item: { studentId: string; alias: string; failures: number; attempts: number; lastAttemptAt: string | null } }) {
  const failureRate = item.attempts > 0 ? Math.round((item.failures / item.attempts) * 100) : 0
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised p-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-selected">
        <Ionicons name="person" size={18} color="#9FD6FF" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white" numberOfLines={1}>{item.alias}</Text>
        <Text className="mt-1 text-[11px] text-text-muted">
          {item.failures} fallos de {item.attempts} intentos · {item.lastAttemptAt ? getTimeAgo(item.lastAttemptAt) : 'Sin fecha'}
        </Text>
      </View>
      <Text className="text-[16px] font-black text-semantic-danger">{failureRate}%</Text>
    </View>
  )
}

function EmptyBox({ text }: { text: string }) {
  return (
    <View className="rounded-xl border border-dashed border-border-default bg-surface-raised px-4 py-5">
      <Text className="text-center text-[12px] text-text-muted">{text}</Text>
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
