import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { calculateStreakDays } from '../../lib/studentBadges'
import { fetchStudentProgressSummary, type StudentProgressSubject } from '../../lib/studentProgress'
import { getStartOfWeekMonday } from '../../lib/weeklyGoal'
import type {
  StudentHomeAchievementPreview,
  StudentHomeAction,
  StudentHomeProfile,
  StudentHomeRankingProfile,
  StudentHomeRankingSummary,
  StudentHomeSubject,
  StudentHomeSubjectRow,
  StudentHomeViewModel,
} from '../../components/student/home/types'

const DAILY_MISSION_TARGET = 5
const WEEKLY_GOAL_TARGET = 20

export function useStudentHome() {
  const [profile, setProfile] = useState<StudentHomeProfile | null>(null)
  const [subjects, setSubjects] = useState<StudentHomeSubject[]>([])
  const [ranking, setRanking] = useState<StudentHomeRankingProfile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [progressSummary, setProgressSummary] = useState<Awaited<ReturnType<typeof fetchStudentProgressSummary>> | null>(null)
  const [todayAttemptCount, setTodayAttemptCount] = useState(0)
  const [weeklyAttemptCount, setWeeklyAttemptCount] = useState(0)
  const [streakDays, setStreakDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const { data: sessionResult } = await supabase.auth.getSession()
      const userId = sessionResult.session?.user.id
      if (!userId) throw new Error('No hay una sesión activa.')
      setCurrentUserId(userId)

      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const startOfWeek = getStartOfWeekMonday(now).toISOString()

      const [profileResult, enrollmentsResult, rankingResult, todayResult, weeklyResult, streakResult, progressResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, points, role_id, visibility').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('classroom_id, joined_at, subjects(id, name, description, icon, theme_color), classrooms(id, name, code)')
          .eq('student_id', userId)
          .order('joined_at', { ascending: false }),
        supabase.rpc('get_ranking_profiles', { p_limit: 5 }),
        supabase
          .from('attempt_history')
          .select('id', { head: true, count: 'exact' })
          .eq('student_id', userId)
          .gte('attempted_at', startOfToday),
        supabase
          .from('attempt_history')
          .select('id', { head: true, count: 'exact' })
          .eq('student_id', userId)
          .gte('attempted_at', startOfWeek),
        supabase
          .from('attempt_history')
          .select('attempted_at')
          .eq('student_id', userId)
          .order('attempted_at', { ascending: false })
          .limit(120),
        fetchStudentProgressSummary(userId),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (rankingResult.error) throw rankingResult.error
      if (todayResult.error) throw todayResult.error
      if (weeklyResult.error) throw weeklyResult.error
      if (streakResult.error) throw streakResult.error

      const nextSubjects = ((enrollmentsResult.data || []) as any[])
        .map((enrollment) => {
          const subject = normalizeRelation<any>(enrollment.subjects)
          const classroom = normalizeRelation<any>(enrollment.classrooms)
          if (!subject) return null
          return {
            id: Number(subject.id),
            classroom_id: Number(enrollment.classroom_id ?? classroom?.id ?? 0) || null,
            classroom_name: classroom?.name ?? null,
            classroom_code: classroom?.code ?? null,
            name: subject.name,
            description: subject.description ?? null,
            icon: subject.icon ?? null,
            theme_color: subject.theme_color ?? null,
          } satisfies StudentHomeSubject
        })
        .filter((subject): subject is StudentHomeSubject => Boolean(subject))

      setProfile(profileResult.data as StudentHomeProfile)
      setSubjects(nextSubjects)
      setRanking((rankingResult.data || []) as StudentHomeRankingProfile[])
      setTodayAttemptCount(todayResult.count ?? 0)
      setWeeklyAttemptCount(weeklyResult.count ?? 0)
      setStreakDays(calculateStreakDays(
        ((streakResult.data || []) as { attempted_at: string | null }[])
          .map((attempt) => attempt.attempted_at)
          .filter((value): value is string => Boolean(value))
      ))
      setProgressSummary(progressResult)
    } catch (loadError) {
      console.error('Error cargando el inicio del alumno:', loadError)
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el inicio.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  const viewModel = useMemo<StudentHomeViewModel>(() => {
    const progressRows = progressSummary?.subjects ?? []
    const subjectRows = getSubjectProgressRows(subjects, progressRows)
    const failedQuestions = progressRows.reduce((sum, subject) => sum + subject.failedQuestions, 0)
    const points = profile?.points ?? 0
    const attemptCount = progressSummary?.totalAttempts ?? 0

    return {
      profile,
      subjects,
      subjectRows,
      progressSummary,
      ranking,
      rankingSummary: buildRankingSummary(ranking, currentUserId, points),
      achievements: buildAchievementPreview({
        points,
        streakDays,
        subjectsCount: subjects.length,
        attemptCount,
        accuracyPercent: progressSummary?.accuracyPercent ?? 0,
      }),
      recommendedAction: buildRecommendedAction(subjects, progressRows, failedQuestions),
      continueRow: subjectRows.find((row) => (row.progress?.pendingQuestions ?? 0) > 0)
        || subjectRows.find((row) => (row.progress?.failedQuestions ?? 0) > 0)
        || subjectRows[0]
        || null,
      currentUserId,
      attemptCount,
      todayAttemptCount,
      weeklyAttemptCount,
      streakDays,
      failedQuestions,
      dailyMissionTarget: DAILY_MISSION_TARGET,
      weeklyGoalTarget: WEEKLY_GOAL_TARGET,
    }
  }, [currentUserId, profile, progressSummary, ranking, streakDays, subjects, todayAttemptCount, weeklyAttemptCount])

  return {
    ...viewModel,
    loading,
    refreshing,
    error,
    refresh: () => load({ silent: true }),
  }
}

export function buildStudentClassHref(subject: Pick<StudentHomeSubject, 'id' | 'classroom_id'>) {
  return {
    pathname: '/(student)/class/[id]',
    params: {
      id: String(subject.id),
      ...(subject.classroom_id ? { classroomId: String(subject.classroom_id) } : {}),
    },
  }
}

export function getStudentHomeCourseKey(subject: Pick<StudentHomeSubject, 'id' | 'classroom_id'>) {
  return `${subject.id}:${subject.classroom_id ?? 'general'}`
}

function buildRecommendedAction(
  subjects: StudentHomeSubject[],
  progressRows: StudentProgressSubject[],
  failedQuestions: number,
): StudentHomeAction {
  const rows = getSubjectProgressRows(subjects, progressRows)
  const reviewRow = rows.find((row) => (row.progress?.failedQuestions ?? 0) > 0)
  if (reviewRow && failedQuestions > 0) {
    return {
      title: 'Tu acción recomendada',
      description: `Repasa ${failedQuestions} ${failedQuestions === 1 ? 'fallo' : 'fallos'} en ${reviewRow.subject.name} antes de avanzar.`,
      buttonLabel: 'Repasar ahora',
      icon: 'refresh-circle',
      href: buildStudentClassHref(reviewRow.subject),
      tone: 'review',
    }
  }

  const continueRow = rows.find((row) => (row.progress?.pendingQuestions ?? 0) > 0)
  if (continueRow) {
    return {
      title: 'Tu acción recomendada',
      description: `Sigue con ${continueRow.subject.name}. Tienes ${continueRow.progress?.pendingQuestions ?? 0} preguntas por descubrir.`,
      buttonLabel: 'Continuar aprendiendo',
      icon: 'play-forward',
      href: buildStudentClassHref(continueRow.subject),
      tone: 'continue',
    }
  }

  if (subjects.length === 0) {
    return {
      title: 'Empieza tu primera aventura',
      description: 'Únete a un curso con el código que te facilite tu profesor.',
      buttonLabel: 'Unirme a un curso',
      icon: 'add-circle',
      href: '/(student)/classes',
      tone: 'start',
    }
  }

  return {
    title: 'Elige tu siguiente misión',
    description: 'Has completado lo pendiente. Puedes repetir un tema o explorar otro curso.',
    buttonLabel: 'Ver mis cursos',
    icon: 'planet',
    href: '/(student)/classes',
    tone: 'explore',
  }
}

function getSubjectProgressRows(
  subjects: StudentHomeSubject[],
  progressRows: StudentProgressSubject[],
): StudentHomeSubjectRow[] {
  return subjects
    .map((subject) => ({
      subject,
      progress: progressRows.find((progress) => getProgressKey(progress) === getStudentHomeCourseKey(subject)),
    }))
    .sort((left, right) => {
      const failedDiff = (right.progress?.failedQuestions ?? 0) - (left.progress?.failedQuestions ?? 0)
      if (failedDiff !== 0) return failedDiff
      const pendingDiff = (right.progress?.pendingQuestions ?? 0) - (left.progress?.pendingQuestions ?? 0)
      if (pendingDiff !== 0) return pendingDiff
      return (right.progress?.percent ?? 0) - (left.progress?.percent ?? 0)
    })
}

function buildRankingSummary(
  ranking: StudentHomeRankingProfile[],
  currentUserId: string | null,
  points: number,
): StudentHomeRankingSummary | null {
  if (ranking.length === 0) return null
  const currentIndex = currentUserId ? ranking.findIndex((row) => row.id === currentUserId) : -1
  return {
    position: currentIndex >= 0 ? currentIndex + 1 : ranking.filter((row) => (row.points ?? 0) > points).length + 1,
    total: ranking.length,
    points,
    leaderAlias: ranking[0]?.alias || 'Líder',
    leaderPoints: ranking[0]?.points ?? 0,
  }
}

function buildAchievementPreview({
  points,
  streakDays,
  subjectsCount,
  attemptCount,
  accuracyPercent,
}: {
  points: number
  streakDays: number
  subjectsCount: number
  attemptCount: number
  accuracyPercent: number
}): StudentHomeAchievementPreview[] {
  const candidates: StudentHomeAchievementPreview[] = [
    {
      id: 'practice-25',
      title: 'En marcha',
      description: 'Responde 25 preguntas',
      icon: 'rocket',
      current: attemptCount,
      target: 25,
      unlocked: attemptCount >= 25,
      colorRole: 'info',
    },
    {
      id: 'streak-3',
      title: 'Constante',
      description: 'Practica 3 días seguidos',
      icon: 'flame',
      current: streakDays,
      target: 3,
      unlocked: streakDays >= 3,
      colorRole: 'streak',
    },
    {
      id: 'course-explorer',
      title: 'Explorador',
      description: 'Únete a 3 cursos',
      icon: 'map',
      current: subjectsCount,
      target: 3,
      unlocked: subjectsCount >= 3,
      colorRole: 'success',
    },
    {
      id: 'accuracy-80',
      title: 'Precisión brillante',
      description: 'Alcanza un 80% de precisión',
      icon: 'speedometer',
      current: accuracyPercent,
      target: 80,
      unlocked: attemptCount >= 20 && accuracyPercent >= 80,
      colorRole: 'success',
    },
    {
      id: 'xp-500',
      title: 'Cazador de XP',
      description: 'Acumula 500 XP',
      icon: 'flash',
      current: points,
      target: 500,
      unlocked: points >= 500,
      colorRole: 'xp',
    },
  ]

  return candidates
    .sort((left, right) => {
      if (left.unlocked !== right.unlocked) return left.unlocked ? 1 : -1
      const leftProgress = left.current / Math.max(left.target, 1)
      const rightProgress = right.current / Math.max(right.target, 1)
      return rightProgress - leftProgress
    })
    .slice(0, 3)
}

function getProgressKey(subject: StudentProgressSubject) {
  return `${subject.id}:${subject.classroomId ?? 'general'}`
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}
