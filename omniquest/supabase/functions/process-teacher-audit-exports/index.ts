import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, json, methodNotAllowedResponse, publicErrorResponse } from '../_shared/errors.ts'
import { csvCell } from '../_shared/csv.ts'

const BUCKET = 'teacher-audit-exports'
const PAGE_SIZE = 1000
const MAX_ROWS = 100_000
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

type ExportRequest = {
  id: string
  teacher_id: string
  filters: Record<string, unknown> | null
}

type AuditRow = {
  id: number
  action: string
  target_table: string | null
  target_id: string | null
  severity: string
  metadata: Record<string, unknown> | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  request_id: string | null
  created_at: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    const workerSecret = Deno.env.get('TEACHER_AUDIT_EXPORT_SECRET')?.trim()
    if (!supabaseUrl || !serviceRoleKey) {
      return publicErrorResponse('El exportador de auditoría no está configurado.', 500, 'service_unavailable')
    }

    const authorization = req.headers.get('Authorization') || ''
    const suppliedSecret = req.headers.get('x-cron-secret')?.trim()
    const authorized = authorization === `Bearer ${serviceRoleKey}`
      || Boolean(workerSecret && suppliedSecret === workerSecret)
    if (!authorized) return publicErrorResponse('No autorizado.', 401, 'unauthorized')

    const body = await req.json().catch(() => ({})) as { limit?: number }
    const limit = Math.max(1, Math.min(Number(body.limit) || 3, 10))
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    await expireOldExports(admin)

    const { data, error } = await admin.rpc('claim_teacher_audit_export_requests', { p_limit: limit })
    if (error) throw error
    const requests = (data || []) as ExportRequest[]
    const results: Array<{ id: string; status: string; rows?: number; error?: string }> = []

    for (const request of requests) {
      try {
        const rows = await fetchAuditRows(admin, request)
        const csv = buildCsv(rows, exportLocale(request.filters))
        const path = `${request.teacher_id}/${request.id}.csv`
        const { error: uploadError } = await admin.storage.from(BUCKET).upload(
          path,
          new Blob([csv], { type: 'text/csv;charset=utf-8' }),
          { contentType: 'text/csv;charset=utf-8', upsert: true },
        )
        if (uploadError) throw uploadError

        const { error: completeError } = await admin.rpc('complete_teacher_audit_export', {
          p_request_id: request.id,
          p_status: 'ready',
          p_object_path: path,
          p_row_count: rows.length,
          p_error_message: null,
        })
        if (completeError) throw completeError
        results.push({ id: request.id, status: 'ready', rows: rows.length })
      } catch (requestError) {
        const message = sanitizeError(requestError)
        await admin.rpc('complete_teacher_audit_export', {
          p_request_id: request.id,
          p_status: 'failed',
          p_object_path: null,
          p_row_count: null,
          p_error_message: message,
        })
        results.push({ id: request.id, status: 'failed', error: message })
      }
    }

    return json({ ok: true, processed: requests.length, results })
  } catch (error) {
    return errorResponse(error, 'No se pudieron procesar las exportaciones de auditoría.', {
      functionName: 'process-teacher-audit-exports',
    })
  }
})

