import { corsHeaders, errorResponse, getAdminContext, isResponse, json, methodNotAllowedResponse, publicError, readJsonBody, writeAdminAudit, writeAdminUserHistory } from '../_shared/admin.ts'

type RequestBody = {
  profileId?: string
}

type EmailDeliveryMode = 'real' | 'redirect'

type EmailDeliveryResult = {
  mode: EmailDeliveryMode
  sent: boolean
  to?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getAdminContext(req, 'users.security')
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const profileId = String(body.profileId || '').trim()

    if (!profileId) return json({ error: 'Falta profileId.' }, 400)

    const { data: profile, error: profileError } = await context.adminClient
      .from('profiles')
      .select('id, alias, email, role_id, active')
      .eq('id', profileId)
      .single()

    if (profileError || !profile) return json({ error: 'Usuario no encontrado.' }, 404)
    if (profile.role_id === 'admin' && !context.permissions.includes('admin.roles.manage')) return json({ error: 'Solo un administrador global puede restablecer otra cuenta administrativa.' }, 403)
    if (profile.active === false) return json({ error: 'No se puede restablecer la contraseña de un usuario inactivo.' }, 400)

    const { data: authUserData, error: authUserError } = await context.adminClient.auth.admin.getUserById(profileId)
    const email = String(authUserData?.user?.email || profile.email || '').trim().toLowerCase()
    if (authUserError || !email) return json({ error: 'No se pudo recuperar el correo de acceso del usuario.' }, 404)

    const redirectTo = getPasswordResetRedirectTo()
    if (!redirectTo) {
      throw publicError(
        'La recuperación no está configurada. Define PASSWORD_RESET_REDIRECT_TO o SITE_URL en Supabase Functions.',
        500,
        'service_unavailable',
      )
    }

    const { data: recoveryData, error: recoveryError } = await context.adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })
    if (recoveryError) throw recoveryError

    const recoveryLink = recoveryData?.properties?.action_link
    if (!recoveryLink) throw new Error('Supabase did not return a recovery link.')

    const delivery = await sendRecoveryEmail({ email, recoveryLink, alias: profile.alias })
    if (!delivery.sent) throw publicError('No se pudo enviar el correo de recuperación.', 503, 'service_unavailable')

    const requestedAt = new Date().toISOString()
    const beforeState = { active: profile.active, password_reset_requested_at: null }
    const afterState = { active: profile.active, password_reset_requested_at: requestedAt }

    await writeAdminUserHistory(context.adminClient, {
      action: 'admin.user.reset_password',
      adminUserId: context.adminUserId,
      profileId,
      reason: 'Solicitud de restablecimiento de contraseña',
      before: beforeState,
      after: afterState,
    })

    await writeAdminAudit(context.adminClient, {
      action: 'admin.user.reset_password',
      adminUserId: context.adminUserId,
      targetTable: 'profiles',
      targetId: profileId,
      before: beforeState,
      after: afterState,
      metadata: {
        alias: profile.alias,
        delivery_mode: delivery.mode,
      },
    })

    return json({ ok: true, email, deliveryMode: delivery.mode })
  } catch (error) {
    return errorResponse(error, 'No se pudo restablecer la contraseña.', { functionName: 'admin-reset-password' })
  }
})

function getPasswordResetRedirectTo() {
  const explicit = Deno.env.get('PASSWORD_RESET_REDIRECT_TO')?.trim() || Deno.env.get('PASSWORD_RECOVERY_REDIRECT_URL')?.trim()
  if (explicit) return explicit
  const siteUrl = Deno.env.get('SITE_URL')?.trim()
  if (!siteUrl) return undefined
  try { return new URL('/update-password', siteUrl).toString() } catch { return undefined }
}

function getEmailDeliveryMode(): EmailDeliveryMode {
  return (Deno.env.get('EMAIL_DELIVERY_MODE') || 'redirect').trim().toLowerCase() === 'redirect' ? 'redirect' : 'real'
}

function resolveEmailDelivery(email: string) {
  const mode = getEmailDeliveryMode()
  const testTo = Deno.env.get('RESEND_TEST_TO')?.trim()
  return mode === 'redirect' && testTo
    ? { to: testTo, mode: 'redirect' as const, originalTo: email }
    : { to: email, mode: 'real' as const, originalTo: email }
}

