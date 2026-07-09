import { publicError, errorResponse, methodNotAllowedResponse, corsHeaders, ensureTeacherSubject, getTeacherContext, isResponse, json, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

type RequestBody = {
  availableUntil?: string | null
  description?: string | null
  icon?: string | null
  sortOrder?: number | string | null
  title?: string
  topicId?: number | string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getTeacherContext(req)
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const topicId = Number(body.topicId)
    const title = String(body.title || '').trim()
    const description = normalizeOptionalText(body.description)
    const icon = normalizeOptionalText(body.icon)
    const sortOrder = body.sortOrder === undefined || body.sortOrder === null ? 1 : Number(body.sortOrder)
    const availableUntil = normalizeIsoDate(body.availableUntil)

    if (!Number.isFinite(topicId)) return json({ error: 'topicId no válido.' }, 400)
    if (!title) return json({ error: 'El título del tema es obligatorio.' }, 400)
    if (title.length > 60) return json({ error: 'El título no puede superar 60 caracteres.' }, 400)
    if ((description || '').length > 160) return json({ error: 'La descripción no puede superar 160 caracteres.' }, 400)
    if (!Number.isFinite(sortOrder) || sortOrder < 1) return json({ error: 'El orden debe ser un número mayor que 0.' }, 400)

    const { data: previous, error: topicError } = await context.adminClient
      .from('subject_topics')
      .select('id, subject_id, classroom_id, title, description, icon, sort_order, available_until')
      .eq('id', topicId)
      .single()

    if (topicError || !previous) return json({ error: 'Tema no encontrado.' }, 404)

    await ensureTeacherSubject(context.adminClient, context.teacherUserId, Number(previous.subject_id), 'id, name, teacher_id')

    const { data, error } = await context.adminClient
      .from('subject_topics')
      .update({
        title,
        description,
        icon,
        sort_order: Math.floor(sortOrder),
        available_until: availableUntil,
      })
      .eq('id', topicId)
      .eq('subject_id', previous.subject_id)
      .select('id, subject_id, classroom_id, title, description, icon, sort_order, available_until')
      .single()

    if (error) throw error

    await writeTeacherAudit(context.adminClient, {
      action: 'teacher.topic.update',
      teacherUserId: context.teacherUserId,
      targetTable: 'subject_topics',
      targetId: topicId,
      metadata: {
        subject_id: previous.subject_id,
        classroom_id: previous.classroom_id,
        previous: safeTopicMetadata(previous),
        next: safeTopicMetadata(data),
      },
    })

    return json({ ok: true, topic: data })
  } catch (error) {
    return errorResponse(error, 'No se pudo actualizar el tema.', { functionName: 'teacher-update-topic' })
  }
})

function normalizeOptionalText(value: unknown) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function normalizeIsoDate(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) throw publicError('La fecha de disponibilidad no es válida.', 400, 'bad_request')
  return date.toISOString()
}

function safeTopicMetadata(topic: any) {
  return {
    id: topic?.id,
    title: topic?.title,
    description: topic?.description,
    icon: topic?.icon,
    sort_order: topic?.sort_order,
    available_until: topic?.available_until,
  }
}
