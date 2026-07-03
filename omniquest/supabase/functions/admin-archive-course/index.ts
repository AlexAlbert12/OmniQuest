import { corsHeaders, getAdminContext, isResponse, json, readJsonBody, writeAdminAudit } from '../_shared/admin.ts'

type RequestBody = {
  archive?: boolean
  subjectId?: number | string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const context = await getAdminContext(req)
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const subjectId = Number(body.subjectId)
    const archive = Boolean(body.archive)

    if (!Number.isFinite(subjectId)) return json({ error: 'subjectId no válido.' }, 400)

    const { data: subject, error: subjectError } = await context.adminClient
      .from('subjects')
      .select('id, name, active, is_archived, teacher_id')
      .eq('id', subjectId)
      .single()

    if (subjectError || !subject) return json({ error: 'Curso no encontrado.' }, 404)

    const { error } = await context.adminClient
      .from('subjects')
      .update({ is_archived: archive, active: archive ? subject.active : true })
      .eq('id', subjectId)

    if (error) throw error

    await writeAdminAudit(context.adminClient, {
      action: archive ? 'admin.course.archive' : 'admin.course.restore',
      adminUserId: context.adminUserId,
      targetTable: 'subjects',
      targetId: subjectId,
      metadata: {
        name: subject.name,
        teacher_id: subject.teacher_id,
        previous_is_archived: subject.is_archived,
        next_is_archived: archive,
      },
    })

    return json({ ok: true, subjectId, isArchived: archive })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el curso.'
    return json({ error: message }, 500)
  }
})
