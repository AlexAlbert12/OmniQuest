import { errorResponse, methodNotAllowedResponse, corsHeaders, ensureTeacherSubject, getTeacherContext, isMissingSchemaError, isResponse, json, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

type RequestBody = {
  classroomId?: number | string | null
  studentId?: string
  subjectId?: number | string
  subjectIds?: Array<number | string>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getTeacherContext(req)
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const studentId = String(body.studentId || '').trim()
    const subjectIds = normalizeSubjectIds(body)
    const classroomId = body.classroomId === undefined || body.classroomId === null ? null : Number(body.classroomId)

    if (!studentId) return json({ error: 'Falta studentId.' }, 400)
    if (subjectIds.length === 0) return json({ error: 'Falta subjectId o subjectIds.' }, 400)
    if (classroomId !== null && !Number.isFinite(classroomId)) return json({ error: 'classroomId no válido.' }, 400)

    const subjects = await ensureSubjects(context.adminClient, context.teacherUserId, subjectIds)
    const deleted = await deleteProgress(context.adminClient, studentId, subjectIds, classroomId)
    await syncStudentPoints(context.adminClient, studentId)

    await writeTeacherAudit(context.adminClient, {
      action: 'teacher.student.reset_progress',
      teacherUserId: context.teacherUserId,
      targetTable: 'profiles',
      targetId: studentId,
      metadata: {
        subject_ids: subjectIds,
        subject_names: subjects.map((subject: any) => subject.name),
        classroom_id: classroomId,
        deleted,
      },
    })

    return json({ ok: true, studentId, subjectIds, classroomId, deleted })
  } catch (error) {
    return errorResponse(error, 'No se pudo reiniciar el progreso.', { functionName: 'teacher-reset-student-progress' })
  }
})

function normalizeSubjectIds(body: RequestBody) {
  const ids = Array.isArray(body.subjectIds) ? body.subjectIds : body.subjectId === undefined ? [] : [body.subjectId]
  return Array.from(new Set(
    ids.map((value) => Number(value)).filter((value) => Number.isFinite(value)),
  ))
}

async function ensureSubjects(adminClient: any, teacherUserId: string, subjectIds: number[]) {
  const subjects = []
  for (const subjectId of subjectIds) {
    subjects.push(await ensureTeacherSubject(adminClient, teacherUserId, subjectId, 'id, name, teacher_id'))
  }
  return subjects
}

async function deleteProgress(adminClient: any, studentId: string, subjectIds: number[], classroomId: number | null) {
  const deleted: Record<string, number | null> = {}
  let questionsQuery = adminClient.from('questions').select('id').in('subject_id', subjectIds)
  if (classroomId !== null) questionsQuery = questionsQuery.eq('classroom_id', classroomId)
  const { data: questions, error: questionsError } = await questionsQuery
  if (questionsError) throw questionsError

  const questionIds = (questions || []).map((question: { id: number | null }) => question.id).filter((id: number | null): id is number => typeof id === 'number')

  if (questionIds.length > 0) {
    const { count, error } = await adminClient
      .from('attempt_history')
      .delete({ count: 'exact' })
      .eq('student_id', studentId)
      .in('question_id', questionIds)
    if (error && !isMissingSchemaError(error.code)) throw error
    deleted.attempt_history = error ? null : count
  } else {
    deleted.attempt_history = 0
  }

  for (const table of ['topic_scores', 'subject_scores']) {
    let query = adminClient.from(table).delete({ count: 'exact' }).eq('student_id', studentId).in('subject_id', subjectIds)
    if (classroomId !== null) query = query.eq('classroom_id', classroomId)
    const { count, error } = await query
    if (error && !isMissingSchemaError(error.code)) throw error
    deleted[table] = error ? null : count
  }

  return deleted
}

async function syncStudentPoints(adminClient: any, studentId: string) {
  const { error } = await adminClient.rpc('sync_student_points', { student_id: studentId })
  if (error && !isMissingSchemaError(error.code)) throw error
}
