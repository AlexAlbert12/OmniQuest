import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../../lib/supabase'
import { difficultyOptions, normalizeDifficulty, type DifficultyLevel } from '../../../lib/difficulty'
import StudentBottomNav from '../../../components/student/StudentBottomNav'
import { MOBILE_BOTTOM_NAV_HEIGHT, MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout'
import { GalaxyScreenBackground, TopicGalaxyMap } from '../../../components/student/galaxy/StudentGalaxyMap'
import { fetchStudentAttemptHistory, fetchStudentQuestionCatalog } from '../../../lib/studentSecureData'
import { useAppTheme } from '../../../lib/appTheme'
import { useAppModal } from '../../../components/AppModalProvider'
import { useResponsiveLayout } from '../../../lib/responsive'
import {
  CourseGalaxyHeader,
  CourseNextMission,
  CourseProgressPanel,
  TopicDifficultyModal,
} from '../../../components/student/course'

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

const MOBILE_STICKY_MISSION_HEIGHT = 58
const MOBILE_STICKY_MISSION_GAP = 12
const MOBILE_STICKY_CONTENT_GAP = 16

export default function StudentClassDetailScreen() {
  const { id, classroomId } = useLocalSearchParams<{ id: string; classroomId?: string }>()
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const insets = useSafeAreaInsets()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([])
  const [failedQuestions, setFailedQuestions] = useState<FailedQuestion[]>([])
  const [classRanking, setClassRanking] = useState<ClassRankingItem[]>([])
  const [studentId, setStudentId] = useState<string | null>(null)
  const [difficultyChooserTopic, setDifficultyChooserTopic] = useState<Topic | null>(null)
  const [inlineMissionBottom, setInlineMissionBottom] = useState<number | null>(null)
  const [showMobileStickyMission, setShowMobileStickyMission] = useState(false)
  const [loading, setLoading] = useState(true)

  const subjectId = Array.isArray(id) ? id[0] : id
  const selectedClassroomId = Array.isArray(classroomId) ? classroomId[0] : classroomId
  const isDesktop = responsive.isDesktop
  const { tokens } = useAppTheme()
  const { showModal } = useAppModal()
  const color = subject?.theme_color || tokens.brand.student
  const showAlert = useCallback((title: string, message: string) => {
    showModal({ title, message, variant: 'error' })
  }, [showModal])

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
    if (classRanking.length === 1) return '1.º de 1'
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
  }, [selectedClassroomId, showAlert, subjectId])

  useFocusEffect(
    useCallback(() => {
      fetchClass()
    }, [fetchClass])
  )

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

  const handleInlineMissionLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout
    setInlineMissionBottom(y + height)
  }, [])

  const handleCourseScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isDesktop || inlineMissionBottom === null || !recommendedTopic) return
    const shouldShow = event.nativeEvent.contentOffset.y > inlineMissionBottom + 8
    setShowMobileStickyMission((current) => current === shouldShow ? current : shouldShow)
  }, [inlineMissionBottom, isDesktop, recommendedTopic])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary">
        <ActivityIndicator size="large" color={tokens.brand.student} />
        <Text className="mt-4 text-text-muted">Cargando temas...</Text>
      </View>
    )
  }

  if (!subject) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary px-6">
        <Ionicons name="alert-circle-outline" size={52} color={tokens.semantic.danger} />
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
      testID: `student-topic-${topic.id}`,
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
  const mobileBottomPadding = recommendedTopic
    ? MOBILE_BOTTOM_NAV_HEIGHT + insets.bottom + MOBILE_STICKY_MISSION_HEIGHT + MOBILE_STICKY_MISSION_GAP + MOBILE_STICKY_CONTENT_GAP
    : MOBILE_BOTTOM_NAV_SPACER

  return (
    <View className="flex-1 bg-background-secondary">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: isDesktop ? 28 : 18,
          paddingTop: isDesktop ? 24 : 18,
          paddingBottom: isDesktop ? 170 : mobileBottomPadding,
        }}
        onScroll={!isDesktop && recommendedTopic ? handleCourseScroll : undefined}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <GalaxyScreenBackground subtle height={Math.max(1900, Math.min(3200, topics.length * 120 + 1700))} />
        <View className="w-full">
          <CourseGalaxyHeader
            subject={subject}
            classroom={classroom}
            totals={totals}
            isDesktop={isDesktop}
            onBack={() => router.back()}
          />

          <View onLayout={!isDesktop && recommendedTopic ? handleInlineMissionLayout : undefined}>
            <CourseNextMission
              topic={recommendedTopic}
              position={recommendedTopicPosition}
              courseDescription={subject.description}
              onContinue={recommendedTopic ? () => openTopic(recommendedTopic, recommendedTopic.failedQuestions > 0) : undefined}
            />
          </View>

          <TopicGalaxyMap items={topicGalaxyItems} />

          <CourseProgressPanel
            totals={totals}
            topicsCount={topics.length}
            color={color}
            failedQuestions={failedQuestions}
            classRanking={classRanking}
            recentAttempts={recentAttempts}
            rankingLabel={rankingLabel}
            isDesktop={isDesktop}
            onOpenActivity={() => router.push('/(student)/activity-log' as any)}
            onOpenFailedQuestion={openFailedQuestion}
          />
        </View>
      </ScrollView>

      {recommendedTopic && (isDesktop || showMobileStickyMission) ? (
        <View
          pointerEvents="box-none"
          style={isDesktop
            ? { position: 'absolute', right: 24, bottom: 24, width: 520, zIndex: 30 }
            : { position: 'absolute', left: 14, right: 14, bottom: MOBILE_BOTTOM_NAV_HEIGHT + insets.bottom + MOBILE_STICKY_MISSION_GAP, zIndex: 30 }}
        >
          <CourseNextMission
            compact
            topic={recommendedTopic}
            position={recommendedTopicPosition}
            courseDescription={subject.description}
            onContinue={() => openTopic(recommendedTopic, recommendedTopic.failedQuestions > 0)}
          />
        </View>
      ) : null}

      <TopicDifficultyModal
        color={color}
        topic={difficultyChooserTopic}
        onClose={() => setDifficultyChooserTopic(null)}
        onChoose={(difficulty, reviewFailed) => difficultyChooserTopic ? chooseDifficulty(difficultyChooserTopic, difficulty, reviewFailed) : undefined}
      />
      {!isDesktop ? <StudentBottomNav active="classes" /> : null}
    </View>
  )
}

function getTopicActionLabel(topic: Topic) {
  if (topic.questionsCount === 0) return 'Sin preguntas'
  if (topic.answeredQuestions === 0) return 'Empezar'
  if (topic.answeredQuestions < topic.questionsCount) return 'Continuar'
  return 'Repetir'
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

function normalizeRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}
