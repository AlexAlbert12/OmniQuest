import { errorResponse, methodNotAllowedResponse, corsHeaders, getAdminContext, isResponse, json, readJsonBody, writeAdminAudit, writeAdminUserHistory } from '../_shared/admin.ts'

type RequestBody = {
  studentId?: string
  reason?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getAdminContext(req, 'users.manage')
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const studentId = String(body.studentId || '').trim()
    const reason = String(body.reason || '').trim()

    if (!studentId) return json({ error: 'Falta studentId.' }, 400)
    if (reason.length < 5) return json({ error: 'El motivo administrativo debe tener al menos 5 caracteres.' }, 400)
    if (reason.length > 500) return json({ error: 'El motivo administrativo es demasiado largo.' }, 400)

    const { data: profile, error: profileError } = await context.adminClient
      .from('profiles')
      .select('id, alias, role_id, points')
      .eq('id', studentId)
      .single()

    if (profileError || !profile) return json({ error: 'Alumno no encontrado.' }, 404)
    if (profile.role_id !== 'student' && profile.role_id !== 'guest') {
      return json({ error: 'Solo se puede eliminar progreso de alumnos o invitados.' }, 400)
    }

    const deleted: Record<string, number | null> = {}
    const tables = ['subject_scores', 'topic_scores', 'attempt_history', 'student_badges']

    for (const table of tables) {
      const { count, error } = await context.adminClient
        .from(table)
        .delete({ count: 'exact' })
        .eq('student_id', studentId)

      if (error && !isMissingSchemaError(error.code)) throw error
      deleted[table] = error ? null : count
    }

    const { data: syncedPoints, error: syncPointsError } = await context.adminClient
      .rpc('sync_student_points', { student_id: studentId })

    if (syncPointsError) throw syncPointsError

    await writeAdminUserHistory(context.adminClient, {
      action: 'admin.student.delete_progress',
      adminUserId: context.adminUserId,
      profileId: studentId,
      reason,
      before: { points: profile.points },
      after: { points: syncedPoints, deleted },
    })

    await writeAdminAudit(context.adminClient, {
      action: 'admin.student.delete_progress',
      adminUserId: context.adminUserId,
      targetTable: 'profiles',
      targetId: studentId,
      before: { points: profile.points },
      after: { points: syncedPoints, deleted },
      metadata: {
        alias: profile.alias,
        reason,
        deleted_records: deleted,
      },
    })

    return json({ ok: true, studentId, deleted, points: syncedPoints })
  } catch (error) {
    return errorResponse(error, 'No se pudo eliminar el progreso.', { functionName: 'admin-delete-student-progress' })
  }
})

function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204'
}
