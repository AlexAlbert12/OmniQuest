import { publicError, errorResponse, methodNotAllowedResponse, corsHeaders, ensureTeacherSubject, getTeacherContext, isResponse, json, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const INVITE_CODE_LENGTH = 6

type RequestBody = {
  classroomId?: number | string | null
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
    const classroomId = body.classroomId === undefined || body.classroomId === null ? null : Number(body.classroomId)

    if (!Number.isFinite(subjectId)) return json({ error: 'subjectId no válido.' }, 400)
    if (classroomId !== null && !Number.isFinite(classroomId)) return json({ error: 'classroomId no válido.' }, 400)

    const subject = await ensureTeacherSubject(
      context.adminClient,
      context.teacherUserId,
      subjectId,
      'id, name, code, teacher_id',
    )

    let previousCode = subject.code
    let targetTable = 'subjects'
    let targetId = subjectId

    if (classroomId !== null) {
      const { data: classroom, error: classroomError } = await context.adminClient
        .from('classrooms')
        .select('id, name, code, subject_id')
        .eq('id', classroomId)
        .eq('subject_id', subjectId)
        .single()

      if (classroomError || !classroom) return json({ error: 'Clase no encontrada en este curso.' }, 404)
      previousCode = classroom.code
      targetTable = 'classrooms'
      targetId = classroomId
    }

    const nextCode = await generateUniqueClassCode(context.adminClient, subjectId, classroomId)
    const updateTarget = classroomId === null ? 'subjects' : 'classrooms'
    const updateQuery = context.adminClient.from(updateTarget).update({ code: nextCode })
    const { error } = classroomId === null
      ? await updateQuery.eq('id', subjectId).eq('teacher_id', context.teacherUserId)
      : await updateQuery.eq('id', classroomId).eq('subject_id', subjectId)

    if (error) throw error

    await writeTeacherAudit(context.adminClient, {
      action: classroomId === null ? 'teacher.subject.regenerate_code' : 'teacher.classroom.regenerate_code',
      teacherUserId: context.teacherUserId,
      targetTable,
      targetId,
      metadata: {
        subject_id: subjectId,
        previous_code: previousCode,
        next_code: nextCode,
      },
    })

    return json({ ok: true, subjectId, classroomId, code: nextCode })
  } catch (error) {
    return errorResponse(error, 'No se pudo regenerar el código.', { functionName: 'teacher-regenerate-class-code' })
  }
})

function generateInviteCode() {
  let result = ''
  const bytes = new Uint8Array(INVITE_CODE_LENGTH)
  crypto.getRandomValues(bytes)

  for (const byte of bytes) {
    result += INVITE_CODE_CHARS.charAt(byte % INVITE_CODE_CHARS.length)
  }

  return result
}

async function generateUniqueClassCode(adminClient: any, excludeSubjectId?: number | null, excludeClassroomId?: number | null) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = generateInviteCode()

    let subjectQuery = adminClient.from('subjects').select('id').eq('code', candidate)
    if (excludeSubjectId) subjectQuery = subjectQuery.neq('id', excludeSubjectId)
    const { data: subjectMatch, error: subjectError } = await subjectQuery.maybeSingle()
    if (subjectError) throw subjectError
    if (subjectMatch) continue

    let classroomQuery = adminClient.from('classrooms').select('id').eq('code', candidate)
    if (excludeClassroomId) classroomQuery = classroomQuery.neq('id', excludeClassroomId)
    const { data: classroomMatch, error: classroomError } = await classroomQuery.maybeSingle()
    if (classroomError) throw classroomError
    if (!classroomMatch) return candidate
  }

  throw publicError('No se pudo generar un código único. Inténtalo de nuevo.', 503, 'service_unavailable')
}
