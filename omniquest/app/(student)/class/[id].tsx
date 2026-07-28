import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../../lib/supabase'
import { difficultyOptions, getDifficultyMeta, normalizeDifficulty, type DifficultyLevel } from '../../../lib/difficulty'
import StudentPageHeader from '../../../components/student/StudentPageHeader'
import StudentBottomNav from '../../../components/student/StudentBottomNav'
import OmniGuide, { type OmniState } from '../../../components/OmniGuide'
import { withAlpha } from '../../../lib/color'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout'
import MobileMetricCard from '../../../components/ui/mobile/MobileMetricCard'
import { GalaxyScreenBackground, TopicGalaxyMap } from '../../../components/student/galaxy/StudentGalaxyMap'
import { fetchStudentAttemptHistory, fetchStudentQuestionCatalog } from '../../../lib/studentSecureData'

type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
}

type Classroom = {
  id: number
  name: string
  code: string | null
  academic_year: string | null
}

type Topic = {
  id: number | 'general'
  title: string
  description: string | null
  icon: string | null
  sort_order: number
  availableUntil: string | null
  questionsCount: number
  answeredQuestions: number
  failedQuestions: number
  lastAttemptAt: string | null
  bestScore?: number
  difficulties: DifficultyTopicStats[]
}

type DifficultyTopicStats = {
  difficulty: DifficultyLevel
  questionsCount: number
  answeredQuestions: number
  failedQuestions: number
  lastAttemptAt: string | null
}

type RecentAttempt = {
  id: string
  isCorrect: boolean
  questionText: string
  topicTitle: string
  attemptedAt: string
}

type FailedQuestion = {
  id: number
  text: string
  topicTitle: string
}

type ClassRankingItem = {
  studentId: string
  alias: string
  avatar: string | null
  points: number
}

