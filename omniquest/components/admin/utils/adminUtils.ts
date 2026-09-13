import type { DesignColorTokens } from '../../../lib/designTokens'
import type { AppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage } from '../../../lib/typeGuards'
import { getTeacherAuditActionLabel } from '../../../lib/teacherAuditPresentation'
import type {
  AdminAuditLogRow,
  AdminDashboardMetrics,
  AdminSection,
  AdminSupportTicketRow,
  ClassroomRow,
  EnrollmentRow,
  IconName,
  ProfileRow,
  SubjectRow,
} from '../types/admin'

export async function runAdminExport(feedback: Pick<AppFeedback, 'error' | 'warning'>, setExporting: (value: boolean) => void, task: () => Promise<boolean>) {
  setExporting(true)
  try {
    const exported = await task()
    if (!exported) feedback.warning('Exportación no disponible', 'No se pudo abrir el diálogo para guardar o compartir el archivo.')
  } catch (error: unknown) {
    feedback.error('No se pudo exportar', getErrorMessage(error, 'Revisa la conexión y vuelve a intentarlo.'))
  } finally {
    setExporting(false)
  }
}

export function getFallbackAdminMetrics({ classrooms, enrollments, profiles, subjects }: {
  classrooms: ClassroomRow[]
  enrollments: EnrollmentRow[]
  profiles: ProfileRow[]
  subjects: SubjectRow[]
}): AdminDashboardMetrics {
  const subjectIdsWithClassrooms = new Set(classrooms.map((classroom) => classroom.subject_id).filter((id): id is number => typeof id === 'number'))
  return {
    totalProfiles: profiles.length,
    teachersCount: profiles.filter((profile) => profile.role_id === 'teacher').length,
    studentsCount: profiles.filter((profile) => profile.role_id === 'student' || profile.role_id === 'guest').length,
    subjectsCount: subjects.length,
    classroomsCount: classrooms.length,
    enrollmentsCount: enrollments.length,
    activeCourses: subjects.filter((subject) => subject.active !== false && !subject.is_archived).length,
    archivedCourses: subjects.filter((subject) => subject.is_archived).length,
    activeClassrooms: classrooms.filter((classroom) => classroom.active !== false).length,
    inactiveUsers: profiles.filter((profile) => profile.active === false).length,
    coursesWithoutClassrooms: subjects.filter((subject) => !subjectIdsWithClassrooms.has(subject.id)).length,
    inactiveStudents: 0,
    classroomsWithoutCode: classrooms.filter((classroom) => !classroom.code).length,
  }
}

export function normalizeAdminMetrics(value: unknown, fallback: AdminDashboardMetrics): AdminDashboardMetrics {
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Partial<Record<keyof AdminDashboardMetrics, unknown>>
  return Object.fromEntries((Object.keys(fallback) as (keyof AdminDashboardMetrics)[]).map((key) => {
    const numberValue = typeof raw[key] === 'number' ? raw[key] as number : fallback[key]
    return [key, Number.isFinite(numberValue) ? numberValue : fallback[key]]
  })) as AdminDashboardMetrics
}

export function getSupportStatusLabel(status: AdminSupportTicketRow['status']) {
  if (status === 'in_progress') return 'En curso'
  if (status === 'resolved') return 'Resuelto'
  if (status === 'closed') return 'Cerrado'
  return 'Abierto'
}

export function getSupportPriorityLabel(priority: AdminSupportTicketRow['priority']) {
  if (priority === 'high') return 'Alta'
  if (priority === 'low') return 'Baja'
  return 'Media'
}

export function formatAdminCount(count: number, singular: string, plural = `${singular}s`) { return `${count} ${count === 1 ? singular : plural}` }

export function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export function getNumericParam(value: string | string[] | undefined) {
  const parsed = Number(getSearchParam(value))
  return Number.isFinite(parsed) ? parsed : null
}

export function getAdminAuditSeverity(action: string) {
  if (/delete|remove|revoke|critical|student\.delete_progress/i.test(action)) return 'critical'
  if (/deactivate|archive|reset_password|reset|transfer/i.test(action)) return 'warning'
  return 'info'
}

export function getAdminAuditSeverityMeta(severity: string, tokens: DesignColorTokens) {
  if (severity === 'critical') return { label: 'Crítica', icon: 'alert-circle' as IconName, color: tokens.semantic.danger, background: tokens.semanticSurface.danger }
  if (severity === 'warning') return { label: 'Advertencia', icon: 'warning' as IconName, color: tokens.semantic.warning, background: tokens.semanticSurface.warning }
  return { label: 'Informativa', icon: 'information-circle' as IconName, color: tokens.semantic.info, background: tokens.semanticSurface.info }
}

