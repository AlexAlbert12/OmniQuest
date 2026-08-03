import { errorResponse, methodNotAllowedResponse, corsHeaders, getTeacherContext, isResponse, json, readJsonBody } from '../_shared/teacher.ts'

type RequestBody = {
  questionId?: number | string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getTeacherContext(req)
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const questionId = Number(body.questionId)

    if (!Number.isFinite(questionId)) return json({ error: 'questionId no válido.' }, 400)

    const { data, error } = await context.userClient.rpc('archive_teacher_question', { p_question_id: questionId })
    if (error) throw error

    return json({ ok: true, questionId, archived: true, data })
  } catch (error) {
    return errorResponse(error, 'No se pudo archivar la pregunta.', { functionName: 'teacher-delete-question' })
  }
})
