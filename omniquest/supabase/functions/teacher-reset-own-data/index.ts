import { corsHeaders, errorResponse, getTeacherContext, isMissingSchemaError, isResponse, json, methodNotAllowedResponse, readJsonBody, writeTeacherAudit } from '../_shared/teacher.ts'

type ResetType = 'scores' | 'teaching_data' | 'all' | 'personal_data'

type RequestBody = {
  resetType?: ResetType | 'enrollments'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getTeacherContext(req)
    if (isResponse(context)) return context

    const body = await readJsonBody<RequestBody>(req)
    const resetType = normalizeResetType(body.resetType)
    const deleted: Record<string, number | null> = {}

    if (resetType === 'personal_data') {
      const avatar = await getTeacherAvatar(context.adminClient, context.teacherUserId)
      await deleteTeacherPreferencesAndAvatar(context.adminClient, context.teacherUserId, avatar, deleted)

      await writeTeacherAudit(context.adminClient, {
        teacherUserId: context.teacherUserId,
        action: 'teacher.profile.reset_preferences',
        targetTable: 'profiles',
        targetId: context.teacherUserId,
        metadata: { deleted, avatar_cleared: Boolean(avatar) },
      })

      return json({ ok: true, resetType, deleted, affectedStudentIds: 0, avatar: null })
    }

    const teacherSnapshot = await getTeacherSnapshot(context.adminClient, context.teacherUserId)
    const subjectIds = teacherSnapshot.subjectIds
    const questionIds = teacherSnapshot.questionIds
    const affectedStudentIds = teacherSnapshot.affectedStudentIds

    if (resetType === 'scores') {
      await deleteTeacherProgress(context.adminClient, subjectIds, questionIds, deleted)
      await syncStudents(context.adminClient, affectedStudentIds)

      await writeTeacherAudit(context.adminClient, {
        teacherUserId: context.teacherUserId,
        action: 'teacher.profile.reset_scores',
        targetTable: 'profiles',
        targetId: context.teacherUserId,
        metadata: {
          subject_count: subjectIds.length,
          question_count: questionIds.length,
          affected_student_count: affectedStudentIds.length,
          deleted,
        },
      })

      return json({ ok: true, resetType, deleted, affectedStudentIds: affectedStudentIds.length })
    }

    if (resetType === 'teaching_data' || resetType === 'all') {
      await deleteTeacherTeachingData(context.adminClient, subjectIds, questionIds, deleted)
      await syncStudents(context.adminClient, affectedStudentIds)

      if (resetType === 'all') {
        await deleteTeacherPreferencesAndAvatar(context.adminClient, context.teacherUserId, teacherSnapshot.avatar, deleted)
      }

      await writeTeacherAudit(context.adminClient, {
        teacherUserId: context.teacherUserId,
        action: resetType === 'all' ? 'teacher.profile.reset_all' : 'teacher.profile.delete_teaching_data',
        targetTable: 'profiles',
        targetId: context.teacherUserId,
        metadata: {
          subject_count: subjectIds.length,
          question_count: questionIds.length,
          affected_student_count: affectedStudentIds.length,
          deleted,
          avatar_cleared: resetType === 'all' ? Boolean(teacherSnapshot.avatar) : false,
        },
      })

      return json({
        ok: true,
        resetType,
        deleted,
        affectedStudentIds: affectedStudentIds.length,
        avatar: resetType === 'all' ? null : teacherSnapshot.avatar,
      })
    }

    return json({ error: 'Tipo de reinicio no válido.' }, 400)
  } catch (error) {
    return errorResponse(error, 'No se pudieron eliminar los datos docentes.', { functionName: 'teacher-reset-own-data' })
  }
})

function normalizeResetType(value: RequestBody['resetType']): ResetType {
  if (value === 'all') return 'all'
  if (value === 'personal_data') return 'personal_data'
  if (value === 'teaching_data' || value === 'enrollments') return 'teaching_data'
  return 'scores'
}

