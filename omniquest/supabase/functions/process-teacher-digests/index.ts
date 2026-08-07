import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, json, methodNotAllowedResponse, publicErrorResponse } from '../_shared/errors.ts'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret' }
type Digest = { id: number; teacher_id: string; recipient_email: string; frequency: 'daily' | 'weekly'; timezone: string; snapshot: Record<string, number>; attempts: number; max_attempts: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return methodNotAllowedResponse()
  try {
    const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const secret = Deno.env.get('DIGEST_QUEUE_SECRET')?.trim(); const supplied = req.headers.get('x-cron-secret')?.trim();
    if (!url || !key) return publicErrorResponse('Servicio no configurado.', 500, 'service_unavailable')
    if (req.headers.get('Authorization') !== `Bearer ${key}` && (!secret || secret !== supplied)) return publicErrorResponse('No autorizado.', 401, 'unauthorized')
    const resend = Deno.env.get('RESEND_API_KEY'); const from = Deno.env.get('MAIL_FROM'); const deliveryMode = getEmailDeliveryMode(); const testTo = Deno.env.get('RESEND_TEST_TO')?.trim();
    if (!resend || !from) return publicErrorResponse('Correo no configurado.', 500, 'mail_not_configured')
    if (deliveryMode === 'redirect' && !testTo) return publicErrorResponse('EMAIL_DELIVERY_MODE=redirect requiere RESEND_TEST_TO.', 500, 'mail_not_configured')
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    await client.rpc('enqueue_due_teacher_digests', { p_now: new Date().toISOString() })
    const worker = crypto.randomUUID(); const { data, error } = await client.rpc('claim_teacher_digest_batch', { p_worker_id: worker, p_limit: 25 }); if (error) throw error
    const summary = { claimed: (data || []).length, sent: 0, retried: 0, failed: 0 }
    for (const digest of (data || []) as Digest[]) {
      try {
        const html = renderDigest(digest)
        const recipient = deliveryMode === 'redirect' && testTo ? testTo : digest.recipient_email
        const baseSubject = digest.frequency === 'weekly' ? 'Resumen semanal de OmniQuest' : 'Resumen diario de OmniQuest'
        const subject = deliveryMode === 'redirect' ? `[PRUEBA → ${digest.recipient_email}] ${baseSubject}` : baseSubject
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [recipient], subject, html }) })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          const retry = response.status === 429 || response.status >= 500
          await client.rpc('finish_teacher_digest', { p_id: digest.id, p_status: retry ? 'retry' : 'failed', p_error_code: String(response.status), p_error_message: String(body?.message || 'Error de Resend'), p_retry_after_seconds: Math.min(3600, 60 * Math.pow(2, digest.attempts)) })
          retry ? summary.retried++ : summary.failed++; continue
        }
        await client.rpc('finish_teacher_digest', { p_id: digest.id, p_status: 'sent', p_provider_message_id: body?.id || null })
        summary.sent++
      } catch (e) {
        const retry = digest.attempts < digest.max_attempts
        await client.rpc('finish_teacher_digest', { p_id: digest.id, p_status: retry ? 'retry' : 'failed', p_error_code: 'worker_error', p_error_message: e instanceof Error ? e.message : String(e), p_retry_after_seconds: 300 })
        retry ? summary.retried++ : summary.failed++
      }
    }
    return json({ ok: true, worker, summary })
  } catch (e) { return errorResponse(e, 'No se pudieron procesar los resúmenes docentes.', { functionName: 'process-teacher-digests' }) }
})

function renderDigest(d: Digest) {
  const inactive = Number(d.snapshot?.inactive_students || 0), reviews = Number(d.snapshot?.open_reviews || 0), sensitive = Number(d.snapshot?.sensitive_actions || 0)
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px"><div style="max-width:640px;margin:auto;background:white;border-radius:16px;padding:28px"><h1 style="color:#172554">Resumen ${d.frequency === 'weekly' ? 'semanal' : 'diario'} de OmniQuest</h1><p style="color:#475569">Información agrupada según tus preferencias y zona horaria (${escapeHtml(d.timezone)}).</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:14px;border:1px solid #e2e8f0">Alumnos sin actividad</td><td style="padding:14px;border:1px solid #e2e8f0;font-weight:bold">${inactive}</td></tr><tr><td style="padding:14px;border:1px solid #e2e8f0">Revisiones pendientes</td><td style="padding:14px;border:1px solid #e2e8f0;font-weight:bold">${reviews}</td></tr><tr><td style="padding:14px;border:1px solid #e2e8f0">Acciones sensibles</td><td style="padding:14px;border:1px solid #e2e8f0;font-weight:bold">${sensitive}</td></tr></table><p style="margin-top:24px;color:#64748b;font-size:12px">Puedes cambiar la frecuencia o darte de baja desde Ajustes docentes.</p></div></body></html>`
}
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] || c)) }
function getEmailDeliveryMode(): 'real' | 'redirect' { return (Deno.env.get('EMAIL_DELIVERY_MODE') || 'redirect').trim().toLowerCase() === 'redirect' ? 'redirect' : 'real' }