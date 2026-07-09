import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, methodNotAllowedResponse, publicErrorResponse } from '../_shared/errors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ResetType = 'scores' | 'enrollments' | 'all'

type RequestBody = {
  resetType?: ResetType
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getUserContext(req)
    if (context instanceof Response) return context

    const body = await readJsonBody<RequestBody>(req)
    const resetType: ResetType = body.resetType === 'enrollments' || body.resetType === 'all' ? body.resetType : 'scores'
    const deleted: Record<string, number | null> = {}

    const { data: profile, error: profileError } = await context.adminClient
      .from('profiles')
      .select('id, role_id, avatar')
      .eq('id', context.userId)
      .single()

    if (profileError || !profile) return json({ error: 'Perfil no encontrado.' }, 404)
    if (!['student', 'guest'].includes(profile.role_id || 'student')) {
      return json({ error: 'Esta acción solo está disponible para alumnos.' }, 403)
    }

    if (resetType === 'scores' || resetType === 'all') {
      await deleteOwnProgress(context.adminClient, context.userId, deleted)
      await syncStudentPoints(context.adminClient, context.userId)
    }

    if (resetType === 'enrollments' || resetType === 'all') {
      deleted.enrollments = await deleteRows(context.adminClient, 'enrollments', 'student_id', context.userId)
    }

    if (resetType === 'all') {
      deleted.notification_state = await deleteRows(context.adminClient, 'notification_state', 'user_id', context.userId)
      deleted.user_preferences = await deleteRows(context.adminClient, 'user_preferences', 'user_id', context.userId)
      deleted.user_notification_preferences = await deleteRows(context.adminClient, 'user_notification_preferences', 'user_id', context.userId)

      const avatarPaths = getAvatarStoragePaths(context.userId, profile.avatar)
      if (avatarPaths.length > 0) {
        const { error: removeError } = await context.adminClient.storage.from('avatars').remove(avatarPaths)
        if (removeError) console.warn('[student reset] could not remove avatar:', removeError.message)
      }

      const { error: avatarError } = await context.adminClient
        .from('profiles')
        .update({ avatar: null })
        .eq('id', context.userId)
      if (avatarError) throw avatarError
    }

    const { data: syncedPoints, error: pointsError } = await context.adminClient.rpc('sync_student_points', { student_id: context.userId })
    if (pointsError && !isMissingSchemaError(pointsError.code)) throw pointsError

    return json({
      ok: true,
      resetType,
      deleted,
      points: typeof syncedPoints === 'number' ? syncedPoints : 0,
      avatar: resetType === 'all' ? null : profile.avatar,
    })
  } catch (error) {
    return errorResponse(error, 'No se pudo reiniciar el progreso.', { functionName: 'student-reset-own-progress' })
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getUserContext(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return publicErrorResponse('El servicio no está configurado correctamente.', 500, 'service_unavailable')
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return publicErrorResponse('Necesitas iniciar sesión para continuar.', 401, 'unauthorized')

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return publicErrorResponse('Tu sesión no es válida o ha caducado. Vuelve a iniciar sesión.', 401, 'unauthorized')

  return { adminClient, userId: userData.user.id }
}

async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch (_error) {
    return {} as T
  }
}

async function deleteOwnProgress(adminClient: any, userId: string, deleted: Record<string, number | null>) {
  for (const table of ['attempt_history', 'student_badges', 'topic_scores', 'subject_scores']) {
    deleted[table] = await deleteRows(adminClient, table, 'student_id', userId)
  }
}

async function deleteRows(adminClient: any, table: string, column: string, value: string) {
  const { count, error } = await adminClient
    .from(table)
    .delete({ count: 'exact' })
    .eq(column, value)

  if (error && !isMissingSchemaError(error.code)) throw error
  return error ? null : count
}

async function syncStudentPoints(adminClient: any, userId: string) {
  const { error } = await adminClient.rpc('sync_student_points', { student_id: userId })
  if (error && !isMissingSchemaError(error.code)) throw error
}

function getAvatarStoragePaths(userId: string, avatarUrl?: string | null) {
  const paths = new Set<string>([`${userId}.jpg`, `${userId}.jpeg`, `${userId}.png`, `${userId}.webp`, `${userId}/avatar.jpg`, `${userId}/avatar.png`, `${userId}/avatar.webp`])
  const marker = '/storage/v1/object/public/avatars/'
  if (avatarUrl?.includes(marker)) {
    const rawPath = avatarUrl.split(marker)[1]?.split('?')[0]
    if (rawPath) paths.add(decodeURIComponent(rawPath))
  }
  return Array.from(paths)
}

function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204'
}