export default function StudentClassDetailScreen() {
  const { id, classroomId } = useLocalSearchParams<{ id: string; classroomId?: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([])
  const [failedQuestions, setFailedQuestions] = useState<FailedQuestion[]>([])
  const [classRanking, setClassRanking] = useState<ClassRankingItem[]>([])
  const [studentId, setStudentId] = useState<string | null>(null)
  const [difficultyChooserTopic, setDifficultyChooserTopic] = useState<Topic | null>(null)
  const [loading, setLoading] = useState(true)

  const subjectId = Array.isArray(id) ? id[0] : id
  const selectedClassroomId = Array.isArray(classroomId) ? classroomId[0] : classroomId
  const isDesktop = width >= 1024
  const color = subject?.theme_color || '#6574FF'

  const totals = useMemo(() => {
    const questions = topics.reduce((total, topic) => total + topic.questionsCount, 0)
    const answered = topics.reduce((total, topic) => total + topic.answeredQuestions, 0)
    const failed = topics.reduce((total, topic) => total + topic.failedQuestions, 0)
    const scores = topics.map((topic) => topic.bestScore).filter((score): score is number => typeof score === 'number')
    const average = scores.length > 0 ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0
    const earnedXp = scores.reduce((total, score) => total + score, 0)
    const progress = questions > 0 ? Math.round((answered / questions) * 100) : 0

    return { questions, answered, failed, average, earnedXp, progress }
  }, [topics])

  const rankingLabel = useMemo(() => {
    if (!studentId || classRanking.length === 0) return 'Ranking'
    const rankIndex = classRanking.findIndex((row) => row.studentId === studentId)
    if (rankIndex < 0) return 'Ranking'
    const percentile = Math.max(1, Math.round(((rankIndex + 1) / Math.max(classRanking.length, 1)) * 100))
    return `Top ${percentile}%`
  }, [classRanking, studentId])

  const recommendedTopic = useMemo(() => {
    const playableTopics = topics.filter((topic) => !isTopicLocked(topic))
    return playableTopics.find((topic) => topic.questionsCount > topic.answeredQuestions)
      || playableTopics.find((topic) => topic.questionsCount > 0)
      || null
  }, [topics])

  const fetchClass = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) return
      setStudentId(userId)

      const enrollmentQuery = supabase
        .from('enrollments')
        .select('classroom_id, subjects(id, name, description, icon, theme_color), classrooms(id, name, code, academic_year)')
        .eq('student_id', userId)
        .eq('subject_id', subjectId)

      if (selectedClassroomId) {
        enrollmentQuery.eq('classroom_id', selectedClassroomId)
      }

      const enrollmentResult = await enrollmentQuery.order('joined_at', { ascending: false }).limit(1).maybeSingle()
      if (enrollmentResult.error) throw enrollmentResult.error

      const selectedEnrollmentClassroomId = Number(enrollmentResult.data?.classroom_id ?? selectedClassroomId)
      if (!selectedEnrollmentClassroomId) {
        throw new Error('No estás matriculado en esta clase.')
      }

      const [topicsResult, questionsResult, topicScoresResult, subjectScoreResult, attemptsResult, rankingResult] = await Promise.all([
        supabase
          .from('subject_topics')
          .select('id, title, description, icon, sort_order, available_until')
          .eq('subject_id', subjectId)
          .eq('classroom_id', selectedEnrollmentClassroomId)
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        fetchStudentQuestionCatalog({
          subjectId: Number(subjectId),
          classroomId: selectedEnrollmentClassroomId,
        }),
        supabase
          .from('topic_scores')
          .select('topic_id, max_score')
          .eq('student_id', userId)
          .eq('subject_id', subjectId)
          .eq('classroom_id', selectedEnrollmentClassroomId),
        supabase
          .from('subject_scores')
          .select('max_score')
          .eq('student_id', userId)
          .eq('subject_id', subjectId)
          .eq('classroom_id', selectedEnrollmentClassroomId)
          .maybeSingle(),
        fetchStudentAttemptHistory({
          limit: 100,
          subjectId: Number(subjectId),
          classroomId: selectedEnrollmentClassroomId,
        }),
        supabase.rpc('get_class_ranking_profiles', {
          p_classroom_id: selectedEnrollmentClassroomId,
          p_limit: 5,
        }),
      ])

      if (topicsResult.error) throw topicsResult.error
      if (topicScoresResult.error) throw topicScoresResult.error
      if (subjectScoreResult.error) throw subjectScoreResult.error
      if (rankingResult.error) throw rankingResult.error

      const questions = questionsResult || []
      const attempts = (attemptsResult || []) as any[]
      const latestAttemptByQuestion = new Map<number, any>()
      attempts.forEach((attempt) => {
        const questionId = Number(attempt.question_id ?? normalizeRelation(attempt.questions)?.id)
        if (Number.isFinite(questionId) && !latestAttemptByQuestion.has(questionId)) {
          latestAttemptByQuestion.set(questionId, attempt)
        }
      })
      const answeredQuestionIds = new Set<number>(latestAttemptByQuestion.keys())
      const failedQuestionIds = new Set(
        Array.from(latestAttemptByQuestion.entries())
          .filter(([, attempt]) => attempt.is_correct === false)
          .map(([questionId]) => questionId)
      )
      const scoresByTopic = new Map<number, number>()
      topicScoresResult.data?.forEach((score) => {
        if (score.topic_id !== null) scoresByTopic.set(Number(score.topic_id), score.max_score ?? 0)
      })

      const topicTitleById = new Map<number | 'general', string>()
      const nextTopics: Topic[] = (topicsResult.data || []).map((topic) => {
        const topicId = Number(topic.id)
        const topicQuestions = questions.filter((question) => Number(question.topic_id) === topicId)
        topicTitleById.set(topicId, topic.title)

        return {
          id: topicId,
          title: topic.title,
          description: topic.description,
          icon: topic.icon,
          sort_order: topic.sort_order ?? 1,
          availableUntil: topic.available_until ?? null,
          questionsCount: topicQuestions.length,
          answeredQuestions: topicQuestions.filter((question) => answeredQuestionIds.has(Number(question.id))).length,
          failedQuestions: topicQuestions.filter((question) => failedQuestionIds.has(Number(question.id))).length,
          lastAttemptAt: getLastAttemptAt(topicQuestions, latestAttemptByQuestion),
          bestScore: scoresByTopic.get(topicId),
          difficulties: buildTopicDifficulties(topicQuestions, latestAttemptByQuestion),
        }
      })

      const generalQuestionRows = questions.filter((question) => question.topic_id === null)
      if (generalQuestionRows.length > 0) {
        topicTitleById.set('general', 'Tema general')
        nextTopics.unshift({
          id: 'general',
          title: 'Tema general',
          description: 'Preguntas creadas antes de organizar la clase por temas.',
          icon: 'layers-outline',
          sort_order: 0,
          availableUntil: null,
          questionsCount: generalQuestionRows.length,
          answeredQuestions: generalQuestionRows.filter((question) => answeredQuestionIds.has(Number(question.id))).length,
          failedQuestions: generalQuestionRows.filter((question) => failedQuestionIds.has(Number(question.id))).length,
          lastAttemptAt: getLastAttemptAt(generalQuestionRows, latestAttemptByQuestion),
          bestScore: subjectScoreResult.data?.max_score ?? undefined,
          difficulties: buildTopicDifficulties(generalQuestionRows, latestAttemptByQuestion),
        })
      }

      const enrolledSubject = Array.isArray(enrollmentResult.data?.subjects)
        ? enrollmentResult.data.subjects[0]
        : enrollmentResult.data?.subjects
      const enrolledClassroom = Array.isArray(enrollmentResult.data?.classrooms)
        ? enrollmentResult.data.classrooms[0]
        : enrollmentResult.data?.classrooms

      if (!enrolledSubject) {
        throw new Error('No estás matriculado en esta clase.')
      }

      setSubject(enrolledSubject as Subject)
      setClassroom(enrolledClassroom as Classroom | null)
      setTopics(nextTopics)
      setRecentAttempts(
        attempts.slice(0, 5).map((attempt) => {
          const question = normalizeRelation(attempt.questions)
          const topicId = question?.topic_id === null || question?.topic_id === undefined ? 'general' : Number(question.topic_id)

          return {
            id: String(attempt.id),
            isCorrect: attempt.is_correct === true,
            questionText: question?.text || 'Pregunta',
            topicTitle: topicTitleById.get(topicId) || 'Tema',
            attemptedAt: attempt.attempted_at,
          }
        })
      )
      setFailedQuestions(
        questions
          .filter((question) => failedQuestionIds.has(Number(question.id)))
          .slice(0, 5)
          .map((question) => {
            const topicId = question.topic_id === null || question.topic_id === undefined ? 'general' : Number(question.topic_id)
            return {
              id: Number(question.id),
              text: question.text || 'Pregunta',
              topicTitle: topicTitleById.get(topicId) || 'Tema',
            }
          })
      )
      setClassRanking(
        ((rankingResult.data || []) as any[]).map((row) => {
          return {
            studentId: row.id,
            alias: row.alias || 'Alumno',
            avatar: row.avatar ?? null,
            points: row.points ?? 0,
          }
        })
      )
    } catch (error: any) {
      console.error('Error cargando temas:', error.message)
      showAlert('No se pudo cargar la clase', 'Inténtalo de nuevo en unos segundos.')
    } finally {
      setLoading(false)
    }
  }, [selectedClassroomId, subjectId])

  useFocusEffect(
    useCallback(() => {
      fetchClass()
    }, [fetchClass])
  )

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  const openTopic = (topic: Topic, reviewFailed = false) => {
    if (topic.questionsCount === 0 || isTopicLocked(topic)) return
    if (topic.difficulties.length <= 1) {
      const difficulty = topic.difficulties[0]?.difficulty || 1
      router.push(buildPlayHref(subject?.id || Number(subjectId), classroom?.id ?? null, topic, difficulty, reviewFailed) as any)
      return
    }

    setDifficultyChooserTopic(topic)
  }

  const chooseDifficulty = (topic: Topic, difficulty: DifficultyLevel, reviewFailed = false) => {
    setDifficultyChooserTopic(null)
    router.push(buildPlayHref(subject?.id || Number(subjectId), classroom?.id ?? null, topic, difficulty, reviewFailed) as any)
  }

  const openFailedQuestion = (question: FailedQuestion) => {
    const topic = topics.find((item) => item.title === question.topicTitle) || recommendedTopic
    if (topic) openTopic(topic, true)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary">
        <ActivityIndicator size="large" color="#6574FF" />
        <Text className="mt-4 text-text-muted">Cargando temas...</Text>
      </View>
    )
  }

  if (!subject) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary px-6">
        <Ionicons name="alert-circle-outline" size={52} color="#FB7185" />
        <Text className="mt-4 text-center text-xl font-black text-white">No se encontró esta clase</Text>
        <Pressable onPress={() => router.replace('/(student)/classes' as any)} className="mt-5 rounded-xl bg-brand-student px-5 py-3">
          <Text className="font-bold text-white">Volver a clases</Text>
        </Pressable>
      </View>
    )
  }

  const topicGalaxyItems = topics.map((topic) => {
    const locked = isTopicLocked(topic)
    const completed = topic.questionsCount > 0 && topic.answeredQuestions >= topic.questionsCount
    const isRecommended = recommendedTopic?.id === topic.id
    const state = locked
      ? 'locked' as const
      : topic.questionsCount === 0
        ? 'empty' as const
        : completed
          ? 'completed' as const
          : isRecommended
            ? 'active' as const
            : 'available' as const
    const progress = topic.questionsCount > 0
      ? Math.round((topic.answeredQuestions / topic.questionsCount) * 100)
      : 0

    return {
      key: String(topic.id),
      title: topic.title,
      progress,
      state,
      actionLabel: topic.failedQuestions > 0 ? 'Repasar' : getTopicActionLabel(topic),
      color,
      icon: topic.icon,
      failedQuestions: topic.failedQuestions,
      questionsCount: topic.questionsCount,
      bestScore: topic.bestScore,
      onPress: () => openTopic(topic, topic.failedQuestions > 0),
    }
  })
  const recommendedTopicPosition = recommendedTopic
    ? Math.max(1, topics.findIndex((topic) => topic.id === recommendedTopic.id) + 1)
    : null

  return (
    <View className="flex-1 bg-background-secondary">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: isDesktop ? 18 : 18,
          paddingTop: isDesktop ? 30 : 34,
          paddingBottom: isDesktop ? 70 : MOBILE_BOTTOM_NAV_SPACER + 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <GalaxyScreenBackground height={Math.max(2500, topics.length * 320 + 1280)} />
        <View className="mx-auto w-full max-w-[1480px]">
          <StudentPageHeader
            backAction={{ label: 'Mis cursos', onPress: () => router.back() }}
            isDesktop={isDesktop}
            title={subject.name}
            subtitle={`${totals.progress}% avance · ${totals.failed} ${totals.failed === 1 ? 'fallo pendiente' : 'fallos pendientes'}${classroom ? ` · ${classroom.name}` : ''}`}
            titleNumberOfLines={2}
            showNotifications={isDesktop}
            showAvatar={isDesktop}
            leading={(
              <View className={isDesktop ? 'h-20 w-20' : 'h-16 w-16'}>
                <View className="absolute -inset-1 rounded-full bg-surface-disabled" />
                <LinearGradient
                  colors={[withAlpha(color, 'FF'), '#F59E0B', '#8A3518']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="h-full w-full items-center justify-center rounded-full border-4"
                  style={{ borderColor: withAlpha(color, 'CC') }}
                >
                  {subject.icon ? (
                    getValidIoniconName(subject.icon) ? (
                      <Ionicons name={getValidIoniconName(subject.icon) || 'book'} size={isDesktop ? 34 : 28} color="#FFFFFF" />
                    ) : (
                      <Text className={isDesktop ? 'text-[32px]' : 'text-[26px]'}>{subject.icon}</Text>
                    )
                  ) : (
                    <Ionicons name="book" size={isDesktop ? 34 : 28} color="#FFFFFF" />
                  )}
                </LinearGradient>
              </View>
            )}
            actions={(
              <View className="flex-row items-center gap-4">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="flame" size={22} color="#FF7A3D" />
                  <Text className="text-[18px] font-black text-white">{totals.failed}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="diamond" size={22} color="#59C7FF" />
                  <Text className="text-[18px] font-black text-white">{totals.earnedXp.toLocaleString()}</Text>
                </View>
              </View>
            )}
          />

          <View className="mb-9 flex-row items-center gap-4 rounded-[28px] border border-border-default bg-surface-disabled px-5 py-5">
            <View className="min-w-0 flex-1">
              <Text className="text-[12px] font-black uppercase tracking-[1.6px] text-brand-admin">Ruta de aprendizaje</Text>
              <Text className={isDesktop ? 'mt-2 text-[26px] font-black text-white' : 'mt-2 text-[23px] font-black leading-7 text-white'} numberOfLines={2}>
                {recommendedTopic ? `Tema ${recommendedTopicPosition} · ${recommendedTopic.title}` : topics.length > 0 ? 'Has completado la galaxia' : 'Aún no hay temas disponibles'}
              </Text>
              <Text className="mt-2 text-[15px] leading-6 text-text-secondary" numberOfLines={2}>
                {recommendedTopic?.description || subject.description || 'Selecciona un planeta para empezar una misión.'}
              </Text>
            </View>
            <View className="h-16 w-16 items-center justify-center rounded-[20px] border border-brand-student bg-semantic-surface-danger">
              <Ionicons name="book-outline" size={30} color="#A96CFF" />
            </View>
          </View>

          <TopicGalaxyMap items={topicGalaxyItems} />

          <View className="mt-6 rounded-[28px] border border-border-default bg-surface-default p-5">
            <View className="mb-5 flex-row items-center justify-between gap-3">
              <View>
                <Text className="text-[24px] font-black text-white">Resumen de la galaxia</Text>
                <Text className="mt-1 text-[14px] text-text-muted">Tu progreso, tus retos y la clasificación de la clase.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver toda mi actividad"
                onPress={() => router.push('/(student)/activity-log' as any)}
                className="rounded-full border border-border-default bg-surface-disabled px-4 py-2"
              >
                <Text className="font-black text-brand-admin">Actividad</Text>
              </Pressable>
            </View>

            <View className={isDesktop ? 'flex-row gap-4' : 'flex-row gap-3'}>
              <MobileMetricCard
                compact
                icon="planet"
                color={color}
                value={topics.length}
                label="Temas"
                style={{ flex: 1, minHeight: 118 }}
              />
              <MobileMetricCard
                compact
                icon="checkmark-circle"
                color="#35D7B4"
                value={`${totals.progress}%`}
                label="Avance"
                style={{ flex: 1, minHeight: 118 }}
              />
              <MobileMetricCard
                compact
                icon="flame"
                color="#FB4772"
                value={totals.failed}
                label="Repasar"
                style={{ flex: 1, minHeight: 118 }}
              />
              {isDesktop ? (
                <MobileMetricCard
                  compact
                  icon="diamond"
                  color="#59C7FF"
                  value={totals.earnedXp}
                  suffix=" XP"
                  label="Experiencia"
                  style={{ flex: 1, minHeight: 118 }}
                />
              ) : null}
            </View>

            <View className={isDesktop ? 'mt-6 flex-row gap-5' : 'mt-6 gap-5'}>
              <View className={isDesktop ? 'flex-1' : ''}>
                <MobileSectionHeading title="Preguntas para repasar" actionLabel="Ver todas" onAction={() => router.push('/(student)/activity-log' as any)} />
                {failedQuestions.length > 0 ? (
                  <View className="gap-3">
                    {failedQuestions.slice(0, 2).map((question) => (
                      <MobileFailedQuestionCard
                        key={question.id}
                        question={question}
                        onPress={() => openFailedQuestion(question)}
                      />
                    ))}
                  </View>
                ) : (
                  <MobileEmptyBlock icon="checkmark-circle-outline" omniState="happy" title="Sin fallos pendientes" subtitle="Has superado todas tus misiones recientes." />
                )}
              </View>

              <View className={isDesktop ? 'flex-1' : ''}>
                <MobileSectionHeading title="Ranking de la clase" />
                <View className="gap-2 rounded-2xl border border-border-default bg-surface-default p-3">
                  {classRanking.length > 0 ? (
                    classRanking.slice(0, 3).map((row, index) => (
                      <MobileRankingRow key={row.studentId} row={row} index={index} />
                    ))
                  ) : (
                    <MobileEmptyBlock icon="trophy-outline" omniState="normal" title="Sin ranking todavía" subtitle="Completa una misión para aparecer en la clasificación." />
                  )}
                  <View className="mt-1 rounded-xl bg-surface-disabled px-3 py-2">
                    <Text className="text-center text-[12px] font-black text-brand-student">{rankingLabel}</Text>
                  </View>
                </View>
              </View>
            </View>

            <MobileSectionHeading title="Últimos intentos" actionLabel="Ver todo" onAction={() => router.push('/(student)/activity-log' as any)} />
            <View className="overflow-hidden rounded-2xl border border-border-default bg-surface-default">
              {recentAttempts.length > 0 ? (
                recentAttempts.slice(0, 3).map((attempt, index) => (
                  <MobileRecentAttemptRow
                    key={attempt.id}
                    attempt={attempt}
                    isLast={index === Math.min(recentAttempts.length, 3) - 1}
                  />
                ))
              ) : (
                <MobileEmptyBlock icon="play-circle-outline" omniState="normal" title="Sin intentos recientes" subtitle="Selecciona un planeta para iniciar tu primera misión." />
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <DifficultyChooser
        color={color}
        topic={difficultyChooserTopic}
        onClose={() => setDifficultyChooserTopic(null)}
        onChoose={(difficulty, reviewFailed) => difficultyChooserTopic ? chooseDifficulty(difficultyChooserTopic, difficulty, reviewFailed) : undefined}
      />
      {!isDesktop ? <StudentBottomNav active="classes" /> : null}
    </View>
  )
}

function MobileRankingRow({ row, index }: { row: ClassRankingItem; index: number }) {
  const medalColors = ['#FBBF24', '#CBD5E1', '#F97316']

  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-surface-raised px-3 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-semantic-surface-info">
        {index < 3 ? (
          <Ionicons name="medal" size={18} color={medalColors[index]} />
        ) : (
          <Text className="text-[13px] font-black text-text-secondary">{index + 1}</Text>
        )}
      </View>
      <Text className="min-w-0 flex-1 text-[14px] font-black text-white" numberOfLines={1}>{row.alias}</Text>
      <Text className="text-[13px] font-black text-brand-student">{row.points.toLocaleString()} XP</Text>
    </View>
  )
}

function MobileSectionHeading({
  actionLabel,
  onAction,
  title,
}: {
  actionLabel?: string
  onAction?: () => void
  title: string
}) {
  return (
    <View className="mb-3 mt-7 flex-row items-center justify-between gap-3">
      <Text className="text-[22px] font-black text-white">{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction}>
          <Text className="text-[15px] font-black text-brand-admin">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function MobileRecentAttemptRow({ attempt, isLast }: { attempt: RecentAttempt; isLast: boolean }) {
  const color = attempt.isCorrect ? '#22C55E' : '#FB7185'

  return (
    <View className={`flex-row items-center gap-3 p-4 ${isLast ? '' : 'border-b border-border-subtle'}`}>
      <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '26') }}>
        <Ionicons name={attempt.isCorrect ? 'checkmark' : 'close'} size={26} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-black text-white" numberOfLines={1}>
          {attempt.isCorrect ? 'Respuesta correcta' : 'Respuesta incorrecta'}
        </Text>
        <Text className="mt-1 text-[13px] text-text-secondary" numberOfLines={1}>{attempt.topicTitle} · {attempt.questionText}</Text>
      </View>
      <View className="items-end gap-2">
        <Text className="text-[13px] text-text-secondary">{formatRecentAttemptDate(attempt.attemptedAt)}</Text>
        <View className="rounded-xl bg-surface-selected px-3 py-1.5">
          <Text className="text-[13px] font-black text-text-secondary">{attempt.isCorrect ? '+10 XP' : '+5 XP'}</Text>
        </View>
      </View>
    </View>
  )
}

