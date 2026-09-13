import { supabase } from '../../../lib/supabase'
import type { Json } from '../../../types/database.types'
import type {
  AdminAccountExportRequest,
  AdminActionResult,
  AdminBulkAction,
  AdminBulkEntity,
  AdminExportJob,
  AdminInviteResult,
  AdminPortalContext,
  AdminPushDeliveryDetail,
  AdminPushDeliveryMetrics,
  AdminPushDeliveryRow,
  AdminUserChangeRow,
} from '../types/admin'

type DynamicRowsError = { code?: string; message: string }
type DynamicRowsResponse = { data: unknown[] | null; error: DynamicRowsError | null }
type DynamicRowsQuery = PromiseLike<DynamicRowsResponse> & {
  order: (column: string, options: { ascending: boolean }) => DynamicRowsQuery
  limit: (limit: number) => DynamicRowsQuery
}
type DynamicTableBuilder = { select: (columns: string) => DynamicRowsQuery }
type DynamicSupabaseClient = { from: (table: string) => DynamicTableBuilder }

export function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204' || errorCode === 'PGRST205'
}

export async function fetchOptionalRows<T>(
  table: string,
  select: string,
  options: { ascending?: boolean; limit?: number; orderBy?: string } = {},
) {
  const dynamicClient = supabase as unknown as DynamicSupabaseClient
  let query = dynamicClient.from(table).select(select)
  if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? true })
  if (options.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error && !isMissingSchemaError(error.code)) console.warn(`[admin] No se pudo cargar ${table}:`, error.message)
  return error ? [] : ((data || []) as T[])
}

export async function invokeAdminAction<T extends AdminActionResult>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) {
    const edgeMessage = await readEdgeFunctionErrorMessage(error)
    if (edgeMessage) throw new Error(edgeMessage)
    throw error
  }
  const result = (data || {}) as T
  if (result.error) throw new Error(result.error)
  return result
}

async function readEdgeFunctionErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return null
  const context = (error as { context?: unknown }).context
  if (!context || typeof context !== 'object') return null
  const response = typeof (context as { clone?: unknown }).clone === 'function'
    ? (context as { clone: () => unknown }).clone()
    : context
  if (!response || typeof response !== 'object' || typeof (response as { json?: unknown }).json !== 'function') return null
  try {
    const payload = await (response as { json: () => Promise<unknown> }).json()
    if (!payload || typeof payload !== 'object') return null
    const message = (payload as { error?: unknown; message?: unknown }).error ?? (payload as { message?: unknown }).message
    return typeof message === 'string' && message.trim() ? message.trim() : null
  } catch {
    return null
  }
}

export async function fetchAdminPortalContext(): Promise<AdminPortalContext> {
  const { data, error } = await supabase.rpc('get_admin_portal_context')
  if (error) throw error
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  const userId = String(payload.user_id || '')
  const profilePayload = payload.profile && typeof payload.profile === 'object' && !Array.isArray(payload.profile) ? payload.profile as Record<string, unknown> : {}
  return {
    user_id: userId,
    role_id: typeof payload.role_id === 'string' ? payload.role_id : '',
    role_name: typeof payload.role_name === 'string' && payload.role_name.trim() ? payload.role_name : 'Acceso administrativo pendiente',
    permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String) as AdminPortalContext['permissions'] : [],
    profile: { id: String(profilePayload.id || userId), alias: typeof profilePayload.alias === 'string' && profilePayload.alias.trim() ? profilePayload.alias : 'Administrador', email: typeof profilePayload.email === 'string' ? profilePayload.email : null, active: profilePayload.active !== false, avatar: typeof profilePayload.avatar === 'string' && profilePayload.avatar.trim() ? profilePayload.avatar : null },
  }
}

export async function runAdminBulkAction(options: {
  action: AdminBulkAction
  entity: AdminBulkEntity
  ids: (string | number)[]
  reason?: string
  reactivateAt?: string | null
  targetTeacherId?: string | null
  deactivateClassrooms?: boolean
}) {
  return invokeAdminAction<AdminActionResult & { affected?: number }>('admin-bulk-operations', options)
}

export type AdminExportFilters = { [key: string]: Json | undefined }

export async function requestAdminExportJob(exportType: AdminExportJob['export_type'], filters: AdminExportFilters) {
  const { data, error } = await supabase.rpc('request_admin_export_job', {
    p_export_type: exportType,
    p_filters: filters,
  })
  if (error) throw error
  return data as unknown as AdminExportJob
}

