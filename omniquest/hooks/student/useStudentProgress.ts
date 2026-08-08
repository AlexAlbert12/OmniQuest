import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAppTheme } from '../../lib/appTheme'
import type { DesignColorTokens } from '../../lib/designTokens'
import { readThroughCache } from '../../lib/offlineCache'
import { fetchStudentAttemptHistory } from '../../lib/studentSecureData'
import { fetchStudentProgressSummary, type StudentProgressSubject } from '../../lib/studentProgress'
import { buildStudentBadges, getStudentBadgeMetrics, type StudentBadge, type StudentBadgeScore } from '../../lib/studentBadges'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { formatShortDate } from '../../lib/dateFormat'

export type StudentProgressProfile = { id: string; alias: string; avatar: string | null; points: number | null }
export type StudentProgressScore = {
  subject_id: number | null
  classroom_id?: number | null
  max_score: number | null
  played_at?: string | null
  played_days?: string[] | null
  correct_answers?: number | null
  subjects?: { name: string } | { name: string }[] | null
}
export type StudentCourseProgress = {
  id: number
  classroomId?: number | null
  name: string
  detail: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  averageScore: number | null
  bestScore: number | null
  totalXp: number
  scoreCount: number
  totalQuestions: number
  failedQuestions: number
  pendingQuestions: number
  barPercent: number
}
export type StudentLatestResult = { label: string; meta: string; value: number }
export type PracticeOpportunity = {
  id: string
  title: string
  detail: string
  badge: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  failedCount: number
  accuracyPercent: number
  totalAttempts: number
  subjectId?: number
  topicId?: number | null
  topicName?: string
  actionLabel: string
  reason: string
  evidence: string
  improvementPotential: string
  rewardXp: number
}

type ReinforcementQuestionRelation = {
  id: number
  text: string | null
  type: string | null
  subject_id: number | null
  topic_id: number | null
  subjects?: { name: string } | { name: string }[] | null
  subject_topics?: { title: string } | { title: string }[] | null
}
type ReinforcementAttemptRow = {
  id: number
  is_correct: boolean | null
  attempted_at: string | null
  questions?: ReinforcementQuestionRelation | ReinforcementQuestionRelation[] | null
}
type ProgressCacheSnapshot = {
  profile: StudentProgressProfile
  weeklyAttemptsCount: number
  courseProgress: StudentCourseProgress[]
  latestResults: StudentLatestResult[]
  scores: StudentProgressScore[]
  opportunities: PracticeOpportunity[]
}

export function useStudentProgress() {
  const { tokens } = useAppTheme()
  const [profile, setProfile] = useState<StudentProgressProfile | null>(null)
  const [weeklyAttemptsCount, setWeeklyAttemptsCount] = useState(0)
  const [courseProgress, setCourseProgress] = useState<StudentCourseProgress[]>([])
  const [latestResults, setLatestResults] = useState<StudentLatestResult[]>([])
  const [scores, setScores] = useState<StudentProgressScore[]>([])
  const [opportunities, setOpportunities] = useState<PracticeOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) throw new Error('No hay una sesión activa.')

      const now = new Date()
      const weekStartIso = getStartOfWeekMonday(now).toISOString()
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      await readThroughCache<ProgressCacheSnapshot>({
        userId,
        resource: 'student:progress',
        fetcher: async () => {
          const [profileResult, scoresResult, weeklyResult, progressResult, historyResult] = await Promise.all([
            supabase.from('profiles').select('id, alias, points, avatar').eq('id', userId).single(),
            supabase
              .from('subject_scores')
              .select('subject_id, classroom_id, max_score, played_at, played_days, correct_answers, subjects(name)')
              .eq('student_id', userId)
              .order('played_at', { ascending: false }),
            supabase
              .from('attempt_history')
              .select('id', { count: 'exact', head: true })
              .eq('student_id', userId)
              .gte('attempted_at', weekStartIso)
              .lte('attempted_at', now.toISOString()),
            fetchStudentProgressSummary(userId),
            fetchStudentAttemptHistory({ limit: 1000, since: thirtyDaysAgo.toISOString() }),
          ])
          if (profileResult.error) throw profileResult.error
          if (!profileResult.data) throw new Error('No se pudo cargar el perfil del alumno.')
          if (scoresResult.error) throw scoresResult.error
          if (weeklyResult.error) throw weeklyResult.error
          const nextScores = (scoresResult.data || []) as StudentProgressScore[]
          return {
            profile: profileResult.data,
            weeklyAttemptsCount: weeklyResult.count || 0,
            courseProgress: buildCourseProgress(progressResult.subjects, nextScores, tokens),
            latestResults: buildLatestResults(nextScores),
            scores: nextScores,
            opportunities: buildPracticeOpportunities((historyResult || []) as ReinforcementAttemptRow[], tokens),
          }
        },
        onData: (snapshot) => {
          setProfile(snapshot.profile)
          setWeeklyAttemptsCount(snapshot.weeklyAttemptsCount)
          setCourseProgress(snapshot.courseProgress)
          setLatestResults(snapshot.latestResults)
          setScores(snapshot.scores)
          setOpportunities(snapshot.opportunities)
          setLoading(false)
        },
      })
    } catch (cause) {
      console.error('Error fetching progress:', cause)
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el progreso.')
    } finally {
      setLoading(false)
    }
  }, [tokens])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const viewModel = useMemo(() => {
    const points = profile?.points ?? 0
    const answeredQuestions = courseProgress.reduce((total, course) => total + course.scoreCount, 0)
    const totalQuestions = courseProgress.reduce((total, course) => total + course.totalQuestions, 0)
    const failedQuestions = courseProgress.reduce((total, course) => total + course.failedQuestions, 0)
    const progressPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
    const correctAnswers = scores.reduce((total, score) => total + (score.correct_answers ?? 0), 0)
    const accuracyPercent = answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0
    const badgeMetrics = getStudentBadgeMetrics({
      scores: scores as StudentBadgeScore[],
      totalPoints: points,
      subjectsCount: courseProgress.length,
    })
    const badges = buildStudentBadges(badgeMetrics)
    return {
      points,
      alias: profile?.alias || 'Alumno',
      level: getStudentLevel(points),
      nextLevelProgress: getNextLevelProgress(points),
      answeredQuestions,
      totalQuestions,
      failedQuestions,
      progressPercent: clampPercent(progressPercent),
      accuracyPercent: clampPercent(accuracyPercent),
      streakDays: badgeMetrics.streakDays,
      badges,
      recommendation: opportunities[0] || null,
    }
  }, [courseProgress, opportunities, profile, scores])

  return {
    profile,
    loading,
    error,
    weeklyAttemptsCount,
    courseProgress,
    latestResults,
    opportunities,
    reload: load,
    ...viewModel,
  }
}