function MobileFailedQuestionCard({ question, onPress }: { question: FailedQuestion; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[78px] flex-row items-center gap-3 rounded-2xl border border-border-default bg-semantic-surface-danger p-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-semantic-surface-danger">
        <Ionicons name="close" size={24} color="#FB7185" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-black text-white" numberOfLines={2}>{question.text}</Text>
        <Text className="mt-1 text-[13px] font-bold text-semantic-danger" numberOfLines={1}>{question.topicTitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color="#E9D5FF" />
    </Pressable>
  )
}

function MobileEmptyBlock({
  icon,
  omniState,
  subtitle,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap
  omniState?: OmniState
  subtitle: string
  title: string
}) {
  return (
    <View className="items-center rounded-2xl border border-dashed border-border-default bg-surface-raised px-4 py-7">
      {omniState ? <OmniGuide state={omniState} size={78} autoBlink={omniState === 'normal'} /> : <Ionicons name={icon} size={30} color="#8FA7C7" />}
      <Text className="mt-3 text-center text-[15px] font-black text-white">{title}</Text>
      <Text className="mt-1 text-center text-[13px] leading-5 text-text-muted">{subtitle}</Text>
    </View>
  )
}

function DifficultyChooser({
  color,
  onChoose,
  onClose,
  topic,
}: {
  color: string
  onChoose: (difficulty: DifficultyLevel, reviewFailed: boolean) => void
  onClose: () => void
  topic: Topic | null
}) {
  return (
    <Modal
      visible={Boolean(topic)}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        accessibilityViewIsModal
        style={difficultyModalStyles.root}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar selector de dificultad"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View pointerEvents="box-none" style={difficultyModalStyles.contentFrame}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={difficultyModalStyles.panel}
            contentContainerStyle={difficultyModalStyles.panelContent}
          >
            {topic ? (
              <>
                <View className="flex-row items-start justify-between gap-4">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color }}>Elige dificultad</Text>
                    <Text className="mt-2 text-[24px] font-black text-white">{topic.title}</Text>
                    <Text className="mt-1 text-[13px] leading-5 text-text-secondary">
                      Este tema tiene varias versiones. Jugarás solo las preguntas de la dificultad seleccionada.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar selector de dificultad"
                    onPress={onClose}
                    hitSlop={8}
                    className="h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-surface-raised"
                    style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
                  >
                    <Ionicons name="close" size={18} color="#AFC2DB" />
                  </Pressable>
                </View>

                <View className="mt-5 gap-3">
                  {topic.difficulties.map((stats) => {
                    const meta = getDifficultyMeta(stats.difficulty)
                    const pending = Math.max(0, stats.questionsCount - stats.answeredQuestions)
                    const action = stats.answeredQuestions === 0 ? 'Empezar' : pending > 0 ? 'Continuar' : 'Repetir'
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${meta.label}. ${stats.questionsCount} preguntas. ${action}`}
                        key={stats.difficulty}
                        onPress={() => onChoose(stats.difficulty, false)}
                        className="flex-row flex-wrap items-center gap-4 rounded-xl border p-4"
                        style={({ pressed }) => ({
                          borderColor: `${meta.color}88`,
                          backgroundColor: `${meta.color}18`,
                          opacity: pressed ? 0.82 : 1,
                        })}
                      >
                        <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.color}24` }}>
                          <Ionicons name="layers-outline" size={22} color={meta.color} />
                        </View>
                        <View className="min-w-[180px] flex-1">
                          <Text className="text-[16px] font-black text-white">{meta.label}</Text>
                          <Text className="mt-1 text-[12px] text-text-secondary">
                            {stats.questionsCount} preguntas · {stats.answeredQuestions} respondidas · {stats.failedQuestions} falladas
                          </Text>
                        </View>
                        <View className="flex-row flex-wrap items-center gap-2">
                          {stats.failedQuestions > 0 ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Repasar fallos de dificultad ${meta.label}`}
                              onPress={(event) => {
                                event.stopPropagation?.()
                                onChoose(stats.difficulty, true)
                              }}
                              className="rounded-lg border border-semantic-danger bg-semantic-danger px-4 py-2"
                              style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
                            >
                              <Text className="font-black text-gamification-badge">Repasar fallos</Text>
                            </Pressable>
                          ) : null}
                          <View className="rounded-lg px-4 py-2" style={{ backgroundColor: meta.color }}>
                            <Text className="font-black text-white">{action}</Text>
                          </View>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const difficultyModalStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(1, 5, 15, 0.88)',
    zIndex: 9999,
    elevation: 9999,
  },
  contentFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  panel: {
    flexGrow: 0,
    width: '100%',
    maxWidth: 560,
    maxHeight: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#244166',
    backgroundColor: '#081832',
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 30,
  },
  panelContent: {
    padding: 20,
  },
})

function getTopicActionLabel(topic: Topic) {
  if (topic.questionsCount === 0) return 'Sin preguntas'
  if (topic.answeredQuestions === 0) return 'Empezar'
  if (topic.answeredQuestions < topic.questionsCount) return 'Continuar'
  return 'Repetir'
}

function getValidIoniconName(icon: string | null | undefined): keyof typeof Ionicons.glyphMap | null {
  if (icon && icon in Ionicons.glyphMap) {
    return icon as keyof typeof Ionicons.glyphMap
  }

  return null
}

function buildPlayHref(
  subjectId: number,
  classroomId: number | null,
  topic: Topic,
  difficulty: DifficultyLevel,
  reviewFailed = false,
) {
  return {
    pathname: '/(student)/play/[id]',
    params: {
      id: String(subjectId),
      ...(classroomId ? { classroomId: String(classroomId) } : {}),
      topicId: String(topic.id),
      topicName: topic.title,
      difficulty: String(difficulty),
      ...(reviewFailed ? { review: 'failed' } : {}),
    },
  }
}

function buildTopicDifficulties(questions: any[], latestAttemptByQuestion: Map<number, any>): DifficultyTopicStats[] {
  return difficultyOptions
    .map((option) => {
      const questionRows = questions.filter((question) => (normalizeDifficulty(question.difficulty) || 1) === option.value)
      return {
        difficulty: option.value,
        questionsCount: questionRows.length,
        answeredQuestions: questionRows.filter((question) => latestAttemptByQuestion.has(Number(question.id))).length,
        failedQuestions: questionRows.filter((question) => latestAttemptByQuestion.get(Number(question.id))?.is_correct === false).length,
        lastAttemptAt: getLastAttemptAt(questionRows, latestAttemptByQuestion),
      }
    })
    .filter((stats) => stats.questionsCount > 0)
}

function isTopicLocked(topic: Pick<Topic, 'availableUntil'>) {
  if (!topic.availableUntil) return false
  const timestamp = new Date(topic.availableUntil).getTime()
  return Number.isFinite(timestamp) && timestamp <= Date.now()
}

function getLastAttemptAt(questions: { id: number }[], latestAttemptByQuestion: Map<number, any>) {
  return questions.reduce<string | null>((latest, question) => {
    const attemptedAt = latestAttemptByQuestion.get(Number(question.id))?.attempted_at
    if (!attemptedAt) return latest
    if (!latest) return attemptedAt
    return new Date(attemptedAt).getTime() > new Date(latest).getTime() ? attemptedAt : latest
  }, null)
}

function formatRecentAttemptDate(value: string) {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Sin fecha'

  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 1) return 'Ahora'
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Hace ${diffHours} h`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`

  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(timestamp))
}

function normalizeRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}