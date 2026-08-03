import { errorResponse, methodNotAllowedResponse, corsHeaders, getAdminContext, isResponse, json, readJsonBody, writeAdminAudit } from '../_shared/admin.ts'

type RequestBody = {
  archive?: boolean
  subjectId?: number | string
  reason?: string
  deactivateClassrooms?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getAdminContext(req, 'courses.manage')
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const subjectId = Number(body.subjectId)
    const archive = Boolean(body.archive)
    const reason = String(body.reason || '').trim()
    const deactivateClassrooms = body.deactivateClassrooms !== false

    if (!Number.isFinite(subjectId)) return json({ error: 'subjectId no válido.' }, 400)
    if (archive && reason.length < 5) return json({ error: 'Indica el motivo de archivo.' }, 400)

    const { data: subject, error: subjectError } = await context.adminClient
      .from('subjects')
      .select('id, name, active, is_archived, teacher_id, archive_reason, archived_at, retention_until')
      .eq('id', subjectId)
      .single()

    if (subjectError || !subject) return json({ error: 'Curso no encontrado.' }, 404)

    const archivedAt = archive ? new Date().toISOString() : null
    const nextState = archive
      ? { is_archived: true, active: false, archive_reason: reason, archived_at: archivedAt, retention_until: new Date(Date.now() + 90 * 86400000).toISOString() }
      : { is_archived: false, active: true, archive_reason: null, archived_at: null, retention_until: null }

    const { error } = await context.adminClient
      .from('subjects')
      .update(nextState)
      .eq('id', subjectId)

    if (error) throw error

    if (archive && deactivateClassrooms) {
      const { error: classroomError } = await context.adminClient.from('classrooms').update({ active: false, deactivation_reason: `Curso archivado: ${reason}`, deactivated_at: new Date().toISOString() }).eq('subject_id', subjectId)
      if (classroomError) throw classroomError
    }

    await writeAdminAudit(context.adminClient, {
      action: archive ? 'admin.course.archive' : 'admin.course.restore',
      adminUserId: context.adminUserId,
      targetTable: 'subjects',
      targetId: subjectId,
      before: { active: subject.active, is_archived: subject.is_archived, archive_reason: subject.archive_reason, archived_at: subject.archived_at, retention_until: subject.retention_until },
      after: nextState,
      metadata: {
        name: subject.name,
        teacher_id: subject.teacher_id,
        reason: archive ? reason : 'Restauración administrativa',
        deactivate_classrooms: archive ? deactivateClassrooms : false,
      },
    })

    return json({ ok: true, subjectId, isArchived: archive })
  } catch (error) {
    return errorResponse(error, 'No se pudo actualizar el curso.', { functionName: 'admin-archive-course' })
  }
})
