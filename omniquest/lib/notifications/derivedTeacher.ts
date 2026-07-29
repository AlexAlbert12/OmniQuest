import { supabase } from '../supabase'
import type { AppNotification, EnrollmentRow, NotificationBuildState, ProfileRow, QuestionRow, SubjectRow, SubjectScoreRow } from './types'

export async function fetchTeacherNotifications({
  userId,
  readIds,
  deletedIds,
}: {
  userId: string
  readIds: Set<string>
  deletedIds: Set<string>
}) {
  const { data: subjectsData, error: subjectsError } = await supabase
    .from('subjects')
    .select('id, name, created_at')
    .eq('teacher_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (subjectsError) throw subjectsError

  const subjects = (subjectsData || []) as SubjectRow[]
  const subjectIds = subjects.map((subject) => subject.id)
  if (subjectIds.length === 0) return []

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

  return buildTeacherNotifications({
    subjects,
    enrollments,
    scores,
    questions,
    profilesById,
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
} & NotificationBuildState) {
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

function toStableDate(value?: string | null) {
  return value ? value.replace(/[^0-9]/g, '').slice(0, 14) : 'sin-fecha'
}

function toTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
