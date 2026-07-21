import { exportCsvFile, formatExportDateTime, slugifyFilename, type CsvValue } from './reportExports'
import { supabase } from './supabase'

type PageRow = { total_count?: number | null }

type ExportFilters = Record<string, unknown>

const EXPORT_PAGE_SIZE = 100
const MAX_EXPORT_ROWS = 10000

async function fetchAllRpcRows<T extends PageRow>(functionName: string, filters: ExportFilters): Promise<T[]> {
  const rows: T[] = []
  let offset = 0
  let total = Number.POSITIVE_INFINITY

  while (offset < total && rows.length < MAX_EXPORT_ROWS) {
    const { data, error } = await (supabase.rpc as any)(functionName, {
      ...filters,
      p_limit: EXPORT_PAGE_SIZE,
      p_offset: offset,
    })

    if (error) throw error

    const page = (data || []) as T[]
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
}: {
  role: 'teacher' | 'student'
  search: string
  subjectId?: number | null
  classroomId?: number | null
  profileId?: string | null
}) {
  const rows = await fetchAllRpcRows<any>('get_admin_profiles_page', {
    p_role: role,
    p_search: search.trim(),
    p_subject_id: subjectId,
    p_classroom_id: classroomId,
    p_profile_id: profileId,
  })

  return exportCsvFile(
    datedFilename(`omniquest-${role === 'teacher' ? 'profesores' : 'alumnos'}`),
    ['ID', 'Alias', 'Correo', 'Rol', 'Estado', 'Cursos', 'Inscripciones', 'Creado'],
    rows.map((row) => [
      row.id,
      row.alias,
      row.email,
      row.role_id,
      row.active === false ? 'Inactivo' : 'Activo',
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
}: {
  search: string
  teacherId?: string | null
  archived?: boolean | null
}) {
  const rows = await fetchAllRpcRows<any>('get_admin_subjects_page', {
    p_search: search.trim(),
    p_teacher_id: teacherId,
    p_archived: archived,
  })

  return exportCsvFile(
    datedFilename('omniquest-cursos'),
    ['ID', 'Curso', 'Profesor', 'Correo profesor', 'Estado', 'Archivado', 'Clases', 'Inscripciones', 'Creado'],
    rows.map((row) => [
      row.id,
      row.name,
      row.teacher_alias,
      row.teacher_email,
      row.active === false ? 'Inactivo' : 'Activo',
      row.is_archived ? 'Sí' : 'No',
      row.classes_count ?? 0,
      row.enrollments_count ?? 0,
      formatExportDateTime(row.created_at),
    ]),
  )
}

export async function exportAdminClassrooms({
  search,
  subjectId = null,
  studentId = null,
}: {
  search: string
  subjectId?: number | null
  studentId?: string | null
}) {
  const rows = await fetchAllRpcRows<any>('get_admin_classrooms_page', {
    p_search: search.trim(),
    p_subject_id: subjectId,
    p_student_id: studentId,
  })

  return exportCsvFile(
    datedFilename('omniquest-clases'),
    ['ID', 'Clase', 'Curso', 'Código', 'Estado', 'Alumnos', 'Creada'],
    rows.map((row) => [
      row.id,
      row.name,
      row.subject_name,
      row.code,
      row.active === false ? 'Inactiva' : 'Activa',
      row.enrollments_count ?? 0,
      formatExportDateTime(row.created_at),
    ]),
  )
}

export async function exportAdminAudit(search: string) {
  const rows = await fetchAllRpcRows<any>('get_admin_audit_logs_page', {
    p_search: search.trim() || null,
  })

  return exportCsvFile(
    datedFilename('omniquest-auditoria'),
    ['ID', 'Admin ID', 'Acción', 'Tabla', 'Objetivo', 'Metadata', 'Fecha'],
    rows.map((row) => [
      row.id,
      row.admin_id,
      row.action,
      row.target_table,
      row.target_id,
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
  const rows = await fetchAllRpcRows<any>('get_admin_support_tickets_page', {
    p_search: filters.search.trim() || null,
    p_status: filters.status || null,
    p_priority: filters.priority || null,
    p_role: filters.role || null,
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
