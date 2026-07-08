import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import type { Database, Json, Tables } from '../types/database.types'

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
  source?: 'database' | 'derived'
}

type PersistentNotificationRow = Tables<'notifications'>
type PersistentNotificationUpdate = Database['public']['Tables']['notifications']['Update']
type NotificationPreferenceRow = Tables<'user_notification_preferences'>

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

type StudentBadgeAwardRow = {
  badge_id: string | null
  awarded_at: string | null
  reward_xp: number | null
}

type QuestionRow = {
  subject_id: number | null
  created_at?: string | null
}

type ProfileRow = {
  id: string
  alias: string | null
}

type AudienceState = {
  notifications: AppNotification[]
  loading: boolean
  error: string | null
}

type NotificationPreferenceState = {
  activityEnabled: boolean
  newsEnabled: boolean
}

const defaultNotificationPreferences: NotificationPreferenceState = {
  activityEnabled: true,
  newsEnabled: false,
}

type NotificationContextValue = {
  getAudienceState: (audience: NotificationAudience) => AudienceState
  refresh: (audience: NotificationAudience) => Promise<void>
  markAsRead: (audience: NotificationAudience, id: string) => Promise<void>
  markAllAsRead: (audience: NotificationAudience) => Promise<void>
  deleteNotification: (audience: NotificationAudience, id: string) => Promise<void>
  clearError: (audience: NotificationAudience) => void
}

