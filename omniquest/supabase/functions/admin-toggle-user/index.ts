import { errorResponse, methodNotAllowedResponse, corsHeaders, getAdminContext, isResponse, json, readJsonBody, writeAdminAudit } from '../_shared/admin.ts'

type RequestBody = {
  active?: boolean
  profileId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getAdminContext(req)
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const profileId = String(body.profileId || '').trim()
    const active = Boolean(body.active)

    if (!profileId) return json({ error: 'Falta profileId.' }, 400)
    if (profileId === context.adminUserId && active === false) {
      return json({ error: 'No puedes desactivar tu propia cuenta administradora.' }, 400)
    }

    const { data: targetProfile, error: targetError } = await context.adminClient
      .from('profiles')
      .select('id, alias, role_id, active')
      .eq('id', profileId)
      .single()

    if (targetError || !targetProfile) return json({ error: 'Usuario no encontrado.' }, 404)

    const { error } = await context.adminClient
      .from('profiles')
      .update({ active })
      .eq('id', profileId)

    if (error) throw error

    await writeAdminAudit(context.adminClient, {
      action: active ? 'admin.user.activate' : 'admin.user.deactivate',
      adminUserId: context.adminUserId,
      targetTable: 'profiles',
      targetId: profileId,
      metadata: {
        alias: targetProfile.alias,
        previous_active: targetProfile.active,
        next_active: active,
        role_id: targetProfile.role_id,
      },
    })

    return json({ ok: true, profileId, active })
  } catch (error) {
    return errorResponse(error, 'No se pudo actualizar el usuario.', { functionName: 'admin-toggle-user' })
  }
})