async function fetchAuditRows(admin: ReturnType<typeof createClient>, request: ExportRequest): Promise<AuditRow[]> {
  const filters = request.filters || {}
  const rows: AuditRow[] = []

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    let query = admin
      .from('teacher_audit_logs')
      .select('id, action, target_table, target_id, severity, metadata, before_state, after_state, request_id, created_at')
      .eq('teacher_id', request.teacher_id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    const category = stringFilter(filters.category)
    const search = stringFilter(filters.search)
    const action = stringFilter(filters.action)
    const targetTable = stringFilter(filters.targetTable)
    const severity = stringFilter(filters.severity)
    const from = stringFilter(filters.from)
    const to = stringFilter(filters.to)

    if (action) query = query.eq('action', action)
    if (targetTable) query = query.eq('target_table', targetTable)
    if (severity) query = query.eq('severity', severity)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lt('created_at', to)
    const categoryExpression = buildCategoryExpression(category)
    if (categoryExpression) query = query.or(categoryExpression)

    const { data, error } = await query
    if (error) throw error
    const page = (data || []) as AuditRow[]
    rows.push(...(search ? page.filter((row) => auditRowMatchesSearch(row, search)) : page))
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

function buildCategoryExpression(category: string | null) {
  if (category === 'student') return 'target_table.in.(enrollments,subject_scores,topic_scores),action.ilike.teacher.student.%'
  if (category === 'question') return 'target_table.in.(questions,answers),action.ilike.%question%'
  if (category === 'subject') return 'target_table.in.(subjects,subject_topics),action.ilike.%subject%,action.ilike.%course%,action.ilike.%topic%'
  if (category === 'code') return 'target_table.eq.classrooms,action.ilike.%code%'
  if (category === 'profile') return 'action.ilike.teacher.profile.%'
  return null
}

function auditRowMatchesSearch(row: AuditRow, search: string) {
  const haystack = [
    row.action,
    row.target_table || '',
    row.target_id || '',
    JSON.stringify(sanitizeAuditObject(row.metadata || {})),
    JSON.stringify(effectiveState(row.before_state, row.metadata, ['before', 'old', 'previous'])),
    JSON.stringify(effectiveState(row.after_state, row.metadata, ['after', 'new', 'next'])),
  ].join(' ').toLocaleLowerCase('es-ES')
  return haystack.includes(search.toLocaleLowerCase('es-ES'))
}

async function expireOldExports(admin: ReturnType<typeof createClient>) {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('teacher_audit_export_requests')
    .select('id, object_path')
    .eq('status', 'ready')
    .lte('expires_at', now)
    .limit(100)
  if (error) throw error

  const paths = (data || [])
    .map((item) => typeof item.object_path === 'string' ? item.object_path : null)
    .filter((path): path is string => Boolean(path))
  if (paths.length) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove(paths)
    if (removeError) throw removeError
  }

  const ids = (data || []).map((item) => item.id)
  if (ids.length) {
    const { error: updateError } = await admin
      .from('teacher_audit_export_requests')
      .update({ status: 'expired', object_path: null, updated_at: now })
      .in('id', ids)
    if (updateError) throw updateError
  }
}

function buildCsv(rows: AuditRow[], locale: 'es-ES' | 'en-US') {
  const headers = locale === 'en-US'
    ? ['Date', 'Severity', 'Action', 'Item', 'Identifier', 'Before', 'After', 'Action code', 'Entity code', 'Audit record ID', 'Request ID']
    : ['Fecha', 'Severidad', 'Acción', 'Elemento', 'Identificador', 'Antes', 'Después', 'Código de acción', 'Código de entidad', 'ID de registro', 'ID de petición']
  const content = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => [
      new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.created_at)),
      severityLabel(row.severity, locale),
      actionLabel(row.action, locale),
      entityLabel(row.target_table, locale),
      row.target_id || '',
      formatAuditState(effectiveState(row.before_state, row.metadata, ['before', 'old', 'previous']), locale),
      formatAuditState(effectiveState(row.after_state, row.metadata, ['after', 'new', 'next']), locale),
      row.action,
      row.target_table || '',
      row.id,
      row.request_id || '',
    ].map(csvCell).join(',')),
  ].join('\n')
  return `\uFEFF${content}`
}

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
  'teacher.profile.delete_teaching_data': 'Teaching data deleted',
  'teacher.profile.reset_all': 'Teaching data reset',
}
const ENTITY_LABELS_ES: Record<string, string> = { subjects: 'Curso', subject_topics: 'Tema', questions: 'Pregunta', answers: 'Respuesta', classrooms: 'Clase', enrollments: 'Matrícula', profiles: 'Usuario', subject_scores: 'Progreso del curso', topic_scores: 'Progreso del tema' }
const ENTITY_LABELS_EN: Record<string, string> = { subjects: 'Course', subject_topics: 'Topic', questions: 'Question', answers: 'Answer', classrooms: 'Class', enrollments: 'Enrolment', profiles: 'User', subject_scores: 'Course progress', topic_scores: 'Topic progress' }
const FIELD_LABELS_ES: Record<string, string> = { id: 'Identificador', name: 'Nombre', title: 'Título', icon: 'Icono', sort_order: 'Orden', available_until: 'Disponible hasta', education_level: 'Nivel educativo', academic_year: 'Año académico', subject_label: 'Materia', theme_color: 'Color del curso', active: 'Estado', is_archived: 'Archivado', subject_id: 'Curso', classroom_id: 'Clase', student_id: 'Alumno' }
const FIELD_LABELS_EN: Record<string, string> = { id: 'Identifier', name: 'Name', title: 'Title', icon: 'Icon', sort_order: 'Order', available_until: 'Available until', education_level: 'Education level', academic_year: 'Academic year', subject_label: 'Subject', theme_color: 'Course colour', active: 'Status', is_archived: 'Archived', subject_id: 'Course', classroom_id: 'Class', student_id: 'Student' }
const SENSITIVE_AUDIT_KEYS = new Set(['password','password_hash','current_password','new_password','token','access_token','refresh_token','secret','service_role','authorization','email','phone','submitted_answer_text','submitted_answer_payload','answer','body','message','content','ip_address','user_agent','description','note','notes','comment','comments','feedback','free_text','question_text','question_prompt','prompt','response_text','code','previous_code','next_code','invite_code','access_code'])

