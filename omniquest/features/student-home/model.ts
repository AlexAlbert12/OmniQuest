import type { StudentProgressSubject } from '../../lib/studentProgress'
import type {
  StudentHomeAchievementPreview,
  StudentHomeAction,
  StudentHomeDashboardPayload,
  StudentHomeRankingProfile,
  StudentHomeRankingPreviewRow,
  StudentHomeRankingSummary,
  StudentHomeSubject,
  StudentHomeSubjectRow,
  StudentHomeViewModel,
} from './types'

export const DAILY_MISSION_TARGET = 5
export const WEEKLY_GOAL_TARGET = 20

export function buildStudentHomeViewModel(payload: StudentHomeDashboardPayload): StudentHomeViewModel {
  const progressRows = payload.progressSummary?.subjects ?? []
  const subjectRows = getSubjectProgressRows(payload.subjects, progressRows)
  const failedQuestions = progressRows.reduce((sum, subject) => sum + subject.failedQuestions, 0)
  const points = payload.profile?.points ?? 0
  const attemptCount = payload.progressSummary?.totalAttempts ?? 0
  const rankingSummary = buildRankingSummary(payload.ranking, payload.currentUserId, points, attemptCount)

  return {
    profile: payload.profile,
    subjects: payload.subjects,
    subjectRows,
    progressSummary: payload.progressSummary,
    ranking: payload.ranking,
    rankingSummary,
    rankingPreview: buildRankingPreview(payload.ranking, rankingSummary, payload.currentUserId, payload.profile),
    achievements: buildAchievementPreview({
      points,
      streakDays: payload.streakDays,
      subjectsCount: payload.subjects.length,
      attemptCount,
      accuracyPercent: payload.progressSummary?.accuracyPercent ?? 0,
    }),
    recommendedAction: buildRecommendedAction(payload.subjects, progressRows, failedQuestions),
    continueRow: subjectRows.find((row) => (row.progress?.pendingQuestions ?? 0) > 0)
      || subjectRows.find((row) => (row.progress?.failedQuestions ?? 0) > 0)
      || subjectRows[0]
      || null,
    currentUserId: payload.currentUserId,
    attemptCount,
    todayAttemptCount: payload.todayAttemptCount,
    weeklyAttemptCount: payload.weeklyAttemptCount,
    streakDays: payload.streakDays,
    failedQuestions,
    dailyMissionTarget: DAILY_MISSION_TARGET,
    weeklyGoalTarget: WEEKLY_GOAL_TARGET,
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

function buildRecommendedAction(subjects: StudentHomeSubject[], progressRows: StudentProgressSubject[], failedQuestions: number): StudentHomeAction {
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

function getSubjectProgressRows(subjects: StudentHomeSubject[], progressRows: StudentProgressSubject[]): StudentHomeSubjectRow[] {
  const progressByCourse = new Map(progressRows.map((progress) => [getProgressKey(progress), progress]))
  return subjects
    .map((subject) => ({ subject, progress: progressByCourse.get(getStudentHomeCourseKey(subject)) }))
    .sort((left, right) => {
      const failedDiff = (right.progress?.failedQuestions ?? 0) - (left.progress?.failedQuestions ?? 0)
      if (failedDiff !== 0) return failedDiff
      const pendingDiff = (right.progress?.pendingQuestions ?? 0) - (left.progress?.pendingQuestions ?? 0)
      if (pendingDiff !== 0) return pendingDiff
      return (right.progress?.percent ?? 0) - (left.progress?.percent ?? 0)
    })
}

export function buildRankingSummary(
  ranking: StudentHomeRankingProfile[],
  currentUserId: string | null,
  points: number,
  attemptCount: number,
): StudentHomeRankingSummary | null {
  if (ranking.length === 0 || (attemptCount === 0 && points === 0)) return null
  const currentIndex = currentUserId ? ranking.findIndex((row) => row.id === currentUserId) : -1
  return {
    position: currentIndex >= 0 ? currentIndex + 1 : ranking.filter((row) => (row.points ?? 0) > points).length + 1,
    total: ranking.length,
    points,
    leaderAlias: ranking[0]?.alias || 'Líder',
    leaderPoints: ranking[0]?.points ?? 0,
    estimated: currentIndex < 0,
  }
}

export function buildRankingPreview(
  ranking: StudentHomeRankingProfile[],
  summary: StudentHomeRankingSummary | null,
  currentUserId: string | null,
  profile: StudentHomeDashboardPayload['profile'],
): StudentHomeRankingPreviewRow[] {
  const topRows = ranking.slice(0, 3).map((row, index) => ({
    ...row,
    position: index + 1,
    estimated: false,
  }))

  if (!summary || !currentUserId || topRows.some((row) => row.id === currentUserId)) return topRows

  const currentRow = ranking.find((row) => row.id === currentUserId) ?? {
    id: currentUserId,
    alias: profile.alias,
    avatar: profile.avatar,
    points: profile.points,
  }

  return [
    ...topRows.slice(0, 2),
    { ...currentRow, position: summary.position, estimated: summary.estimated },
  ]
}

function buildAchievementPreview({ points, streakDays, subjectsCount, attemptCount, accuracyPercent }: {
  points: number
  streakDays: number
  subjectsCount: number
  attemptCount: number
  accuracyPercent: number
}): StudentHomeAchievementPreview[] {
  const candidates: StudentHomeAchievementPreview[] = [
    { id: 'practice-25', title: 'En marcha', description: 'Responde 25 preguntas', icon: 'rocket', current: attemptCount, target: 25, unlocked: attemptCount >= 25, colorRole: 'info' },
    { id: 'streak-3', title: 'Constante', description: 'Practica 3 días seguidos', icon: 'flame', current: streakDays, target: 3, unlocked: streakDays >= 3, colorRole: 'streak' },
    { id: 'course-explorer', title: 'Explorador', description: 'Únete a 3 cursos', icon: 'map', current: subjectsCount, target: 3, unlocked: subjectsCount >= 3, colorRole: 'success' },
    { id: 'accuracy-80', title: 'Precisión brillante', description: 'Alcanza un 80% de precisión', icon: 'speedometer', current: accuracyPercent, target: 80, unlocked: attemptCount >= 20 && accuracyPercent >= 80, colorRole: 'success' },
    { id: 'xp-500', title: 'Cazador de XP', description: 'Acumula 500 XP', icon: 'flash', current: points, target: 500, unlocked: points >= 500, colorRole: 'xp' },
  ]

  return candidates
    .sort((left, right) => {
      if (left.unlocked !== right.unlocked) return left.unlocked ? 1 : -1
      return (right.current / Math.max(right.target, 1)) - (left.current / Math.max(left.target, 1))
    })
    .slice(0, 3)
}

function getProgressKey(subject: StudentProgressSubject) {
  return `${subject.id}:${subject.classroomId ?? 'general'}`
}
