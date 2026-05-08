import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

export type NotificationType = 'enrollment' | 'student_activity' | 'achievement' | 'new_class' | 'announcement'
export type NotificationAudience = 'teacher' | 'student'

export type AppNotification = {
  id: string
  type: NotificationType
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  timestamp: string
  isRead: boolean
  relatedId?: number
  subjectName?: string
  studentName?: string
  actionUrl?: string
}

type SubjectRow = {
  id: number
  name: string
  created_at?: string | null
}

type EnrollmentRow = {
  subject_id: number | null
  student_id: string | null
  joined_at?: string | null
}

type SubjectScoreRow = {
  subject_id: number | null
  student_id: string | null
  max_score: number | null
  correct_answers?: number | null
  played_days?: string[] | null
  played_at?: string | null
}

type QuestionRow = {
  subject_id: number | null
  created_at?: string | null
}

type ProfileRow = {
  id: string
  alias: string | null
}

const notificationStorageKeys: Record<NotificationAudience, { read: string; deleted: string }> = {
  teacher: {
    read: 'omniquest.teacherNotifications.read',
    deleted: 'omniquest.teacherNotifications.deleted',
  },
  student: {
    read: 'omniquest.studentNotifications.read',
    deleted: 'omniquest.studentNotifications.deleted',
  },
}

export function useNotifications(audience: NotificationAudience = 'teacher') {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  )

  useEffect(() => {
    const getSession = async () => {
      const { data: session } = await supabase.auth.getSession()
      setUserId(session?.session?.user.id || null)
      if (session?.session?.user.id) {
        const { read, deleted } = await loadNotificationStateFromDB(session.session.user.id)
        setReadIds(read)
        setDeletedIds(deleted)
      }
    }
    getSession()
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) {
        setNotifications([])
        setLoading(false)
        return
      }

      if (audience === 'student') {
        const nextNotifications = await fetchStudentNotifications({
          userId,
          readIds,
          deletedIds,
        })
        setNotifications(nextNotifications)
        setLoading(false)
        return
      }

      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, created_at')
        .eq('teacher_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (subjectsError) throw subjectsError

      const subjects = (subjectsData || []) as SubjectRow[]
      const subjectIds = subjects.map((subject) => subject.id)
      if (subjectIds.length === 0) {
        setNotifications([])
        setLoading(false)
        return
      }

      const [enrollmentsResult, scoresResult, questionsResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('subject_id, student_id, joined_at')
          .in('subject_id', subjectIds)
          .order('joined_at', { ascending: false })
          .limit(20),
        supabase
          .from('subject_scores')
          .select('subject_id, student_id, max_score, played_at')
          .in('subject_id', subjectIds)
          .not('played_at', 'is', null)
          .order('played_at', { ascending: false })
          .limit(30),
        supabase
          .from('questions')
          .select('subject_id, created_at')
          .in('subject_id', subjectIds)
          .order('created_at', { ascending: false })
          .limit(40),
      ])

      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (scoresResult.error) throw scoresResult.error
      if (questionsResult.error) throw questionsResult.error

      const enrollments = (enrollmentsResult.data || []) as EnrollmentRow[]
      const scores = (scoresResult.data || []) as SubjectScoreRow[]
      const questions = (questionsResult.data || []) as QuestionRow[]
      const studentIds = Array.from(
        new Set(
          [...enrollments.map((item) => item.student_id), ...scores.map((item) => item.student_id)]
            .filter((value): value is string => Boolean(value))
        )
      )
      const profilesById = studentIds.length > 0 ? await fetchProfilesById(studentIds) : {}

      const nextNotifications = buildTeacherNotifications({
        subjects,
        enrollments,
        scores,
        questions,
        profilesById,
        readIds,
        deletedIds,
      })

      setNotifications(nextNotifications)
      setLoading(false)
    } catch (error: any) {
      console.error('Error cargando notificaciones:', error.message)
      setNotifications(buildFallbackNotifications(readIds, deletedIds, audience))
      setLoading(false)
    }
  }, [audience, deletedIds, readIds])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = useCallback(
    async (id: string) => {
      if (!userId) return
      
      setReadIds((current) => {
        const next = new Set(current)
        next.add(id)
        return next
      })
      setNotifications((prev) =>
        prev.map((notification) => (notification.id === id ? { ...notification, isRead: true } : notification))
      )
      
      await persistNotificationStateToDb(userId, id, true, false)
    },
    [userId]
  )

  const markAllAsRead = useCallback(async () => {
    if (!userId) return
    
    setReadIds((current) => {
      const next = new Set(current)
      notifications.forEach((notification) => next.add(notification.id))
      return next
    })
    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })))
    
    // Guardar todos como leídos en la BD
    for (const notification of notifications) {
      if (!readIds.has(notification.id)) {
        await persistNotificationStateToDb(userId, notification.id, true, false)
      }
    }
  }, [notifications, readIds, userId])

  const deleteNotification = useCallback(
    async (id: string) => {
      if (!userId) return
      
      setDeletedIds((current) => {
        const next = new Set(current)
        next.add(id)
        return next
      })
      setNotifications((prev) => prev.filter((notification) => notification.id !== id))
      
      await persistNotificationStateToDb(userId, id, false, true)
    },
    [userId]
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchNotifications()
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  }
}

