import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, isMissingSchemaError, json, methodNotAllowedResponse, publicError, publicErrorResponse } from './errors.ts'

export { corsHeaders, errorResponse, isMissingSchemaError, json, methodNotAllowedResponse, publicError, publicErrorResponse }

export type AdminContext = {
  adminClient: any
  adminUserId: string
  authHeader: string
  permissions: string[]
  roleId: string
  roleName: string
  supabaseUrl: string
}

export async function getAdminContext(req: Request, requiredPermission?: string): Promise<AdminContext | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return publicErrorResponse('El servicio no está configurado correctamente.', 500, 'service_unavailable')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return publicErrorResponse('Necesitas iniciar sesión para continuar.', 401, 'unauthorized')

  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return publicErrorResponse('Tu sesión no es válida o ha caducado. Vuelve a iniciar sesión.', 401, 'unauthorized')

  const { data: adminProfile, error: adminProfileError } = await adminClient.from('profiles').select('role_id, active').eq('id', userData.user.id).single()
  if (adminProfileError || adminProfile?.role_id !== 'admin' || adminProfile.active === false) return publicErrorResponse('No tienes permisos para realizar esta acción.', 403, 'forbidden')

  let permissions: string[] = []
  let roleId = 'unassigned'
  let roleName = 'Acceso administrativo pendiente'
  const { data: portalContext, error: portalError } = await userClient.rpc('get_admin_portal_context')
  if (!portalError && portalContext && typeof portalContext === 'object' && !Array.isArray(portalContext)) {
    const payload = portalContext as Record<string, unknown>
    permissions = Array.isArray(payload.permissions) ? payload.permissions.map(String) : []
    roleId = typeof payload.role_id === 'string' && payload.role_id ? payload.role_id : roleId
    roleName = typeof payload.role_name === 'string' && payload.role_name ? payload.role_name : roleName
  } else {
    return publicErrorResponse('No se pudieron verificar los permisos administrativos.', 503, 'authorization_unavailable')
  }

  if (requiredPermission && !permissions.includes(requiredPermission)) return publicErrorResponse('Tu rol administrativo no permite esta acción.', 403, 'forbidden')

  return { adminClient, adminUserId: userData.user.id, authHeader, permissions, roleId, roleName, supabaseUrl }
}

export function isResponse(value: AdminContext | Response): value is Response {
  return value instanceof Response
}

export async function writeAdminAudit(adminClient: any, params: {
  action: string
  adminUserId: string
  after?: Record<string, unknown> | null
  before?: Record<string, unknown> | null
  contextCaptureReason?: string | null
  metadata?: Record<string, unknown>
  requestContext?: { ip?: string | null; userAgent?: string | null } | null
  requestId?: string | null
  targetId?: string | number | null
  targetTable?: string | null
}) {
  const rawMetadata = params.metadata || {}
  const metadataBefore = isPlainObject(rawMetadata.before) ? rawMetadata.before as Record<string, unknown> : null
  const metadataAfter = isPlainObject(rawMetadata.after) ? rawMetadata.after as Record<string, unknown> : null
  const { before: _before, after: _after, ...metadataWithoutSnapshots } = rawMetadata
  const captureContext = Boolean(params.contextCaptureReason?.trim())
  const metadata = sanitizeAuditMetadata(metadataWithoutSnapshots)
  if (captureContext && params.requestContext?.ip) metadata.ip = params.requestContext.ip.trim()
  if (captureContext && params.requestContext?.userAgent) metadata.user_agent = params.requestContext.userAgent.trim()
  const { error } = await adminClient.from('admin_audit_logs').insert({
    admin_id: params.adminUserId,
    action: params.action,
    target_table: params.targetTable ?? null,
    target_id: params.targetId === undefined || params.targetId === null ? null : String(params.targetId),
    metadata,
    before_state: params.before || metadataBefore ? sanitizeAuditMetadata(params.before || metadataBefore || {}) : null,
    after_state: params.after || metadataAfter ? sanitizeAuditMetadata(params.after || metadataAfter || {}) : null,
    request_id: params.requestId || null,
    context_capture_reason: params.contextCaptureReason?.trim() || null,
  })
  if (error) console.warn('[admin audit] could not write audit log:', error.message)
}

export async function writeAdminUserHistory(adminClient: any, params: {
  action: string
  adminUserId: string
  after?: Record<string, unknown> | null
  before?: Record<string, unknown> | null
  profileId: string
  reason?: string | null
}) {
  const { error } = await adminClient.from('admin_user_change_history').insert({
    profile_id: params.profileId,
    changed_by: params.adminUserId,
    action: params.action,
    before_state: sanitizeAuditMetadata(params.before || {}),
    after_state: sanitizeAuditMetadata(params.after || {}),
    reason: params.reason?.trim() || null,
  })
  if (error && !isMissingSchemaError(error.code)) console.warn('[admin history] could not write history:', error.message)
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  try { return await req.json() as T } catch (_error) { return {} as T }
}

function sanitizeAuditMetadata(value: Record<string, unknown>) {
  const blocked = new Set(['password','token','secret','answer','answer_text','response','email','phone','ip','user_agent'])
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.has(key.toLowerCase())).map(([key, item]) => [key, sanitizeValue(item, blocked)]))
}

function sanitizeValue(value: unknown, blocked: Set<string>): unknown {
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeValue(item, blocked))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !blocked.has(key.toLowerCase())).map(([key, item]) => [key, sanitizeValue(item, blocked)]))
}

function isPlainObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
