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

export type StudentBadgeCategory = string

export type StudentBadge = {
  id: string
  category: StudentBadgeCategory
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
  categoryName?: string
  categoryIcon?: keyof typeof Ionicons.glyphMap
  categoryColor?: string
  unitSingular?: string
  unitPlural?: string
}

export type StudentBadgeCategoryDefinition = {
  key: string
  name: string
  description: string | null
  icon: keyof typeof Ionicons.glyphMap
  color: string
  totalCount: number
  unlockedCount: number
}

export type StudentBadgeCatalogSummary = {
  total: number
  unlocked: number
  locked: number
  completionPercent: number
  streakDays: number
}

export type StudentBadgeCatalogPage = {
  categories: StudentBadgeCategoryDefinition[]
  badges: StudentBadge[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  summary: StudentBadgeCatalogSummary
  nextBadge: StudentBadge | null
  featuredBadgeId: string | null
  equippedFrameKey: string
  awardedXp: number
  newlyAwardedBadges: StudentBadge[]
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

export async function fetchStudentBadgeCatalog({
  page = 0,
  pageSize = 12,
  category = null,
  status = 'all',
}: {
  page?: number
  pageSize?: number
  category?: string | null
  status?: 'all' | 'unlocked' | 'locked'
} = {}): Promise<StudentBadgeCatalogPage> {
  const { data, error } = await supabase.rpc('get_student_badge_catalog', {
    p_page: page,
    p_page_size: pageSize,
    p_category_key: category ?? undefined,
    p_status: status,
  })

  if (error) throw error

  const payload = asRecord(data)
  const pagination = asRecord(payload.pagination)
  const summary = asRecord(payload.summary)

  return {
    categories: asArray(payload.categories).map(normalizeCategory).filter(isPresent),
    badges: asArray(payload.items).map(normalizeCatalogBadge).filter(isPresent),
    page: toSafeInteger(pagination.page, page),
    pageSize: toSafeInteger(pagination.page_size, pageSize),
    total: toSafeInteger(pagination.total),
    hasMore: pagination.has_more === true,
    summary: {
      total: toSafeInteger(summary.total),
      unlocked: toSafeInteger(summary.unlocked),
      locked: toSafeInteger(summary.locked),
      completionPercent: toSafeInteger(summary.completion_percent),
      streakDays: toSafeInteger(summary.streak_days),
    },
    nextBadge: normalizeCatalogBadge(payload.next_badge),
    featuredBadgeId: typeof payload.featured_badge_id === 'string' ? payload.featured_badge_id : null,
    equippedFrameKey: typeof payload.equipped_frame_key === 'string' ? payload.equipped_frame_key : 'explorer',
    awardedXp: toSafeInteger(payload.awarded_xp),
    newlyAwardedBadges: asArray(payload.new_awards).map(normalizeCatalogBadge).filter(isPresent),
  }
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

const EMPTY_BADGE_METRICS: StudentBadgeMetrics = {
  totalAnswers: 0,
  correctAnswers: 0,
  accuracyPercent: 0,
  accuracyEligible: false,
  streakDays: 0,
  totalPoints: 0,
  subjectsCount: 0,
  practicedSubjects: 0,
  practicedClassrooms: 0,
  questionTypesPlayed: 0,
}

export function getStudentBadgePresentation(badgeId: string): StudentBadge | null {
  return buildStudentBadges(EMPTY_BADGE_METRICS).find((badge) => badge.id === badgeId) || null
}

export function buildStudentBadges(metrics: StudentBadgeMetrics): StudentBadge[] {
  return [
    createBadge({
      id: 'first-step',
      category: 'challenges',
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
      category: 'challenges',
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
      category: 'challenges',
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
      category: 'challenges',
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
      category: 'accuracy',
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
      category: 'accuracy',
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
      category: 'streak',
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
      category: 'streak',
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
      category: 'courses',
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
      category: 'courses',
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
      category: 'challenges',
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
      category: 'xp',
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
      category: 'xp',
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
  category,
  title,
  requirement,
  current,
  target,
  xp,
  icon,
  color,
}: {
  id: string
  category: StudentBadgeCategory
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
    category,
    title,
    detail: unlocked ? 'Insignia global conseguida' : 'Insignia global pendiente',
    requirement,
    progressLabel: `${clampedCurrent.toLocaleString()} / ${target.toLocaleString()}`,
    statusLabel: unlocked ? 'Conseguida' : 'Pendiente',
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

function normalizeCategory(value: unknown): StudentBadgeCategoryDefinition | null {
  const row = asRecord(value)
  if (typeof row.key !== 'string' || typeof row.name !== 'string') return null

  return {
    key: row.key,
    name: row.name,
    description: typeof row.description === 'string' ? row.description : null,
    icon: normalizeIcon(row.icon, 'ribbon-outline'),
    color: typeof row.color === 'string' ? row.color : '#58B5FF',
    totalCount: toSafeInteger(row.total_count),
    unlockedCount: toSafeInteger(row.unlocked_count),
  }
}

function normalizeCatalogBadge(value: unknown): StudentBadge | null {
  const row = asRecord(value)
  if (typeof row.id !== 'string' || typeof row.title !== 'string') return null

  const current = toSafeInteger(row.current)
  const target = Math.max(1, toSafeInteger(row.target, 1))
  const rewardXp = toSafeInteger(row.reward_xp)
  const unlocked = row.unlocked === true

  return {
    id: row.id,
    category: typeof row.category_key === 'string' ? row.category_key : 'uncategorized',
    categoryName: typeof row.category_name === 'string' ? row.category_name : undefined,
    categoryIcon: normalizeIcon(row.category_icon, 'ribbon-outline'),
    categoryColor: typeof row.category_color === 'string' ? row.category_color : undefined,
    title: row.title,
    detail: typeof row.detail === 'string' ? row.detail : '',
    requirement: typeof row.requirement === 'string' ? row.requirement : '',
    progressLabel: `${Math.min(current, target).toLocaleString()} / ${target.toLocaleString()}`,
    statusLabel: unlocked ? 'Conseguida' : 'Pendiente',
    xp: `+${rewardXp.toLocaleString()} XP`,
    rewardXp,
    icon: normalizeIcon(row.icon, 'ribbon'),
    color: typeof row.color === 'string' ? row.color : '#58B5FF',
    unlocked,
    current: Math.min(current, target),
    target,
    awardedAt: typeof row.awarded_at === 'string' ? row.awarded_at : null,
    unitSingular: typeof row.unit_singular === 'string' ? row.unit_singular : undefined,
    unitPlural: typeof row.unit_plural === 'string' ? row.unit_plural : undefined,
  }
}

function normalizeIcon(value: unknown, fallback: keyof typeof Ionicons.glyphMap) {
  return typeof value === 'string' && value in Ionicons.glyphMap
    ? value as keyof typeof Ionicons.glyphMap
    : fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toSafeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
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
