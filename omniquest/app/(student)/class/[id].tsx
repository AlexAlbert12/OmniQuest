import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../../lib/supabase'
import { difficultyOptions, getDifficultyMeta, normalizeDifficulty, type DifficultyLevel } from '../../../lib/difficulty'
import NotificationBadge from '../../../components/NotificationBadge'
import StudentHeaderAvatar from '../../../components/student/StudentHeaderAvatar'
import StudentBottomNav from '../../../components/student/StudentBottomNav'
import { withAlpha } from '../../../lib/color'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout'

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
        supabase
          .from('questions')
          .select('id, topic_id, text, difficulty')
          .eq('subject_id', subjectId)
          .eq('classroom_id', selectedEnrollmentClassroomId)
          .eq('active', true),
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
        supabase
          .from('attempt_history')
          .select('id, question_id, is_correct, attempted_at, questions!inner(id, text, topic_id, subject_id, classroom_id, difficulty)')
          .eq('student_id', userId)
          .eq('questions.subject_id', subjectId)
          .eq('questions.classroom_id', selectedEnrollmentClassroomId)
          .order('attempted_at', { ascending: false })
          .limit(30),
        supabase.rpc('get_class_ranking_profiles', {
          p_classroom_id: selectedEnrollmentClassroomId,
          p_limit: 5,
        }),
      ])

      if (topicsResult.error) throw topicsResult.error
      if (questionsResult.error) throw questionsResult.error
      if (topicScoresResult.error) throw topicScoresResult.error
      if (subjectScoreResult.error) throw subjectScoreResult.error
      if (attemptsResult.error) throw attemptsResult.error
      if (rankingResult.error) throw rankingResult.error

      const questions = questionsResult.data || []
      const attempts = (attemptsResult.data || []) as any[]
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
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#6574FF" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando temas...</Text>
      </View>
    )
  }

  if (!subject) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126] px-6">
        <Ionicons name="alert-circle-outline" size={52} color="#FB7185" />
        <Text className="mt-4 text-center text-xl font-black text-white">No se encontró esta clase</Text>
        <Pressable onPress={() => router.replace('/(student)/classes' as any)} className="mt-5 rounded-xl bg-[#5865F2] px-5 py-3">
          <Text className="font-bold text-white">Volver a clases</Text>
        </Pressable>
      </View>
    )
  }

  if (!isDesktop) {
    return (
      <View className="flex-1 bg-[#031022]">
        <MobileStudentClassDetail
          classroom={classroom}
          classRanking={classRanking}
          color={color}
          failedQuestions={failedQuestions}
          rankingLabel={rankingLabel}
          recentAttempts={recentAttempts}
          recommendedTopic={recommendedTopic}
          subject={subject}
          topics={topics}
          totals={totals}
          onBack={() => router.back()}
          onOpenActivity={() => router.push('/(student)/activity-log' as any)}
          onOpenFailedQuestion={openFailedQuestion}
          onOpenTopic={openTopic}
        />
        <DifficultyChooser
          color={color}
          topic={difficultyChooserTopic}
          onClose={() => setDifficultyChooserTopic(null)}
          onChoose={(difficulty, reviewFailed) => difficultyChooserTopic ? chooseDifficulty(difficultyChooserTopic, difficulty, reviewFailed) : undefined}
        />
        <StudentBottomNav active="classes" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: isDesktop ? 34 : 18,
          paddingTop: isDesktop ? 28 : 18,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-center justify-between gap-3">
          <Pressable onPress={() => router.back()} className="flex-row items-center gap-2">
            <Ionicons name="arrow-back" size={18} color="#8FA7C7" />
            <Text className="font-semibold text-[#8FA7C7]">Mis Cursos</Text>
          </Pressable>
          <View className="flex-row items-center gap-3">
            <NotificationBadge />
            <StudentHeaderAvatar />
          </View>
        </View>

        <View className="mb-6 flex-row flex-wrap items-center gap-4">
          <View className="h-20 w-20 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}26` }}>
            {subject.icon ? <Text className="text-[36px]">{subject.icon}</Text> : <Ionicons name="book" size={38} color={color} />}
          </View>
          <View className="min-w-[240px] flex-1">
            <Text className="text-[30px] font-black text-white">{subject.name}</Text>
            <Text className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#AFC2DB]">
              {subject.description || 'Elige un tema para empezar a responder preguntas.'}
            </Text>
            {classroom ? (
              <Text className="mt-1 text-[12px] font-bold text-[#A78BFA]">
                Clase: {classroom.name}{classroom.code ? ` · Código ${classroom.code}` : ''}
              </Text>
            ) : null}
          </View>
        </View>

        <View className={isDesktop ? 'mb-5 flex-row gap-4' : 'mb-5 gap-4'}>
          <SummaryCard icon="albums" label="Temas" value={String(topics.length)} color={color} />
          <SummaryCard icon="help-circle" label="Preguntas" value={String(totals.questions)} color="#58B5FF" />
          <SummaryCard icon="checkmark-circle" label="Respondidas" value={`${totals.answered} / ${totals.questions}`} color="#43D991" />
          <SummaryCard icon="star" label="Media de XP" value={totals.average > 0 ? `${totals.average} XP` : '0 XP'} color="#F6A64A" />
        </View>

        <View className={isDesktop ? 'mb-5 flex-row gap-5' : 'mb-5 gap-5'}>
          <ClassProgressCard
            progress={totals.progress}
            answered={totals.answered}
            total={totals.questions}
            failed={totals.failed}
            color={color}
          />
          <NextActionCard subjectId={subject.id} classroomId={classroom?.id ?? null} topic={recommendedTopic} color={color} onPress={openTopic} />
        </View>

        <View className="mb-5 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
          <Text className="mb-4 text-[18px] font-black text-white">Elige un tema</Text>

          {topics.length === 0 ? (
            <View className="items-center rounded-xl border border-dashed border-[#20375E] bg-[#0A1A34] px-4 py-8">
              <Ionicons name="albums-outline" size={42} color="#60799C" />
              <Text className="mt-3 text-center font-bold text-white">Aún no hay temas disponibles</Text>
              <Text className="mt-1 text-center text-[12px] leading-5 text-[#8FA7C7]">
                Tu profesor añadirá temas con preguntas para esta clase.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {topics.map((topic, index) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  index={index}
                  color={color}
                  onPress={() => openTopic(topic)}
                  onReviewFailures={() => openTopic(topic, true)}
                />
              ))}
            </View>
          )}
        </View>

        <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
          <InfoPanel title="Últimos intentos" icon="time-outline" className={isDesktop ? 'flex-[1.2]' : ''}>
            {recentAttempts.length > 0 ? (
              <View className="gap-3">
                {recentAttempts.map((attempt) => (
                  <RecentAttemptRow key={attempt.id} attempt={attempt} />
                ))}
              </View>
            ) : (
              <EmptyPanel icon="play-circle-outline" message="Empieza un tema para ver tus intentos recientes." />
            )}
          </InfoPanel>

          <InfoPanel title="Preguntas falladas" icon="alert-circle-outline" className={isDesktop ? 'flex-1' : ''}>
            {failedQuestions.length > 0 ? (
              <View className="gap-3">
                {failedQuestions.map((question) => (
                  <FailedQuestionRow key={question.id} question={question} />
                ))}
              </View>
            ) : (
              <EmptyPanel icon="checkmark-circle-outline" message="No tienes fallos pendientes en esta clase." />
            )}
          </InfoPanel>

          <InfoPanel title="Ranking de la clase" icon="trophy-outline" className={isDesktop ? 'flex-1' : ''}>
            {classRanking.length > 0 ? (
              <View className="gap-2">
                {classRanking.map((row, index) => (
                  <ClassRankingRow key={row.studentId} row={row} index={index} />
                ))}
              </View>
            ) : (
              <EmptyPanel icon="podium-outline" message="Aún no hay puntuaciones en esta clase." />
            )}
          </InfoPanel>
        </View>
      </ScrollView>
      <DifficultyChooser
        color={color}
        topic={difficultyChooserTopic}
        onClose={() => setDifficultyChooserTopic(null)}
        onChoose={(difficulty, reviewFailed) => difficultyChooserTopic ? chooseDifficulty(difficultyChooserTopic, difficulty, reviewFailed) : undefined}
      />
    </View>
  )
}

