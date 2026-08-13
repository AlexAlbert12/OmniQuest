import { corsHeaders, errorResponse, getAdminContext, isResponse, json, methodNotAllowedResponse, readJsonBody, writeAdminAudit, writeAdminUserHistory } from '../_shared/admin.ts'

type BulkAction = 'activate_users' | 'deactivate_users' | 'archive_courses' | 'restore_courses' | 'transfer_courses' | 'delete_courses' | 'activate_classrooms' | 'deactivate_classrooms'
type BulkEntity = 'profiles' | 'subjects' | 'classrooms'
type RequestBody = {
  action?: BulkAction
  entity?: BulkEntity
  ids?: Array<string | number>
  reason?: string
  reactivateAt?: string | null
  targetTeacherId?: string | null
  deactivateClassrooms?: boolean
}

const permissionByAction: Record<BulkAction, string> = {
  activate_users: 'users.manage', deactivate_users: 'users.manage',
  archive_courses: 'courses.manage', restore_courses: 'courses.manage',
  transfer_courses: 'courses.transfer', delete_courses: 'courses.delete',
  activate_classrooms: 'courses.manage', deactivate_classrooms: 'courses.manage',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const body = await readJsonBody<RequestBody>(req)
    const action = body.action
    if (!action || !(action in permissionByAction)) return json({ error: 'Acción por lote no válida.' }, 400)
    const context = await getAdminContext(req, permissionByAction[action])
    if (isResponse(context)) return context

    const ids = normalizeIds(body.ids)
    if (ids.length === 0) return json({ error: 'Selecciona al menos un elemento.' }, 400)
    if (ids.length > 100) return json({ error: 'El máximo por operación es de 100 elementos.' }, 400)
    validateEntity(action, body.entity)

    const reason = String(body.reason || '').trim()
    if (requiresReason(action) && reason.length < 5) return json({ error: 'Indica un motivo administrativo de al menos cinco caracteres.' }, 400)

    const reactivateAt = action === 'deactivate_users' ? normalizeReactivationDate(body.reactivateAt) : null
    let affected = 0
    if (body.entity === 'profiles') affected = await updateProfiles(context, action, ids.map(String), reason, reactivateAt)
    if (body.entity === 'subjects') affected = await updateSubjects(context, action, ids.map(Number), reason, body.targetTeacherId || null, body.deactivateClassrooms !== false)
    if (body.entity === 'classrooms') affected = await updateClassrooms(context, action, ids.map(Number), reason)

    await writeAdminAudit(context.adminClient, {
      action: `admin.bulk.${action}`,
      adminUserId: context.adminUserId,
      targetTable: body.entity,
      metadata: { affected, ids: ids.slice(0, 100), reason, target_teacher_id: body.targetTeacherId || null, deactivate_classrooms: body.deactivateClassrooms !== false },
    })

    return json({ ok: true, action, entity: body.entity, affected })
  } catch (error) {
    return errorResponse(error, 'No se pudo completar la operación por lote.', { functionName: 'admin-bulk-operations' })
  }
})

function normalizeIds(values: RequestBody['ids']) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => String(value).trim().length > 0))]
}

function normalizeReactivationDate(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const timestamp = new Date(String(value))
  if (Number.isNaN(timestamp.getTime())) throw new Error('La fecha de reactivación no es válida.')
  if (timestamp.getTime() <= Date.now()) throw new Error('La reactivación debe programarse para una fecha futura.')
  return timestamp.toISOString()
}

function requiresReason(action: BulkAction) {
  return ['deactivate_users','archive_courses','transfer_courses','delete_courses','deactivate_classrooms'].includes(action)
}

function validateEntity(action: BulkAction, entity?: BulkEntity) {
  const expected = action.endsWith('_users') ? 'profiles' : action.endsWith('_courses') ? 'subjects' : 'classrooms'
  if (entity !== expected) throw new Error('La entidad no corresponde con la acción solicitada.')
}

