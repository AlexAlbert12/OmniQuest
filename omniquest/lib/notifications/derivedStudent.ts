import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../supabase'
import type {
  AppNotification,
  EnrollmentRow,
  NotificationBuildState,
  QuestionRow,
  StudentBadgeAwardRow,
  SubjectRow,
  SubjectScoreRow,
} from './types'

export async function fetchStudentNotifications({
  userId,
  readIds,
  deletedIds,
}: {
  userId: string
  readIds: Set<string>
  deletedIds: Set<string>
}) {
  const [enrollmentsResult, scoresResult, badgeAwardsResult] = await Promise.all([
    supabase
      .from('enrollments')
      .select('subject_id, student_id, joined_at, subjects(id, name, created_at)')
      .eq('student_id', userId)
      .order('joined_at', { ascending: false }),
    supabase
      .from('subject_scores')
      .select('subject_id, student_id, max_score, correct_answers, played_days, played_at, subjects(id, name, created_at)')
      .eq('student_id', userId)
      .order('played_at', { ascending: false }),
    supabase
      .from('student_badges')
      .select('badge_id, awarded_at, reward_xp')
      .eq('student_id', userId)
      .order('awarded_at', { ascending: false })
      .limit(12),
  ])

  if (enrollmentsResult.error) throw enrollmentsResult.error
  if (scoresResult.error) throw scoresResult.error
  if (badgeAwardsResult.error) throw badgeAwardsResult.error

  const enrollments = (enrollmentsResult.data || []) as (EnrollmentRow & { subjects?: SubjectRow | SubjectRow[] | null })[]
  const scores = (scoresResult.data || []) as (SubjectScoreRow & { subjects?: SubjectRow | SubjectRow[] | null })[]
  const badgeAwards = (badgeAwardsResult.data || []) as StudentBadgeAwardRow[]
  const subjectRows = [...enrollments, ...scores]
    .map((row) => normalizeSubjectRelation(row.subjects))
    .filter((subject): subject is SubjectRow => Boolean(subject))
  const subjectsById = new Map(subjectRows.map((subject) => [subject.id, subject]))
  const enrolledSubjectIds = enrollments.map((enrollment) => enrollment.subject_id).filter((value): value is number => typeof value === 'number')
  const questionsBySubject = enrolledSubjectIds.length > 0 ? await fetchQuestionCountsBySubject(enrolledSubjectIds) : {}

  return buildStudentNotifications({
    enrollments,
    scores,
    badgeAwards,
    subjectsById,
    questionsBySubject,
    readIds,
    deletedIds,
  })
}

