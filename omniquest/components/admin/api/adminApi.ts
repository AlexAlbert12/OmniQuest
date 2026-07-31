import { supabase } from '../../../lib/supabase'
import type {
  AdminActionResult,
  AdminBulkAction,
  AdminBulkEntity,
  AdminExportJob,
  AdminPortalContext,
  AdminUserChangeRow,
} from '../types/admin'

export function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204' || errorCode === 'PGRST205'
}

export async function fetchOptionalRows<T>(
  table: string,
  select: string,
  options: { ascending?: boolean; limit?: number; orderBy?: string } = {},
) {
  let query = (supabase.from(table as never) as any).select(select)
  if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? true })
  if (options.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error && !isMissingSchemaError(error.code)) console.warn(`[admin] No se pudo cargar ${table}:`, error.message)
  return error ? [] : ((data || []) as T[])
}

export async function invokeAdminAction<T extends AdminActionResult>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) throw error
  const result = (data || {}) as T
  if (result.error) throw new Error(result.error)
  return result
}

export async function fetchAdminPortalContext(): Promise<AdminPortalContext> {
  const { data, error } = await supabase.rpc('get_admin_portal_context' as any)
  if (error) throw error
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  return {
    user_id: String(payload.user_id || ''),
    role_id: String(payload.role_id || 'admin'),
    role_name: String(payload.role_name || 'Administrador'),
    permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String) as AdminPortalContext['permissions'] : [],
  }
}

export async function runAdminBulkAction(options: {
  action: AdminBulkAction
  entity: AdminBulkEntity
  ids: Array<string | number>
  reason?: string
  reactivateAt?: string | null
  targetTeacherId?: string | null
  deactivateClassrooms?: boolean
}) {
  return invokeAdminAction<AdminActionResult & { affected?: number }>('admin-bulk-operations', options)
}

export async function requestAdminExportJob(exportType: AdminExportJob['export_type'], filters: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('request_admin_export_job' as any, {
    p_export_type: exportType,
    p_filters: filters,
  })
  if (error) throw error
  return data as unknown as AdminExportJob
}

export async function fetchAdminExportJobs(limit = 10) {
  const { data, error } = await supabase.rpc('get_admin_export_jobs_page' as any, { p_limit: limit, p_offset: 0 })
  if (error) throw error
  return (data || []) as unknown as AdminExportJob[]
}

export async function getAdminExportDownloadUrl(jobId: string) {
  const { data, error } = await supabase.rpc('get_admin_export_download_path' as any, { p_job_id: jobId })
  if (error) throw error
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  const path = String(payload.storage_path || '')
  if (!path) throw new Error('La exportación todavía no está disponible.')
  const { data: signed, error: signedError } = await supabase.storage.from('admin-exports').createSignedUrl(path, 300)
  if (signedError) throw signedError
  return signed.signedUrl
}

export async function fetchAdminUserChangeHistory(profileId: string, limit = 25, offset = 0) {
  const { data, error } = await supabase.rpc('get_admin_user_change_history_page' as any, {
    p_profile_id: profileId,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return (data || []) as unknown as AdminUserChangeRow[]
}

export async function fetchAdminRoles() {
  const { data, error } = await supabase.rpc('get_admin_roles' as any)
  if (error) throw error
  return (data || []) as unknown as import('../types/admin').AdminRoleRow[]
}

export async function fetchAdminRoleAssignments(limit = 50, offset = 0) {
  const { data, error } = await supabase.rpc('get_admin_role_assignments_page' as any, { p_limit: limit, p_offset: offset })
  if (error) throw error
  return (data || []) as unknown as import('../types/admin').AdminRoleAssignmentRow[]
}

export async function assignAdminRole(userId: string, roleId: string, reason: string) {
  const { data, error } = await supabase.rpc('assign_admin_role' as any, { p_user_id: userId, p_role_id: roleId, p_reason: reason })
  if (error) throw error
  return data
}
