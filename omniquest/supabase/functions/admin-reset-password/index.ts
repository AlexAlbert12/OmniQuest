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

    const redirectTo = Deno.env.get('PASSWORD_RESET_REDIRECT_TO') || Deno.env.get('SITE_URL') || undefined
    const { error } = await context.adminClient.auth.resetPasswordForEmail(profile.email, {
      redirectTo,
    })

    if (error) throw error

    await writeAdminUserHistory(context.adminClient, {
      action: 'admin.user.reset_password',
      adminUserId: context.adminUserId,
      profileId,
      reason: 'Solicitud de restablecimiento de contraseña',
      before: { active: profile.active },
      after: { password_reset_requested_at: new Date().toISOString() },
    })

    await writeAdminAudit(context.adminClient, {
      action: 'admin.user.reset_password',
      adminUserId: context.adminUserId,
      targetTable: 'profiles',
      targetId: profileId,
      metadata: {
        alias: profile.alias,
        email: profile.email,
      },
    })

    return json({ ok: true, email: profile.email })
  } catch (error) {
    return errorResponse(error, 'No se pudo restablecer la contraseña.', { functionName: 'admin-reset-password' })
  }
})
