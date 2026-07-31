import { exportCsvFile, formatExportDateTime, slugifyFilename, type CsvValue } from './reportExports'
import { supabase } from './supabase'
import type { Database } from '../types/database.types'

type PageRow = { total_count?: number | null }

type PublicFunctions = Database['public']['Functions']
type AdminPagedRpcName =
  | 'get_admin_profiles_page'
  | 'get_admin_subjects_page'
  | 'get_admin_classrooms_page'

type AdminPagedRpcArgs<Name extends AdminPagedRpcName> = Omit<
  PublicFunctions[Name]['Args'],
  'p_limit' | 'p_offset'
>
type AdminPagedRpcRow<Name extends AdminPagedRpcName> =
  PublicFunctions[Name]['Returns'] extends Array<infer Row> ? Row & PageRow : never

const EXPORT_PAGE_SIZE = 100
const MAX_EXPORT_ROWS = 10000

async function fetchAllRpcRows<Name extends AdminPagedRpcName>(
  functionName: Name,
  filters: AdminPagedRpcArgs<Name>,
): Promise<AdminPagedRpcRow<Name>[]> {
  const rows: AdminPagedRpcRow<Name>[] = []
  let offset = 0
  let total = Number.POSITIVE_INFINITY

  while (offset < total && rows.length < MAX_EXPORT_ROWS) {
    const args = {
      ...filters,
      p_limit: EXPORT_PAGE_SIZE,
      p_offset: offset,
    } as PublicFunctions[Name]['Args']
    const { data, error } = await supabase.rpc(functionName, args)

    if (error) throw error

    const page = (Array.isArray(data) ? data : []) as unknown as AdminPagedRpcRow<Name>[]
    if (page.length === 0) break

    rows.push(...page)
    total = Number(page[0]?.total_count ?? rows.length)
    offset += page.length

    if (page.length < EXPORT_PAGE_SIZE) break
  }

  return rows.slice(0, MAX_EXPORT_ROWS)
}


async function fetchAllRpcRowsUntyped(functionName: string, filters: Record<string, unknown>): Promise<Array<Record<string, any> & PageRow>> {
  const rows: Array<Record<string, any> & PageRow> = []
  let offset = 0
  let total = Number.POSITIVE_INFINITY
  while (offset < total && rows.length < MAX_EXPORT_ROWS) {
    const { data, error } = await (supabase.rpc(functionName as any, { ...filters, p_limit: EXPORT_PAGE_SIZE, p_offset: offset }) as any)
    if (error) throw error
    const page = Array.isArray(data) ? data as Array<Record<string, any> & PageRow> : []
    if (page.length === 0) break
    rows.push(...page)
    total = Number(page[0]?.total_count ?? rows.length)
    offset += page.length
    if (page.length < EXPORT_PAGE_SIZE) break
  }
  return rows.slice(0, MAX_EXPORT_ROWS)
}

function datedFilename(prefix: string) {
  return `${slugifyFilename(prefix)}_${new Date().toISOString().slice(0, 10)}.csv`
}

export async function exportAdminProfiles({
  role,
  search,
  subjectId = null,
  classroomId = null,
  profileId = null,
  active = null,
  activityState = null,
  createdFrom = null,
  createdTo = null,
}: {
  role: 'teacher' | 'student'
  search: string
  subjectId?: number | null
  classroomId?: number | null
  profileId?: string | null
  active?: boolean | null
  activityState?: string | null
  createdFrom?: string | null
  createdTo?: string | null
}) {
  const rows = await fetchAllRpcRows('get_admin_profiles_page', {
    p_role: role,
    p_search: search.trim(),
    p_subject_id: subjectId ?? undefined,
    p_classroom_id: classroomId ?? undefined,
    p_profile_id: profileId ?? undefined,
    p_active: active ?? undefined,
    p_activity_state: activityState ?? undefined,
    p_created_from: createdFrom ?? undefined,
    p_created_to: createdTo ?? undefined,
  })

  return exportCsvFile(
    datedFilename(`omniquest-${role === 'teacher' ? 'profesores' : 'alumnos'}`),
    ['ID', 'Alias', 'Correo', 'Rol', 'Estado', 'Actividad', 'Última actividad', 'Cursos', 'Inscripciones', 'Creado'],
    rows.map((row) => [
      row.id,
      row.alias,
      row.email,
      row.role_id,
      row.active === false ? 'Inactivo' : 'Activo',
      row.activity_state,
      formatExportDateTime(row.last_activity_at),
      row.subject_count ?? 0,
      row.enrollment_count ?? 0,
      formatExportDateTime(row.created_at),
    ]),
  )
}

