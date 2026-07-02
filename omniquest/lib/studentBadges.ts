import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'

export type StudentBadgeScore = {
  max_score: number | null
  played_at: string | null
  played_days: string[] | null
  correct_answers: number | null
  subject_id?: number | null
  classroom_id?: number | null
}

export type StudentBadgeAttemptQuestion = {
  subject_id: number | null
  classroom_id: number | null
  type: string | null
}

export type StudentBadgeAttempt = {
  id: number
  is_correct: boolean | null
  attempted_at: string | null
  earned_points?: number | null
  questions?: StudentBadgeAttemptQuestion | StudentBadgeAttemptQuestion[] | null
}

export type StudentBadge = {
  id: string
  title: string
  detail: string
  requirement: string
  progressLabel: string
  statusLabel: string
  xp: string
  rewardXp: number
  icon: keyof typeof Ionicons.glyphMap
  color: string
  unlocked: boolean
  current: number
  target: number
  awardedAt?: string | null
}

export type StudentBadgeMetrics = {
  totalAnswers: number
  correctAnswers: number
  accuracyPercent: number
  accuracyEligible: boolean
  streakDays: number
  totalPoints: number
  subjectsCount: number
  practicedSubjects: number
  practicedClassrooms: number
  questionTypesPlayed: number
}

type StudentBadgeAwardRow = {
  badge_id: string
  awarded_at: string | null
  reward_xp: number | null
}

export type StudentBadgeSyncResult = {
  badges: StudentBadge[]
  awardedXp: number
  newlyAwardedBadges: StudentBadge[]
}

export function getStudentLevel(points: number) {
  return Math.floor(Math.max(0, points) / 100) + 1
}

export function getNextLevelProgress(points: number) {
  return Math.max(0, points) % 100
}

export function getStudentBadgeMetrics({
  attempts = [],
  scores = [],
  totalPoints,
  subjectsCount,
}: {
  attempts?: StudentBadgeAttempt[]
  scores?: StudentBadgeScore[]
  totalPoints: number
  subjectsCount: number
}): StudentBadgeMetrics {
  if (attempts.length > 0) {
    return getMetricsFromAttempts({ attempts, totalPoints, subjectsCount })
  }

  return getLegacyMetricsFromScores({ scores, totalPoints, subjectsCount })
}

export function buildStudentBadges(metrics: StudentBadgeMetrics): StudentBadge[] {
  return [
    createBadge({
      id: 'first-step',
      title: 'Primer paso',
      requirement: 'Responde correctamente tu primera pregunta',
      current: metrics.correctAnswers,
      target: 1,
      xp: '+50 XP',
      icon: 'sparkles',
      color: '#58B5FF',
    }),
    createBadge({
      id: 'first-session',
      title: 'Primera sesión',
      requirement: 'Completa tus primeras 5 preguntas',
      current: metrics.totalAnswers,
      target: 5,
      xp: '+60 XP',
      icon: 'play-circle',
      color: '#8B5CF6',
    }),
    createBadge({
      id: 'practice-25',
      title: 'En marcha',
      requirement: 'Responde 25 preguntas',
      current: metrics.totalAnswers,
      target: 25,
      xp: '+100 XP',
      icon: 'rocket',
      color: '#7C5CFF',
    }),
    createBadge({
      id: 'practice-100',
      title: 'Maestro de retos',
      requirement: 'Responde 100 preguntas',
      current: metrics.totalAnswers,
      target: 100,
      xp: '+250 XP',
      icon: 'trophy',
      color: '#FBBF24',
    }),
    createBadge({
      id: 'correct-50',
      title: 'Buena puntería',
      requirement: 'Consigue 50 respuestas correctas',
      current: metrics.correctAnswers,
      target: 50,
      xp: '+180 XP',
      icon: 'checkmark-circle',
      color: '#34D399',
    }),
    createBadge({
      id: 'accuracy-80',
      title: 'Precisión brillante',
      requirement: 'Alcanza un 80% de precisión con al menos 20 respuestas',
      current: metrics.accuracyEligible ? metrics.accuracyPercent : 0,
      target: 80,
      xp: '+200 XP',
      icon: 'speedometer',
      color: '#43D991',
    }),
    createBadge({
      id: 'streak-3',
      title: 'Constante',
      requirement: 'Practica durante 3 días seguidos',
      current: metrics.streakDays,
      target: 3,
      xp: '+100 XP',
      icon: 'flame',
      color: '#F97316',
    }),
    createBadge({
      id: 'streak-7',
      title: 'Racha semanal',
      requirement: 'Practica durante 7 días seguidos',
      current: metrics.streakDays,
      target: 7,
      xp: '+220 XP',
      icon: 'bonfire',
      color: '#FB7185',
    }),
    createBadge({
      id: 'course-explorer',
      title: 'Explorador de cursos',
      requirement: 'Practica en 3 cursos diferentes',
      current: metrics.practicedSubjects,
      target: 3,
      xp: '+150 XP',
      icon: 'map',
      color: '#38BDF8',
    }),
    createBadge({
      id: 'class-explorer',
      title: 'Explorador de clases',
      requirement: 'Practica en 3 clases diferentes',
      current: metrics.practicedClassrooms,
      target: 3,
      xp: '+150 XP',
      icon: 'compass',
      color: '#34D399',
    }),
    createBadge({
      id: 'question-type-explorer',
      title: 'Explorador de formatos',
      requirement: 'Practica 3 tipos de pregunta diferentes',
      current: metrics.questionTypesPlayed,
      target: 3,
      xp: '+120 XP',
      icon: 'shapes',
      color: '#EC4899',
    }),
    createBadge({
      id: 'xp-500',
      title: 'Cazador de XP',
      requirement: 'Acumula 500 XP',
      current: metrics.totalPoints,
      target: 500,
      xp: '+120 XP',
      icon: 'flash',
      color: '#FBBF24',
    }),
    createBadge({
      id: 'xp-2000',
      title: 'Leyenda XP',
      requirement: 'Acumula 2.000 XP',
      current: metrics.totalPoints,
      target: 2000,
      xp: '+300 XP',
      icon: 'star',
      color: '#F59E0B',
    }),
  ]
}

