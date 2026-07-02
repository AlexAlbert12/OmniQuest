import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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

type QuestionDetail = {
  id: number
  text: string
  type: string | null
  subject_id: number | null
  classroom_id: number | null
  topic_id: number | null
  explanation: string | null
  points_base: number | null
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
}

type AnswerDistributionItem = {
  label: string
  count: number
  correct: boolean
  percent: number
}

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
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isDesktop = width >= 1080
  const isWide = width >= 900
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

      setQuestion(nextQuestion)
      setAnswers(nextAnswers)
      setSubjectsCount(subjectsResult.count || 0)
      setAttempts(
        nextAttempts.map((attempt) => ({
          ...attempt,
          studentAlias: getStudentAlias(attempt.student_id, profilesById),
          answerLabel: getAttemptAnswerLabel(attempt, answersById),
        }))
      )
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

  const stats = useMemo(() => buildReportStats(attempts), [attempts])
  const answerDistribution = useMemo(() => buildAnswerDistribution(attempts, answers), [answers, attempts])
  const affectedStudents = useMemo(
    () => Array.from(new Set(attempts.filter((attempt) => attempt.is_correct === false).map((attempt) => attempt.student_id).filter(Boolean))).length,
    [attempts]
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
                    <Text className="text-[26px] font-black leading-8 text-white">{question.text}</Text>
                    {question.explanation ? (
                      <Text className="mt-3 text-[13px] leading-5 text-[#AFC2DB]">
                        Explicación: {question.explanation}
                      </Text>
                    ) : null}
                  </View>

                  <View className="flex-row flex-wrap gap-2">
                    <Pressable
                      onPress={() => router.push(`/(teacher)/subject/edit-question?subjectId=${question.subject_id}&questionId=${question.id}` as any)}
                      className="flex-row items-center gap-2 rounded-xl bg-[#7C5CFF] px-4 py-3"
                      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                    >
                      <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                      <Text className="text-[12px] font-black text-white">Editar pregunta</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push(`/(teacher)/subject/${question.subject_id}` as any)}
                      className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#07162E] px-4 py-3"
                      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                    >
                      <Ionicons name="book-outline" size={16} color="#DDE7F4" />
                      <Text className="text-[12px] font-black text-[#DDE7F4]">Ver curso</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <View className={isWide ? 'mt-5 flex-row gap-4' : 'mt-5 gap-4'}>
                <ReportMetricCard icon="people" title="Alumnos afectados" value={String(affectedStudents)} detail="Fallaron al menos una vez" color="#F43F5E" />
                <ReportMetricCard icon="close-circle" title="Tasa de fallo" value={`${stats.failureRate}%`} detail={`${stats.failedAttempts} de ${stats.totalAttempts} intentos`} color="#FB7185" />
                <ReportMetricCard icon="checkmark-circle" title="Aciertos" value={String(stats.correctAttempts)} detail="Intentos correctos" color="#43D991" />
                <ReportMetricCard icon="time" title="Tiempo medio" value={stats.averageTimeLabel} detail="Por intento" color="#58B5FF" />
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

                <Panel title="Últimos intentos" action={`${attempts.length} registrados`} className={isWide ? 'flex-1' : ''}>
                  <View className="gap-3">
                    {attempts.slice(0, 8).map((attempt) => (
                      <AttemptRowItem key={attempt.id} attempt={attempt} />
                    ))}
                    {attempts.length === 0 ? <EmptyBox text="Esta pregunta todavía no tiene intentos." /> : null}
                  </View>
                </Panel>
              </View>

              <Panel title="Alumnos con fallos" action={`${affectedStudents} alumnos`} className="mt-5">
                <View className="gap-3">
                  {buildAffectedStudentRows(attempts).map((item) => (
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
        <Text className="mt-1 text-[11px] text-[#60799C]">
          {attempt.attempted_at ? getTimeAgo(attempt.attempted_at) : 'Sin fecha'} · {attempt.earned_points ?? 0} XP
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

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}
