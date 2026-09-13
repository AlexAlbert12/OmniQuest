import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, getAdminContext, isResponse, json, methodNotAllowedResponse, publicError, readJsonBody, writeAdminAudit } from '../_shared/admin.ts'

type InviteAdminRequest = {
  alias?: string
  email?: string
  reason?: string
  roleId?: string
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

  let createdUserId: string | null = null
  let completed = false
  let adminClientForRollback: any = null

  try {
    const context = await getAdminContext(req, 'admin.roles.manage')
    if (isResponse(context)) return context
    adminClientForRollback = context.adminClient

    const body = await readJsonBody<InviteAdminRequest>(req)
    const email = normalizeEmail(body.email)
    const alias = String(body.alias || '').trim()
    const roleId = String(body.roleId || '').trim()
    const reason = String(body.reason || '').trim()

    if (!isValidEmail(email)) return json({ error: 'Correo electrónico no válido.', code: 'invalid_email' }, 400)
    if (alias.length < 2 || alias.length > 80) return json({ error: 'El alias debe tener entre 2 y 80 caracteres.', code: 'invalid_alias' }, 400)
    if (!roleId) return json({ error: 'Selecciona un perfil administrativo.', code: 'invalid_role' }, 400)
    if (reason.length < 5 || reason.length > 500) return json({ error: 'Indica un motivo de entre 5 y 500 caracteres.', code: 'invalid_reason' }, 400)

    const { data: role, error: roleError } = await context.adminClient
      .from('admin_roles')
      .select('id, name, description, permissions, system')
      .eq('id', roleId)
      .maybeSingle()

    if (roleError) throw roleError
    if (!role) return json({ error: 'El perfil administrativo seleccionado no existe.', code: 'invalid_role' }, 400)

    const existingUser = await findAuthUserByEmail(context.adminClient, email)
    if (existingUser) return existingAccountResponse(context.adminClient, existingUser.id)

    const redirectTo = getAdminInviteRedirectTo()
    if (!redirectTo) {
      throw publicError(
        'La invitación administrativa no está configurada. Define ADMIN_INVITE_REDIRECT_TO o SITE_URL en Supabase Functions.',
        500,
        'service_unavailable',
      )
    }

    const { data: inviteData, error: inviteError } = await context.adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { alias },
        redirectTo,
      },
    })

    if (inviteError) {
      if (isExistingAccountError(inviteError)) return json({ error: 'Ya existe una cuenta con este correo.', code: 'account_exists' }, 409)
      throw inviteError
    }

    const invitedUser = inviteData?.user
    const invitationLink = inviteData?.properties?.action_link
    if (!invitedUser?.id || !invitationLink) throw new Error('Supabase no devolvió una invitación válida.')
    createdUserId = invitedUser.id

    const { data: adminProfile, error: profileError } = await context.adminClient
      .from('profiles')
      .upsert({
        id: invitedUser.id,
        email,
        alias,
        role_id: 'admin',
        points: 0,
        active: true,
        visibility: 'private',
      }, { onConflict: 'id' })
      .select('id, alias, email, role_id, active')
      .single()

    if (profileError || !adminProfile) throw profileError || new Error('No se pudo preparar el perfil administrativo.')

    const delivery = await sendAdminInvitationEmail({
      alias,
      email,
      invitationLink,
      roleName: String(role.name || role.id),
    })
    if (!delivery.sent) throw publicError('No se pudo enviar la invitación administrativa.', 503, 'service_unavailable')

    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseAnonKey) throw publicError('El servicio no está configurado correctamente.', 500, 'service_unavailable')
    const actorClient = createClient(context.supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: context.authHeader } },
      auth: { persistSession: false },
    })

    const { data: assignment, error: assignmentError } = await actorClient.rpc('assign_admin_role', {
      p_user_id: invitedUser.id,
      p_role_id: roleId,
      p_reason: reason,
    })
    if (assignmentError) throw assignmentError

    await writeAdminAudit(context.adminClient, {
      action: 'admin.user.invite',
      adminUserId: context.adminUserId,
      targetTable: 'profiles',
      targetId: invitedUser.id,
      before: {},
      after: { active: true, alias, role_id: 'admin', admin_role_id: roleId },
      metadata: {
        alias,
        admin_role_id: roleId,
        admin_role_name: String(role.name || roleId),
        reason,
        delivery_mode: delivery.mode,
        source: 'admin-invite-admin',
      },
    })

    completed = true
    return json({
      ok: true,
      status: 'invited',
      deliveryMode: delivery.mode,
      admin: {
        id: invitedUser.id,
        alias,
        email,
        roleId,
        roleName: String((assignment as Record<string, unknown> | null)?.role_name || role.name || roleId),
      },
    })
  } catch (error) {
    if (createdUserId && !completed && adminClientForRollback) await rollbackInvitedUser(adminClientForRollback, createdUserId)
    return errorResponse(error, 'No se pudo invitar al administrador.', { functionName: 'admin-invite-admin' })
  }
})