function getMetricsFromAttempts({
  attempts,
  totalPoints,
  subjectsCount,
}: {
  attempts: StudentBadgeAttempt[]
  totalPoints: number
  subjectsCount: number
}): StudentBadgeMetrics {
  const totalAnswers = attempts.length
  const correctAnswers = attempts.filter((attempt) => attempt.is_correct === true).length
  const accuracyPercent = totalAnswers > 0
    ? Math.min(100, Math.round((correctAnswers / totalAnswers) * 100))
    : 0

  const questionRows = attempts
    .map((attempt) => normalizeQuestionRelation(attempt.questions))
    .filter((question): question is StudentBadgeAttemptQuestion => Boolean(question))

  const practicedSubjects = new Set(
    questionRows
      .map((question) => question.subject_id)
      .filter((value): value is number => typeof value === 'number')
  ).size

  const practicedClassrooms = new Set(
    questionRows
      .map((question) => question.classroom_id)
      .filter((value): value is number => typeof value === 'number')
  ).size

  const questionTypesPlayed = new Set(
    questionRows
      .map((question) => question.type)
      .filter((value): value is string => Boolean(value))
  ).size

  return {
    totalAnswers,
    correctAnswers,
    accuracyPercent,
    accuracyEligible: totalAnswers >= 20,
    streakDays: calculateStreakDays(attempts.map((attempt) => attempt.attempted_at).filter((value): value is string => Boolean(value))),
    totalPoints,
    subjectsCount,
    practicedSubjects,
    practicedClassrooms,
    questionTypesPlayed,
  }
}

function getLegacyMetricsFromScores({
  scores,
  totalPoints,
  subjectsCount,
}: {
  scores: StudentBadgeScore[]
  totalPoints: number
  subjectsCount: number
}): StudentBadgeMetrics {
  const correctAnswers = scores.reduce((total, score) => total + (score.correct_answers ?? 0), 0)
  const totalAnswers = Math.max(correctAnswers, scores.filter((score) => (score.max_score ?? 0) > 0).length)
  const accuracyPercent = totalAnswers > 0
    ? Math.min(100, Math.round((correctAnswers / Math.max(totalAnswers, 1)) * 100))
    : 0
  const playedDays = scores.flatMap((score) => [
    ...(score.played_days || []),
    ...(score.played_at ? [score.played_at] : []),
  ])
  const practicedSubjects = new Set(
    scores
      .map((score) => score.subject_id)
      .filter((value): value is number => typeof value === 'number')
  ).size
  const practicedClassrooms = new Set(
    scores
      .map((score) => score.classroom_id)
      .filter((value): value is number => typeof value === 'number')
  ).size

  return {
    totalAnswers,
    correctAnswers,
    accuracyPercent,
    accuracyEligible: totalAnswers >= 20,
    streakDays: calculateStreakDays(playedDays),
    totalPoints,
    subjectsCount,
    practicedSubjects: Math.max(practicedSubjects, subjectsCount > 0 && correctAnswers > 0 ? 1 : 0),
    practicedClassrooms,
    questionTypesPlayed: 0,
  }
}