async function fetchStudentNotifications({
  userId,
  readIds,
  deletedIds,
}: {
  userId: string
  readIds: Set<string>
  deletedIds: Set<string>
}) {
  const [enrollmentsResult, scoresResult] = await Promise.all([
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
  ])

  if (enrollmentsResult.error) throw enrollmentsResult.error
  if (scoresResult.error) throw scoresResult.error

  const enrollments = (enrollmentsResult.data || []) as (EnrollmentRow & { subjects?: SubjectRow | SubjectRow[] | null })[]
  const scores = (scoresResult.data || []) as (SubjectScoreRow & { subjects?: SubjectRow | SubjectRow[] | null })[]
  const subjectRows = [...enrollments, ...scores]
    .map((row) => normalizeSubjectRelation(row.subjects))
    .filter((subject): subject is SubjectRow => Boolean(subject))
  const subjectsById = new Map(subjectRows.map((subject) => [subject.id, subject]))
  const enrolledSubjectIds = enrollments.map((enrollment) => enrollment.subject_id).filter((value): value is number => typeof value === 'number')
  const questionsBySubject = enrolledSubjectIds.length > 0 ? await fetchQuestionCountsBySubject(enrolledSubjectIds) : {}

  return buildStudentNotifications({
    enrollments,
    scores,
    subjectsById,
    questionsBySubject,
    readIds,
    deletedIds,
  })
}

async function fetchProfilesById(studentIds: string[]) {
  const { data, error } = await supabase.from('profiles').select('id, alias').in('id', studentIds)
  if (error) throw error

  return ((data || []) as ProfileRow[]).reduce<Record<string, ProfileRow>>((acc, profile) => {
    acc[profile.id] = profile
    return acc
  }, {})
}

