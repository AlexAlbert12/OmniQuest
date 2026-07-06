import { corsHeaders, ensureTeacherSubject, getTeacherContext, isResponse, json, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

type RequestBody = {
  questionId?: number | string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const context = await getTeacherContext(req)
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const questionId = Number(body.questionId)

    if (!Number.isFinite(questionId)) return json({ error: 'questionId no válido.' }, 400)

    const { data: question, error: questionError } = await context.adminClient
      .from('questions')
      .select('id, subject_id, classroom_id, topic_id, text, type')
      .eq('id', questionId)
      .single()

    if (questionError || !question) return json({ error: 'Pregunta no encontrada.' }, 404)

    const subject = await ensureTeacherSubject(context.adminClient, context.teacherUserId, Number(question.subject_id), 'id, name, teacher_id')

    const { error } = await context.adminClient
      .from('questions')
      .delete()
      .eq('id', questionId)
      .eq('subject_id', question.subject_id)

    if (error) throw error

    await writeTeacherAudit(context.adminClient, {
      action: 'teacher.question.delete',
      teacherUserId: context.teacherUserId,
      targetTable: 'questions',
      targetId: questionId,
      metadata: {
        subject_id: question.subject_id,
        subject_name: subject.name,
        classroom_id: question.classroom_id,
        topic_id: question.topic_id,
        type: question.type,
        text: question.text,
      },
    })

    return json({ ok: true, questionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo borrar la pregunta.'
    return json({ error: message }, 500)
  }
})
