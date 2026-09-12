import type { TeacherAuditLog } from './teacherAudit'

type AuditLocale = 'es-ES' | 'en-US'

const ACTION_LABELS_ES: Record<string, string> = {
  'teacher.topic.create': 'Tema creado',
  'teacher.topic.update': 'Tema actualizado',
  'teacher.topic.archive': 'Tema archivado',
  'teacher.subject.update': 'Curso actualizado',
  'teacher.subject.archive': 'Curso archivado',
  'teacher.subject.restore': 'Curso restaurado',
  'teacher.subject.regenerate_code': 'Código del curso regenerado',
  'teacher.classroom.regenerate_code': 'Código de clase regenerado',
  'teacher.question.archive': 'Pregunta archivada',
  'teacher.student.note.add': 'Nota docente añadida',
  'teacher.student.reset_progress': 'Progreso del alumno reiniciado',
  'teacher.student.remove_from_class': 'Alumno eliminado de la clase',
  'teacher.student.password_recovery_requested': 'Recuperación de acceso solicitada',
  'teacher.profile.avatar.update': 'Imagen de perfil actualizada',
  'teacher.profile.avatar.clear': 'Imagen de perfil eliminada',
  'teacher.profile.reset_scores': 'Puntuaciones reiniciadas',
  'teacher.profile.reset_preferences': 'Preferencias docentes reiniciadas',
  'teacher.profile.delete_teaching_data': 'Datos docentes eliminados',
  'teacher.profile.reset_all': 'Datos docentes reiniciados',
}

const ACTION_LABELS_EN: Record<string, string> = {
  'teacher.topic.create': 'Topic created',
  'teacher.topic.update': 'Topic updated',
  'teacher.topic.archive': 'Topic archived',
  'teacher.subject.update': 'Course updated',
  'teacher.subject.archive': 'Course archived',
  'teacher.subject.restore': 'Course restored',
  'teacher.subject.regenerate_code': 'Course code regenerated',
  'teacher.classroom.regenerate_code': 'Class code regenerated',
  'teacher.question.archive': 'Question archived',
  'teacher.student.note.add': 'Teacher note added',
  'teacher.student.reset_progress': 'Student progress reset',
  'teacher.student.remove_from_class': 'Student removed from class',
  'teacher.student.password_recovery_requested': 'Access recovery requested',
  'teacher.profile.avatar.update': 'Profile image updated',
  'teacher.profile.avatar.clear': 'Profile image removed',
  'teacher.profile.reset_scores': 'Scores reset',
  'teacher.profile.reset_preferences': 'Teacher preferences reset',
  'teacher.profile.delete_teaching_data': 'Teaching data deleted',
  'teacher.profile.reset_all': 'Teaching data reset',
}

const ENTITY_LABELS_ES: Record<string, string> = {
  subjects: 'Curso',
  subject_topics: 'Tema',
  questions: 'Pregunta',
  answers: 'Respuesta',
  classrooms: 'Clase',
  enrollments: 'Matrícula',
  profiles: 'Usuario',
  subject_scores: 'Progreso del curso',
  topic_scores: 'Progreso del tema',
}

const ENTITY_LABELS_EN: Record<string, string> = {
  subjects: 'Course',
  subject_topics: 'Topic',
  questions: 'Question',
  answers: 'Answer',
  classrooms: 'Class',
  enrollments: 'Enrolment',
  profiles: 'User',
  subject_scores: 'Course progress',
  topic_scores: 'Topic progress',
}

const FIELD_LABELS_ES: Record<string, string> = {
  id: 'Identificador',
  name: 'Nombre',
  title: 'Título',
  description: 'Descripción',
  icon: 'Icono',
  sort_order: 'Orden',
  available_until: 'Disponible hasta',
  education_level: 'Nivel educativo',
  academic_year: 'Año académico',
  subject_label: 'Materia',
  theme_color: 'Color del curso',
  active: 'Estado',
  is_archived: 'Archivado',
  archive_reason: 'Motivo de archivo',
  archived_at: 'Fecha de archivo',
  retention_until: 'Conservación hasta',
  subject_id: 'Curso',
  classroom_id: 'Clase',
  student_id: 'Alumno',
}

const FIELD_LABELS_EN: Record<string, string> = {
  id: 'Identifier',
  name: 'Name',
  title: 'Title',
  description: 'Description',
  icon: 'Icon',
  sort_order: 'Order',
  available_until: 'Available until',
  education_level: 'Education level',
  academic_year: 'Academic year',
  subject_label: 'Subject',
  theme_color: 'Course colour',
  active: 'Status',
  is_archived: 'Archived',
  archive_reason: 'Archive reason',
  archived_at: 'Archived at',
  retention_until: 'Retained until',
  subject_id: 'Course',
  classroom_id: 'Class',
  student_id: 'Student',
}

export function getTeacherAuditActionLabel(action: string, locale: AuditLocale = 'es-ES') {
  return labelsFor(locale, ACTION_LABELS_ES, ACTION_LABELS_EN)[action] || fallbackActionLabel(action, locale)
}

export function getTeacherAuditEntityLabel(targetTable: string | null, locale: AuditLocale = 'es-ES') {
  if (!targetTable) return locale === 'en-US' ? 'System' : 'Sistema'
  return labelsFor(locale, ENTITY_LABELS_ES, ENTITY_LABELS_EN)[targetTable] || (locale === 'en-US' ? 'Item' : 'Elemento')
}

export function getTeacherAuditSeverityLabel(severity: string, locale: AuditLocale = 'es-ES') {
  if (locale === 'en-US') return severity === 'critical' ? 'Critical' : severity === 'warning' ? 'Warning' : 'Informational'
  return severity === 'critical' ? 'Crítica' : severity === 'warning' ? 'Advertencia' : 'Informativa'
}

