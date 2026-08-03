import { errorResponse, methodNotAllowedResponse, corsHeaders, getAdminContext, isResponse, json, readJsonBody, writeAdminAudit, writeAdminUserHistory } from '../_shared/admin.ts'

type RequestBody = {
  active?: boolean
  profileId?: string
  reason?: string
  reactivateAt?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getAdminContext(req, 'users.manage')
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const profileId = String(body.profileId || '').trim()
    const active = Boolean(body.active)
    const reason = String(body.reason || '').trim()
    const reactivateAt = active ? null : normalizeReactivationDate(body.reactivateAt)

    if (!profileId) return json({ error: 'Falta profileId.' }, 400)
    if (!active && reason.length < 5) return json({ error: 'Indica el motivo de desactivación.' }, 400)
    if (profileId === context.adminUserId && active === false) {
      return json({ error: 'No puedes desactivar tu propia cuenta administradora.' }, 400)
    }

    const { data: targetProfile, error: targetError } = await context.adminClient
      .from('profiles')
      .select('id, alias, role_id, active, deactivation_reason, deactivated_at, reactivate_at')
      .eq('id', profileId)
      .single()

    if (targetError || !targetProfile) return json({ error: 'Usuario no encontrado.' }, 404)
    if (targetProfile.role_id === 'admin' && !context.permissions.includes('admin.roles.manage')) return json({ error: 'Solo un administrador global puede modificar otras cuentas administrativas.' }, 403)

    const beforeState = { active: targetProfile.active, deactivation_reason: targetProfile.deactivation_reason, deactivated_at: targetProfile.deactivated_at, reactivate_at: targetProfile.reactivate_at }
    const afterState = { active, deactivation_reason: active ? null : reason, deactivated_at: active ? null : new Date().toISOString(), reactivate_at: active ? null : reactivateAt }

    const { error } = await context.adminClient
      .from('profiles')
      .update(afterState)
      .eq('id', profileId)

    if (error) throw error

    await writeAdminUserHistory(context.adminClient, {
      action: active ? 'admin.user.activate' : 'admin.user.deactivate',
      adminUserId: context.adminUserId,
      profileId,
      reason: active ? 'Reactivación administrativa' : reason,
      before: beforeState,
      after: afterState,
    })

    await writeAdminAudit(context.adminClient, {
      action: active ? 'admin.user.activate' : 'admin.user.deactivate',
      adminUserId: context.adminUserId,
      targetTable: 'profiles',
      targetId: profileId,
      before: beforeState,
      after: afterState,
      metadata: {
        alias: targetProfile.alias,
        role_id: targetProfile.role_id,
      },
    })

    return json({ ok: true, profileId, active })
  } catch (error) {
    return errorResponse(error, 'No se pudo actualizar el usuario.', { functionName: 'admin-toggle-user' })
  }
})


function normalizeReactivationDate(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const timestamp = new Date(String(value))
  if (Number.isNaN(timestamp.getTime())) throw new Error('La fecha de reactivación no es válida.')
  if (timestamp.getTime() <= Date.now()) throw new Error('La reactivación debe programarse para una fecha futura.')
  return timestamp.toISOString()
}
