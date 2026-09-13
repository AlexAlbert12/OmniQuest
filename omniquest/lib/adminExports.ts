import { exportBinaryFile, exportCsvFile, formatExportDateTime, slugifyFilename, type CsvValue } from './reportExports'
import { buildXlsxWorkbook, type XlsxCell, type XlsxSheet } from './xlsxWriter'
import { supabase } from './supabase'
import type { Database } from '../types/database.types'
import type { AdminAuditLogRow, AdminSupportTicketRow } from '../components/admin/types/admin'

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

type DynamicRpcResponse = { data: unknown; error: { message: string } | null }
type DynamicRpcClient = { rpc: (functionName: string, args: Record<string, unknown>) => PromiseLike<DynamicRpcResponse> }

const EXPORT_PAGE_SIZE = 100
const MAX_EXPORT_ROWS = 10000
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

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

async function fetchAllRpcRowsUntyped<T extends PageRow>(functionName: string, filters: Record<string, unknown>): Promise<T[]> {
  const rows: T[] = []
  let offset = 0
  let total = Number.POSITIVE_INFINITY
  const dynamicClient = supabase as unknown as DynamicRpcClient

  while (offset < total && rows.length < MAX_EXPORT_ROWS) {
    const response = await dynamicClient.rpc(functionName, { ...filters, p_limit: EXPORT_PAGE_SIZE, p_offset: offset })
    if (response.error) throw response.error
    const page = Array.isArray(response.data) ? response.data as T[] : []
    if (page.length === 0) break
    rows.push(...page)
    total = Number(page[0]?.total_count ?? rows.length)
    if (total > MAX_EXPORT_ROWS) throw new Error(`La exportación directa admite hasta ${MAX_EXPORT_ROWS.toLocaleString('es-ES')} registros. Aplica filtros para reducir el resultado.`)
    offset += page.length
    if (page.length < EXPORT_PAGE_SIZE) break
  }

  return rows.slice(0, MAX_EXPORT_ROWS)
}

