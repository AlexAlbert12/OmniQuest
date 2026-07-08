import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  avatarPath?: string | null
  clear?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const context = await getUserContext(req)
    if (context instanceof Response) return context

    const body = await readJsonBody<RequestBody>(req)
    const clear = body.clear === true
    const avatarPath = String(body.avatarPath || '').trim()

    if (!clear && !isAllowedAvatarPath(context.userId, avatarPath)) {
      return json({ error: 'La ruta del avatar no es válida para este usuario.' }, 400)
    }

    const { data: profile, error: profileError } = await context.adminClient
      .from('profiles')
      .select('id, role_id, avatar')
      .eq('id', context.userId)
      .single()

    if (profileError || !profile) return json({ error: 'Perfil no encontrado.' }, 404)

    let nextAvatar: string | null = null
    if (!clear) {
      const { data } = context.adminClient.storage.from('avatars').getPublicUrl(avatarPath)
      nextAvatar = data.publicUrl
    }

    const { error } = await context.adminClient
      .from('profiles')
      .update({ avatar: nextAvatar })
      .eq('id', context.userId)

    if (error) throw error

    if (profile.role_id === 'teacher') {
      await writeTeacherAudit(context.adminClient, {
        teacherUserId: context.userId,
        action: clear ? 'teacher.profile.avatar.clear' : 'teacher.profile.avatar.update',
        targetTable: 'profiles',
        targetId: context.userId,
        metadata: {
          previous_has_avatar: Boolean(profile.avatar),
          next_has_avatar: Boolean(nextAvatar),
          avatar_path: clear ? null : avatarPath,
        },
      })
    }

    return json({ ok: true, avatar: nextAvatar })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el avatar.'
    return json({ error: message }, 500)
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
    return json({ error: 'Missing Supabase environment variables.' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization header.' }, 401)

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Sesión no válida o caducada.' }, 401)

  return { adminClient, userId: userData.user.id }
}

async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch (_error) {
    return {} as T
  }
}

function isAllowedAvatarPath(userId: string, path: string) {
  if (!path) return false
  if (path.includes('..') || path.startsWith('/') || path.includes('://')) return false
  return path === `${userId}.jpg`
    || path === `${userId}.jpeg`
    || path === `${userId}.png`
    || path === `${userId}.webp`
    || path.startsWith(`${userId}/`)
}

async function writeTeacherAudit(
  adminClient: any,
  params: {
    action: string
    metadata?: Record<string, unknown>
    targetId?: string | number | null
    targetTable?: string | null
    teacherUserId: string
  },
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

  if (error) console.warn('[teacher audit] could not write audit log:', error.message)
}