async function getTeacherAvatar(adminClient: any, teacherUserId: string) {
  const { data: profile, error } = await adminClient.from('profiles').select('avatar').eq('id', teacherUserId).single()
  if (error || !profile) throw new Error('Perfil docente no encontrado.')
  return profile.avatar as string | null
}

async function getTeacherSnapshot(adminClient: any, teacherUserId: string) {
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, avatar')
    .eq('id', teacherUserId)
    .single()

  if (profileError || !profile) throw new Error('Perfil docente no encontrado.')

  const { data: subjects, error: subjectsError } = await adminClient
    .from('subjects')
    .select('id')
    .eq('teacher_id', teacherUserId)

  if (subjectsError) throw subjectsError

  const subjectIds = (subjects || [])
    .map((subject: { id: number | null }) => subject.id)
    .filter((id: number | null): id is number => typeof id === 'number')

  const questionIds = await getQuestionIds(adminClient, subjectIds)
  const affectedStudentIds = await getAffectedStudentIds(adminClient, subjectIds, questionIds)

  return {
    avatar: profile.avatar as string | null,
    subjectIds,
    questionIds,
    affectedStudentIds,
  }
}

async function getQuestionIds(adminClient: any, subjectIds: number[]) {
  if (subjectIds.length === 0) return []

  const { data, error } = await adminClient
    .from('questions')
    .select('id')
    .in('subject_id', subjectIds)

  if (error && !isMissingSchemaError(error.code)) throw error

  return (data || [])
    .map((question: { id: number | null }) => question.id)
    .filter((id: number | null): id is number => typeof id === 'number')
}

async function getAffectedStudentIds(adminClient: any, subjectIds: number[], questionIds: number[]) {
  const ids = new Set<string>()

  if (subjectIds.length > 0) {
    const { data: enrollments, error: enrollmentsError } = await adminClient
      .from('enrollments')
      .select('student_id')
      .in('subject_id', subjectIds)
    if (enrollmentsError && !isMissingSchemaError(enrollmentsError.code)) throw enrollmentsError

    for (const enrollment of enrollments || []) {
      if (enrollment.student_id) ids.add(String(enrollment.student_id))
    }
  }

  if (questionIds.length > 0) {
    const { data: attempts, error: attemptsError } = await adminClient
      .from('attempt_history')
      .select('student_id')
      .in('question_id', questionIds)
    if (attemptsError && !isMissingSchemaError(attemptsError.code)) throw attemptsError

    for (const attempt of attempts || []) {
      if (attempt.student_id) ids.add(String(attempt.student_id))
    }
  }

  return Array.from(ids)
}

async function deleteTeacherProgress(adminClient: any, subjectIds: number[], questionIds: number[], deleted: Record<string, number | null>) {
  if (questionIds.length > 0) {
    deleted.attempt_history = await deleteRowsIn(adminClient, 'attempt_history', 'question_id', questionIds)
  } else {
    deleted.attempt_history = 0
  }

  if (subjectIds.length > 0) {
    deleted.game_attempts = await deleteRowsIn(adminClient, 'game_attempts', 'subject_id', subjectIds)
    deleted.topic_scores = await deleteRowsIn(adminClient, 'topic_scores', 'subject_id', subjectIds)
    deleted.subject_scores = await deleteRowsIn(adminClient, 'subject_scores', 'subject_id', subjectIds)
  } else {
    deleted.game_attempts = 0
    deleted.topic_scores = 0
    deleted.subject_scores = 0
  }
}