async function updateProfiles(context: any, action: BulkAction, ids: string[], reason: string, reactivateAt: string | null) {
  const active = action === 'activate_users'
  if (!active && ids.includes(context.adminUserId)) throw new Error('No puedes desactivar tu propia cuenta administradora.')

  const { data: profiles, error: readError } = await context.adminClient.from('profiles').select('id, alias, role_id, active, deactivation_reason, deactivated_at, reactivate_at').in('id', ids)
  if (readError) throw readError
  if ((profiles || []).length !== ids.length) throw new Error('Uno o más usuarios ya no existen.')
  if ((profiles || []).some((profile: any) => profile.role_id === 'admin') && !context.permissions.includes('admin.roles.manage')) throw new Error('Solo un administrador global puede modificar otras cuentas administrativas.')

  const now = new Date().toISOString()
  const nextState = { active, deactivation_reason: active ? null : reason, deactivated_at: active ? null : now, reactivate_at: active ? null : reactivateAt }
  const { error: updateError } = await context.adminClient.from('profiles').update(nextState).in('id', ids)
  if (updateError) throw updateError

  for (const profile of profiles || []) {
    const auditAction = active ? 'admin.user.activate' : 'admin.user.deactivate'
    const before = { active: profile.active, deactivation_reason: profile.deactivation_reason, deactivated_at: profile.deactivated_at, reactivate_at: profile.reactivate_at }
    const auditReason = active ? 'Reactivación administrativa' : reason
    await writeAdminUserHistory(context.adminClient, { action: auditAction, adminUserId: context.adminUserId, profileId: profile.id, before, after: nextState, reason: auditReason })
    await writeAdminAudit(context.adminClient, { action: auditAction, adminUserId: context.adminUserId, targetTable: 'profiles', targetId: profile.id, before, after: nextState, metadata: { reason: auditReason } })
  }
  return profiles?.length || 0
}