function buildStudentNotifications({
  enrollments,
  scores,
  badgeAwards,
  subjectsById,
  questionsBySubject,
  readIds,
  deletedIds,
}: {
  enrollments: (EnrollmentRow & { subjects?: SubjectRow | SubjectRow[] | null })[]
  scores: (SubjectScoreRow & { subjects?: SubjectRow | SubjectRow[] | null })[]
  badgeAwards: StudentBadgeAwardRow[]
  subjectsById: Map<number, SubjectRow>
  questionsBySubject: Record<number, number>
} & NotificationBuildState) {
  const nowIso = new Date().toISOString()
  const activitySubjectIds = new Set(scores.filter((score) => score.played_at).map((score) => score.subject_id).filter(Boolean))

  const classNotifications: AppNotification[] = enrollments
    .filter((enrollment) => enrollment.subject_id)
    .slice(0, 12)
    .map((enrollment) => {
      const subject = getSubjectForRow(enrollment, subjectsById)
      return {
        id: `student-class-${enrollment.subject_id}-${toStableDate(enrollment.joined_at)}`,
        type: 'new_class',
        title: 'Nueva clase disponible',
        description: `Ya puedes entrar en ${subject?.name || 'tu nueva clase'} y elegir un tema.`,
        icon: 'book-outline',
        color: '#8B5CF6',
        timestamp: enrollment.joined_at || subject?.created_at || nowIso,
        isRead: false,
        relatedId: enrollment.subject_id ?? undefined,
        subjectName: subject?.name,
        actionUrl: enrollment.subject_id ? `/(student)/class/${enrollment.subject_id}` : undefined,
      }
    })

  const activityNotifications: AppNotification[] = scores
    .filter((score) => score.subject_id && score.played_at)
    .slice(0, 14)
    .map((score) => {
      const subject = getSubjectForRow(score, subjectsById)
      return {
        id: `student-activity-${score.subject_id}-${toStableDate(score.played_at)}`,
        type: 'student_activity',
        title: 'Actividad registrada',
        description: `Has conseguido ${score.max_score ?? 0} puntos${subject ? ` en ${subject.name}` : ''}.`,
        icon: 'checkmark-circle-outline',
        color: '#34D399',
        timestamp: score.played_at || nowIso,
        isRead: false,
        relatedId: score.subject_id ?? undefined,
        subjectName: subject?.name,
        actionUrl: score.subject_id ? `/(student)/class/${score.subject_id}` : undefined,
      }
    })

  const achievementNotifications: AppNotification[] = scores
    .filter((score) => (score.max_score ?? 0) >= 500 || (score.correct_answers ?? 0) >= 25 || getPlayedDayCount(score) >= 5)
    .slice(0, 8)
    .map((score) => {
      const subject = getSubjectForRow(score, subjectsById)
      const playedDays = getPlayedDayCount(score)
      const title = playedDays >= 5 ? 'Racha en marcha' : 'Logro conseguido'
      const description = playedDays >= 5
        ? `Has jugado ${playedDays} días${subject ? ` en ${subject.name}` : ''}.`
        : `Tu progreso destaca con ${score.max_score ?? 0} puntos y ${score.correct_answers ?? 0} respuestas correctas.`

      return {
        id: `student-achievement-${score.subject_id}-${score.max_score}-${score.correct_answers ?? 0}-${playedDays}`,
        type: 'achievement',
        title,
        description,
        icon: playedDays >= 5 ? 'flame-outline' : 'trophy-outline',
        color: '#F6A64A',
        timestamp: score.played_at || nowIso,
        isRead: false,
        relatedId: score.subject_id ?? undefined,
        subjectName: subject?.name,
        actionUrl: '/(student)/badges',
      }
    })

  const badgeNotifications: AppNotification[] = badgeAwards
    .filter((award) => award.badge_id)
    .slice(0, 12)
    .map((award) => {
      const badge = getBadgeNotificationDetails(String(award.badge_id))
      const rewardXp = award.reward_xp ?? badge.rewardXp

      return {
        id: `student-badge-${award.badge_id}-${toStableDate(award.awarded_at)}`,
        type: 'achievement',
        title: 'Logro desbloqueado',
        description: rewardXp > 0
          ? `Has conseguido "${badge.title}" y ganado ${rewardXp.toLocaleString()} XP.`
          : `Has conseguido "${badge.title}".`,
        icon: badge.icon,
        color: badge.color,
        timestamp: award.awarded_at || nowIso,
        isRead: false,
        actionUrl: '/(student)/badges',
      }
    })

  const announcementNotifications: AppNotification[] = enrollments
    .filter((enrollment) => enrollment.subject_id)
    .flatMap((enrollment) => {
      const subjectId = Number(enrollment.subject_id)
      const subject = getSubjectForRow(enrollment, subjectsById)
      const items: AppNotification[] = []

      if ((questionsBySubject[subjectId] ?? 0) === 0) {
        items.push({
          id: `student-announcement-no-questions-${subjectId}`,
          type: 'announcement',
          title: 'Aviso de clase',
          description: `${subject?.name || 'Una clase'} todavía no tiene preguntas disponibles.`,
          icon: 'alert-circle-outline',
          color: '#F97316',
          timestamp: enrollment.joined_at || nowIso,
          isRead: false,
          relatedId: subjectId,
          subjectName: subject?.name,
          actionUrl: `/(student)/class/${subjectId}`,
        })
      } else if (!activitySubjectIds.has(subjectId)) {
        items.push({
          id: `student-announcement-start-${subjectId}`,
          type: 'announcement',
          title: 'Actividad pendiente',
          description: `${subject?.name || 'Una clase'} tiene preguntas listas para empezar.`,
          icon: 'radio-button-on-outline',
          color: '#58B5FF',
          timestamp: enrollment.joined_at || nowIso,
          isRead: false,
          relatedId: subjectId,
          subjectName: subject?.name,
          actionUrl: `/(student)/class/${subjectId}`,
        })
      }

      return items
    })
    .slice(0, 8)

  return [
    ...classNotifications,
    ...activityNotifications,
    ...achievementNotifications,
    ...badgeNotifications,
    ...announcementNotifications,
  ]
    .map((notification) => ({
      ...notification,
      isRead: readIds.has(notification.id),
    }))
    .filter((notification) => !deletedIds.has(notification.id))
    .sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp))
    .slice(0, 40)
}