export async function fetchAdminExportJobs(limit = 10, offset = 0) {
  const { data, error } = await supabase.rpc('get_admin_export_jobs_page', { p_limit: limit, p_offset: offset })
  if (error) throw error
  const rows = (data || []) as unknown as AdminExportJob[]
  return { rows, total: Number(rows[0]?.total_count || 0) }
}

export async function fetchAdminAccountExportRequests(limit = 25, offset = 0) {
  const { data, error } = await supabase.rpc('get_admin_account_export_requests_page', { p_limit: limit, p_offset: offset })
  if (error) throw error
  const rows = (data || []) as unknown as AdminAccountExportRequest[]
  return { rows, total: Number(rows[0]?.total_count || 0) }
}

export async function getAdminExportDownloadUrl(jobId: string) {
  const { data, error } = await supabase.rpc('get_admin_export_download_path', { p_job_id: jobId })
  if (error) throw error
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  const path = String(payload.storage_path || '')
  if (!path) throw new Error('La exportación todavía no está disponible.')
  const { data: signed, error: signedError } = await supabase.storage.from('admin-exports').createSignedUrl(path, 300)
  if (signedError) throw signedError
  return signed.signedUrl
}

export async function fetchAdminUserChangeHistory(profileId: string, limit = 25, offset = 0) {
  const { data, error } = await supabase.rpc('get_admin_user_change_history_page', {
    p_profile_id: profileId,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return (data || []) as unknown as AdminUserChangeRow[]
}

export async function fetchAdminRoles() {
  const { data, error } = await supabase.rpc('get_admin_roles')
  if (error) throw error
  return (data || []) as unknown as import('../types/admin').AdminRoleRow[]
}

export async function fetchAdminRoleAssignments(limit = 50, offset = 0) {
  const { data, error } = await supabase.rpc('get_admin_role_assignments_page', { p_limit: limit, p_offset: offset })
  if (error) throw error
  return (data || []) as unknown as import('../types/admin').AdminRoleAssignmentRow[]
}

export async function inviteAdmin(input: { email: string; alias: string; roleId: string; reason: string }) {
  return invokeAdminAction<AdminInviteResult>('admin-invite-admin', input)
}

export async function assignAdminRole(userId: string, roleId: string, reason: string) {
  const { data, error } = await supabase.rpc('assign_admin_role', { p_user_id: userId, p_role_id: roleId, p_reason: reason })
  if (error) throw error
  return data
}

export async function revokeAdminRole(userId: string, reason: string) {
  const { data, error } = await supabase.rpc('revoke_admin_role', { p_user_id: userId, p_reason: reason })
  if (error) throw error
  return data
}

export async function fetchAdminPushDeliveryMetrics(days = 30) {
  const { data, error } = await supabase.rpc('get_admin_push_delivery_metrics', { p_days: days })
  if (error) throw error
  return data as unknown as AdminPushDeliveryMetrics
}

export async function fetchAdminPushDeliveryPage(filters: { search?: string; status?: string | null; role?: string | null; type?: string | null; from?: string | null; to?: string | null; limit?: number; offset?: number }) {
  const { data, error } = await supabase.rpc('get_admin_push_delivery_page', { p_search: filters.search || undefined, p_status: filters.status || undefined, p_role: filters.role || undefined, p_type: filters.type || undefined, p_from: filters.from || undefined, p_to: filters.to || undefined, p_limit: filters.limit || 25, p_offset: filters.offset || 0 })
  if (error) throw error
  return (data || []) as unknown as AdminPushDeliveryRow[]
}

export async function fetchAdminPushDeliveryDetail(queueId: number) {
  const { data, error } = await supabase.rpc('get_admin_push_delivery_detail', { p_queue_id: queueId })
  if (error) throw error
  return data as unknown as AdminPushDeliveryDetail
}

export async function retryAdminPushDelivery(queueId: number) {
  const { data, error } = await supabase.rpc('admin_retry_push_delivery', { p_queue_id: queueId })
  if (error) throw error
  return data
}

export async function cancelAdminPushDelivery(queueId: number) {
  const { data, error } = await supabase.rpc('admin_cancel_push_delivery', { p_queue_id: queueId })
  if (error) throw error
  return data
}

export async function processAdminPushDeliveryNow(queueId: number) {
  return invokeAdminAction<AdminActionResult & { queueId?: number }>('admin-process-push-delivery', { queueId })
}

export async function sendAdminPushTest(userId: string) {
  return invokeAdminAction<AdminActionResult & { queued?: boolean; notificationId?: string }>('send-push-notification', { userId, title: 'Prueba de notificaciones push', body: 'Si ves este aviso, la entrega push de OmniQuest funciona correctamente.', priority: 'high', data: { admin_push_test: true } })
}