const emptyAudienceState: AudienceState = {
  notifications: [],
  loading: true,
  error: null,
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [audienceState, setAudienceState] = useState<Record<NotificationAudience, AudienceState>>({
    teacher: emptyAudienceState,
    student: emptyAudienceState,
  })
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const syncUser = async (nextUserId: string | null) => {
      if (!isMounted) return

      setUserId(nextUserId)

      if (nextUserId) {
        let read = new Set<string>()
        let deleted = new Set<string>()

        try {
          const state = await loadNotificationStateFromDB(nextUserId)
          read = state.read
          deleted = state.deleted
        } catch (error) {
          console.error('Error cargando estado inicial de notificaciones:', error)
        }

        if (!isMounted) return

        setReadIds(read)
        setDeletedIds(deleted)
      } else {
        setReadIds(new Set())
        setDeletedIds(new Set())
        setAudienceState({
          teacher: { notifications: [], loading: false, error: null },
          student: { notifications: [], loading: false, error: null },
        })
      }
    }

    const syncInitialSession = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        await syncUser(session.session?.user.id || null)
      } catch (error) {
        console.error('Error sincronizando sesión para notificaciones:', error)
        await syncUser(null)
      }
    }

    void syncInitialSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user.id || null)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const setAudienceLoading = useCallback((audience: NotificationAudience, loading: boolean) => {
    setAudienceState((current) => ({
      ...current,
      [audience]: {
        ...current[audience],
        loading,
        error: loading ? null : current[audience].error,
      },
    }))
  }, [])

  const setAudienceNotifications = useCallback((audience: NotificationAudience, notifications: AppNotification[]) => {
    setAudienceState((current) => ({
      ...current,
      [audience]: {
        notifications,
        loading: false,
        error: null,
      },
    }))
  }, [])

  const setAudienceError = useCallback((audience: NotificationAudience, error: string) => {
    setAudienceState((current) => ({
      ...current,
      [audience]: {
        ...current[audience],
        loading: false,
        error,
      },
    }))
  }, [])

  const fetchNotifications = useCallback(async (audience: NotificationAudience) => {
    setAudienceLoading(audience, true)

    try {
      if (!userId) {
        setAudienceNotifications(audience, [])
        return
      }

      const { read: latestRead, deleted: latestDeleted } = await loadNotificationStateFromDB(userId)
      setReadIds(latestRead)
      setDeletedIds(latestDeleted)

      const preferences = await loadNotificationPreferences(userId)
      const persistentNotifications = filterNotificationsByPreferences(
        await fetchPersistentNotifications({ userId, audience }),
        preferences
      )

      if (audience === 'student') {
        const derivedNotifications = filterNotificationsByPreferences(
          await fetchStudentNotifications({
            userId,
            readIds: latestRead,
            deletedIds: latestDeleted,
          }),
          preferences
        )
        setAudienceNotifications(audience, mergeNotificationSources(persistentNotifications, derivedNotifications))
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
        setAudienceNotifications(audience, [])
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

      const derivedNotifications = filterNotificationsByPreferences(
        buildTeacherNotifications({
          subjects,
          enrollments,
          scores,
          questions,
          profilesById,
          readIds: latestRead,
          deletedIds: latestDeleted,
        }),
        preferences
      )

      setAudienceNotifications(audience, mergeNotificationSources(persistentNotifications, derivedNotifications))
    } catch (error: any) {
      console.error('Error cargando notificaciones:', error.message)
      setAudienceError(
        audience,
        'No se pudieron cargar las notificaciones. Revisa tu conexión o vuelve a iniciar sesión.'
      )
    }
  }, [setAudienceError, setAudienceLoading, setAudienceNotifications, userId])

  useEffect(() => {
    if (!userId) return
    void fetchNotifications('teacher')
    void fetchNotifications('student')
  }, [fetchNotifications, userId])

  const markAsRead = useCallback(
    async (_audience: NotificationAudience, id: string) => {
      if (!userId) return

      setReadIds((current) => {
        const next = new Set(current)
        next.add(id)
        return next
      })

      setAudienceState((current) => markNotificationReadInState(current, id))
      try {
        const dbNotificationId = getDatabaseNotificationId(id)
        if (dbNotificationId) {
          await updatePersistentNotificationState(dbNotificationId, { read: true })
        } else {
          await persistNotificationStateToDb(userId, id, { isRead: true, isDeleted: deletedIds.has(id) })
        }
      } catch (error) {
        console.error('Error marcando notificación como leída:', error)
      }
    },
    [deletedIds, setAudienceError, userId]
  )

  const markAllAsRead = useCallback(async (audience: NotificationAudience) => {
    if (!userId) return

    const notifications = audienceState[audience].notifications
    const unreadNotifications = notifications.filter((notification) => !notification.isRead)
    if (unreadNotifications.length === 0) return

    setReadIds((current) => {
      const next = new Set(current)
      unreadNotifications.forEach((notification) => next.add(notification.id))
      return next
    })

    setAudienceState((current) => markAllAudienceNotificationsReadInState(current, audience))

    try {
      for (const notification of unreadNotifications) {
        const dbNotificationId = getDatabaseNotificationId(notification.id)
        if (dbNotificationId) {
          await updatePersistentNotificationState(dbNotificationId, { read: true })
        } else {
          await persistNotificationStateToDb(userId, notification.id, {
            isRead: true,
            isDeleted: deletedIds.has(notification.id),
          })
        }
      }
    } catch (error) {
      console.error('Error marcando todas las notificaciones como leídas:', error)
    }
  }, [audienceState, deletedIds, setAudienceError, userId])

  const deleteNotification = useCallback(
    async (_audience: NotificationAudience, id: string) => {
      if (!userId) return

      setDeletedIds((current) => {
        const next = new Set(current)
        next.add(id)
        return next
      })

      setAudienceState((current) => deleteNotificationFromState(current, id))
      try {
        const dbNotificationId = getDatabaseNotificationId(id)
        if (dbNotificationId) {
          await updatePersistentNotificationState(dbNotificationId, { deleted: true })
        } else {
          await persistNotificationStateToDb(userId, id, { isRead: readIds.has(id), isDeleted: true })
        }
      } catch (error) {
        console.error('Error eliminando notificación:', error)
      }
    },
    [readIds, setAudienceError, userId]
  )

  const refresh = useCallback(async (audience: NotificationAudience) => {
    await fetchNotifications(audience)
  }, [fetchNotifications])

  const clearError = useCallback((audience: NotificationAudience) => {
    setAudienceState((current) => ({
      ...current,
      [audience]: {
        ...current[audience],
        error: null,
      },
    }))
  }, [])

  const value = useMemo<NotificationContextValue>(() => ({
    getAudienceState: (audience) => audienceState[audience] || emptyAudienceState,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearError,
  }), [audienceState, clearError, deleteNotification, markAllAsRead, markAsRead, refresh])

  return createElement(NotificationContext.Provider, { value }, children)
}

