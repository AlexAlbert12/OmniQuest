import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, json, methodNotAllowedResponse } from '../_shared/errors.ts'

type ExportJob = { id: string; requested_by: string; export_type: 'profiles' | 'subjects' | 'classrooms' | 'audit' | 'support'; filters: Record<string, unknown> }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const secret = Deno.env.get('ADMIN_EXPORT_QUEUE_SECRET')
    const supplied = req.headers.get('x-queue-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!secret || supplied !== secret) return json({ error: 'Unauthorized' }, 401)

    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ error: 'Service unavailable' }, 500)
    const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const workerId = `admin-export-${crypto.randomUUID()}`
    const { data: claimed, error: claimError } = await client.rpc('claim_admin_export_jobs', { p_worker_id: workerId, p_limit: 2 })
    if (claimError) throw claimError

    const results: Array<{ id: string; status: string; rows?: number }> = []
    for (const job of (claimed || []) as ExportJob[]) {
      try {
        const rows = await readExportRows(client, job)
        const csv = toCsv(rows)
        const storagePath = `${job.requested_by}/${job.id}.csv`
        const { error: uploadError } = await client.storage.from('admin-exports').upload(storagePath, new Blob([csv], { type: 'text/csv;charset=utf-8' }), { upsert: true, contentType: 'text/csv;charset=utf-8' })
        if (uploadError) throw uploadError
        const { error: completeError } = await client.rpc('complete_admin_export_job', { p_job_id: job.id, p_storage_path: storagePath, p_row_count: rows.length })
        if (completeError) throw completeError
        results.push({ id: job.id, status: 'ready', rows: rows.length })
      } catch (error: any) {
        await client.rpc('fail_admin_export_job', { p_job_id: job.id, p_error_message: String(error?.message || error).slice(0, 500) })
        results.push({ id: job.id, status: 'failed' })
      }
    }

    return json({ ok: true, processed: results.length, results })
  } catch (error) {
    return errorResponse(error, 'No se pudieron procesar las exportaciones administrativas.', { functionName: 'process-admin-export-jobs' })
  }
})

async function readExportRows(client: any, job: ExportJob) {
  const pageSize = 1000
  const result: Record<string, unknown>[] = []
  for (let offset = 0; offset < 100000; offset += pageSize) {
    const page = await readPage(client, job, offset, pageSize)
    result.push(...page)
    if (page.length < pageSize) break
  }
  return result
}

async function readPage(client: any, job: ExportJob, offset: number, limit: number) {
  const filters = job.filters || {}
  let query: any
  if (job.export_type === 'profiles') {
    query = client.from('profiles').select('id,alias,email,role_id,active,created_at,deactivation_reason,deactivated_at,reactivate_at').order('created_at', { ascending: false })
    const role = stringFilter(filters.p_role ?? filters.role)
    if (role === 'student') query = query.in('role_id', ['student', 'guest'])
    else if (role) query = query.eq('role_id', role)
    query = applyBoolean(query, 'active', filters.p_active ?? filters.active)
    const profileId = stringFilter(filters.p_profile_id ?? filters.profileId); if (profileId) query = query.eq('id', profileId)
    query = applyDateRange(query, 'created_at', filters.p_created_from ?? filters.createdFrom, filters.p_created_to ?? filters.createdTo)
    query = applyTextSearch(query, 'alias,email', filters.p_search ?? filters.search)
  } else if (job.export_type === 'subjects') {
    query = client.from('subjects').select('id,name,teacher_id,active,is_archived,created_at,archive_reason,archived_at,retention_until').order('created_at', { ascending: false })
    query = applyBoolean(query, 'active', filters.p_active ?? filters.active)
    query = applyBoolean(query, 'is_archived', filters.p_archived ?? filters.archived)
    const teacher = stringFilter(filters.p_teacher_id ?? filters.teacherId)
    if (teacher) query = query.eq('teacher_id', teacher)
    query = applyDateRange(query, 'created_at', filters.p_created_from ?? filters.createdFrom, filters.p_created_to ?? filters.createdTo)
    query = applyTextSearch(query, 'name,code', filters.p_search ?? filters.search)
  } else if (job.export_type === 'classrooms') {
    query = client.from('classrooms').select('id,subject_id,name,code,active,created_at,code_expires_at,deactivation_reason,deactivated_at').order('created_at', { ascending: false })
    query = applyBoolean(query, 'active', filters.p_active ?? filters.active)
    const subject = numberFilter(filters.p_subject_id ?? filters.subjectId)
    if (subject !== null) query = query.eq('subject_id', subject)
    query = applyDateRange(query, 'created_at', filters.p_created_from ?? filters.createdFrom, filters.p_created_to ?? filters.createdTo)
    query = applyTextSearch(query, 'name,code', filters.p_search ?? filters.search)
  } else if (job.export_type === 'audit') {
    query = client.from('admin_audit_logs').select('id,admin_id,action,target_table,target_id,severity,metadata,created_at').order('created_at', { ascending: false })
    const actor = stringFilter(filters.p_actor_id ?? filters.actorId); if (actor) query = query.eq('admin_id', actor)
    const action = stringFilter(filters.p_action ?? filters.action); if (action) query = query.eq('action', action)
    const table = stringFilter(filters.p_target_table ?? filters.targetTable); if (table) query = query.eq('target_table', table)
    const targetId = stringFilter(filters.p_target_id ?? filters.targetId); if (targetId) query = query.eq('target_id', targetId)
    const severity = stringFilter(filters.p_severity ?? filters.severity); if (severity) query = query.eq('severity', severity)
    query = applyDateRange(query, 'created_at', filters.p_from ?? filters.from, filters.p_to ?? filters.to)
    query = applyTextSearch(query, 'action,target_table,target_id', filters.p_search ?? filters.search)
  } else {
    query = client.from('user_support_tickets').select('id,user_id,role,category,subject,priority,status,assigned_admin_id,resolved_at,created_at,updated_at').order('created_at', { ascending: false })
    const status = stringFilter(filters.p_status ?? filters.status); if (status) query = query.eq('status', status)
    const priority = stringFilter(filters.p_priority ?? filters.priority); if (priority) query = query.eq('priority', priority)
    const role = stringFilter(filters.p_role ?? filters.role); if (role) query = query.eq('role', role)
    query = applyTextSearch(query, 'subject,category,contact_email', filters.p_search ?? filters.search)
  }

  const { data, error } = await query.range(offset, offset + limit - 1)
  if (error) throw error
  return (data || []) as Record<string, unknown>[]
}

function applyBoolean(query: any, column: string, value: unknown) {
  return typeof value === 'boolean' ? query.eq(column, value) : query
}

function applyDateRange(query: any, column: string, from: unknown, to: unknown) {
  const fromValue = stringFilter(from); if (fromValue) query = query.gte(column, fromValue)
  const toValue = stringFilter(to); if (toValue) query = query.lte(column, toValue)
  return query
}

function applyTextSearch(query: any, columns: string, value: unknown) {
  const search = stringFilter(value)
  return search ? query.or(columns.split(',').map((column) => `${column}.ilike.%${escapeFilter(search)}%`).join(',')) : query
}

function stringFilter(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : null }
function numberFilter(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : null }
function escapeFilter(value: string) { return value.replace(/[,%()]/g, ' ') }

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return '\uFEFFsin_resultados\n'
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort()
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(headers.map((header) => csvCell(normalizeCell(row[header]))).join(','))
  return `\uFEFF${lines.join('\n')}\n`
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function csvCell(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"` }
