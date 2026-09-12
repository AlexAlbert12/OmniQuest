import { errorResponse, methodNotAllowedResponse, corsHeaders, ensureTeacherSubject, getTeacherContext, isResponse, json, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

type RequestBody = {
  archive?: boolean
  subjectId?: number | string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  let archive = true
  try {
    const body = await readJsonBody<RequestBody>(req)
    const subjectId = Number(body.subjectId)
    archive = body.archive !== false

    if (!Number.isFinite(subjectId)) return json({ error: 'subjectId no válido.' }, 400)

    const context = await getTeacherContext(req)
    if (isResponse(context)) return context

    const subject = await ensureTeacherSubject(
      context.adminClient,
      context.teacherUserId,
      subjectId,
      'id, name, active, is_archived, archive_reason, archived_at, retention_until, teacher_id',
    )

    const now = new Date()
    const nextState = archive
      ? {
          active: false,
          is_archived: true,
          archive_reason: 'Archivado por el profesor',
          archived_at: now.toISOString(),
          retention_until: new Date(now.getTime() + 90 * 86400000).toISOString(),
        }
      : {
          active: true,
          is_archived: false,
          archive_reason: null,
          archived_at: null,
          retention_until: null,
        }

    const { error } = await context.adminClient
      .from('subjects')
      .update(nextState)
      .eq('id', subjectId)
      .eq('teacher_id', context.teacherUserId)

    if (error) throw error

    await writeTeacherAudit(context.adminClient, {
      action: archive ? 'teacher.subject.archive' : 'teacher.subject.restore',
      teacherUserId: context.teacherUserId,
      targetTable: 'subjects',
      targetId: subjectId,
      beforeState: {
        name: subject.name,
        active: subject.active,
        is_archived: subject.is_archived,
        archive_reason: subject.archive_reason,
        archived_at: subject.archived_at,
        retention_until: subject.retention_until,
      },
      afterState: { name: subject.name, ...nextState },
      metadata: { subject_id: subjectId },
    })

    return json({ ok: true, subjectId, isArchived: archive, active: nextState.active })
  } catch (error) {
    return errorResponse(error, archive ? 'No se pudo archivar el curso.' : 'No se pudo restaurar el curso.', { functionName: 'teacher-archive-subject' })
  }
})
