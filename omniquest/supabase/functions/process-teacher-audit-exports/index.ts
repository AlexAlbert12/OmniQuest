import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, json, methodNotAllowedResponse, publicErrorResponse } from '../_shared/errors.ts'

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
        const csv = buildCsv(rows)
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
    if (search) query = query.or(`action.ilike.%${escapePostgrest(search)}%,target_table.ilike.%${escapePostgrest(search)}%,target_id.ilike.%${escapePostgrest(search)}%`)
    const categoryExpression = buildCategoryExpression(category)
    if (categoryExpression) query = query.or(categoryExpression)

    const { data, error } = await query
    if (error) throw error
    const page = (data || []) as AuditRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

function buildCategoryExpression(category: string | null) {
  if (category === 'student') return 'target_table.in.(profiles,enrollments,subject_scores,topic_scores),action.ilike.%student%'
  if (category === 'question') return 'target_table.in.(questions,answers),action.ilike.%question%'
  if (category === 'subject') return 'target_table.in.(subjects,subject_topics),action.ilike.%subject%,action.ilike.%course%,action.ilike.%topic%'
  if (category === 'code') return 'target_table.eq.classrooms,action.ilike.%code%'
  if (category === 'profile') return 'target_table.eq.profiles,action.ilike.%profile%'
  return null
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

function buildCsv(rows: AuditRow[]) {
  const headers = ['id', 'created_at', 'severity', 'action', 'target_table', 'target_id', 'request_id', 'before_state', 'after_state', 'metadata']
  return [
    headers.join(','),
    ...rows.map((row) => [
      row.id,
      row.created_at,
      row.severity,
      row.action,
      row.target_table || '',
      row.target_id || '',
      row.request_id || '',
      JSON.stringify(row.before_state || {}),
      JSON.stringify(row.after_state || {}),
      JSON.stringify(row.metadata || {}),
    ].map(csvCell).join(',')),
  ].join('\n')
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function stringFilter(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function escapePostgrest(value: string) {
  return value.replace(/[,%()]/g, ' ')
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/(token|secret|password|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]').slice(0, 500)
}
