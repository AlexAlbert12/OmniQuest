import { errorResponse, methodNotAllowedResponse, corsHeaders, getAdminContext, isResponse, json, readJsonBody, writeAdminAudit, writeAdminUserHistory } from '../_shared/admin.ts'

type RequestBody = {
  profileId?: string
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
    if (!profile.email) return json({ error: 'Este usuario no tiene correo guardado.' }, 400)
    if (profile.role_id === 'admin' && !context.permissions.includes('admin.roles.manage')) return json({ error: 'Solo un administrador global puede restablecer otra cuenta administrativa.' }, 403)
    if (profile.active === false) return json({ error: 'No se puede restablecer la contraseña de un usuario inactivo.' }, 400)

    const redirectTo = getPasswordResetRedirectTo()
    const { error } = await context.adminClient.auth.resetPasswordForEmail(profile.email, {
      redirectTo,
    })

    if (error) throw error

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
      },
    })

    return json({ ok: true, email: profile.email })
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