function MobileStudentClassDetail({
  classroom,
  classRanking,
  color,
  failedQuestions,
  rankingLabel,
  recentAttempts,
  recommendedTopic,
  subject,
  topics,
  totals,
  onBack,
  onOpenActivity,
  onOpenFailedQuestion,
  onOpenTopic,
}: {
  classroom: Classroom | null
  classRanking: ClassRankingItem[]
  color: string
  failedQuestions: FailedQuestion[]
  rankingLabel: string
  recentAttempts: RecentAttempt[]
  recommendedTopic: Topic | null
  subject: Subject
  topics: Topic[]
  totals: { questions: number; answered: number; failed: number; average: number; earnedXp: number; progress: number }
  onBack: () => void
  onOpenActivity: () => void
  onOpenFailedQuestion: (question: FailedQuestion) => void
  onOpenTopic: (topic: Topic, reviewFailed?: boolean) => void
}) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: MOBILE_BOTTOM_NAV_SPACER + 6 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-7 flex-row items-center justify-between">
        <Pressable onPress={onBack} className="flex-row items-center gap-3" hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          <Text className="text-[18px] font-black text-white">Mis cursos</Text>
        </Pressable>
        <View className="flex-row items-center gap-3">
          <NotificationBadge audience="student" />
          <StudentHeaderAvatar />
        </View>
      </View>

      <MobileClassHero
        classroom={classroom}
        color={color}
        subject={subject}
      />

      <View className="mt-5 flex-row rounded-2xl border border-[#17345B] bg-[#071832]">
        <MobileSummaryMetric icon="book" label="Temas" value={String(topics.length)} color={color} />
        <MobileSummaryMetric icon="help-circle" label="Preguntas" value={String(totals.questions)} color="#38BDF8" />
        <MobileSummaryMetric icon="flame" label="Fallos" value={String(totals.failed)} color="#FB7185" />
        <MobileSummaryMetric icon="star" label="XP" value={`${totals.earnedXp}`} color="#F59E0B" isLast />
      </View>

      <MobileClassProgressPanel
        color={color}
        progress={totals.progress}
        answered={totals.answered}
        total={totals.questions}
        failed={totals.failed}
      />

      <MobileRecommendedPanel
        color={color}
        topic={recommendedTopic}
        onPress={onOpenTopic}
      />

      <View className="mt-7">
        <Text className="mb-4 text-[22px] font-black text-white">Temas del curso</Text>
        {topics.length > 0 ? (
          <View className="gap-2">
            {topics.map((topic, index) => (
              <MobileTopicCard
                key={topic.id}
                color={color}
                index={index}
                topic={topic}
                onPress={() => onOpenTopic(topic)}
              />
            ))}
          </View>
        ) : (
          <MobileEmptyBlock icon="albums-outline" title="Sin temas disponibles" subtitle="Tu profesor añadirá temas con preguntas para esta clase." />
        )}
      </View>

      <MobileSectionHeading title="Preguntas falladas" actionLabel="Ver todas" onAction={onOpenActivity} />
      {failedQuestions.length > 0 ? (
        <View className="gap-3">
          {failedQuestions.slice(0, 2).map((question) => (
            <MobileFailedQuestionCard
              key={question.id}
              question={question}
              onPress={() => onOpenFailedQuestion(question)}
            />
          ))}
        </View>
      ) : (
        <MobileEmptyBlock icon="checkmark-circle-outline" title="Sin fallos pendientes" subtitle="Buen trabajo, no tienes preguntas para repasar." />
      )}

      <MobileSectionHeading title="Ranking compacto" />
      <View className="gap-2 rounded-2xl border border-[#17345B] bg-[#071832] p-3">
        {classRanking.length > 0 ? (
          classRanking.slice(0, 3).map((row, index) => (
            <MobileRankingRow key={row.studentId} row={row} index={index} />
          ))
        ) : (
          <MobileEmptyBlock icon="trophy-outline" title="Sin ranking todavía" subtitle="Responde preguntas para aparecer en la clasificación." />
        )}
        <View className="mt-1 rounded-xl bg-[#0D1D3B] px-3 py-2">
          <Text className="text-center text-[12px] font-black text-[#B9A7FF]">{rankingLabel}</Text>
        </View>
      </View>

      <MobileSectionHeading title="Últimos intentos" actionLabel="Ver todo" onAction={onOpenActivity} />
      <View className="overflow-hidden rounded-2xl border border-[#17345B] bg-[#071832]">
        {recentAttempts.length > 0 ? (
          recentAttempts.slice(0, 2).map((attempt, index) => (
            <MobileRecentAttemptRow
              key={attempt.id}
              attempt={attempt}
              isLast={index === Math.min(recentAttempts.length, 2) - 1}
            />
          ))
        ) : (
          <MobileEmptyBlock icon="play-circle-outline" title="Sin intentos recientes" subtitle="Empieza un tema para ver tu actividad." />
        )}
      </View>
    </ScrollView>
  )
}