function normalizeQuestionRelation(
  question: StudentBadgeAttempt['questions']
): StudentBadgeAttemptQuestion | null {
  if (Array.isArray(question)) {
    return question[0] ?? null
  }

  return question ?? null
}

function createBadge({
  id,
  title,
  requirement,
  current,
  target,
  xp,
  icon,
  color,
}: {
  id: string
  title: string
  requirement: string
  current: number
  target: number
  xp: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
}): StudentBadge {
  const unlocked = current >= target
  const clampedCurrent = Math.min(current, target)
  const rewardXp = parseRewardXp(xp)

  return {
    id,
    title,
    detail: unlocked ? 'Insignia global conseguida' : 'Insignia global pendiente',
    requirement,
    progressLabel: `${clampedCurrent.toLocaleString()} / ${target.toLocaleString()}`,
    statusLabel: unlocked ? 'Conseguida' : 'Bloqueada',
    xp,
    rewardXp,
    icon,
    color,
    unlocked,
    current: clampedCurrent,
    target,
    awardedAt: null,
  }
}

export async function syncStudentBadgeAwards({
  badges,
}: {
  userId: string
  badges: StudentBadge[]
  currentPoints: number
}): Promise<StudentBadgeSyncResult> {
  const { data, error } = await supabase.rpc('sync_student_badges')

  if (error) throw error

  const result = data && typeof data === 'object' && !Array.isArray(data)
    ? data as {
        awards?: StudentBadgeAwardRow[]
        new_awards?: StudentBadgeAwardRow[]
        awarded_xp?: number
      }
    : {}
  const awards = Array.isArray(result.awards) ? result.awards : []
  const newAwards = Array.isArray(result.new_awards)
    ? result.new_awards
    : inferNewAwardRows({ awards, awardedXp: result.awarded_xp ?? 0 })
  const awardedByBadgeId = new Map(
    awards.map((row) => [row.badge_id, row])
  )
  const newAwardByBadgeId = new Map(
    newAwards.map((row) => [row.badge_id, row])
  )

  const syncedBadges = badges.map((badge) => ({
    ...badge,
    awardedAt: awardedByBadgeId.get(badge.id)?.awarded_at ?? null,
  }))

  return {
    badges: syncedBadges,
    awardedXp: result.awarded_xp ?? 0,
    newlyAwardedBadges: syncedBadges.filter((badge) => newAwardByBadgeId.has(badge.id)),
  }
}

function inferNewAwardRows({
  awards,
  awardedXp,
}: {
  awards: StudentBadgeAwardRow[]
  awardedXp: number
}) {
  if (awardedXp <= 0 || awards.length === 0) {
    return []
  }

  const orderedAwards = [...awards].sort((a, b) => {
    const left = a.awarded_at ? new Date(a.awarded_at).getTime() : 0
    const right = b.awarded_at ? new Date(b.awarded_at).getTime() : 0
    return right - left
  })
  const inferredRows: StudentBadgeAwardRow[] = []
  let accumulatedXp = 0

  for (const row of orderedAwards) {
    if (accumulatedXp >= awardedXp) break

    inferredRows.push(row)
    accumulatedXp += row.reward_xp ?? 0
  }

  return inferredRows
}

function parseRewardXp(value: string) {
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export function calculateStreakDays(playedAtValues: string[]) {
  const playedDays = new Set(
    playedAtValues
      .map((value) => {
        const date = parsePlayedDate(value)
        return Number.isNaN(date.getTime()) ? null : toDateKey(date)
      })
      .filter(Boolean)
  )

  const today = startOfLocalDay(new Date())
  const yesterday = addDays(today, -1)
  let cursor = playedDays.has(toDateKey(today))
    ? today
    : playedDays.has(toDateKey(yesterday))
      ? yesterday
      : null

  if (!cursor) return 0

  let streak = 0
  while (playedDays.has(toDateKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function parsePlayedDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(date.getDate() + days)
  return nextDate
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