function getBadgeNotificationDetails(badgeId: string): {
  title: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  rewardXp: number
} {
  return badgeNotificationDetails[badgeId] || {
    title: 'Nuevo logro',
    icon: 'trophy-outline',
    color: '#F6A64A',
    rewardXp: 0,
  }
}

const badgeNotificationDetails: Record<string, {
  title: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  rewardXp: number
}> = {
  'first-step': {
    title: 'Primer paso',
    icon: 'sparkles',
    color: '#58B5FF',
    rewardXp: 50,
  },
  'first-session': {
    title: 'Primera sesión',
    icon: 'play-circle',
    color: '#8B5CF6',
    rewardXp: 60,
  },
  'practice-25': {
    title: 'En marcha',
    icon: 'rocket',
    color: '#7C5CFF',
    rewardXp: 100,
  },
  'practice-100': {
    title: 'Maestro de retos',
    icon: 'trophy',
    color: '#FBBF24',
    rewardXp: 250,
  },
  'correct-50': {
    title: 'Buena puntería',
    icon: 'checkmark-circle',
    color: '#34D399',
    rewardXp: 180,
  },
  'accuracy-80': {
    title: 'Precisión brillante',
    icon: 'speedometer',
    color: '#43D991',
    rewardXp: 200,
  },
  'streak-3': {
    title: 'Constante',
    icon: 'flame',
    color: '#F97316',
    rewardXp: 100,
  },
  'streak-7': {
    title: 'Racha semanal',
    icon: 'bonfire',
    color: '#FB7185',
    rewardXp: 220,
  },
  'course-explorer': {
    title: 'Explorador de cursos',
    icon: 'map',
    color: '#38BDF8',
    rewardXp: 150,
  },
  'class-explorer': {
    title: 'Explorador de clases',
    icon: 'compass',
    color: '#34D399',
    rewardXp: 150,
  },
  'question-type-explorer': {
    title: 'Explorador de formatos',
    icon: 'shapes',
    color: '#EC4899',
    rewardXp: 120,
  },
  'xp-500': {
    title: 'Cazador de XP',
    icon: 'flash',
    color: '#FBBF24',
    rewardXp: 120,
  },
  'xp-2000': {
    title: 'Leyenda XP',
    icon: 'star',
    color: '#F59E0B',
    rewardXp: 300,
  },
}

async function fetchQuestionCountsBySubject(subjectIds: number[]) {
  const { data, error } = await supabase.from('questions').select('subject_id').in('subject_id', subjectIds)
  if (error) throw error

  return ((data || []) as QuestionRow[]).reduce<Record<number, number>>((acc, question) => {
    if (typeof question.subject_id === 'number') {
      acc[question.subject_id] = (acc[question.subject_id] || 0) + 1
    }
    return acc
  }, {})
}

function normalizeSubjectRelation(value: SubjectRow | SubjectRow[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function getSubjectForRow(
  row: { subject_id: number | null; subjects?: SubjectRow | SubjectRow[] | null },
  subjectsById: Map<number, SubjectRow>
) {
  return normalizeSubjectRelation(row.subjects) || (row.subject_id ? subjectsById.get(row.subject_id) : null)
}

function getPlayedDayCount(score: SubjectScoreRow) {
  return Array.isArray(score.played_days) ? score.played_days.filter(Boolean).length : 0
}

function toStableDate(value?: string | null) {
  return value ? value.replace(/[^0-9]/g, '').slice(0, 14) : 'sin-fecha'
}

function toTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