function datedFilename(prefix: string, extension = 'csv') {
  return `${slugifyFilename(prefix)}_${new Date().toISOString().slice(0, 10)}.${extension}`
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
  subjectId = null,
  teacherId = null,
  archived = null,
  active = null,
  createdFrom = null,
  createdTo = null,
}: {
  search: string
  subjectId?: number | null
  teacherId?: string | null
  archived?: boolean | null
  active?: boolean | null
  createdFrom?: string | null
  createdTo?: string | null
}) {
  const rows = await fetchAllRpcRows('get_admin_subjects_page', {
    p_search: search.trim(),
    p_subject_id: subjectId ?? undefined,
    p_teacher_id: teacherId ?? undefined,
    p_archived: archived ?? undefined,
    p_active: active ?? undefined,
    p_created_from: createdFrom ?? undefined,
    p_created_to: createdTo ?? undefined,
  })

  return exportCsvFile(
    datedFilename('omniquest-cursos'),
    ['ID', 'Curso', 'Profesor', 'Correo profesor', 'Estado', 'Archivado', 'Clases', 'Alumnos', 'Última actividad', 'Alertas', 'Revisiones pendientes', 'Clases inactivas', 'Clases sin código', 'Creado'],
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
    ['ID', 'Clase', 'Curso', 'Profesor', 'Correo profesor', 'Código', 'Estado', 'Alumnos', 'Última actividad', 'Alertas', 'Revisiones pendientes', 'Creada'],
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
  const rows = await fetchAllRpcRowsUntyped<AdminAuditLogRow>('get_admin_audit_logs_page_secured', {
    p_search: filters.search.trim() || undefined,
    p_actor_id: filters.actorId || undefined,
    p_action: filters.action || undefined,
    p_target_table: filters.targetTable || undefined,
    p_target_id: filters.targetId || undefined,
    p_from: filters.from || undefined,
    p_to: filters.to || undefined,
    p_severity: filters.severity || undefined,
  })

  const headerRow = 6
  const sheet: XlsxSheet = {
    name: 'Auditoría',
    rows: [
      [{ value: 'OmniQuest — Registro de auditoría', style: 'title' }],
      [{ value: 'Generado', style: 'label' }, { value: new Date(), style: 'datetime' }],
      [{ value: 'Registros exportados', style: 'label' }, { value: rows.length, style: 'integer' }],
      [{ value: 'Filtros activos', style: 'label' }, { value: describeAuditFilters(filters), style: 'wrap' }],
      [],
      auditHeaders().map((value) => ({ value, style: 'header' as const })),
      ...rows.map(buildAuditRow),
    ],
    columnWidths: [10, 10, 19, 24, 30, 30, 22, 24, 15, 42, 42, 42, 19, 44, 44],
    freezeRows: headerRow,
    autoFilter: { fromRow: headerRow, toRow: headerRow + rows.length, toColumn: auditHeaders().length },
    merges: [`A1:${columnLetter(auditHeaders().length)}1`],
  }

  return exportBinaryFile(datedFilename('OmniQuest_Auditoria', 'xlsx'), buildXlsxWorkbook([sheet]), XLSX_MIME)
}

export async function exportAdminSupport(filters: {
  search: string
  status?: string | null
  priority?: string | null
  role?: string | null
  assignedAdminId?: string | null
  tag?: string | null
  slaState?: string | null
}) {
  const rows = await fetchAllRpcRowsUntyped<AdminSupportTicketRow>('get_admin_support_tickets_page_secured', {
    p_search: filters.search.trim() || undefined,
    p_status: filters.status || undefined,
    p_priority: filters.priority || undefined,
    p_role: filters.role || undefined,
    p_assigned_admin_id: filters.assignedAdminId || undefined,
    p_tag: filters.tag || undefined,
    p_sla_state: filters.slaState || undefined,
  })

  const headerRow = 6
  const sheet: XlsxSheet = {
    name: 'Soporte',
    rows: [
      [{ value: 'OmniQuest — Cola de soporte', style: 'title' }],
      [{ value: 'Generado', style: 'label' }, { value: new Date(), style: 'datetime' }],
      [{ value: 'Tickets exportados', style: 'label' }, { value: rows.length, style: 'integer' }],
      [{ value: 'Filtros activos', style: 'label' }, { value: describeSupportFilters(filters), style: 'wrap' }],
      [],
      supportHeaders().map((value) => ({ value, style: 'header' as const })),
      ...rows.map(buildSupportRow),
    ],
    columnWidths: [10, 24, 30, 14, 18, 34, 46, 14, 16, 16, 24, 28, 11, 11, 42, 19, 19, 19, 19],
    freezeRows: headerRow,
    autoFilter: { fromRow: headerRow, toRow: headerRow + rows.length, toColumn: supportHeaders().length },
    merges: [`A1:${columnLetter(supportHeaders().length)}1`],
  }

  return exportBinaryFile(datedFilename('OmniQuest_Soporte', 'xlsx'), buildXlsxWorkbook([sheet]), XLSX_MIME)
}

function auditHeaders() {
  return ['ID', 'Cadena', 'Fecha', 'Actor', 'Correo actor', 'Acción', 'Entidad', 'Referencia', 'Severidad', 'Antes', 'Después', 'Metadatos', 'Retención hasta', 'Hash anterior', 'Hash actual']
}

function buildAuditRow(row: AdminAuditLogRow): XlsxCell[] {
  return [
    { value: row.id, style: 'integer' },
    { value: row.chain_seq ?? null, style: 'integer' },
    { value: parseDate(row.created_at), style: 'datetime' },
    { value: row.actor_alias || 'Admin desconocido', style: 'wrap' },
    { value: row.actor_email || '', style: 'wrap' },
    { value: humanizeAuditAction(row.action), style: 'wrap' },
    { value: humanizeToken(row.target_table || 'Sistema'), style: 'wrap' },
    { value: row.target_id || '', style: 'wrap' },
    { value: getSeverityLabel(row.severity), style: 'border' },
    { value: stringifyJson(row.before_state), style: 'wrap' },
    { value: stringifyJson(row.after_state), style: 'wrap' },
    { value: stringifyJson(row.metadata), style: 'wrap' },
    { value: parseDate(row.retention_until), style: 'datetime' },
    { value: row.previous_hash || '', style: 'wrap' },
    { value: row.chain_hash || '', style: 'wrap' },
  ]
}

function supportHeaders() {
  return ['Ticket', 'Usuario', 'Correo', 'Rol', 'Categoría', 'Asunto', 'Mensaje inicial', 'Prioridad', 'Estado', 'SLA', 'Responsable', 'Etiquetas', 'Mensajes', 'Adjuntos', 'Respuesta administrativa', 'Creado', 'Última respuesta', 'Actualizado', 'Resuelto']
}

function buildSupportRow(row: AdminSupportTicketRow): XlsxCell[] {
  return [
    { value: row.id, style: 'integer' },
    { value: row.user_alias || 'Usuario', style: 'wrap' },
    { value: row.user_email || row.contact_email || '', style: 'wrap' },
    { value: row.role === 'teacher' ? 'Profesor' : 'Alumno', style: 'border' },
    { value: humanizeToken(row.category), style: 'wrap' },
    { value: row.subject, style: 'wrap' },
    { value: row.message, style: 'wrap' },
    { value: getPriorityLabel(row.priority), style: 'border' },
    { value: getSupportStatusLabel(row.status), style: 'border' },
    { value: getSlaLabel(row.sla_state), style: 'border' },
    { value: row.assigned_admin_alias || 'Sin asignar', style: 'wrap' },
    { value: formatSupportTags(row.tags), style: 'wrap' },
    { value: row.message_count ?? 0, style: 'integer' },
    { value: row.attachment_count ?? 0, style: 'integer' },
    { value: row.admin_response || '', style: 'wrap' },
    { value: parseDate(row.created_at), style: 'datetime' },
    { value: parseDate(row.last_response_at), style: 'datetime' },
    { value: parseDate(row.updated_at), style: 'datetime' },
    { value: parseDate(row.resolved_at), style: 'datetime' },
  ]
}

function describeAuditFilters(filters: Parameters<typeof exportAdminAudit>[0]) {
  const active = [
    filters.search.trim() ? `Búsqueda: ${filters.search.trim()}` : '',
    filters.actorId ? 'Actor: filtrado' : '',
    filters.action ? `Acción: ${humanizeAuditAction(filters.action)}` : '',
    filters.targetTable ? `Entidad: ${humanizeToken(filters.targetTable)}` : '',
    filters.targetId ? `Referencia: ${filters.targetId}` : '',
    filters.severity ? `Severidad: ${getSeverityLabel(filters.severity)}` : '',
    filters.from ? `Desde: ${formatExportDateTime(filters.from)}` : '',
    filters.to ? `Hasta: ${formatExportDateTime(filters.to)}` : '',
  ].filter(Boolean)
  return active.length ? active.join(' · ') : 'Sin filtros adicionales'
}

function describeSupportFilters(filters: Parameters<typeof exportAdminSupport>[0]) {
  const active = [
    filters.search.trim() ? `Búsqueda: ${filters.search.trim()}` : '',
    filters.status ? `Estado: ${getSupportStatusLabel(filters.status)}` : '',
    filters.priority ? `Prioridad: ${getPriorityLabel(filters.priority)}` : '',
    filters.role ? `Rol: ${filters.role === 'teacher' ? 'Profesor' : 'Alumno'}` : '',
    filters.assignedAdminId ? 'Responsable: filtrado' : '',
    filters.tag ? `Etiqueta: ${filters.tag}` : '',
    filters.slaState ? `SLA: ${getSlaLabel(filters.slaState)}` : '',
  ].filter(Boolean)
  return active.length ? active.join(' · ') : 'Sin filtros adicionales'
}

function humanizeAuditAction(value: string) {
  return humanizeToken(value.replace(/^admin\./, ''))
}

function humanizeToken(value: string) {
  const normalized = value.replace(/[._-]+/g, ' ').trim()
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : ''
}

function getSeverityLabel(value?: string | null) {
  if (value === 'critical') return 'Crítica'
  if (value === 'warning') return 'Advertencia'
  return 'Informativa'
}

function getPriorityLabel(value?: string | null) {
  if (value === 'high') return 'Alta'
  if (value === 'medium') return 'Media'
  if (value === 'low') return 'Baja'
  return humanizeToken(value || '')
}

function getSupportStatusLabel(value?: string | null) {
  if (value === 'open') return 'Abierto'
  if (value === 'in_progress') return 'En proceso'
  if (value === 'resolved') return 'Resuelto'
  if (value === 'closed') return 'Cerrado'
  return humanizeToken(value || '')
}

function getSlaLabel(value?: string | null) {
  if (value === 'on_track') return 'En plazo'
  if (value === 'at_risk') return 'En riesgo'
  if (value === 'breached') return 'Vencido'
  if (value === 'completed') return 'Completado'
  return value ? humanizeToken(value) : ''
}

function formatSupportTags(value: AdminSupportTicketRow['tags']) {
  if (!Array.isArray(value)) return ''
  return value.map((tag) => tag?.label || tag?.slug).filter(Boolean).join(' · ')
}

function stringifyJson(value: Record<string, unknown> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return ''
  try { return JSON.stringify(value) } catch { return '' }
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function columnLetter(index: number) {
  let value = index
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result || 'A'
}
