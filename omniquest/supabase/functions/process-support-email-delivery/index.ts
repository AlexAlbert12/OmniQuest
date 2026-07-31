import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, json, methodNotAllowedResponse, publicErrorResponse } from '../_shared/errors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret',
}

type DeliveryRow = {
  id: number
  ticket_id: number
  message_id: number | null
  recipient_email: string
  subject: string
  attempts: number
  max_attempts: number
}

type TicketRow = {
  id: number
  subject: string
  status: string
}

type MessageRow = {
  body: string
  created_at: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return methodNotAllowedResponse()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    const configuredSecret = Deno.env.get('SUPPORT_EMAIL_QUEUE_SECRET')?.trim()
    const suppliedSecret = request.headers.get('x-cron-secret')?.trim()
    const authorization = request.headers.get('Authorization') || ''

    if (!supabaseUrl || !serviceRoleKey) {
      return publicErrorResponse('El procesador de correo de soporte no está configurado.', 500, 'service_unavailable')
    }

    const authorizedByServiceRole = authorization === `Bearer ${serviceRoleKey}`
    const authorizedByCronSecret = Boolean(configuredSecret && suppliedSecret === configuredSecret)
    if (!authorizedByServiceRole && !authorizedByCronSecret) {
      return publicErrorResponse('No autorizado.', 401, 'unauthorized')
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const mailFrom = Deno.env.get('MAIL_FROM') || Deno.env.get('RESEND_FROM_EMAIL')
    const deliveryMode = getEmailDeliveryMode()
    const testRecipient = Deno.env.get('RESEND_TEST_TO')?.trim()
    if (!resendApiKey || !mailFrom) {
      return publicErrorResponse('El correo transaccional no está configurado.', 500, 'mail_not_configured')
    }
    if (deliveryMode === 'redirect' && !testRecipient) {
      return publicErrorResponse('EMAIL_DELIVERY_MODE=redirect requiere RESEND_TEST_TO.', 500, 'mail_not_configured')
    }

    const payload = await request.json().catch(() => ({})) as { limit?: number }
    const limit = Math.min(Math.max(Number(payload.limit) || 25, 1), 100)
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const workerId = crypto.randomUUID()
    const { data, error } = await client.rpc('claim_support_email_delivery_batch', {
      p_worker_id: workerId,
      p_limit: limit,
    })
    if (error) throw error

    const summary = { claimed: 0, sent: 0, retried: 0, failed: 0 }
    const deliveries = (data || []) as DeliveryRow[]
    summary.claimed = deliveries.length

    for (const delivery of deliveries) {
      try {
        const [ticketResult, messageResult] = await Promise.all([
          client
            .from('user_support_tickets')
            .select('id, subject, status')
            .eq('id', delivery.ticket_id)
            .maybeSingle(),
          delivery.message_id
            ? client
                .from('support_ticket_messages')
                .select('body, created_at')
                .eq('id', delivery.message_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ])

        if (ticketResult.error) throw ticketResult.error
        if (messageResult.error) throw messageResult.error
        const ticket = ticketResult.data as TicketRow | null
        const message = messageResult.data as MessageRow | null
        if (!ticket || !message) throw new Error('El ticket o el mensaje ya no están disponibles.')

        const resolvedRecipient = deliveryMode === 'redirect' && testRecipient
          ? testRecipient
          : delivery.recipient_email
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: mailFrom,
            to: [resolvedRecipient],
            subject: deliveryMode === 'redirect'
              ? `[PRUEBA → ${delivery.recipient_email}] ${delivery.subject}`
              : delivery.subject,
            html: renderSupportEmail(ticket, message, deliveryMode === 'redirect' ? delivery.recipient_email : null),
          }),
        })
        const responseBody = await response.json().catch(() => ({})) as { id?: string; message?: string }

        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500
          await client.rpc('finish_support_email_delivery', {
            p_id: delivery.id,
            p_status: retryable ? 'retry' : 'failed',
            p_error_code: String(response.status),
            p_error_message: String(responseBody.message || 'El proveedor rechazó el correo.'),
            p_retry_after_seconds: retryable ? retryDelaySeconds(delivery.attempts) : undefined,
          })
          if (retryable) summary.retried += 1
          else summary.failed += 1
          continue
        }

        const finish = await client.rpc('finish_support_email_delivery', {
          p_id: delivery.id,
          p_status: 'sent',
          p_provider_message_id: responseBody.id,
        })
        if (finish.error) throw finish.error
        summary.sent += 1
      } catch (deliveryError) {
        const retryable = delivery.attempts < delivery.max_attempts
        await client.rpc('finish_support_email_delivery', {
          p_id: delivery.id,
          p_status: retryable ? 'retry' : 'failed',
          p_error_code: 'worker_error',
          p_error_message: deliveryError instanceof Error ? deliveryError.message : String(deliveryError),
          p_retry_after_seconds: retryable ? retryDelaySeconds(delivery.attempts) : undefined,
        })
        if (retryable) summary.retried += 1
        else summary.failed += 1
      }
    }

    return json({ ok: true, workerId, summary })
  } catch (error) {
    return errorResponse(error, 'No se pudo procesar el correo de soporte.', {
      functionName: 'process-support-email-delivery',
    })
  }
})

function renderSupportEmail(ticket: TicketRow, message: MessageRow, originalRecipient: string | null) {
  const safeSubject = escapeHtml(ticket.subject)
  const safeBody = escapeHtml(message.body).replace(/\n/g, '<br />')
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033">
      <h1 style="font-size:22px">Nueva respuesta de soporte</h1>
      ${originalRecipient ? `<p style="padding:10px;border-radius:8px;background:#fff4d6"><strong>Modo de prueba:</strong> destinatario original ${escapeHtml(originalRecipient)}.</p>` : ''}
      <p>El ticket <strong>#${ticket.id} · ${safeSubject}</strong> tiene una nueva respuesta.</p>
      <div style="padding:16px;border:1px solid #d9ddea;border-radius:12px;background:#f7f8fc">${safeBody}</div>
      <p style="font-size:13px;color:#667085">Estado actual: ${escapeHtml(ticket.status)}. Abre OmniQuest para responder o consultar los adjuntos.</p>
    </div>
  `
}


function getEmailDeliveryMode(): 'real' | 'redirect' {
  return (Deno.env.get('EMAIL_DELIVERY_MODE') || 'real').trim().toLowerCase() === 'redirect'
    ? 'redirect'
    : 'real'
}

function retryDelaySeconds(attempt: number) {
  return Math.min(3600, Math.max(60, 60 * (2 ** Math.max(0, attempt - 1))))
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