async function existingAccountResponse(adminClient: any, userId: string) {
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.role_id === 'admin') {
    const { data: assignment } = await adminClient
      .from('admin_role_assignments')
      .select('role_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (!assignment) {
      return json({ error: 'Esta cuenta ya existe como administrador. Asígnale un perfil desde Administración y permisos.', code: 'admin_pending_assignment' }, 409)
    }
    return json({ error: 'Ya existe una cuenta administrativa con este correo.', code: 'admin_exists' }, 409)
  }

  return json({ error: 'Este correo ya pertenece a una cuenta de OmniQuest con otro rol. Utiliza un correo administrativo distinto.', code: 'account_role_conflict' }, 409)
}

async function findAuthUserByEmail(adminClient: any, email: string) {
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = (data?.users || []).find((user: { email?: string }) => normalizeEmail(user.email) === email)
    if (found) return found
    if (!data?.users || data.users.length < perPage) return null
    page += 1
  }
}

async function rollbackInvitedUser(adminClient: any, userId: string) {
  try {
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) console.warn('[admin-invite-admin] rollback failed:', error.message)
  } catch (error) {
    console.warn('[admin-invite-admin] rollback failed:', error instanceof Error ? error.message : String(error))
  }
}

function getAdminInviteRedirectTo() {
  const explicit = Deno.env.get('ADMIN_INVITE_REDIRECT_TO')?.trim()
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

async function sendAdminInvitationEmail({ alias, email, invitationLink, roleName }: {
  alias: string
  email: string
  invitationLink: string
  roleName: string
}): Promise<EmailDeliveryResult> {
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
    ? `[PRUEBA -> ${email}] Invitación para administrar OmniQuest`
    : 'Invitación para administrar OmniQuest'
  const text = buildInvitationText({ alias, delivery, invitationLink, roleName })
  const html = buildInvitationHtml({ alias, delivery, invitationLink, roleName })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: delivery.to, subject, text, html }),
  })

  if (!response.ok) {
    let detail = `Resend devolvió HTTP ${response.status}.`
    try {
      const payload = await response.json()
      detail = payload?.message || payload?.error || JSON.stringify(payload)
    } catch {
      detail = await response.text().catch(() => detail)
    }
    throw publicError(`No se pudo enviar la invitación: ${String(detail).slice(0, 240)}`, 503, 'service_unavailable')
  }

  return { sent: true, to: delivery.to, mode: delivery.mode }
}

function buildInvitationText({ alias, delivery, invitationLink, roleName }: {
  alias: string
  delivery: { to: string; mode: EmailDeliveryMode; originalTo: string }
  invitationLink: string
  roleName: string
}) {
  const demoIntro = delivery.mode === 'redirect'
    ? `[Modo demo: correo original ${delivery.originalTo}; enviado a ${delivery.to}]\n\n`
    : ''
  return `${demoIntro}${[
    `Hola ${alias},`,
    '',
    `Has recibido una invitación para acceder a OmniQuest con el perfil administrativo "${roleName}".`,
    '',
    'Abre este enlace seguro para aceptar la invitación y establecer tu contraseña:',
    invitationLink,
    '',
    'Si no esperabas esta invitación, puedes ignorar este mensaje.',
  ].join('\n')}`
}

function buildInvitationHtml({ alias, delivery, invitationLink, roleName }: {
  alias: string
  delivery: { to: string; mode: EmailDeliveryMode; originalTo: string }
  invitationLink: string
  roleName: string
}) {
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
            <div style="font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1.15;">Omni<span style="color:#a78bfa;">Quest</span></div>
            ${demoNotice}
            <h1 style="font-size:22px;line-height:1.25;margin:24px 0 10px;">Invitación administrativa</h1>
            <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Hola ${escapeHtml(alias)},</p>
            <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Has recibido acceso a OmniQuest con el perfil <strong>${escapeHtml(roleName)}</strong>.</p>
            <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">Acepta la invitación y establece una contraseña segura para activar tu acceso.</p>
            <a href="${escapeHtml(invitationLink)}" style="display:inline-block;background:#7c5cff;color:#ffffff;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:12px;">Aceptar invitación</a>
            <p style="font-size:12px;line-height:1.5;color:#64748b;margin:22px 0 0;">Si no esperabas esta invitación, puedes ignorar este correo.</p>
          </div>
          <div style="padding:18px 26px 24px;color:#94a3b8;font-size:11px;">OmniQuest · Acceso administrativo protegido</div>
        </div>
      </body>
    </html>`
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isExistingAccountError(error: { code?: string; message?: string }) {
  const code = String(error.code || '').toLowerCase()
  const message = String(error.message || '').toLowerCase()
  return code === 'user_already_exists' || message.includes('already') || message.includes('registered') || message.includes('exists')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