export async function exportAdminSubjects({
  search,
  teacherId = null,
  archived = null,
  active = null,
  createdFrom = null,
  createdTo = null,
}: {
  search: string
  teacherId?: string | null
  archived?: boolean | null
  active?: boolean | null
  createdFrom?: string | null
  createdTo?: string | null
}) {
  const rows = await fetchAllRpcRows('get_admin_subjects_page', {
    p_search: search.trim(),
    p_teacher_id: teacherId ?? undefined,
    p_archived: archived ?? undefined,
    p_active: active ?? undefined,
    p_created_from: createdFrom ?? undefined,
    p_created_to: createdTo ?? undefined,
  })

  return exportCsvFile(
    datedFilename('omniquest-cursos'),
    ['ID', 'Curso', 'Profesor', 'Correo profesor', 'Estado', 'Archivado', 'Clases', 'Alumnos', 'Última actividad', 'Incidencias', 'Revisiones pendientes', 'Clases inactivas', 'Clases sin código', 'Creado'],
    rows.map((row) => [
      row.id,
      row.name,
      row.teacher_alias,
      row.teacher_email,
      row.active === false ? 'Inactivo' : 'Activo',
      row.is_archived ? 'Sí' : 'No',
      row.classes_count ?? 0,
      row.enrollments_count ?? 0,
      formatExportDateTime(row.last_activity_at),
      row.incidents_count ?? 0,
      row.pending_reviews_count ?? 0,
      row.inactive_classrooms_count ?? 0,
      row.missing_code_count ?? 0,
      formatExportDateTime(row.created_at),
    ]),
  )
}

export async function exportAdminClassrooms({
  search,
  subjectId = null,
  studentId = null,
  teacherId = null,
  active = null,
  createdFrom = null,
  createdTo = null,
}: {
  search: string
  subjectId?: number | null
  studentId?: string | null
  teacherId?: string | null
  active?: boolean | null
  createdFrom?: string | null
  createdTo?: string | null
}) {
  const rows = await fetchAllRpcRows('get_admin_classrooms_page', {
    p_search: search.trim(),
    p_subject_id: subjectId ?? undefined,
    p_student_id: studentId ?? undefined,
    p_teacher_id: teacherId ?? undefined,
    p_active: active ?? undefined,
    p_created_from: createdFrom ?? undefined,
    p_created_to: createdTo ?? undefined,
  })

  return exportCsvFile(
    datedFilename('omniquest-clases'),
    ['ID', 'Clase', 'Curso', 'Profesor', 'Correo profesor', 'Código', 'Estado', 'Alumnos', 'Última actividad', 'Incidencias', 'Revisiones pendientes', 'Creada'],
    rows.map((row) => [
      row.id,
      row.name,
      row.subject_name,
      row.teacher_alias,
      row.teacher_email,
      row.code,
      row.active === false ? 'Inactiva' : 'Activa',
      row.enrollments_count ?? 0,
      formatExportDateTime(row.last_activity_at),
      row.incidents_count ?? 0,
      row.pending_reviews_count ?? 0,
      formatExportDateTime(row.created_at),
    ]),
  )
}

export async function exportAdminAudit(filters: {
  search: string
  actorId?: string | null
  action?: string | null
  targetTable?: string | null
  targetId?: string | null
  from?: string | null
  to?: string | null
  severity?: string | null
}) {
  const rows = await fetchAllRpcRowsUntyped('get_admin_audit_logs_page_secured', {
    p_search: filters.search.trim() || undefined,
    p_actor_id: filters.actorId || undefined,
    p_action: filters.action || undefined,
    p_target_table: filters.targetTable || undefined,
    p_target_id: filters.targetId || undefined,
    p_from: filters.from || undefined,
    p_to: filters.to || undefined,
    p_severity: filters.severity || undefined,
  })

  return exportCsvFile(
    datedFilename('omniquest-auditoria'),
    ['ID', 'Actor', 'Correo actor', 'Acción', 'Entidad', 'Objetivo', 'Severidad', 'Metadata', 'Fecha'],
    rows.map((row) => [
      row.id,
      row.actor_alias,
      row.actor_email,
      row.action,
      row.target_table,
      row.target_id,
      row.severity,
      JSON.stringify(row.metadata || {}),
      formatExportDateTime(row.created_at),
    ]),
  )
}

export async function exportAdminSupport(filters: {
  search: string
  status?: string | null
  priority?: string | null
  role?: string | null
}) {
  const rows = await fetchAllRpcRowsUntyped('get_admin_support_tickets_page_secured', {
    p_search: filters.search.trim() || undefined,
    p_status: filters.status || undefined,
    p_priority: filters.priority || undefined,
    p_role: filters.role || undefined,
  })

  return exportCsvFile(
    datedFilename('omniquest-soporte'),
    ['ID', 'Usuario', 'Correo', 'Rol', 'Categoría', 'Asunto', 'Mensaje', 'Prioridad', 'Estado', 'Respuesta admin', 'Creado', 'Actualizado'],
    rows.map((row) => [
      row.id,
      row.user_alias,
      row.user_email || row.contact_email,
      row.role,
      row.category,
      row.subject,
      row.message,
      row.priority,
      row.status,
      row.admin_response,
      formatExportDateTime(row.created_at),
      formatExportDateTime(row.updated_at),
    ] as CsvValue[]),
  )
}
