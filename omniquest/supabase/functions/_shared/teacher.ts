import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export type TeacherContext = {
  adminClient: any
  authHeader: string
  supabaseUrl: string
  teacherUserId: string
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export async function getTeacherContext(req: Request): Promise<TeacherContext | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json({ error: 'Missing Supabase environment variables.' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing authorization header.' }, 401)
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return json({ error: 'Sesión no válida o caducada.' }, 401)
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role_id, active')
    .eq('id', userData.user.id)
    .single()

  if (profileError || profile?.role_id !== 'teacher' || profile.active === false) {
    return json({ error: 'No tienes permisos de profesor.' }, 403)
  }

  return {
    adminClient,
    authHeader,
    supabaseUrl,
    teacherUserId: userData.user.id,
  }
}

export function isResponse(value: TeacherContext | Response): value is Response {
  return value instanceof Response
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch (_error) {
    return {} as T
  }
}

export async function ensureTeacherSubject(
  adminClient: any,
  teacherUserId: string,
  subjectId: number,
  select = 'id, name, code, teacher_id'
) {
  const { data, error } = await adminClient
    .from('subjects')
    .select(select)
    .eq('id', subjectId)
    .eq('teacher_id', teacherUserId)
    .single()

  if (error || !data) {
    throw new Error('Curso no encontrado o no pertenece a este profesor.')
  }

  return data
}

export async function writeTeacherAudit(
  adminClient: any,
  params: {
    action: string
    metadata?: Record<string, unknown>
    targetId?: string | number | null
    targetTable?: string | null
    teacherUserId: string
  }
) {
  const { error } = await adminClient
    .from('teacher_audit_logs')
    .insert({
      teacher_id: params.teacherUserId,
      action: params.action,
      target_table: params.targetTable ?? null,
      target_id: params.targetId === undefined || params.targetId === null ? null : String(params.targetId),
      metadata: params.metadata || {},
    })

  if (error) {
    console.warn('[teacher audit] could not write audit log:', error.message)
  }
}

export function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204'
}
