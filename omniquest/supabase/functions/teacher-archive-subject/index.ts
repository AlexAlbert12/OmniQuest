import { corsHeaders, ensureTeacherSubject, getTeacherContext, isResponse, json, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

type RequestBody = {
  archive?: boolean
  subjectId?: number | string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const context = await getTeacherContext(req)
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const subjectId = Number(body.subjectId)
    const archive = body.archive !== false

    if (!Number.isFinite(subjectId)) return json({ error: 'subjectId no válido.' }, 400)

    const subject = await ensureTeacherSubject(
      context.adminClient,
      context.teacherUserId,
      subjectId,
      'id, name, active, is_archived, teacher_id',
    )

    const { error } = await context.adminClient
      .from('subjects')
      .update({ is_archived: archive, active: archive ? subject.active : true })
      .eq('id', subjectId)
      .eq('teacher_id', context.teacherUserId)

    if (error) throw error

    await writeTeacherAudit(context.adminClient, {
      action: archive ? 'teacher.subject.archive' : 'teacher.subject.restore',
      teacherUserId: context.teacherUserId,
      targetTable: 'subjects',
      targetId: subjectId,
      metadata: {
        name: subject.name,
        previous_is_archived: subject.is_archived,
        next_is_archived: archive,
      },
    })

    return json({ ok: true, subjectId, isArchived: archive })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo archivar el curso.'
    return json({ error: message }, 500)
  }
})
