import { errorResponse, methodNotAllowedResponse, corsHeaders, getAdminContext, isResponse, json, readJsonBody, writeAdminAudit } from '../_shared/admin.ts'

type RequestBody = {
  active?: boolean
  classroomId?: number | string
  reason?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getAdminContext(req, 'courses.manage')
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const classroomId = Number(body.classroomId)
    const active = Boolean(body.active)
    const reason = String(body.reason || '').trim()

    if (!Number.isFinite(classroomId)) return json({ error: 'classroomId no válido.' }, 400)
    if (!active && reason.length < 5) return json({ error: 'Indica el motivo de desactivación.' }, 400)

    const { data: classroom, error: classroomError } = await context.adminClient
      .from('classrooms')
      .select('id, name, subject_id, active, deactivation_reason, deactivated_at')
      .eq('id', classroomId)
      .single()

    if (classroomError || !classroom) return json({ error: 'Clase no encontrada.' }, 404)

    const nextState = { active, deactivation_reason: active ? null : reason, deactivated_at: active ? null : new Date().toISOString() }

    const { error } = await context.adminClient
      .from('classrooms')
      .update(nextState)
      .eq('id', classroomId)

    if (error) throw error

    await writeAdminAudit(context.adminClient, {
      action: active ? 'admin.classroom.activate' : 'admin.classroom.deactivate',
      adminUserId: context.adminUserId,
      targetTable: 'classrooms',
      targetId: classroomId,
      before: { active: classroom.active, deactivation_reason: classroom.deactivation_reason, deactivated_at: classroom.deactivated_at },
      after: nextState,
      metadata: {
        name: classroom.name,
        subject_id: classroom.subject_id,
        reason: active ? 'Reactivación administrativa' : reason,
      },
    })

    return json({ ok: true, classroomId, active })
  } catch (error) {
    return errorResponse(error, 'No se pudo actualizar la clase.', { functionName: 'admin-deactivate-classroom' })
  }
})