async function updateSubjects(context: any, action: BulkAction, ids: number[], reason: string, targetTeacherId: string | null, deactivateClassrooms: boolean) {
  if (ids.some((id) => !Number.isFinite(id))) throw new Error('Identificadores de curso no válidos.')
  const { data: subjects, error: readError } = await context.adminClient.from('subjects').select('id, name, teacher_id, active, is_archived, archive_reason, archived_at, retention_until').in('id', ids)
  if (readError) throw readError
  if ((subjects || []).length !== ids.length) throw new Error('Uno o más cursos ya no existen.')

  if (action === 'transfer_courses') {
    if (!targetTeacherId) throw new Error('Selecciona el nuevo profesor propietario.')
    const { data: teacher, error: teacherError } = await context.adminClient.from('profiles').select('id, role_id, active').eq('id', targetTeacherId).single()
    if (teacherError || !teacher || teacher.role_id !== 'teacher' || teacher.active === false) throw new Error('El nuevo propietario debe ser un profesor activo.')
    const { error } = await context.adminClient.from('subjects').update({ teacher_id: targetTeacherId }).in('id', ids)
    if (error) throw error
    for (const subject of subjects || []) await writeAdminAudit(context.adminClient, { action: 'admin.course.transfer', adminUserId: context.adminUserId, targetTable: 'subjects', targetId: subject.id, metadata: { previous_teacher_id: subject.teacher_id, next_teacher_id: targetTeacherId, reason } })
    return subjects?.length || 0
  }

  if (action === 'archive_courses') {
    const now = new Date()
    const retentionUntil = new Date(now.getTime() + 90 * 86400000).toISOString()
    const { error } = await context.adminClient.from('subjects').update({ active: false, is_archived: true, archive_reason: reason, archived_at: now.toISOString(), retention_until: retentionUntil }).in('id', ids)
    if (error) throw error
    if (deactivateClassrooms) {
      const { error: classroomError } = await context.adminClient.from('classrooms').update({ active: false, deactivation_reason: `Curso archivado: ${reason}`, deactivated_at: now.toISOString() }).in('subject_id', ids)
      if (classroomError) throw classroomError
    }
    for (const subject of subjects || []) await writeAdminAudit(context.adminClient, { action: 'admin.course.archive', adminUserId: context.adminUserId, targetTable: 'subjects', targetId: subject.id, metadata: { before: { active: subject.active, is_archived: subject.is_archived, archive_reason: subject.archive_reason, archived_at: subject.archived_at, retention_until: subject.retention_until }, after: { active: false, is_archived: true, archive_reason: reason, archived_at: now.toISOString(), retention_until: retentionUntil }, deactivate_classrooms: deactivateClassrooms } })
    return subjects?.length || 0
  }

  if (action === 'restore_courses') {
    const teacherIds = [...new Set<string>((subjects || []).map((subject: any) => String(subject.teacher_id || '')).filter(Boolean))]
    if (teacherIds.length !== (subjects || []).length) throw new Error('Transfiere primero los cursos sin profesor antes de restaurarlos.')
    const { data: teachers, error: teacherError } = await context.adminClient.from('profiles').select('id, active, role_id').in('id', teacherIds)
    if (teacherError) throw teacherError
    const validTeachers = new Set<string>((teachers || []).filter((teacher: any) => teacher.role_id === 'teacher' && teacher.active !== false).map((teacher: any) => String(teacher.id)))
    if (teacherIds.some((teacherId) => !validTeachers.has(teacherId))) throw new Error('Todos los cursos deben tener un profesor propietario activo antes de restaurarse.')
    const { error } = await context.adminClient.from('subjects').update({ active: true, is_archived: false, archive_reason: null, archived_at: null, retention_until: null }).in('id', ids)
    if (error) throw error
    for (const subject of subjects || []) await writeAdminAudit(context.adminClient, { action: 'admin.course.restore', adminUserId: context.adminUserId, targetTable: 'subjects', targetId: subject.id, metadata: { before: { active: subject.active, is_archived: subject.is_archived, archive_reason: subject.archive_reason, archived_at: subject.archived_at, retention_until: subject.retention_until }, after: { active: true, is_archived: false, archive_reason: null, archived_at: null, retention_until: null }, classrooms_reactivated: false } })

    return subjects?.length || 0
  }

  if (action === 'delete_courses') {
    const now = Date.now()
    for (const subject of subjects || []) {
      if (!subject.is_archived) throw new Error(`El curso ${subject.name} debe estar archivado antes de eliminarse.`)
      if (!subject.retention_until || new Date(subject.retention_until).getTime() > now) throw new Error(`El curso ${subject.name} sigue dentro del periodo de conservación.`)
      const [{ count: classroomCount, error: classroomError }, { count: enrollmentCount, error: enrollmentError }] = await Promise.all([
        context.adminClient.from('classrooms').select('id', { count: 'exact', head: true }).eq('subject_id', subject.id),
        context.adminClient.from('enrollments').select('id', { count: 'exact', head: true }).eq('subject_id', subject.id),
      ])
      if (classroomError || enrollmentError) throw classroomError || enrollmentError
      if ((classroomCount || 0) > 0 || (enrollmentCount || 0) > 0) throw new Error(`El curso ${subject.name} conserva clases o matrículas y no puede eliminarse.`)
    }
    const { error } = await context.adminClient.from('subjects').delete().in('id', ids)
    if (error) throw error
    for (const subject of subjects || []) await writeAdminAudit(context.adminClient, { action: 'admin.course.delete', adminUserId: context.adminUserId, targetTable: 'subjects', targetId: subject.id, metadata: { name: subject.name, previous_teacher_id: subject.teacher_id, archived_at: subject.archived_at, retention_until: subject.retention_until, reason } })
    return subjects?.length || 0
  }

  throw new Error('Acción de curso no compatible.')
}

async function updateClassrooms(context: any, action: BulkAction, ids: number[], reason: string) {
  if (ids.some((id) => !Number.isFinite(id))) throw new Error('Identificadores de clase no válidos.')
  const active = action === 'activate_classrooms'
  const { data: classrooms, error: readError } = await context.adminClient.from('classrooms').select('id, name, subject_id, active, deactivation_reason, deactivated_at').in('id', ids)
  if (readError) throw readError
  if ((classrooms || []).length !== ids.length) throw new Error('Una o más clases ya no existen.')
  const changedAt = new Date().toISOString()
  const nextState = { active, deactivation_reason: active ? null : reason, deactivated_at: active ? null : changedAt }
  const { error } = await context.adminClient.from('classrooms').update(nextState).in('id', ids)
  if (error) throw error
  for (const classroom of classrooms || []) await writeAdminAudit(context.adminClient, { action: active ? 'admin.classroom.activate' : 'admin.classroom.deactivate', adminUserId: context.adminUserId, targetTable: 'classrooms', targetId: classroom.id, metadata: { before: { active: classroom.active, deactivation_reason: classroom.deactivation_reason, deactivated_at: classroom.deactivated_at }, after: nextState, subject_id: classroom.subject_id } })
  return classrooms?.length || 0
}
