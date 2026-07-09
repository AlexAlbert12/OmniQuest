import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, isMissingSchemaError, json, methodNotAllowedResponse, publicError, publicErrorResponse } from './errors.ts'

export { corsHeaders, errorResponse, isMissingSchemaError, json, methodNotAllowedResponse, publicError, publicErrorResponse }

export type AdminContext = {
  adminClient: any
  adminUserId: string
  authHeader: string
  supabaseUrl: string
}


export async function getAdminContext(req: Request): Promise<AdminContext | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return publicErrorResponse('El servicio no está configurado correctamente.', 500, 'service_unavailable')
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return publicErrorResponse('Necesitas iniciar sesión para continuar.', 401, 'unauthorized')
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return publicErrorResponse('Tu sesión no es válida o ha caducado. Vuelve a iniciar sesión.', 401, 'unauthorized')
  }

  const { data: adminProfile, error: adminProfileError } = await adminClient
    .from('profiles')
    .select('role_id, active')
    .eq('id', userData.user.id)
    .single()

  if (adminProfileError || adminProfile?.role_id !== 'admin' || adminProfile.active === false) {
    return publicErrorResponse('No tienes permisos para realizar esta acción.', 403, 'forbidden')
  }

  return {
    adminClient,
    adminUserId: userData.user.id,
    authHeader,
    supabaseUrl,
  }
}

export function isResponse(value: AdminContext | Response): value is Response {
  return value instanceof Response
}

export async function writeAdminAudit(
  adminClient: any,
  params: {
    action: string
    adminUserId: string
    metadata?: Record<string, unknown>
    targetId?: string | number | null
    targetTable?: string | null
  }
) {
  const { error } = await adminClient
    .from('admin_audit_logs')
    .insert({
      admin_id: params.adminUserId,
      action: params.action,
      target_table: params.targetTable ?? null,
      target_id: params.targetId === undefined || params.targetId === null ? null : String(params.targetId),
      metadata: params.metadata || {},
    })

  if (error) {
    console.warn('[admin audit] could not write audit log:', error.message)
  }
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch (_error) {
    return {} as T
  }
}
