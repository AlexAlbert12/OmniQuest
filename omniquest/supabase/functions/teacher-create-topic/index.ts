import { publicError, errorResponse, methodNotAllowedResponse, corsHeaders, ensureTeacherSubject, getTeacherContext, isResponse, json, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

type RequestBody = {
  availableUntil?: string | null
  classroomId?: number | string | null
  description?: string | null
  icon?: string | null
  sortOrder?: number | string | null
  subjectId?: number | string
  title?: string
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
    const title = String(body.title || '').trim()
    const description = normalizeOptionalText(body.description)
    const icon = normalizeOptionalText(body.icon) || 'book-outline'
    const sortOrder = body.sortOrder === undefined || body.sortOrder === null ? null : Number(body.sortOrder)
    const availableUntil = normalizeIsoDate(body.availableUntil)

    if (!Number.isFinite(subjectId)) return json({ error: 'subjectId no válido.' }, 400)
    if (classroomId !== null && !Number.isFinite(classroomId)) return json({ error: 'classroomId no válido.' }, 400)
    if (!title) return json({ error: 'El nombre del tema es obligatorio.' }, 400)
    if (title.length > 60) return json({ error: 'El título no puede superar 60 caracteres.' }, 400)
    if ((description || '').length > 160) return json({ error: 'La descripción no puede superar 160 caracteres.' }, 400)
    if (sortOrder !== null && (!Number.isFinite(sortOrder) || sortOrder < 1)) return json({ error: 'El orden debe ser un número mayor que 0.' }, 400)

    const subject = await ensureTeacherSubject(context.adminClient, context.teacherUserId, subjectId, 'id, name, teacher_id')
    const resolvedClassroomId = classroomId ?? await ensureDefaultClassroom(context.adminClient, subjectId)

    await ensureClassroom(context.adminClient, subjectId, resolvedClassroomId)

    const nextSortOrder = sortOrder === null
      ? await getNextSortOrder(context.adminClient, subjectId, resolvedClassroomId)
      : Math.floor(sortOrder)

    const { data, error } = await context.adminClient
      .from('subject_topics')
      .insert({
        subject_id: subjectId,
        classroom_id: resolvedClassroomId,
        title,
        description,
        icon,
        sort_order: nextSortOrder,
        available_until: availableUntil,
      })
      .select('id, subject_id, classroom_id, title, description, icon, sort_order, available_until')
      .single()

    if (error) throw error

    await writeTeacherAudit(context.adminClient, {
      action: 'teacher.topic.create',
      teacherUserId: context.teacherUserId,
      targetTable: 'subject_topics',
      targetId: data.id,
      afterState: { title: data.title, icon: data.icon, sort_order: data.sort_order, available_until: data.available_until },
      metadata: { subject_id: subjectId, subject_name: subject.name, classroom_id: resolvedClassroomId },
    })

    return json({ ok: true, topic: data })
  } catch (error) {
    return errorResponse(error, 'No se pudo crear el tema.', { functionName: 'teacher-create-topic' })
  }
})

async function ensureDefaultClassroom(adminClient: any, subjectId: number) {
  const { data, error } = await adminClient.rpc('ensure_default_classroom', { p_subject_id: subjectId })
  if (error) throw error
  const classroomId = Number(data)
  if (!Number.isFinite(classroomId)) throw publicError('No se pudo resolver la clase principal del curso.', 400, 'bad_request')
  return classroomId
}

async function ensureClassroom(adminClient: any, subjectId: number, classroomId: number) {
  const { data, error } = await adminClient
    .from('classrooms')
    .select('id')
    .eq('id', classroomId)
    .eq('subject_id', subjectId)
    .neq('active', false)
    .single()

  if (error || !data) throw publicError('La clase seleccionada no pertenece a este curso.', 404, 'not_found')
}

async function getNextSortOrder(adminClient: any, subjectId: number, classroomId: number) {
  const { data, error } = await adminClient
    .from('subject_topics')
    .select('sort_order')
    .eq('subject_id', subjectId)
    .eq('classroom_id', classroomId)
    .order('sort_order', { ascending: false, nullsFirst: false })
    .limit(1)

  if (error) throw error
  const current = Number(data?.[0]?.sort_order || 0)
  return Number.isFinite(current) ? current + 1 : 1
}

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