export function useNotifications(audience: NotificationAudience = 'teacher') {
  const context = useContext(NotificationContext)

  if (!context) {
    throw new Error('useNotifications debe usarse dentro de NotificationProvider')
  }

  const {
    clearError: clearAudienceError,
    deleteNotification: deleteAudienceNotification,
    getAudienceState,
    markAllAsRead: markAllAudienceAsRead,
    markAsRead: markAudienceAsRead,
    refresh: refreshAudience,
  } = context
  const { notifications, loading, error } = getAudienceState(audience)
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  )
  const markAsRead = useCallback(
    (id: string) => markAudienceAsRead(audience, id),
    [audience, markAudienceAsRead]
  )
  const deleteNotification = useCallback(
    (id: string) => deleteAudienceNotification(audience, id),
    [audience, deleteAudienceNotification]
  )
  const markAllAsRead = useCallback(
    () => markAllAudienceAsRead(audience),
    [audience, markAllAudienceAsRead]
  )
  const refresh = useCallback(
    () => refreshAudience(audience),
    [audience, refreshAudience]
  )
  const clearError = useCallback(
    () => clearAudienceError(audience),
    [audience, clearAudienceError]
  )

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    clearError,
  }
}

function markNotificationReadInState(
  current: Record<NotificationAudience, AudienceState>,
  notificationId: string
) {
  return mapAudienceNotifications(current, (notification) =>
    notification.id === notificationId ? { ...notification, isRead: true } : notification
  )
}

function markAllAudienceNotificationsReadInState(
  current: Record<NotificationAudience, AudienceState>,
  audience: NotificationAudience
) {
  return {
    ...current,
    [audience]: {
      ...current[audience],
      notifications: current[audience].notifications.map((notification) => ({ ...notification, isRead: true })),
    },
  }
}

function deleteNotificationFromState(
  current: Record<NotificationAudience, AudienceState>,
  notificationId: string
) {
  return {
    teacher: {
      ...current.teacher,
      notifications: current.teacher.notifications.filter((notification) => notification.id !== notificationId),
    },
    student: {
      ...current.student,
      notifications: current.student.notifications.filter((notification) => notification.id !== notificationId),
    },
  }
}

function mapAudienceNotifications(
  current: Record<NotificationAudience, AudienceState>,
  mapper: (notification: AppNotification) => AppNotification
) {
  return {
    teacher: {
      ...current.teacher,
      notifications: current.teacher.notifications.map(mapper),
    },
    student: {
      ...current.student,
      notifications: current.student.notifications.map(mapper),
    },
  }
}


async function fetchPersistentNotifications({
  userId,
  audience,
}: {
  userId: string
  audience: NotificationAudience
}): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, audience, type, title, description, icon, color, created_at, read_at, action_url, related_id, metadata')
      .eq('user_id', userId)
      .eq('audience', audience)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(60)

    if (error) throw error

    return ((data || []) as PersistentNotificationRow[])
      .filter((row) => isNotificationType(row.type))
      .map((row) => {
        const type = row.type as NotificationType
        const metadata = getNotificationMetadata(row.metadata)

        return {
          id: `db:${row.id}`,
          type,
          title: row.title,
          description: row.description,
          icon: getSafeNotificationIcon(row.icon),
          color: row.color || getNotificationTypeColor(type),
          timestamp: row.created_at || new Date().toISOString(),
          isRead: Boolean(row.read_at),
          relatedId: row.related_id && /^\d+$/.test(row.related_id) ? Number(row.related_id) : undefined,
          subjectName: typeof metadata.subject_name === 'string' ? metadata.subject_name : undefined,
          studentName: typeof metadata.student_name === 'string' ? metadata.student_name : undefined,
          actionUrl: row.action_url || undefined,
          source: 'database' as const,
        }
      })
  } catch (error: any) {
    // Si la migración nueva aún no está aplicada, mantenemos las notificaciones derivadas.
    if (String(error?.message || '').includes('notifications')) {
      return []
    }
    console.error('Error cargando notificaciones persistentes:', error)
    return []
  }
}

function mergeNotificationSources(persistent: AppNotification[], derived: AppNotification[]) {
  const seen = new Set<string>()

  return [...persistent, ...derived.map((notification) => ({ ...notification, source: 'derived' as const }))]
    .filter((notification) => {
      const key = [notification.type, notification.title, notification.description, notification.actionUrl || ''].join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp))
    .slice(0, 60)
}

function getDatabaseNotificationId(id: string) {
  return id.startsWith('db:') ? id.slice(3) : null
}

async function updatePersistentNotificationState(id: string, state: { read?: boolean; deleted?: boolean }) {
  const payload: PersistentNotificationUpdate = { updated_at: new Date().toISOString() }

  if (state.read) payload.read_at = new Date().toISOString()
  if (state.deleted) payload.deleted_at = new Date().toISOString()

  const { error } = await supabase
    .from('notifications')
    .update(payload)
    .eq('id', id)

  if (error) throw error
}