const ADMIN_AUDIT_ACTION_LABELS: Record<string, string> = {
  'admin.user.activate': 'Usuario activado',
  'admin.user.deactivate': 'Usuario desactivado',
  'admin.user.reset_password': 'Contraseña restablecida',
  'admin.user.invite': 'Administrador invitado',
  'admin.student.delete_progress': 'Progreso eliminado',
  'admin.teacher.create': 'Profesor creado',
  'admin.teacher.update_existing': 'Profesor existente actualizado',
  'admin.course.archive': 'Curso archivado',
  'admin.course.restore': 'Curso restaurado',
  'admin.course.transfer': 'Curso transferido',
  'admin.course.delete': 'Curso eliminado',
  'admin.classroom.activate': 'Clase activada',
  'admin.classroom.deactivate': 'Clase desactivada',
  'admin.support.update': 'Ticket de soporte actualizado',
  'admin.role.assign': 'Rol administrativo actualizado',
  'admin.role.revoke': 'Acceso administrativo retirado',
  'admin.bulk.execute': 'Operación por lotes',
  'admin.notification.send': 'Notificación push enviada',
  'admin.notification.retry': 'Notificación push reintentada',
  'admin.notification.cancel': 'Envío push cancelado',
  'admin.notification.process_now': 'Procesamiento push solicitado',
}

const ADMIN_AUDIT_TARGET_LABELS: Record<string, string> = {
  profiles: 'Usuario', subjects: 'Curso', subject_topics: 'Tema', questions: 'Pregunta', answers: 'Respuesta', classrooms: 'Clase', enrollments: 'Matrícula', subject_scores: 'Progreso del curso', topic_scores: 'Progreso del tema', attempt_history: 'Intento', game_attempts: 'Partida', student_badges: 'Logro', user_support_tickets: 'Ticket de soporte', admin_export_jobs: 'Exportación', admin_role_assignments: 'Rol administrativo', notifications: 'Notificación', notification_delivery_queue: 'Entrega push', teacher_audit_logs: 'Actividad docente', admin_audit_logs: 'Actividad administrativa',
}

export function getAuditActionLabel(action: string) {
  if (action.startsWith('teacher.')) return getTeacherAuditActionLabel(action)
  const known = ADMIN_AUDIT_ACTION_LABELS[action]
  if (known) return known
  const value = action.replace(/^admin\./, '').replace(/[._-]+/g, ' ').trim()
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Actividad administrativa'
}

export function getAuditTargetTypeLabel(targetTable?: string | null) {
  if (!targetTable) return 'Sistema'
  if (targetTable === 'user_support_tickets') return 'Soporte'
  if (targetTable === 'admin_role_assignments') return 'Permisos'
  return ADMIN_AUDIT_TARGET_LABELS[targetTable] || targetTable.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

export function getAuditTargetReferenceLabel(log: AdminAuditLogRow) {
  const type = getAuditTargetTypeLabel(log.target_table)
  if (!log.target_id) return type
  const reference = formatAuditReference(log.target_id)
  if (log.target_table === 'notification_delivery_queue') return `Envío ${reference}`
  if (log.target_table === 'user_support_tickets') return `Ticket ${reference}`
  return `${type} · ${reference}`
}

export function getAuditTargetLabel(log: AdminAuditLogRow) { return getAuditTargetReferenceLabel(log) }

function formatAuditReference(value: string) {
  if (/^\d+$/.test(value)) return `#${value}`
  if (value.length > 18) return `…${value.slice(-12)}`
  return value
}

export function stringMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : null
}

export function formatAuditDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatAdminDate(value?: string | null) {
  if (!value) return 'Nunca'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Nunca' : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export function buildTeacherProfileFromSubject(subject: SubjectRow): ProfileRow | undefined {
  if (!subject.teacher_id) return undefined
  return {
    id: subject.teacher_id,
    alias: subject.teacher_alias || 'Profesor sin alias',
    email: subject.teacher_email || null,
    role_id: 'teacher',
    active: true,
    created_at: subject.created_at || new Date(0).toISOString(),
  }
}

export function buildSubjectFromClassroom(classroom: ClassroomRow): SubjectRow | undefined {
  if (!classroom.subject_id) return undefined
  return {
    id: classroom.subject_id,
    name: classroom.subject_name || 'Curso sin nombre',
    teacher_id: classroom.teacher_id || null,
    active: true,
    is_archived: false,
    created_at: classroom.created_at,
    teacher_alias: classroom.teacher_alias,
    teacher_email: classroom.teacher_email,
  }
}

export function getInitials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A'
}

export function getAdminSectionIcon(section: AdminSection): IconName {
  const icons: Record<AdminSection, IconName> = {
    home: 'shield-checkmark', teachers: 'school', students: 'people', courses: 'book', classrooms: 'albums', support: 'headset', audit: 'receipt', users: 'people', content: 'book', more: 'ellipsis-horizontal-circle', profile: 'person-circle', security: 'shield-checkmark', exports: 'cloud-download', permissions: 'key', push: 'notifications',
  }
  return icons[section]
}

export function filledIconFor(icon: IconName): IconName {
  return icon.endsWith('-outline') ? icon.replace('-outline', '') as IconName : icon
}