async function deleteTeacherTeachingData(adminClient: any, subjectIds: number[], questionIds: number[], deleted: Record<string, number | null>) {
  await deleteTeacherProgress(adminClient, subjectIds, questionIds, deleted)

  if (questionIds.length > 0) {
    deleted.answers = await deleteRowsIn(adminClient, 'answers', 'question_id', questionIds)
  } else {
    deleted.answers = 0
  }

  if (subjectIds.length > 0) {
    deleted.enrollments = await deleteRowsIn(adminClient, 'enrollments', 'subject_id', subjectIds)
    deleted.questions = await deleteRowsIn(adminClient, 'questions', 'subject_id', subjectIds)
    deleted.classrooms = await deleteRowsIn(adminClient, 'classrooms', 'subject_id', subjectIds)
    deleted.subject_topics = await deleteRowsIn(adminClient, 'subject_topics', 'subject_id', subjectIds)
    deleted.subjects = await deleteRowsIn(adminClient, 'subjects', 'id', subjectIds)
  } else {
    deleted.enrollments = 0
    deleted.questions = 0
    deleted.classrooms = 0
    deleted.subject_topics = 0
    deleted.subjects = 0
  }
}

async function deleteTeacherPreferencesAndAvatar(adminClient: any, teacherUserId: string, avatar: string | null, deleted: Record<string, number | null>) {
  deleted.notification_state = await deleteRowsEq(adminClient, 'notification_state', 'user_id', teacherUserId)
  deleted.notifications = await deleteRowsEq(adminClient, 'notifications', 'user_id', teacherUserId)
  deleted.push_tokens = await deleteRowsEq(adminClient, 'push_tokens', 'user_id', teacherUserId)
  deleted.teacher_digest_deliveries = await deleteRowsEq(adminClient, 'teacher_digest_deliveries', 'teacher_id', teacherUserId)
  deleted.teacher_notification_course_preferences = await deleteRowsEq(adminClient, 'teacher_notification_course_preferences', 'teacher_id', teacherUserId)
  deleted.user_preferences = await deleteRowsEq(adminClient, 'user_preferences', 'user_id', teacherUserId)
  deleted.user_notification_preferences = await deleteRowsEq(adminClient, 'user_notification_preferences', 'user_id', teacherUserId)

  const avatarPaths = getAvatarStoragePaths(teacherUserId, avatar)
  if (avatarPaths.length > 0) {
    const { error } = await adminClient.storage.from('avatars').remove(avatarPaths)
    if (error) console.warn('[teacher reset] could not remove avatar:', error.message)
  }

  const { error: avatarError } = await adminClient
    .from('profiles')
    .update({ avatar: null })
    .eq('id', teacherUserId)
  if (avatarError) throw avatarError
}

async function deleteRowsIn(adminClient: any, table: string, column: string, values: Array<number | string>) {
  if (values.length === 0) return 0

  const { count, error } = await adminClient
    .from(table)
    .delete({ count: 'exact' })
    .in(column, values)

  if (error && !isMissingSchemaError(error.code)) throw error
  return error ? null : count
}

async function deleteRowsEq(adminClient: any, table: string, column: string, value: string) {
  const { count, error } = await adminClient
    .from(table)
    .delete({ count: 'exact' })
    .eq(column, value)

  if (error && !isMissingSchemaError(error.code)) throw error
  return error ? null : count
}

async function syncStudents(adminClient: any, studentIds: string[]) {
  for (const studentId of studentIds) {
    const { error } = await adminClient.rpc('sync_student_points', { student_id: studentId })
    if (error && !isMissingSchemaError(error.code)) throw error
  }
}

function getAvatarStoragePaths(userId: string, avatarUrl?: string | null) {
  const paths = new Set<string>([
    `${userId}.jpg`,
    `${userId}.jpeg`,
    `${userId}.png`,
    `${userId}.webp`,
    `${userId}/avatar.jpg`,
    `${userId}/avatar.png`,
    `${userId}/avatar.webp`,
  ])
  const marker = '/storage/v1/object/public/avatars/'
  if (avatarUrl?.includes(marker)) {
    const rawPath = avatarUrl.split(marker)[1]?.split('?')[0]
    if (rawPath) paths.add(decodeURIComponent(rawPath))
  }
  return Array.from(paths)
}
