import { errorResponse, methodNotAllowedResponse, corsHeaders, ensureTeacherSubject, getTeacherContext, isResponse, json, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

type RequestBody = {
  archive?: boolean
  subjectId?: number | string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

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
      beforeState: { name: subject.name, is_archived: subject.is_archived },
      afterState: { name: subject.name, is_archived: archive },
      metadata: { subject_id: subjectId },
    })

    return json({ ok: true, subjectId, isArchived: archive })
  } catch (error) {
    return errorResponse(error, 'No se pudo archivar el curso.', { functionName: 'teacher-archive-subject' })
  }
})
