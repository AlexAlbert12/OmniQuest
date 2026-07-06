import { accuracyToGrade, answersToAccuracyPercent, scoreToGrade } from './grades'

export type Enrollment = {
  student_id: string
  classroom_id?: number | null
}

export type SubjectScore = {
  student_id: string
  classroom_id?: number | null
  max_score: number | null
  correct_answers?: number | null
  played_days?: string[] | null
  played_at?: string | null
}

export type StudentProfile = {
  id: string
  alias: string | null
}

export type StudentReport = {
  id: string
  name: string
  score: number
  grade: number
  accuracyPercent: number
  correctAnswers: number
  failedAnswers: number
  participation: number
  playedSessions: number
  lastActivity?: string | null
  hasActivity: boolean
}

export type StudentStatusFilter = 'all' | 'active' | 'inactive' | 'needs_help' | 'no_activity'
export type StudentSortKey = 'xp' | 'progress' | 'grade' | 'recent' | 'last_activity'

export type EvolutionReport = {
  label: string
  activityCount: number
  averageScore: number
}

export function buildStudentListRows(
  students: StudentReport[],
  search: string,
  statusFilter: StudentStatusFilter,
  sortKey: StudentSortKey
) {
  const normalizedSearch = search.trim().toLowerCase()

  return students
    .filter((student) => {
      if (normalizedSearch && !student.name.toLowerCase().includes(normalizedSearch)) {
        return false
      }

      return statusFilter === 'all' || getStudentStatus(student) === statusFilter
    })
    .sort((a, b) => {
      if (sortKey === 'progress') return b.participation - a.participation || b.score - a.score
      if (sortKey === 'grade') return b.grade - a.grade || b.score - a.score
      if (sortKey === 'recent' || sortKey === 'last_activity') return getSortableTime(b.lastActivity) - getSortableTime(a.lastActivity)
      return b.score - a.score || b.participation - a.participation
    })
}

export function getStudentStatus(student: StudentReport): StudentStatusFilter {
  if (!student.hasActivity) return 'no_activity'
  if (student.participation < 35 || student.grade < 5) return 'needs_help'
  if (student.participation < 60) return 'inactive'
  return 'active'
}

export function getStudentStatusMeta(status: StudentStatusFilter) {
  if (status === 'active') return { label: 'Activo', color: '#34D399' }
  if (status === 'inactive') return { label: 'Inactivo', color: '#8FA7C7' }
  if (status === 'no_activity') return { label: 'Sin actividad', color: '#AFC2DB' }
  if (status === 'needs_help') return { label: 'Necesita apoyo', color: '#F59E0B' }
  return { label: 'Todos', color: '#A78BFA' }
}

export function getStudentStatusFilterLabel(status: StudentStatusFilter) {
  if (status === 'active') return 'Activos'
  if (status === 'inactive') return 'Inactivos'
  if (status === 'no_activity') return 'Sin actividad'
  if (status === 'needs_help') return 'Necesitan apoyo'
  return 'Todos'
}

export function getNextStudentStatusFilter(status: StudentStatusFilter): StudentStatusFilter {
  const options: StudentStatusFilter[] = ['all', 'active', 'inactive', 'no_activity', 'needs_help']
  const index = options.indexOf(status)
  return options[(index + 1) % options.length]
}

export function getStudentSortLabel(sortKey: StudentSortKey) {
  if (sortKey === 'progress') return 'Progreso'
  if (sortKey === 'grade') return 'Nota'
  if (sortKey === 'recent' || sortKey === 'last_activity') return 'Actividad'
  return 'XP'
}

export function getNextStudentSortKey(sortKey: StudentSortKey): StudentSortKey {
  const options: StudentSortKey[] = ['xp', 'progress', 'grade', 'recent']
  const index = options.indexOf(sortKey)
  return options[(index + 1) % options.length]
}

export function getGradeColor(value: number) {
  if (value >= 8) return '#34D399'
  if (value >= 6) return '#F59E0B'
  return '#F43F5E'
}

export function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'A'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

export function slugifyStudentName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18) || 'alumno'
}

