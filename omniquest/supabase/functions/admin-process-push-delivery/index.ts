import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, getAdminContext, isResponse, json, methodNotAllowedResponse, publicError, publicErrorResponse, readJsonBody } from '../_shared/admin.ts'

type RequestBody = { queueId?: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getAdminContext(req, 'notifications.manage')
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const queueId = Number(body.queueId)
    if (!Number.isInteger(queueId) || queueId <= 0) throw publicError('El envío push no es válido.', 400, 'bad_request')

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    if (!anonKey || !serviceRoleKey) return publicErrorResponse('El procesador push no está configurado.', 500, 'service_unavailable')

    const userClient = createClient(context.supabaseUrl, anonKey, { global: { headers: { Authorization: context.authHeader } }, auth: { autoRefreshToken: false, persistSession: false } })
    const { error: prepareError } = await userClient.rpc('admin_request_push_delivery_processing', { p_queue_id: queueId })
    if (prepareError) throw prepareError

    const workerResponse = await fetch(`${context.supabaseUrl.replace(/\/$/, '')}/functions/v1/process-notification-delivery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId }),
    })
    const workerPayload = await workerResponse.json().catch(() => ({}))
    if (!workerResponse.ok) throw publicError('Se ha solicitado el procesamiento, pero el worker no respondió correctamente.', 502, 'worker_unavailable')

    return json({ ok: true, queueId, worker: workerPayload })
  } catch (error) {
    return errorResponse(error, 'No se pudo procesar ahora el envío push.', { functionName: 'admin-process-push-delivery' })
  }
})
