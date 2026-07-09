import { publicError, errorResponse, methodNotAllowedResponse, corsHeaders, ensureTeacherSubject, getTeacherContext, isMissingSchemaError, isResponse, json, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

type RequestBody = {
  classroomId?: number | string | null
  classroomIds?: Array<number | string>
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
    const subjectIds = normalizeIds(Array.isArray(body.subjectIds) ? body.subjectIds : body.subjectId === undefined ? [] : [body.subjectId])
    const classroomIds = normalizeIds(Array.isArray(body.classroomIds) ? body.classroomIds : body.classroomId === undefined || body.classroomId === null ? [] : [body.classroomId])

    if (!studentId) return json({ error: 'Falta studentId.' }, 400)
    if (subjectIds.length === 0 && classroomIds.length === 0) return json({ error: 'Falta curso o clase.' }, 400)

    const resolvedSubjectIds = subjectIds.length > 0
      ? subjectIds
      : await getSubjectIdsFromClassrooms(context.adminClient, classroomIds)

    const subjects = []
    for (const subjectId of resolvedSubjectIds) {
      subjects.push(await ensureTeacherSubject(context.adminClient, context.teacherUserId, subjectId, 'id, name, teacher_id'))
    }

    await ensureClassroomsBelongToSubjects(context.adminClient, classroomIds, resolvedSubjectIds)
    const deletedProgress = await deleteProgress(context.adminClient, studentId, resolvedSubjectIds, classroomIds)

    let enrollmentQuery = context.adminClient
      .from('enrollments')
      .delete({ count: 'exact' })
      .eq('student_id', studentId)

    if (classroomIds.length > 0) {
      enrollmentQuery = enrollmentQuery.in('classroom_id', classroomIds)
    } else {
      enrollmentQuery = enrollmentQuery.in('subject_id', resolvedSubjectIds)
    }

    const { count: deletedEnrollments, error: enrollmentError } = await enrollmentQuery
    if (enrollmentError) throw enrollmentError

    await syncStudentPoints(context.adminClient, studentId)

    await writeTeacherAudit(context.adminClient, {
      action: 'teacher.student.remove_from_class',
      teacherUserId: context.teacherUserId,
      targetTable: 'enrollments',
      targetId: studentId,
      metadata: {
        student_id: studentId,
        subject_ids: resolvedSubjectIds,
        subject_names: subjects.map((subject: any) => subject.name),
        classroom_ids: classroomIds,
        deleted_enrollments: deletedEnrollments,
        deleted_progress: deletedProgress,
      },
    })

    return json({ ok: true, studentId, subjectIds: resolvedSubjectIds, classroomIds, deletedEnrollments, deletedProgress })
  } catch (error) {
    return errorResponse(error, 'No se pudo quitar al alumno.', { functionName: 'teacher-remove-student-from-class' })
  }
})

function normalizeIds(values: Array<number | string>) {
  return Array.from(new Set(
    values.map((value) => Number(value)).filter((value) => Number.isFinite(value)),
  ))
}

async function getSubjectIdsFromClassrooms(adminClient: any, classroomIds: number[]) {
  if (classroomIds.length === 0) return []
  const { data, error } = await adminClient
    .from('classrooms')
    .select('subject_id')
    .in('id', classroomIds)
  if (error) throw error
  return Array.from(new Set((data || []).map((item: { subject_id: number | null }) => item.subject_id).filter((id: number | null): id is number => typeof id === 'number')))
}

async function ensureClassroomsBelongToSubjects(adminClient: any, classroomIds: number[], subjectIds: number[]) {
  if (classroomIds.length === 0) return
  const { data, error } = await adminClient
    .from('classrooms')
    .select('id, subject_id')
    .in('id', classroomIds)
    .in('subject_id', subjectIds)
  if (error) throw error
  if ((data || []).length !== classroomIds.length) {
    throw publicError('Alguna clase no pertenece a los cursos del profesor.', 403, 'forbidden')
  }
}

async function deleteProgress(adminClient: any, studentId: string, subjectIds: number[], classroomIds: number[]) {
  const deleted: Record<string, number | null> = {}
  let questionsQuery = adminClient.from('questions').select('id').in('subject_id', subjectIds)
  if (classroomIds.length > 0) questionsQuery = questionsQuery.in('classroom_id', classroomIds)
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
    if (classroomIds.length > 0) query = query.in('classroom_id', classroomIds)
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