function buildCourseProgress(subjects: StudentProgressSubject[], scores: StudentProgressScore[], tokens: DesignColorTokens): StudentCourseProgress[] {
  const colors = [tokens.semantic.success, tokens.brand.student, tokens.semantic.info, tokens.gamification.xp, tokens.text.muted]
  const icons: (keyof typeof Ionicons.glyphMap)[] = ['book', 'calculator', 'flask', 'business', 'ellipsis-horizontal']
  const scoresBySubject = scores.reduce<Record<string, number[]>>((acc, score) => {
    if (score.subject_id === null || score.max_score === null) return acc
    const key = `${score.subject_id}:${score.classroom_id ?? 'general'}`
    if (!acc[key]) acc[key] = []
    acc[key].push(score.max_score)
    return acc
  }, {})

  return subjects.map((subject, index) => {
    const subjectScores = scoresBySubject[`${subject.id}:${subject.classroomId ?? 'general'}`] || []
    const averageScore = subjectScores.length ? Math.round(subjectScores.reduce((sum, value) => sum + value, 0) / subjectScores.length) : null
    const bestScore = subjectScores.length ? Math.max(...subjectScores) : null
    const topicCount = Math.max(1, subject.totalTopics)
    return {
      id: subject.id,
      classroomId: subject.classroomId ?? null,
      name: subject.name,
      detail: `${subject.classroomName || 'Clase principal'} · ${topicCount} ${topicCount === 1 ? 'tema' : 'temas'} · ${subject.totalQuestions} preguntas`,
      icon: icons[index] || 'book',
      color: subject.theme_color || colors[index % colors.length] || tokens.brand.student,
      averageScore,
      bestScore,
      totalXp: subjectScores.reduce((sum, value) => sum + value, 0),
      scoreCount: subject.answeredQuestions,
      totalQuestions: subject.totalQuestions,
      failedQuestions: subject.failedQuestions,
      pendingQuestions: subject.pendingQuestions,
      barPercent: subject.percent,
    }
  })
}

function buildLatestResults(scores: StudentProgressScore[]): StudentLatestResult[] {
  return scores.filter((score) => score.max_score !== null).slice(0, 7).map((score, index) => {
    const subject = Array.isArray(score.subjects) ? score.subjects[0] : score.subjects
    return { label: subject?.name || `Resultado ${index + 1}`, meta: formatShortDate(score.played_at), value: score.max_score || 0 }
  })
}

