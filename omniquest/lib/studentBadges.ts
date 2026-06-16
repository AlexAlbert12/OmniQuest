import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'

export type StudentBadgeScore = {
  max_score: number | null
  played_at: string | null
  played_days: string[] | null
  correct_answers: number | null
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

type StudentBadgeMetrics = {
  correctAnswers: number
  streakDays: number
  completedClasses: number
  totalPoints: number
  subjectsCount: number
  bestScore: number
}

type StudentBadgeAwardRow = {
  badge_id: string
  awarded_at: string | null
  reward_xp: number | null
}

export function getStudentLevel(points: number) {
  return Math.floor(Math.max(0, points) / 100) + 1
}

export function getNextLevelProgress(points: number) {
  return Math.max(0, points) % 100
}

export function getStudentBadgeMetrics({
  scores,
  totalPoints,
  subjectsCount,
}: {
  scores: StudentBadgeScore[]
  totalPoints: number
  subjectsCount: number
}): StudentBadgeMetrics {
  const correctAnswers = scores.reduce((total, score) => total + (score.correct_answers ?? 0), 0)
  const completedClasses = scores.filter((score) => (score.max_score ?? 0) > 0).length
  const bestScore = Math.max(0, ...scores.map((score) => score.max_score ?? 0))
  const playedDays = scores.flatMap((score) => [
    ...(score.played_days || []),
    ...(score.played_at ? [score.played_at] : []),
  ])

  return {
    correctAnswers,
    streakDays: calculateStreakDays(playedDays),
    completedClasses,
    totalPoints,
    subjectsCount,
    bestScore,
  }
}

export function buildStudentBadges(metrics: StudentBadgeMetrics): StudentBadge[] {
  return [
    createBadge({
      id: 'first-step',
      title: 'Primer paso',
      requirement: 'Consigue tu primera respuesta correcta',
      current: metrics.correctAnswers,
      target: 1,
      xp: '+50 XP',
      icon: 'sparkles',
      color: '#58B5FF',
    }),
    createBadge({
      id: 'challenge-master',
      title: 'Maestro de retos',
      requirement: 'Supera 50 respuestas correctas',
      current: metrics.correctAnswers,
      target: 50,
      xp: '+200 XP',
      icon: 'trophy',
      color: '#8B5CF6',
    }),
    createBadge({
      id: 'constant',
      title: 'Constante',
      requirement: 'Mantén una racha de 7 días',
      current: metrics.streakDays,
      target: 7,
      xp: '+100 XP',
      icon: 'flame',
      color: '#F6A64A',
    }),
    createBadge({
      id: 'class-explorer',
      title: 'Explorador de clases',
      requirement: 'Completa partidas en 3 clases',
      current: metrics.completedClasses,
      target: 3,
      xp: '+150 XP',
      icon: 'compass',
      color: '#34D399',
    }),
    createBadge({
      id: 'collector',
      title: 'Coleccionista',
      requirement: 'Inscríbete en 5 clases',
      current: metrics.subjectsCount,
      target: 5,
      xp: '+120 XP',
      icon: 'albums',
      color: '#EC4899',
    }),
    createBadge({
      id: 'xp-legend',
      title: 'Leyenda XP',
      requirement: 'Acumula 2.000 XP',
      current: metrics.totalPoints,
      target: 2000,
      xp: '+250 XP',
      icon: 'flash',
      color: '#FBBF24',
    }),
    createBadge({
      id: 'high-score',
      title: 'Marca brillante',
      requirement: 'Logra una nota de 1.000 XP',
      current: metrics.bestScore,
      target: 1000,
      xp: '+180 XP',
      icon: 'medal',
      color: '#43D991',
    }),
  ]
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
    detail: unlocked ? 'Insignia conseguida' : 'Insignia pendiente',
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
}) {
  const { data, error } = await supabase.rpc('sync_student_badges')

  if (error) throw error

  const result = data && typeof data === 'object' && !Array.isArray(data)
    ? data as { awards?: StudentBadgeAwardRow[]; awarded_xp?: number }
    : {}
  const awards = Array.isArray(result.awards) ? result.awards : []
  const awardedByBadgeId = new Map(
    awards.map((row) => [row.badge_id, row])
  )

  return {
    badges: badges.map((badge) => ({
      ...badge,
      awardedAt: awardedByBadgeId.get(badge.id)?.awarded_at ?? null,
    })),
    awardedXp: result.awarded_xp ?? 0,
  }
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
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