function MobileClassHero({
  classroom,
  color,
  subject,
}: {
  classroom: Classroom | null
  color: string
  subject: Subject
}) {
  return (
    <View className="rounded-[28px] border border-[#17345B] bg-[#071832] p-4">
      <View className="flex-row items-start gap-4">
        <SubjectIconPanel color={color} icon={subject.icon} size="medium" />

        <View className="min-w-0 flex-1">
          <View className="self-start flex-row items-center gap-2 rounded-full px-3 py-1.5" style={{ backgroundColor: withAlpha(color, '22') }}>
            <View className="h-2.5 w-2.5 rounded-full bg-[#22D3A5]" />
            <Text className="text-[13px] font-black" style={{ color }}>En progreso</Text>
          </View>
          <Text className="mt-3 text-[27px] font-black leading-[32px] text-white" numberOfLines={2}>{subject.name}</Text>
          <Text className="mt-2 text-[14px] leading-5 text-[#C7D3E5]" numberOfLines={2}>
            {subject.description || 'Elige un tema para empezar a responder preguntas.'}
          </Text>
        </View>
      </View>

      {classroom ? (
        <View className="mt-4 rounded-2xl bg-[#0B1D3B] px-4 py-3">
          <Text className="text-[13px] font-semibold text-[#B7C4D7]" numberOfLines={1}>
            Clase: {classroom.name}{classroom.code ? ` · Código: ${classroom.code}` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function MobileSummaryMetric({
  color,
  icon,
  isLast = false,
  label,
  value,
}: {
  color: string
  icon: keyof typeof Ionicons.glyphMap
  isLast?: boolean
  label: string
  value: string
}) {
  return (
    <View className={`min-h-[122px] flex-1 items-center justify-center px-2 py-4 ${isLast ? '' : 'border-r border-[#11294A]'}`}>
      <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '24') }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text className="mt-3 text-center text-[20px] font-black text-white" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{value}</Text>
      <Text className="mt-1 text-center text-[11px] leading-4 text-[#C7D3E5]" numberOfLines={2}>{label}</Text>
    </View>
  )
}

function MobileClassProgressPanel({
  answered,
  color,
  failed,
  progress,
  total,
}: {
  answered: number
  color: string
  failed: number
  progress: number
  total: number
}) {
  const pending = Math.max(0, total - answered)
  const width = Math.min(100, Math.max(progress > 0 ? 8 : 0, progress))

  return (
    <View className="mt-5 rounded-2xl border border-[#17345B] bg-[#071832] p-5">
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <Text className="text-[21px] font-black text-white">Tu progreso en esta clase</Text>
          <Text className="mt-1 text-[14px] text-[#C7D3E5]">{answered} de {total} preguntas respondidas</Text>
        </View>
        <Text className="text-[42px] font-black leading-[46px] text-white">{progress}%</Text>
      </View>

      <View className="mt-4 h-3 overflow-hidden rounded-full bg-[#14294C]">
        <LinearGradient
          colors={[color, '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${width}%`, height: '100%', borderRadius: 999 }}
        />
      </View>

      <View className="mt-5 flex-row gap-3">
        <MobileMiniPill icon="radio-button-on" label={`${pending} por practicar`} color="#38BDF8" />
        <MobileMiniPill icon="refresh-circle" label={`${failed} fallos por repasar`} color="#FB7185" />
      </View>
    </View>
  )
}

function MobileRecommendedPanel({
  color,
  topic,
  onPress,
}: {
  color: string
  topic: Topic | null
  onPress: (topic: Topic, reviewFailed?: boolean) => void
}) {
  const failed = topic?.failedQuestions ?? 0
  const title = topic
    ? failed > 0
      ? `Repasa ${failed} ${failed === 1 ? 'fallo' : 'fallos'} en ${topic.title}.`
      : topic.answeredQuestions > 0
      ? `Repite ${topic.title} para mejorar tu precisión.`
      : `Empieza ${topic.title} para avanzar.`
    : 'Espera nuevos temas'
  const actionLabel = topic
    ? failed > 0
      ? 'Repasar fallos'
      : `${getTopicActionLabel(topic)} ${topic.title}`
    : ''
  const actionIcon = failed > 0 ? 'refresh' : topic ? getTopicActionIcon(topic) : 'play'

  return (
    <LinearGradient
      colors={['#19124D', '#101C42', '#081832']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ marginTop: 20, borderRadius: 20, borderWidth: 1, borderColor: '#263B72', overflow: 'hidden' }}
    >
      <View className="relative p-5">
        <View className="absolute -right-5 top-6 h-28 w-28 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '20') }}>
          <Ionicons name="locate" size={70} color={color} />
        </View>
        <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color }}>Recomendado</Text>
        <Text className="mt-4 max-w-[250px] text-[20px] font-black leading-7 text-white">{title}</Text>
        <Text className="mt-2 max-w-[255px] text-[14px] leading-5 text-[#C7D3E5]">
          Un repaso te ayudará a afianzar lo aprendido y ganar confianza.
        </Text>
        {topic ? (
          <Pressable
            onPress={() => onPress(topic, failed > 0)}
            className="mt-5 flex-row items-center justify-center gap-2 rounded-xl px-4 py-4"
            style={{ backgroundColor: color }}
          >
            <Ionicons name={actionIcon} size={18} color="#FFFFFF" />
            <Text className="text-[15px] font-black text-white">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  )
}

function MobileTopicCard({
  color,
  index,
  topic,
  onPress,
}: {
  color: string
  index: number
  topic: Topic
  onPress: () => void
}) {
  const locked = isTopicLocked(topic)
  const disabled = topic.questionsCount === 0 || locked
  const status = getTopicStatus(topic)
  const progress = topic.questionsCount > 0 ? Math.round((topic.answeredQuestions / topic.questionsCount) * 100) : 0
  const width = Math.min(100, Math.max(progress > 0 ? 8 : 0, progress))
  const topicColor = ['#8B5CF6', '#22C55E', '#F59E0B', '#38BDF8'][index % 4] || color

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="min-h-[86px] flex-row items-center gap-3 rounded-2xl border border-[#17345B] bg-[#071832] p-3"
      style={({ pressed }) => ({ opacity: disabled ? 0.62 : pressed ? 0.82 : 1 })}
    >
      <SubjectIconPanel color={topicColor} icon={topic.icon} size="small" fallback="folder" />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="min-w-0 flex-1 text-[15px] font-black text-white" numberOfLines={1}>{topic.title}</Text>
          {locked ? (
            <Ionicons name="lock-closed" size={20} color="#60799C" />
          ) : (
            <Text className="text-[14px] font-black text-[#B9A7FF]">{progress}%</Text>
          )}
        </View>
        <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#14294C]">
          <View className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: topicColor }} />
        </View>
        <View className="mt-2 flex-row items-center gap-3">
          <Text className="text-[12px] font-bold" style={{ color: status.color }} numberOfLines={1}>
            {status.label}
          </Text>
          {typeof topic.bestScore === 'number' ? (
            <Text className="text-[12px] font-bold text-[#B9A7FF]">+{topic.bestScore} XP</Text>
          ) : (
            <Text className="text-[12px] text-[#C7D3E5]">
              {topic.questionsCount} pregunta{topic.questionsCount === 1 ? '' : 's'}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={22} color="#A9A1FF" />
    </Pressable>
  )
}

function SubjectIconPanel({
  color,
  fallback = 'book',
  icon,
  size,
}: {
  color: string
  fallback?: keyof typeof Ionicons.glyphMap
  icon: string | null
  size: 'large' | 'medium' | 'small'
}) {
  const ioniconName = getValidIoniconName(icon)
  const dimension = size === 'large'
    ? 'h-[128px] w-[128px] rounded-[28px]'
    : size === 'medium'
      ? 'h-[88px] w-[88px] rounded-[24px]'
      : 'h-[60px] w-[60px] rounded-2xl'
  const iconSize = size === 'large' ? 62 : size === 'medium' ? 40 : 28

  return (
    <LinearGradient
      colors={[withAlpha(color, 'EE'), '#32117A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className={`${dimension} items-center justify-center`}
    >
      {ioniconName ? (
        <Ionicons name={ioniconName} size={iconSize} color="#FFFFFF" />
      ) : icon ? (
        <Text style={{ fontSize: size === 'large' ? 52 : size === 'medium' ? 38 : 28 }}>{icon}</Text>
      ) : (
        <Ionicons name={fallback} size={iconSize} color="#FFFFFF" />
      )}
    </LinearGradient>
  )
}

function MobileRankingRow({ row, index }: { row: ClassRankingItem; index: number }) {
  const medalColors = ['#FBBF24', '#CBD5E1', '#F97316']

  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-[#0D1D3B] px-3 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#142B52]">
        {index < 3 ? (
          <Ionicons name="medal" size={18} color={medalColors[index]} />
        ) : (
          <Text className="text-[13px] font-black text-[#AFC2DB]">{index + 1}</Text>
        )}
      </View>
      <Text className="min-w-0 flex-1 text-[14px] font-black text-white" numberOfLines={1}>{row.alias}</Text>
      <Text className="text-[13px] font-black text-[#B9A7FF]">{row.points.toLocaleString()} XP</Text>
    </View>
  )
}

function MobileMiniPill({ color, icon, label }: { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View className="min-w-0 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#091C3A] px-3 py-3">
      <Ionicons name={icon} size={17} color={color} />
      <Text className="text-[13px] font-black text-[#DDE7F4]" numberOfLines={1}>{label}</Text>
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
          <Text className="text-[15px] font-black text-[#A970FF]">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function MobileRecentAttemptRow({ attempt, isLast }: { attempt: RecentAttempt; isLast: boolean }) {
  const color = attempt.isCorrect ? '#22C55E' : '#FB7185'

  return (
    <View className={`flex-row items-center gap-3 p-4 ${isLast ? '' : 'border-b border-[#11294A]'}`}>
      <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '26') }}>
        <Ionicons name={attempt.isCorrect ? 'checkmark' : 'close'} size={26} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-black text-white" numberOfLines={1}>
          {attempt.isCorrect ? 'Respuesta correcta' : 'Respuesta incorrecta'}
        </Text>
        <Text className="mt-1 text-[13px] text-[#C7D3E5]" numberOfLines={1}>{attempt.topicTitle} · {attempt.questionText}</Text>
      </View>
      <View className="items-end gap-2">
        <Text className="text-[13px] text-[#B7C4D7]">{formatRecentAttemptDate(attempt.attemptedAt)}</Text>
        <View className="rounded-xl bg-[#2D2365] px-3 py-1.5">
          <Text className="text-[13px] font-black text-[#D8CCFF]">{attempt.isCorrect ? '+10 XP' : '+5 XP'}</Text>
        </View>
      </View>
    </View>
  )
}

function MobileFailedQuestionCard({ question, onPress }: { question: FailedQuestion; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[78px] flex-row items-center gap-3 rounded-2xl border border-[#7F1D3A] bg-[#2A0E1F] p-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-[#7F1D3A]/45">
        <Ionicons name="close" size={24} color="#FB7185" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-black text-white" numberOfLines={2}>{question.text}</Text>
        <Text className="mt-1 text-[13px] font-bold text-[#FB7185]" numberOfLines={1}>{question.topicTitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color="#E9D5FF" />
    </Pressable>
  )
}

function MobileEmptyBlock({
  icon,
  subtitle,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap
  subtitle: string
  title: string
}) {
  return (
    <View className="items-center rounded-2xl border border-dashed border-[#1E3A63] bg-[#081B37] px-4 py-7">
      <Ionicons name={icon} size={30} color="#8FA7C7" />
      <Text className="mt-3 text-center text-[15px] font-black text-white">{title}</Text>
      <Text className="mt-1 text-center text-[13px] leading-5 text-[#8FA7C7]">{subtitle}</Text>
    </View>
  )
}

function ClassProgressCard({
  answered,
  color,
  failed,
  progress,
  total,
}: {
  answered: number
  color: string
  failed: number
  progress: number
  total: number
}) {
  return (
    <View className="flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="flex-row items-center justify-between gap-4">
        <View>
          <Text className="text-[16px] font-black text-white">Tu progreso en esta clase</Text>
          <Text className="mt-1 text-[13px] text-[#8FA7C7]">
            {answered} de {total} preguntas respondidas
          </Text>
        </View>
        <Text className="text-[34px] font-black text-white">{progress}%</Text>
      </View>
      <View className="mt-4 h-3 overflow-hidden rounded-full bg-[#172A4A]">
        <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color }} />
      </View>
      <View className="mt-4 flex-row flex-wrap gap-3">
        <SmallMetric icon="help-circle-outline" label={`${Math.max(0, total - answered)} por practicar`} color="#58B5FF" />
        <SmallMetric icon="alert-circle-outline" label={`${failed} falladas para repasar`} color="#FB7185" />
      </View>
    </View>
  )
}

function NextActionCard({ topic, color, onPress }: { subjectId: number; classroomId: number | null; topic: Topic | null; color: string; onPress: (topic: Topic, reviewFailed?: boolean) => void }) {
  if (!topic) {
    return (
      <View className="flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
        <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color }}>Recomendado</Text>
        <Text className="mt-3 text-[20px] font-black text-white">Espera nuevos temas</Text>
        <Text className="mt-2 text-[13px] leading-5 text-[#AFC2DB]">Tu profesor aún no ha añadido preguntas practicables.</Text>
      </View>
    )
  }

  const failed = topic.failedQuestions
  const pending = Math.max(0, topic.questionsCount - topic.answeredQuestions)
  const title = pending > 0
    ? `Continúa ${topic.title}: quedan ${pending} ${pending === 1 ? 'pregunta' : 'preguntas'}.`
    : topic.answeredQuestions > 0
      ? `Repite ${topic.title} para mejorar tu puntuación.`
      : `Empieza ${topic.title} y consigue tu primera puntuación.`

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-[#1A3155] bg-[#101D4A] p-5">
      <View className="absolute right-[-32px] top-[-34px] h-32 w-32 rounded-full" style={{ backgroundColor: `${color}24` }} />
      <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color }}>Recomendado</Text>
      <Text className="mt-3 text-[20px] font-black leading-7 text-white">{title}</Text>
      <Text className="mt-2 text-[13px] leading-5 text-[#AFC2DB]">
        La opción principal juega el tema entero para que puedas mejorar tu mejor puntuación.
      </Text>
      <Pressable onPress={() => onPress(topic, false)} className="mt-5 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: color }}>
        <Ionicons name={getTopicActionIcon(topic)} size={17} color="#FFFFFF" />
        <Text className="font-black text-white">{getTopicActionLabel(topic)}</Text>
      </Pressable>
      {failed > 0 ? (
        <Pressable onPress={() => onPress(topic, true)} className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3" style={{ borderColor: '#FB718588', backgroundColor: '#FB718514' }}>
          <Ionicons name="refresh" size={17} color="#FB7185" />
          <Text className="font-black text-[#FDB4C0]">Repasar {failed === 1 ? 'fallo' : 'fallos'}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function InfoPanel({
  children,
  className = '',
  icon,
  title,
}: {
  children: React.ReactNode
  className?: string
  icon: keyof typeof Ionicons.glyphMap
  title: string
}) {
  return (
    <View className={`rounded-2xl border border-[#1A3155] bg-[#09162C] p-5 ${className}`}>
      <View className="mb-4 flex-row items-center gap-2">
        <Ionicons name={icon} size={18} color="#9FD6FF" />
        <Text className="text-[16px] font-black text-white">{title}</Text>
      </View>
      {children}
    </View>
  )
}

function RecentAttemptRow({ attempt }: { attempt: RecentAttempt }) {
  const color = attempt.isCorrect ? '#43D991' : '#FB7185'
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={attempt.isCorrect ? 'checkmark' : 'close'} size={17} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-bold text-white" numberOfLines={1}>{attempt.questionText}</Text>
        <Text className="mt-1 text-[12px] text-[#8FA7C7]">{attempt.topicTitle} · {formatRecentAttemptDate(attempt.attemptedAt)}</Text>
      </View>
    </View>
  )
}

function FailedQuestionRow({ question }: { question: FailedQuestion }) {
  return (
    <View className="rounded-xl border border-[#3B1D2A] bg-[#160D19] p-3">
      <Text className="text-[13px] font-bold text-white" numberOfLines={2}>{question.text}</Text>
      <View className="mt-2 flex-row items-center justify-between gap-3">
        <Text className="min-w-0 flex-1 text-[12px] text-[#FB7185]" numberOfLines={1}>{question.topicTitle}</Text>
        <Text className="text-[12px] font-black text-[#B9A7FF]">Repasar →</Text>
      </View>
    </View>
  )
}

function ClassRankingRow({ row, index }: { row: ClassRankingItem; index: number }) {
  const medalColors = ['#FBBF24', '#CBD5E1', '#F97316']
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-[#0D1D3B] px-3 py-2">
      <View className="w-6 items-center">
        {index < 3 ? <Ionicons name="medal" size={17} color={medalColors[index]} /> : <Text className="font-bold text-[#AFC2DB]">{index + 1}</Text>}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white" numberOfLines={1}>{row.alias}</Text>
      </View>
      <Text className="text-[13px] font-black text-[#B9A7FF]">{row.points.toLocaleString()} XP</Text>
    </View>
  )
}

function EmptyPanel({ icon, message }: { icon: keyof typeof Ionicons.glyphMap; message: string }) {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#20375E] bg-[#0A1A34] px-4 py-6">
      <Ionicons name={icon} size={30} color="#60799C" />
      <Text className="mt-2 text-center text-[13px] leading-5 text-[#8FA7C7]">{message}</Text>
    </View>
  )
}

function SmallMetric({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-[#0D1D3B] px-3 py-2">
      <Ionicons name={icon} size={15} color={color} />
      <Text className="text-[12px] font-bold text-[#DDE7F4]">{label}</Text>
    </View>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  color: string
}) {
  return (
    <View className="min-w-[170px] flex-1 flex-row items-center gap-4 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View>
        <Text className="text-[22px] font-black text-white">{value}</Text>
        <Text className="text-[12px] text-[#8FA7C7]">{label}</Text>
      </View>
    </View>
  )
}

function TopicRow({
  topic,
  index,
  color,
  onPress,
  onReviewFailures,
}: {
  topic: Topic
  index: number
  color: string
  onPress: () => void
  onReviewFailures: () => void
}) {
  const hasPlayed = topic.answeredQuestions > 0 || typeof topic.bestScore === 'number'
  const topicColor = ['#6574FF', '#43D991', '#F6A64A', '#58B5FF'][index % 4] || color
  const locked = isTopicLocked(topic)
  const disabled = topic.questionsCount === 0 || locked
  const actionLabel = getTopicActionLabel(topic)
  const status = getTopicStatus(topic)
  const ioniconName = getValidIoniconName(topic.icon)

  const content = (
    <View className={`flex-row flex-wrap items-center gap-4 rounded-xl border p-4 ${disabled ? 'border-[#172A4A] bg-[#07162E]' : 'border-[#20375E] bg-[#0B1A32]'}`}>
      <View className="h-14 w-14 items-center justify-center rounded-xl" style={{ backgroundColor: `${topicColor}26` }}>
        {ioniconName ? (
          <Ionicons name={ioniconName} size={27} color={topicColor} />
        ) : topic.icon ? (
          <Text className="text-2xl">{topic.icon}</Text>
        ) : (
          <Ionicons name="albums-outline" size={27} color={topicColor} />
        )}
      </View>
      <View className="min-w-[220px] flex-1">
        <Text className="text-[17px] font-black text-white">{topic.title}</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>
          {topic.description || `${topic.questionsCount} pregunta${topic.questionsCount === 1 ? '' : 's'} disponible${topic.questionsCount === 1 ? '' : 's'}`}
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <Badge icon="help-circle-outline" label={`${topic.questionsCount} preguntas`} color="#58B5FF" />
          <Badge icon={status.icon} label={status.label} color={status.color} />
          {topic.failedQuestions > 0 ? (
            <Badge icon="alert-circle-outline" label={`${topic.failedQuestions} ${topic.failedQuestions === 1 ? 'error' : 'errores'}`} color="#FB7185" />
          ) : null}
          <Badge icon="star-outline" label={hasPlayed && typeof topic.bestScore === 'number' ? `${topic.bestScore} XP` : 'Sin jugar'} color={hasPlayed ? '#B9A7FF' : '#8FA7C7'} />
          {topic.availableUntil ? (
            <Badge icon={locked ? 'lock-closed-outline' : 'time-outline'} label={locked ? 'Bloqueado' : `Hasta ${formatTopicDeadline(topic.availableUntil)}`} color={locked ? '#FB7185' : '#F6A64A'} />
          ) : null}
        </View>
        {topic.lastAttemptAt ? (
          <Text className="mt-2 text-[11px] text-[#8FA7C7]">Último intento: {formatRecentAttemptDate(topic.lastAttemptAt)}</Text>
        ) : null}
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        {topic.failedQuestions > 0 && !disabled ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.()
              onReviewFailures()
            }}
            className="flex-row items-center gap-2 rounded-lg border border-[#FB718566] bg-[#FB718514] px-4 py-3"
          >
            <Ionicons name="refresh" size={15} color="#FB7185" />
            <Text className="font-bold text-[#FDB4C0]">Repasar fallos</Text>
          </Pressable>
        ) : null}
        <View className={`flex-row items-center gap-2 rounded-lg px-4 py-3 ${disabled ? 'bg-[#172A4A]' : 'bg-[#4F46E5]'}`}>
          <Ionicons name={locked ? 'lock-closed' : getTopicActionIcon(topic)} size={15} color="#FFFFFF" />
          <Text className="font-bold text-white">{locked ? 'Bloqueado' : disabled ? 'Sin preguntas' : actionLabel}</Text>
        </View>
      </View>
    </View>
  )

  if (disabled) {
    return <View style={{ opacity: 0.72 }}>{content}</View>
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}>{content}</Pressable>
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
  if (!topic) return null

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/70 px-5">
      <Pressable className="absolute inset-0" onPress={onClose} />
      <View className="w-full max-w-[560px] rounded-2xl border border-[#244166] bg-[#081832] p-5">
        <View className="flex-row items-start justify-between gap-4">
          <View className="min-w-0 flex-1">
            <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color }}>Elige dificultad</Text>
            <Text className="mt-2 text-[24px] font-black text-white">{topic.title}</Text>
            <Text className="mt-1 text-[13px] leading-5 text-[#AFC2DB]">
              Este tema tiene varias versiones. Jugarás solo las preguntas de la dificultad seleccionada.
            </Text>
          </View>
          <Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-xl border border-[#20375E] bg-[#0D1D3B]">
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
                key={stats.difficulty}
                onPress={() => onChoose(stats.difficulty, false)}
                className="flex-row flex-wrap items-center gap-4 rounded-xl border p-4"
                style={{ borderColor: `${meta.color}88`, backgroundColor: `${meta.color}18` }}
              >
                <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.color}24` }}>
                  <Ionicons name="layers-outline" size={22} color={meta.color} />
                </View>
                <View className="min-w-[180px] flex-1">
                  <Text className="text-[16px] font-black text-white">{meta.label}</Text>
                  <Text className="mt-1 text-[12px] text-[#AFC2DB]">
                    {stats.questionsCount} preguntas · {stats.answeredQuestions} respondidas · {stats.failedQuestions} falladas
                  </Text>
                </View>
                <View className="flex-row flex-wrap items-center gap-2">
                  {stats.failedQuestions > 0 ? (
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation?.()
                        onChoose(stats.difficulty, true)
                      }}
                      className="rounded-lg border border-[#FB718566] bg-[#FB718514] px-4 py-2"
                    >
                      <Text className="font-black text-[#FDB4C0]">Repasar fallos</Text>
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
      </View>
    </View>
  )
}

function Badge({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-md bg-[#122544] px-2 py-1">
      <Ionicons name={icon} size={12} color={color} />
      <Text className="text-[10px] font-bold text-[#C9D6EA]">{label}</Text>
    </View>
  )
}

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

function getTopicActionIcon(topic: Topic): keyof typeof Ionicons.glyphMap {
  if (topic.answeredQuestions === 0) return 'play'
  if (topic.answeredQuestions < topic.questionsCount) return 'play-forward'
  return 'repeat'
}

function getTopicStatus(topic: Topic): { label: string; color: string; icon: keyof typeof Ionicons.glyphMap } {
  if (isTopicLocked(topic)) {
    return { label: 'Bloqueado', color: '#FB7185', icon: 'lock-closed-outline' }
  }

  if (topic.questionsCount === 0) {
    return { label: 'Sin preguntas', color: '#8FA7C7', icon: 'remove-circle-outline' }
  }

  if (topic.answeredQuestions >= topic.questionsCount) {
    return { label: 'Completada', color: '#43D991', icon: 'checkmark-circle-outline' }
  }

  if (topic.answeredQuestions > 0) {
    return { label: 'En progreso', color: '#FBBF24', icon: 'time-outline' }
  }

  return { label: 'Sin empezar', color: '#8FA7C7', icon: 'ellipse-outline' }
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

function formatTopicDeadline(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'fecha límite'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
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