function buildPracticeOpportunities(rows: ReinforcementAttemptRow[], tokens: DesignColorTokens): PracticeOpportunity[] {
  type TopicStats = { subjectId: number; topicId: number | null; topicName: string; subjectName: string; total: number; correct: number; failed: number }
  type TypeStats = { type: string; total: number; correct: number; failed: number }
  const topics = new Map<string, TopicStats>()
  const types = new Map<string, TypeStats>()

  rows.forEach((row) => {
    const question = normalizeRelation(row.questions)
    if (!question || question.subject_id === null) return
    const correct = row.is_correct === true
    const topic = normalizeRelation(question.subject_topics)
    const subject = normalizeRelation(question.subjects)
    const topicId = question.topic_id ?? null
    const key = `${question.subject_id}:${topicId ?? 'general'}`
    const current = topics.get(key) || {
      subjectId: question.subject_id,
      topicId,
      topicName: topic?.title || 'Tema general',
      subjectName: subject?.name || 'Curso',
      total: 0,
      correct: 0,
      failed: 0,
    }
    current.total += 1
    current.correct += correct ? 1 : 0
    current.failed += correct ? 0 : 1
    topics.set(key, current)

    const type = question.type || 'unknown'
    const typeCurrent = types.get(type) || { type, total: 0, correct: 0, failed: 0 }
    typeCurrent.total += 1
    typeCurrent.correct += correct ? 1 : 0
    typeCurrent.failed += correct ? 0 : 1
    types.set(type, typeCurrent)
  })

  const topicRows = Array.from(topics.values()).filter((item) => item.failed > 0).map((item) => {
    const accuracy = Math.round((item.correct / Math.max(item.total, 1)) * 100)
    const potential = Math.min(35, Math.max(8, item.failed * 5))
    return {
      id: `topic-${item.subjectId}-${item.topicId ?? 'general'}`,
      title: item.topicName,
      detail: `${item.failed} ${item.failed === 1 ? 'pregunta pendiente' : 'preguntas pendientes'} · ${item.subjectName}`,
      badge: 'Tema recomendado',
      icon: 'alert-circle' as const,
      color: tokens.semantic.warning,
      failedCount: item.failed,
      accuracyPercent: accuracy,
      totalAttempts: item.total,
      subjectId: item.subjectId,
      topicId: item.topicId,
      topicName: item.topicName,
      actionLabel: 'Practicar ahora',
      reason: accuracy < 50 ? 'Es el tema con menor precisión en los últimos 30 días.' : 'Concentra varios fallos de los últimos 30 días que puedes recuperar.',
      evidence: `Precisión de ${item.topicName} · últimos 30 días: ${accuracy}% · ${item.total} ${item.total === 1 ? 'intento' : 'intentos'}`,
      improvementPotential: `Puedes mejorar hasta ${potential} puntos de precisión`,
      rewardXp: Math.min(120, Math.max(20, item.failed * 20)),
    } satisfies PracticeOpportunity
  })

  const typeRows = Array.from(types.values()).filter((item) => item.total >= 3 && item.failed > 0).map((item) => {
    const accuracy = Math.round((item.correct / Math.max(item.total, 1)) * 100)
    return {
      id: `type-${item.type}`,
      title: getQuestionTypeLabel(item.type),
      detail: `${item.failed} ${item.failed === 1 ? 'pregunta para revisar' : 'preguntas para revisar'}`,
      badge: 'Patrón detectado',
      icon: getQuestionTypeIcon(item.type),
      color: tokens.brand.student,
      failedCount: item.failed,
      accuracyPercent: accuracy,
      totalAttempts: item.total,
      actionLabel: 'Revisar historial',
      reason: 'Este formato concentra parte de tus fallos recientes.',
      evidence: `${item.total} ${item.total === 1 ? 'respuesta' : 'respuestas'} · ${accuracy}% de precisión`,
      improvementPotential: accuracy <= 25 ? 'Potencial de mejora alto' : accuracy <= 50 ? 'Potencial de mejora medio' : 'Oportunidad de mejora',
      rewardXp: Math.min(80, Math.max(20, item.failed * 10)),
    } satisfies PracticeOpportunity
  }).filter((item) => item.accuracyPercent <= 60)

  return [...topicRows, ...typeRows]
    .sort((a, b) => b.failedCount - a.failedCount || a.accuracyPercent - b.accuracyPercent)
    .slice(0, 5)
}

function normalizeRelation<T>(relation: T | T[] | null | undefined): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation ?? null
}
function getStartOfWeekMonday(date: Date) {
  const day = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  monday.setHours(0, 0, 0, 0)
  return monday
}
function clampPercent(value: number) { return Math.min(100, Math.max(0, value)) }
function getQuestionTypeLabel(type: string) {
  return ({ multiple_choice: 'Preguntas tipo test', true_false: 'Verdadero o falso', open_answer: 'Preguntas abiertas', fill_blank: 'Rellenar huecos', ordering: 'Ordenar elementos', match_pairs: 'Unir parejas', drag_drop: 'Asignar elementos' } as Record<string, string>)[type] || 'Tipo de pregunta'
}
function getQuestionTypeIcon(type: string): keyof typeof Ionicons.glyphMap {
  return ({ multiple_choice: 'list-circle', true_false: 'checkmark-circle', open_answer: 'chatbubble-ellipses', fill_blank: 'create', ordering: 'reorder-three', match_pairs: 'git-compare', drag_drop: 'move' } as Record<string, keyof typeof Ionicons.glyphMap>)[type] || 'help-circle'
}