function getNotificationMetadata(value: Json | null): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function isNotificationType(value: string): value is NotificationType {
  return ['enrollment', 'student_activity', 'achievement', 'new_class', 'announcement'].includes(value)
}

function getSafeNotificationIcon(icon: string | null | undefined): keyof typeof Ionicons.glyphMap {
  if (icon && icon in Ionicons.glyphMap) return icon as keyof typeof Ionicons.glyphMap
  return 'notifications-outline'
}

function getNotificationTypeColor(type: NotificationType) {
  if (type === 'enrollment') return '#8B5CF6'
  if (type === 'student_activity') return '#43D991'
  if (type === 'achievement') return '#F6A64A'
  if (type === 'new_class') return '#58B5FF'
  return '#F97316'
}


async function loadNotificationPreferences(userId: string): Promise<NotificationPreferenceState> {
  try {
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('activity_enabled, news_enabled')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    const preferences = data as Pick<NotificationPreferenceRow, 'activity_enabled' | 'news_enabled'> | null

    return {
      activityEnabled: preferences?.activity_enabled ?? defaultNotificationPreferences.activityEnabled,
      newsEnabled: preferences?.news_enabled ?? defaultNotificationPreferences.newsEnabled,
    }
  } catch (error) {
    console.error('Error cargando preferencias de notificaciones:', error)
    return defaultNotificationPreferences
  }
}

function filterNotificationsByPreferences(
  notifications: AppNotification[],
  preferences: NotificationPreferenceState
) {
  return notifications.filter((notification) => shouldShowNotificationForPreferences(notification, preferences))
}

function shouldShowNotificationForPreferences(
  notification: AppNotification,
  preferences: NotificationPreferenceState
) {
  const category = getNotificationPreferenceCategory(notification)

  if (category === 'activity') return preferences.activityEnabled
  if (category === 'news') return preferences.newsEnabled

  return true
}

function getNotificationPreferenceCategory(notification: AppNotification): 'activity' | 'news' | 'system' {
  if (notification.type === 'announcement') return 'news'
  if (['enrollment', 'student_activity', 'achievement', 'new_class'].includes(notification.type)) return 'activity'
  return 'system'
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
        actionUrl: enrollment.subject_id ? `/(teacher)/students?subjectId=${enrollment.subject_id}` : undefined,
      }
    })

  const activityNotifications: AppNotification[] = scores
    .filter((score) => score.subject_id && score.student_id && score.played_at)
    .slice(0, 10)
    .map((score) => {
      const subject = subjectsById.get(Number(score.subject_id))
      const studentName = getStudentName(score.student_id, profilesById)
      const scoreValue = score.max_score ?? 0
      const isHighlighted = scoreValue >= 500

      return {
        id: `activity-${score.subject_id}-${score.student_id}-${toStableDate(score.played_at)}`,
        type: 'student_activity',
        title: isHighlighted ? 'Actividad destacada' : 'Actividad de alumno',
        description: `${studentName} completó una actividad en ${subject?.name || 'una clase'} con ${scoreValue} puntos.`,
        icon: isHighlighted ? 'trending-up-outline' : 'checkmark-circle-outline',
        color: isHighlighted ? '#F6A64A' : '#34D399',
        timestamp: score.played_at || nowIso,
        isRead: false,
        relatedId: Number(score.subject_id),
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
      title: 'Curso nuevo',
      description: `${subject.name} ya aparece en tu panel de cursos.`,
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
    throw error
  }
}

async function persistNotificationStateToDb(
  userId: string,
  notificationId: string,
  state: { isRead: boolean; isDeleted: boolean }
) {
  try {
    const now = new Date().toISOString()
    const { data: existingRows, error: selectError } = await supabase
      .from('notification_state')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_id', notificationId)
      .limit(1)

    if (selectError) throw selectError

    const existingId = existingRows?.[0]?.id

    if (typeof existingId === 'number') {
      const { error: updateError } = await supabase
        .from('notification_state')
        .update({
          is_read: state.isRead,
          is_deleted: state.isDeleted,
          updated_at: now,
        })
        .eq('id', existingId)

      if (updateError) throw updateError
      return
    }

    const { error: insertError } = await supabase
      .from('notification_state')
      .insert({
        user_id: userId,
        notification_id: notificationId,
        is_read: state.isRead,
        is_deleted: state.isDeleted,
        updated_at: now,
      })

    if (insertError) throw insertError
  } catch (error) {
    console.error('Error persisting notification state to DB:', error)
    throw error
  }
}
