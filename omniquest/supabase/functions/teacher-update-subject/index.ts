import { errorResponse, methodNotAllowedResponse, corsHeaders, ensureTeacherSubject, getTeacherContext, isResponse, json, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

type RequestBody = {
  academicYear?: string | null
  description?: string | null
  educationLevel?: string | null
  icon?: string | null
  name?: string
  subjectId?: number | string
  subjectLabel?: string | null
  themeColor?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getTeacherContext(req)
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const subjectId = Number(body.subjectId)
    const name = String(body.name || '').trim()
    const description = normalizeOptionalText(body.description)
    const icon = normalizeOptionalText(body.icon)
    const educationLevel = normalizeOptionalText(body.educationLevel)
    const academicYear = normalizeOptionalText(body.academicYear)
    const subjectLabel = normalizeOptionalText(body.subjectLabel)
    const themeColor = normalizeOptionalText(body.themeColor)

    if (!Number.isFinite(subjectId)) return json({ error: 'subjectId no válido.' }, 400)
    if (!name) return json({ error: 'El nombre del curso es obligatorio.' }, 400)
    if (name.length > 50) return json({ error: 'El nombre no puede superar 50 caracteres.' }, 400)
    if ((description || '').length > 120) return json({ error: 'La descripción no puede superar 120 caracteres.' }, 400)

    const previous = await ensureTeacherSubject(
      context.adminClient,
      context.teacherUserId,
      subjectId,
      'id, name, description, icon, education_level, academic_year, subject_label, theme_color, teacher_id',
    )

    const { data, error } = await context.adminClient
      .from('subjects')
      .update({
        name,
        description,
        icon,
        education_level: educationLevel,
        academic_year: academicYear,
        subject_label: subjectLabel,
        theme_color: themeColor,
      })
      .eq('id', subjectId)
      .eq('teacher_id', context.teacherUserId)
      .select('id, name, description, icon, code, education_level, academic_year, subject_label, theme_color, is_archived')
      .single()

    if (error) throw error

    await writeTeacherAudit(context.adminClient, {
      action: 'teacher.subject.update',
      teacherUserId: context.teacherUserId,
      targetTable: 'subjects',
      targetId: subjectId,
      metadata: {
        previous: safeSubjectMetadata(previous),
        next: safeSubjectMetadata(data),
      },
    })

    return json({ ok: true, subject: data })
  } catch (error) {
    return errorResponse(error, 'No se pudo actualizar el curso.', { functionName: 'teacher-update-subject' })
  }
})

function normalizeOptionalText(value: unknown) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function safeSubjectMetadata(subject: any) {
  return {
    id: subject?.id,
    name: subject?.name,
    description: subject?.description,
    icon: subject?.icon,
    education_level: subject?.education_level,
    academic_year: subject?.academic_year,
    subject_label: subject?.subject_label,
    theme_color: subject?.theme_color,
  }
}