export function getTeacherAuditFieldLabel(field: string, locale: AuditLocale = 'es-ES') {
  return labelsFor(locale, FIELD_LABELS_ES, FIELD_LABELS_EN)[field] || sentenceCase(field.replaceAll('_', ' '))
}

export function getTeacherAuditElementDescription(item: TeacherAuditLog, locale: AuditLocale = 'es-ES') {
  const metadata = item.metadata || {}
  const beforeState = effectiveState(item.before_state, metadata, ['previous', 'before', 'old'])
  const afterState = effectiveState(item.after_state, metadata, ['next', 'after', 'new'])
  const targetId = item.target_id ? `#${item.target_id}` : ''
  const english = locale === 'en-US'

  if (item.target_table === 'subject_topics') {
    const title = firstText(afterState.title, beforeState.title, metadata.title)
    const subjectName = firstText(metadata.subject_name)
    return joinDescription(title || `${english ? 'Topic' : 'Tema'} ${targetId}`.trim(), subjectName)
  }
  if (item.target_table === 'subjects') {
    const name = firstText(afterState.name, beforeState.name, metadata.subject_name, metadata.name)
    return name || `${english ? 'Course' : 'Curso'} ${targetId}`.trim()
  }
  if (item.target_table === 'classrooms') {
    const classroomName = firstText(metadata.classroom_name, metadata.name)
    const subjectName = firstText(metadata.subject_name)
    return joinDescription(classroomName || `${english ? 'Class' : 'Clase'} ${targetId}`.trim(), subjectName)
  }
  if (item.target_table === 'questions') return firstText(metadata.title, metadata.question_title) || `${english ? 'Question' : 'Pregunta'} ${targetId}`.trim()
  if (item.target_table === 'answers') return `${english ? 'Answer' : 'Respuesta'} ${targetId}`.trim()
  if (item.target_table === 'profiles') {
    if (item.action.startsWith('teacher.profile.')) return english ? 'Teacher profile' : 'Perfil docente'
    const alias = firstText(metadata.student_alias, metadata.alias, metadata.student_name, metadata.name)
    return alias || `${english ? 'Student' : 'Alumno'} ${targetId}`.trim()
  }
  if (item.target_table === 'enrollments') return `${english ? 'Enrolment' : 'Matrícula'} ${targetId}`.trim()
  if (item.target_table === 'subject_scores') return `${english ? 'Course progress' : 'Progreso del curso'} ${targetId}`.trim()
  if (item.target_table === 'topic_scores') return `${english ? 'Topic progress' : 'Progreso del tema'} ${targetId}`.trim()
  return `${getTeacherAuditEntityLabel(item.target_table, locale)} ${targetId}`.trim()
}

export function getTeacherAuditEffectiveBeforeState(item: TeacherAuditLog) {
  return effectiveState(item.before_state, item.metadata || {}, ['previous', 'before', 'old'])
}

export function getTeacherAuditEffectiveAfterState(item: TeacherAuditLog) {
  return effectiveState(item.after_state, item.metadata || {}, ['next', 'after', 'new'])
}

export function formatTeacherAuditValue(field: string, value: unknown, locale: AuditLocale = 'es-ES') {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') {
    if (field === 'active') return locale === 'en-US' ? (value ? 'Active' : 'Inactive') : (value ? 'Activo' : 'Inactivo')
    return locale === 'en-US' ? (value ? 'Yes' : 'No') : (value ? 'Sí' : 'No')
  }
  if (typeof value === 'string' && isDateField(field)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  }
  if (Array.isArray(value)) return value.map((item) => formatScalar(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function effectiveState(primary: Record<string, unknown> | null | undefined, metadata: Record<string, unknown>, fallbacks: string[]) {
  if (primary && Object.keys(primary).length) return primary
  for (const key of fallbacks) {
    const candidate = metadata[key]
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) return candidate as Record<string, unknown>
  }
  return {}
}

function firstText(...values: unknown[]) {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function joinDescription(primary: string, secondary: string | null) {
  return secondary ? `${primary} · ${secondary}` : primary
}

function fallbackActionLabel(action: string, locale: AuditLocale) {
  const parts = action.replace(/^teacher\./, '').split('.').filter(Boolean)
  const entityEs: Record<string, string> = { topic: 'Tema', subject: 'Curso', classroom: 'Clase', question: 'Pregunta', student: 'Alumno', profile: 'Perfil' }
  const entityEn: Record<string, string> = { topic: 'Topic', subject: 'Course', classroom: 'Class', question: 'Question', student: 'Student', profile: 'Profile' }
  const operationEs: Record<string, string> = { create: 'creado', update: 'actualizado', archive: 'archivado', restore: 'restaurado', delete: 'eliminado', reset: 'reiniciado', clear: 'eliminado' }
  const operationEn: Record<string, string> = { create: 'created', update: 'updated', archive: 'archived', restore: 'restored', delete: 'deleted', reset: 'reset', clear: 'removed' }
  const operationKey = parts.length ? parts[parts.length - 1] : null
  const entity = parts[0] ? (locale === 'en-US' ? entityEn : entityEs)[parts[0]] : null
  const operation = operationKey ? (locale === 'en-US' ? operationEn : operationEs)[operationKey] : null
  if (entity && operation) return `${entity} ${operation}`
  return locale === 'en-US' ? 'Recorded activity' : 'Actividad registrada'
}

function labelsFor(locale: AuditLocale, es: Record<string, string>, en: Record<string, string>) {
  return locale === 'en-US' ? en : es
}

function sentenceCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function isDateField(field: string) {
  return field.endsWith('_at') || field.endsWith('_until') || field.includes('date')
}

function formatScalar(value: unknown) {
  if (value === null || value === undefined) return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