async function sendRecoveryEmail({ email, recoveryLink, alias }: { email: string; recoveryLink: string; alias?: string | null }): Promise<EmailDeliveryResult> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('MAIL_FROM') || Deno.env.get('RESEND_FROM_EMAIL')
  const deliveryMode = getEmailDeliveryMode()
  const testTo = Deno.env.get('RESEND_TEST_TO')?.trim()

  if (!resendApiKey || !from) {
    throw publicError('El correo no está configurado. Define RESEND_API_KEY y MAIL_FROM en Supabase Functions.', 500, 'mail_not_configured')
  }
  if (deliveryMode === 'redirect' && !testTo) {
    throw publicError('EMAIL_DELIVERY_MODE=redirect requiere RESEND_TEST_TO.', 500, 'mail_not_configured')
  }

  const delivery = resolveEmailDelivery(email)
  const subject = delivery.mode === 'redirect'
    ? `[PRUEBA -> ${email}] Restablece tu contraseña de OmniQuest`
    : 'Restablece tu contraseña de OmniQuest'
  const text = buildRecoveryText({ alias, delivery, recoveryLink })
  const html = buildRecoveryHtml({ alias, delivery, recoveryLink })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: delivery.to, subject, text, html }),
  })

  if (!response.ok) {
    let detail = `Resend devolvio HTTP ${response.status}.`
    try {
      const payload = await response.json()
      detail = payload?.message || payload?.error || JSON.stringify(payload)
    } catch {
      detail = await response.text().catch(() => detail)
    }
    throw publicError(`No se pudo enviar el correo de recuperacion: ${String(detail).slice(0, 240)}`, 503, 'service_unavailable')
  }

  return { sent: true, to: delivery.to, mode: delivery.mode }
}

function buildRecoveryText({ alias, delivery, recoveryLink }: {
  alias?: string | null
  delivery: { to: string; mode: EmailDeliveryMode; originalTo: string }
  recoveryLink: string
}) {
  const greeting = alias?.trim() ? `Hola ${alias.trim()},` : 'Hola,'
  const demoIntro = delivery.mode === 'redirect'
    ? `[Modo demo: correo original ${delivery.originalTo}; enviado a ${delivery.to}]\n\n`
    : ''
  return `${demoIntro}${[
    greeting,
    '',
    'Un administrador de OmniQuest ha solicitado un enlace seguro para restablecer tu contraseña.',
    '',
    'Abre este enlace para crear una contraseña nueva:',
    recoveryLink,
    '',
    'Si no esperabas este mensaje, puedes ignorarlo.',
  ].join('\n')}`
}

function buildRecoveryHtml({ alias, delivery, recoveryLink }: {
  alias?: string | null
  delivery: { to: string; mode: EmailDeliveryMode; originalTo: string }
  recoveryLink: string
}) {
  const greeting = alias?.trim() ? `Hola ${escapeHtml(alias.trim())},` : 'Hola,'
  const demoNotice = delivery.mode === 'redirect'
    ? `<p style="color:#b45309;font-size:12px;line-height:1.5;">Modo demo: destinatario original ${escapeHtml(delivery.originalTo)}.</p>`
    : ''
  return `
    <!doctype html>
    <html lang="es">
      <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>OmniQuest</title></head>
      <body style="margin:0;background:#07162d;padding:28px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.28);">
          <div style="padding:24px 26px 10px;">
            <div style="font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1.15;">Omni<span style="color:#38bdf8;">Quest</span></div>
            <p style="margin:8px 0 0;color:#475569;font-size:15px;line-height:1.45;">Recuperacion segura de acceso.</p>
          </div>
          <div style="padding:12px 26px 26px;">
            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Restablece tu contrasena</h1>
            <p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">${greeting} un administrador de OmniQuest ha solicitado un enlace seguro para recuperar tu acceso.</p>
            <div style="margin:22px 0;border:1px solid #dbeafe;background:#eff6ff;border-radius:16px;padding:18px;text-align:center;">
              <a href="${escapeHtml(recoveryLink)}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:800;border-radius:12px;padding:13px 20px;">Restablecer contrasena</a>
              <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">El enlace es de un solo uso. OmniQuest nunca enviara una contrasena por correo.</p>
            </div>
            ${demoNotice}
            <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">Si no esperabas este mensaje, puedes ignorarlo.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
