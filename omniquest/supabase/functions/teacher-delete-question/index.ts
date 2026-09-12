import { errorResponse, methodNotAllowedResponse, corsHeaders, getTeacherContext, isResponse, json, publicError, readJsonBody } from '../_shared/teacher.ts'

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

    const { data, error } = await context.userClient.rpc('delete_teacher_question', { p_question_id: questionId })
    if (error) {
      const message = String(error.message || '')
      if (message.includes('Archiva la pregunta antes de eliminarla definitivamente.')) throw publicError('Archiva la pregunta antes de eliminarla definitivamente.', 409, 'conflict')
      if (message.includes('Esta pregunta no se puede eliminar porque ya ha sido utilizada por alumnos')) {
        throw publicError('Esta pregunta no se puede eliminar porque ya ha sido utilizada por alumnos y forma parte de su historial. Puedes mantenerla archivada para impedir que vuelva a utilizarse.', 409, 'conflict')
      }
      if (message.includes('No se puede eliminar contenido mientras el curso esté archivado o inactivo.')) {
        throw publicError('No se puede eliminar contenido mientras el curso esté archivado o inactivo.', 409, 'conflict')
      }
      if (message.includes('Question not found or access denied')) throw publicError('Pregunta no encontrada o sin acceso.', 404, 'not_found')
      throw error
    }

    return json({ ok: true, questionId, deleted: true, data })
  } catch (error) {
    return errorResponse(error, 'No se pudo eliminar la pregunta definitivamente.', { functionName: 'teacher-delete-question' })
  }
})
