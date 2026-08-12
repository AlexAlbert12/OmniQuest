import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, methodNotAllowedResponse, publicError, publicErrorResponse, json } from '../_shared/errors.ts'
import { writeAdminAudit } from '../_shared/admin.ts'

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
  priority?: 'low' | 'normal' | 'high'
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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) return publicErrorResponse('La sesión no es válida.', 401, 'unauthorized')

    const request = await req.json() as RequestBody
    const targetUserId = String(request.userId || '').trim()
    const title = String(request.title || '').trim()
    const body = String(request.body || '').trim()
    if (!targetUserId || !title || !body) {
      throw publicError('Faltan destinatario, título o mensaje.', 400, 'bad_request')
    }
    if (title.length > 100 || body.length > 500) {
      throw publicError('El título o el mensaje superan el límite permitido.', 400, 'bad_request')
    }

    const callerId = authData.user.id
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('role_id, active')
      .eq('id', callerId)
      .maybeSingle()
    if (callerProfileError) throw callerProfileError
    if (!callerProfile || callerProfile.active === false) {
      throw publicError('La cuenta no está activa.', 403, 'forbidden')
    }

    // Teachers must use create_teacher_notification, which validates the course,
    // classroom, enrolment and permitted message type. This generic endpoint is
    // intentionally limited to administrators and self-notifications.
    const isAdmin = callerProfile.role_id === 'admin'
    if (isAdmin) {
      const { data: canManage, error: permissionError } = await userClient.rpc('admin_has_permission', { p_permission: 'notifications.manage' })
      if (permissionError) throw permissionError
      if (!canManage) throw publicError('Tu perfil administrativo no permite generar envíos push.', 403, 'forbidden')
    }
    if (!isAdmin && targetUserId !== callerId) {
      throw publicError(
        'Los profesores deben usar el aviso docente seguro asociado a un curso.',
        403,
        'forbidden',
      )
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('role_id, active')
      .eq('id', targetUserId)
      .maybeSingle()
    if (targetError) throw targetError
    if (!targetProfile || targetProfile.active === false) {
      throw publicError('El destinatario no existe o está inactivo.', 404, 'not_found')
    }

    const priority = request.priority === 'high' || request.priority === 'low'
      ? request.priority
      : 'normal'
    const audience = targetProfile.role_id === 'admin' ? 'admin' : targetProfile.role_id === 'teacher' ? 'teacher' : 'student'

    const { data: notificationId, error: notificationError } = await adminClient.rpc('create_notification', {
      p_user_id: targetUserId,
      p_audience: audience,
      p_type: 'announcement',
      p_title: title,
      p_description: body,
      p_icon: 'notifications-outline',
      p_color: '#8B5CF6',
      p_action_url: request.url || null,
      p_related_table: 'profiles',
      p_related_id: targetUserId,
      p_metadata: {
        ...(request.data || {}),
        requested_by: callerId,
        preference_category: 'system',
        push_priority: priority,
      },
      p_fingerprint: `explicit-push:${callerId}:${crypto.randomUUID()}`,
    })
    if (notificationError) throw notificationError

    if (isAdmin && notificationId) {
      await writeAdminAudit(adminClient, {
        action: 'admin.notification.send',
        adminUserId: callerId,
        targetTable: 'notifications',
        targetId: notificationId,
        metadata: { target_user_id: targetUserId, self_test: targetUserId === callerId, priority, notification_type: 'announcement' },
      })
    }

    return json({
      queued: Boolean(notificationId),
      notificationId,
      delivery: 'notification_delivery_queue',
    })
  } catch (error) {
    return errorResponse(error, 'No se pudo poner en cola la notificación push.', {
      functionName: 'send-push-notification',
    })
  }
})