export function buildStudentReportRows(
  enrollments: Enrollment[],
  scores: SubjectScore[],
  profilesById: Record<string, StudentProfile>,
  questionsCount: number
): StudentReport[] {
  const scoreByStudentId = new Map<string, SubjectScore>()
  scores.forEach((score) => {
    if (!scoreByStudentId.has(score.student_id)) {
      scoreByStudentId.set(score.student_id, score)
    }
  })
  const maxSessions = Math.max(1, ...scores.map((score) => getPlayedSessions(score, questionsCount)))

  return enrollments
    .map((enrollment, index) => {
      const score = scoreByStudentId.get(enrollment.student_id)
      const hasActivity = Boolean(score?.played_at || typeof score?.max_score === 'number')
      const playedSessions = getPlayedSessions(score, questionsCount)
      const performance = score ? getScorePerformance(score, questionsCount) : { accuracyPercent: 0, correctAnswers: 0, totalAnswers: 0, grade: 0 }
      const answeredQuestions = performance.totalAnswers
      const correctAnswers = performance.correctAnswers
      const failedAnswers = hasActivity && typeof score?.correct_answers === 'number' ? Math.max(0, answeredQuestions - correctAnswers) : 0

      return {
        id: enrollment.student_id,
        name: profilesById[enrollment.student_id]?.alias || `Alumno ${index + 1}`,
        score: score?.max_score ?? 0,
        grade: performance.grade,
        accuracyPercent: performance.accuracyPercent,
        correctAnswers,
        failedAnswers,
        participation: hasActivity ? Math.min(100, Math.round((playedSessions / maxSessions) * 100)) : 0,
        playedSessions,
        lastActivity: score?.played_at,
        hasActivity,
      }
    })
    .sort((a, b) => Number(b.hasActivity) - Number(a.hasActivity) || b.score - a.score || a.name.localeCompare(b.name))
}

export function getScorePerformance(score: SubjectScore, questionsCount: number) {
  const playedSessions = getPlayedSessions(score, questionsCount)
  const totalAnswers = typeof score.correct_answers === 'number' && questionsCount > 0
    ? playedSessions * questionsCount
    : 0
  const correctAnswers = totalAnswers > 0 ? Math.min(Math.max(0, score.correct_answers ?? 0), totalAnswers) : 0
  const accuracyPercent = totalAnswers > 0 ? answersToAccuracyPercent(correctAnswers, totalAnswers) : 0
  const grade = totalAnswers > 0
    ? accuracyToGrade(accuracyPercent)
    : scoreToGrade(score.max_score ?? 0, Math.max(160, questionsCount * 160))

  return {
    accuracyPercent,
    correctAnswers,
    totalAnswers,
    grade,
  }
}

export function buildTemporalEvolution(scores: SubjectScore[], questionsCount: number): EvolutionReport[] {
  const today = new Date()
  const periods = Array.from({ length: 6 }, (_, index) => {
    const start = startOfDay(addDays(today, -35 + index * 7))
    const end = endOfDay(addDays(start, 6))

    return { start, end, label: `${formatShortDate(start)} - ${formatShortDate(end)}` }
  })

  return periods.map((period) => {
    const activeScores = scores.filter((score) =>
      getPlayedDateKeys(score).some((dateKey) => {
        const date = new Date(`${dateKey}T12:00:00`)
        return date >= period.start && date <= period.end
      })
    )
    const averageScore = activeScores.length > 0
      ? Math.round(activeScores.reduce((total, score) => total + (score.max_score ?? 0), 0) / activeScores.length)
      : 0

    return {
      label: period.label,
      activityCount: activeScores.length,
      averageScore: questionsCount > 0 ? averageScore : 0,
    }
  })
}

export function getPlayedSessions(score: SubjectScore | undefined, questionsCount: number) {
  if (!score) return 0
  const playedDays = Array.isArray(score.played_days) ? score.played_days.filter(Boolean).length : 0
  const sessionsFromCorrectAnswers = questionsCount > 0 ? Math.ceil((score.correct_answers ?? 0) / questionsCount) : 0
  return Math.max(score.played_at ? 1 : 0, playedDays, sessionsFromCorrectAnswers)
}

export function getPlayedDateKeys(score: SubjectScore) {
  const playedDays = Array.isArray(score.played_days) ? score.played_days.filter(Boolean) : []
  if (playedDays.length > 0) return playedDays
  if (!score.played_at) return []
  return [toDateKey(new Date(score.played_at))]
}

function getSortableTime(value?: string | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function startOfDay(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function endOfDay(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(23, 59, 59, 999)
  return nextDate
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date)
}