function buildTeacherNotifications({
  subjects,
  enrollments,
  scores,
  questions,
  profilesById,
  readIds,
  deletedIds,
}: {
  subjects: SubjectRow[]
  enrollments: EnrollmentRow[]
  scores: SubjectScoreRow[]
  questions: QuestionRow[]
  profilesById: Record<string, ProfileRow>
  readIds: Set<string>
  deletedIds: Set<string>
}) {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]))
  const nowIso = new Date().toISOString()

  const enrollmentNotifications: AppNotification[] = enrollments
    .filter((enrollment) => enrollment.subject_id && enrollment.student_id)
    .slice(0, 10)
    .map((enrollment) => {
      const subject = subjectsById.get(Number(enrollment.subject_id))
      const studentName = getStudentName(enrollment.student_id, profilesById)
      return {
        id: `enrollment-${enrollment.subject_id}-${enrollment.student_id}-${toStableDate(enrollment.joined_at)}`,
        type: 'enrollment',
        title: 'Nueva inscripción',
        description: `${studentName} se ha unido a ${subject?.name || 'una clase'}.`,
        icon: 'person-add-outline',
        color: '#38BDF8',
        timestamp: enrollment.joined_at || nowIso,
        isRead: false,
        relatedId: Number(enrollment.subject_id),
        subjectName: subject?.name,
        studentName,
        actionUrl: enrollment.subject_id ? `/(teacher)/subject/students?subjectId=${enrollment.subject_id}` : undefined,
      }
    })

  const activityNotifications: AppNotification[] = scores
    .filter((score) => score.subject_id && score.student_id && score.played_at)
    .slice(0, 10)
    .map((score) => {
      const subject = subjectsById.get(Number(score.subject_id))
      const studentName = getStudentName(score.student_id, profilesById)
      return {
        id: `activity-${score.subject_id}-${score.student_id}-${toStableDate(score.played_at)}`,
        type: 'student_activity',
        title: 'Actividad de alumno',
        description: `${studentName} completó actividad en ${subject?.name || 'una clase'} con ${score.max_score ?? 0} XP.`,
        icon: 'checkmark-circle-outline',
        color: '#34D399',
        timestamp: score.played_at || nowIso,
        isRead: false,
        relatedId: Number(score.subject_id),
        subjectName: subject?.name,
        studentName,
        actionUrl: score.subject_id ? `/(teacher)/subject/${score.subject_id}?tab=reports` : undefined,
      }
    })

  const achievementNotifications: AppNotification[] = scores
    .filter((score) => (score.max_score ?? 0) >= 500)
    .slice(0, 6)
    .map((score) => {
      const subject = score.subject_id ? subjectsById.get(score.subject_id) : null
      const studentName = getStudentName(score.student_id, profilesById)
      return {
        id: `achievement-${score.subject_id}-${score.student_id}-${score.max_score}-${toStableDate(score.played_at)}`,
        type: 'achievement',
        title: 'Logro destacado',
        description: `${studentName} alcanzó ${score.max_score ?? 0} XP${subject ? ` en ${subject.name}` : ''}.`,
        icon: 'trophy-outline',
        color: '#F6A64A',
        timestamp: score.played_at || nowIso,
        isRead: false,
        relatedId: score.subject_id ?? undefined,
        subjectName: subject?.name,
        studentName,
        actionUrl: score.subject_id ? `/(teacher)/subject/${score.subject_id}?tab=reports` : undefined,
      }
    })

  const classNotifications: AppNotification[] = subjects
    .slice(0, 6)
    .map((subject) => ({
      id: `new-class-${subject.id}-${toStableDate(subject.created_at)}`,
      type: 'new_class',
      title: 'Clase nueva',
      description: `${subject.name} ya aparece en tu panel de clases.`,
      icon: 'book-outline',
      color: '#8B5CF6',
      timestamp: subject.created_at || nowIso,
      isRead: false,
      relatedId: subject.id,
      subjectName: subject.name,
      actionUrl: `/(teacher)/subject/${subject.id}`,
    }))

  const announcementNotifications = buildAnnouncementNotifications({ subjects, enrollments, scores, questions })

  return [
    ...enrollmentNotifications,
    ...activityNotifications,
    ...achievementNotifications,
    ...classNotifications,
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

function buildStudentNotifications({
  enrollments,
  scores,
  subjectsById,
  questionsBySubject,
  readIds,
  deletedIds,
}: {
  enrollments: (EnrollmentRow & { subjects?: SubjectRow | SubjectRow[] | null })[]
  scores: (SubjectScoreRow & { subjects?: SubjectRow | SubjectRow[] | null })[]
  subjectsById: Map<number, SubjectRow>
  questionsBySubject: Record<number, number>
  readIds: Set<string>
  deletedIds: Set<string>
}) {
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
        description: `Has conseguido ${score.max_score ?? 0} XP${subject ? ` en ${subject.name}` : ''}.`,
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
        : `Tu progreso destaca con ${score.max_score ?? 0} XP y ${score.correct_answers ?? 0} respuestas correctas.`

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

function buildAnnouncementNotifications({
  subjects,
  enrollments,
  scores,
  questions,
}: {
  subjects: SubjectRow[]
  enrollments: EnrollmentRow[]
  scores: SubjectScoreRow[]
  questions: QuestionRow[]
}) {
  const nowIso = new Date().toISOString()
  const subjectIdsWithQuestions = new Set(questions.map((question) => question.subject_id).filter(Boolean))
  const subjectIdsWithEnrollment = new Set(enrollments.map((enrollment) => enrollment.subject_id).filter(Boolean))
  const subjectIdsWithActivity = new Set(scores.map((score) => score.subject_id).filter(Boolean))
  const announcements: AppNotification[] = []

  subjects.forEach((subject) => {
    if (!subjectIdsWithQuestions.has(subject.id)) {
      announcements.push({
        id: `announcement-empty-content-${subject.id}`,
        type: 'announcement',
        title: 'Aviso de contenido',
        description: `${subject.name} todavía no tiene preguntas publicadas.`,
        icon: 'alert-circle-outline',
        color: '#F97316',
        timestamp: subject.created_at || nowIso,
        isRead: false,
        relatedId: subject.id,
        subjectName: subject.name,
        actionUrl: `/(teacher)/subject/${subject.id}?tab=questions`,
      })
    } else if (subjectIdsWithEnrollment.has(subject.id) && !subjectIdsWithActivity.has(subject.id)) {
      announcements.push({
        id: `announcement-no-activity-${subject.id}`,
        type: 'announcement',
        title: 'Aviso de participación',
        description: `${subject.name} tiene alumnos inscritos, pero aún no registra actividad.`,
        icon: 'radio-button-on-outline',
        color: '#F97316',
        timestamp: nowIso,
        isRead: false,
        relatedId: subject.id,
        subjectName: subject.name,
        actionUrl: `/(teacher)/subject/${subject.id}?tab=reports`,
      })
    }
  })

  return announcements.slice(0, 8)
}

function buildFallbackNotifications(
  readIds: Set<string>,
  deletedIds: Set<string>,
  audience: NotificationAudience
) {
  const notifications: AppNotification[] = [
    {
      id: `fallback-announcement-system-${audience}`,
      type: 'announcement',
      title: 'Aviso del sistema',
      description: 'No se pudo refrescar la bandeja. Conserva esta vista y vuelve a intentarlo en unos segundos.',
      icon: 'alert-circle-outline',
      color: '#F97316',
      timestamp: new Date().toISOString(),
      isRead: false,
    },
  ]

  return notifications
    .map((notification) => ({ ...notification, isRead: readIds.has(notification.id) }))
    .filter((notification) => !deletedIds.has(notification.id))
}

function getStudentName(studentId: string | null | undefined, profilesById: Record<string, ProfileRow>) {
  if (!studentId) return 'Un alumno'
  return profilesById[studentId]?.alias || 'Un alumno'
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

function loadStoredIds(key: string) {
  if (typeof window === 'undefined') return new Set<string>()

  try {
    const rawValue = window.localStorage.getItem(key)
    const values = rawValue ? JSON.parse(rawValue) : []
    return new Set<string>(Array.isArray(values) ? values : [])
  } catch {
    return new Set<string>()
  }
}

function persistStoredIds(key: string, values: Set<string>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(Array.from(values)))
}

async function loadNotificationStateFromDB(userId: string): Promise<{ read: Set<string>; deleted: Set<string> }> {
  try {
    const { data, error } = await supabase
      .from('notification_state')
      .select('notification_id, is_read, is_deleted')
      .eq('user_id', userId)

    if (error) throw error

    const read = new Set<string>()
    const deleted = new Set<string>()

    data?.forEach((row: any) => {
      if (row.is_read) read.add(row.notification_id)
      if (row.is_deleted) deleted.add(row.notification_id)
    })

    return { read, deleted }
  } catch (error) {
    console.error('Error loading notification state from DB:', error)
    return { read: new Set(), deleted: new Set() }
  }
}

async function persistNotificationStateToDb(
  userId: string,
  notificationId: string,
  isRead: boolean,
  isDeleted: boolean
) {
  try {
    // Usar upsert para crear o actualizar el registro
    const { error } = await supabase.from('notification_state').upsert({
      user_id: userId,
      notification_id: notificationId,
      is_read: isRead,
      is_deleted: isDeleted,
      updated_at: new Date().toISOString(),
    })

    if (error) throw error
  } catch (error) {
    console.error('Error persisting notification state to DB:', error)
  }
}
