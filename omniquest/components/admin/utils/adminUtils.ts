import { Alert, Platform } from 'react-native'
import type { DesignColorTokens } from '../../../lib/designTokens'
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

export function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`)
    return
  }
  Alert.alert(title, message)
}

export async function runAdminExport(setExporting: (value: boolean) => void, task: () => Promise<boolean>) {
  setExporting(true)
  try {
    const exported = await task()
    if (!exported) showAlert('Exportación no disponible', 'No se pudo abrir el diálogo para guardar o compartir el archivo.')
  } catch (error: any) {
    showAlert('No se pudo exportar', error?.message || 'Revisa la conexión y vuelve a intentarlo.')
  } finally {
    setExporting(false)
  }
}

export function confirmAction(title: string, message: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
  ])
}

export function confirmActionAsync(title: string, message: string) {
  return new Promise<boolean>((resolve) => {
    if (Platform.OS === 'web') {
      resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false)
      return
    }
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  })
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
    studentsWithoutActivity: 0,
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

export function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export function getNumericParam(value: string | string[] | undefined) {
  const parsed = Number(getSearchParam(value))
  return Number.isFinite(parsed) ? parsed : null
}

export function getAdminAuditSeverity(action: string) {
  if (/delete|remove|critical|student\.delete_progress/i.test(action)) return 'critical'
  if (/deactivate|archive|reset_password|reset|transfer/i.test(action)) return 'warning'
  return 'info'
}

export function getAdminAuditSeverityMeta(severity: string, tokens: DesignColorTokens) {
  if (severity === 'critical') return { label: 'Crítica', icon: 'alert-circle' as IconName, color: tokens.semantic.danger, background: tokens.semanticSurface.danger }
  if (severity === 'warning') return { label: 'Advertencia', icon: 'warning' as IconName, color: tokens.semantic.warning, background: tokens.semanticSurface.warning }
  return { label: 'Informativa', icon: 'information-circle' as IconName, color: tokens.semantic.info, background: tokens.semanticSurface.info }
}

export function getAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    'admin.user.activate': 'Usuario activado',
    'admin.user.deactivate': 'Usuario desactivado',
    'admin.user.reset_password': 'Contraseña restablecida',
    'admin.student.delete_progress': 'Progreso eliminado',
    'admin.course.archive': 'Curso archivado',
    'admin.course.restore': 'Curso restaurado',
    'admin.course.transfer': 'Curso transferido',
    'admin.classroom.activate': 'Clase activada',
    'admin.classroom.deactivate': 'Clase desactivada',
    'admin.bulk.execute': 'Operación por lotes',
  }
  return labels[action] || action.replace(/[._-]+/g, ' ')
}

export function getAuditTargetLabel(log: AdminAuditLogRow) {
  if (!log.target_table) return 'Sistema'
  const tableLabels: Record<string, string> = { profiles: 'Usuario', subjects: 'Curso', classrooms: 'Clase', admin_export_jobs: 'Exportación' }
  const label = tableLabels[log.target_table] || log.target_table
  return log.target_id ? `${label} · ${log.target_id}` : label
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
    home: 'shield-checkmark', teachers: 'school', students: 'people', courses: 'book', classrooms: 'albums', support: 'headset', audit: 'receipt', users: 'people', content: 'book', more: 'ellipsis-horizontal-circle', profile: 'person-circle', settings: 'settings',
  }
  return icons[section]
}

export function filledIconFor(icon: IconName): IconName {
  return icon.endsWith('-outline') ? icon.replace('-outline', '') as IconName : icon
}
