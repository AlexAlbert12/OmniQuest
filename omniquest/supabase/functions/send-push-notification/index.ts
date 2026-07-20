import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, methodNotAllowedResponse, publicError, publicErrorResponse, json } from '../_shared/errors.ts'
import { sendExpoPushToUser } from '../_shared/push.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  userId?: string
  title?: string
  body?: string
  url?: string
  data?: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return publicErrorResponse('El servicio push no está configurado.', 500, 'service_unavailable')
    }

    const authorization = req.headers.get('Authorization')
    if (!authorization) return publicErrorResponse('Necesitas iniciar sesión.', 401, 'unauthorized')

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) return publicErrorResponse('La sesión no es válida.', 401, 'unauthorized')

    const request = await req.json() as RequestBody
    const targetUserId = String(request.userId || '').trim()
    const title = String(request.title || '').trim()
    const body = String(request.body || '').trim()
    if (!targetUserId || !title || !body) throw publicError('Faltan destinatario, título o mensaje.', 400, 'bad_request')

    const callerId = authData.user.id
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role_id')
      .eq('id', callerId)
      .maybeSingle()

    const role = callerProfile?.role_id
    let allowed = targetUserId === callerId || role === 'admin'

    if (!allowed && role === 'teacher') {
      const { data: enrollment } = await adminClient
        .from('enrollments')
        .select('subject_id, subjects!inner(teacher_id)')
        .eq('student_id', targetUserId)
        .eq('subjects.teacher_id', callerId)
        .limit(1)
        .maybeSingle()
      allowed = Boolean(enrollment)
    }

    if (!allowed) throw publicError('No tienes permiso para avisar a este usuario.', 403, 'forbidden')

    const result = await sendExpoPushToUser(adminClient, targetUserId, {
      title,
      body,
      data: {
        ...(request.data || {}),
        ...(request.url ? { url: request.url } : {}),
      },
    })

    return json(result)
  } catch (error) {
    return errorResponse(error, 'No se pudo enviar la notificación push.', { functionName: 'send-push-notification' })
  }
})
