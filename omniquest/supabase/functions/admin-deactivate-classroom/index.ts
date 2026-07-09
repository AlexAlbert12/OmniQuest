import { errorResponse, methodNotAllowedResponse, corsHeaders, getAdminContext, isResponse, json, readJsonBody, writeAdminAudit } from '../_shared/admin.ts'

type RequestBody = {
  active?: boolean
  classroomId?: number | string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getAdminContext(req)
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const classroomId = Number(body.classroomId)
    const active = Boolean(body.active)

    if (!Number.isFinite(classroomId)) return json({ error: 'classroomId no válido.' }, 400)

    const { data: classroom, error: classroomError } = await context.adminClient
      .from('classrooms')
      .select('id, name, subject_id, active')
      .eq('id', classroomId)
      .single()

    if (classroomError || !classroom) return json({ error: 'Clase no encontrada.' }, 404)

    const { error } = await context.adminClient
      .from('classrooms')
      .update({ active })
      .eq('id', classroomId)

    if (error) throw error

    await writeAdminAudit(context.adminClient, {
      action: active ? 'admin.classroom.activate' : 'admin.classroom.deactivate',
      adminUserId: context.adminUserId,
      targetTable: 'classrooms',
      targetId: classroomId,
      metadata: {
        name: classroom.name,
        subject_id: classroom.subject_id,
        previous_active: classroom.active,
        next_active: active,
      },
    })

    return json({ ok: true, classroomId, active })
  } catch (error) {
    return errorResponse(error, 'No se pudo actualizar la clase.', { functionName: 'admin-deactivate-classroom' })
  }
})