function exportLocale(filters: Record<string, unknown> | null): 'es-ES' | 'en-US' {
  return filters?.locale === 'en-US' ? 'en-US' : 'es-ES'
}

function actionLabel(action: string, locale: 'es-ES' | 'en-US') {
  return (locale === 'en-US' ? ACTION_LABELS_EN : ACTION_LABELS_ES)[action] || (locale === 'en-US' ? 'Recorded activity' : 'Actividad registrada')
}

function entityLabel(targetTable: string | null, locale: 'es-ES' | 'en-US') {
  if (!targetTable) return locale === 'en-US' ? 'System' : 'Sistema'
  return (locale === 'en-US' ? ENTITY_LABELS_EN : ENTITY_LABELS_ES)[targetTable] || (locale === 'en-US' ? 'Item' : 'Elemento')
}

function severityLabel(severity: string, locale: 'es-ES' | 'en-US') {
  if (locale === 'en-US') return severity === 'critical' ? 'Critical' : severity === 'warning' ? 'Warning' : 'Informational'
  return severity === 'critical' ? 'Crítica' : severity === 'warning' ? 'Advertencia' : 'Informativa'
}

function effectiveState(primary: Record<string, unknown> | null, metadata: Record<string, unknown> | null, fallbacks: string[]) {
  if (primary && Object.keys(primary).length) return sanitizeAuditObject(primary)
  for (const key of fallbacks) {
    const candidate = metadata?.[key]
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) return sanitizeAuditObject(candidate as Record<string, unknown>)
  }
  return {}
}

function sanitizeAuditObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE_AUDIT_KEYS.has(key.toLowerCase())).map(([key, item]) => [key, sanitizeAuditValue(item)]))
}

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue)
  if (value && typeof value === 'object') return sanitizeAuditObject(value as Record<string, unknown>)
  return value
}

function formatAuditState(state: Record<string, unknown>, locale: 'es-ES' | 'en-US') {
  const fields = locale === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_ES
  return Object.entries(state).map(([key, value]) => `${fields[key] || humanField(key)}: ${formatAuditValue(key, value, locale)}`).join(' | ')
}

function formatAuditValue(key: string, value: unknown, locale: 'es-ES' | 'en-US') {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') {
    if (key === 'active') return locale === 'en-US' ? (value ? 'Active' : 'Inactive') : (value ? 'Activo' : 'Inactivo')
    return locale === 'en-US' ? (value ? 'Yes' : 'No') : (value ? 'Sí' : 'No')
  }
  if (typeof value === 'string' && (key.endsWith('_at') || key.endsWith('_until') || key.includes('date'))) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date)
  }
  if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? JSON.stringify(item) : String(item ?? '—')).join(', ')
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function humanField(value: string) {
  const text = value.replaceAll('_', ' ')
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

function stringFilter(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/(token|secret|password|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]').slice(0, 500)
}
