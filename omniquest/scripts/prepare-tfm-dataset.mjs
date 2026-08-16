import { randomBytes } from 'node:crypto'
import { assertApplyConfirmation, loadTfmDatasetEnvironment } from './tfm-dataset-environment.mjs'
import { DEMO_QUESTIONS, DEMO_SUPPORT_TICKETS, STUDENT_IDENTITIES, TEACHER_IDENTITIES } from './tfm-dataset-config.mjs'

const apply = process.argv.includes('--apply')
const keepMediaPaths = readRepeatedArg('--keep-question-media-path')
const demoPassword = String(process.env.OMNIQUEST_TFM_DEMO_PASSWORD || '')
if (apply) {
  assertApplyConfirmation()
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(demoPassword)) throw new Error('Define OMNIQUEST_TFM_DEMO_PASSWORD con al menos 12 caracteres, mayúscula, minúscula, número y símbolo.')
  if (!keepMediaPaths.length) throw new Error('Indica al menos una ruta académica segura con --keep-question-media-path. Todo el resto de question-media se eliminará.')
}

const { projectRef, url, supabase } = loadTfmDatasetEnvironment()

try {
  const state = await loadState()
  const plan = buildPlan(state)
  printPlan(plan)
  if (plan.blockers.length) throw new Error(`El dataset tiene ${plan.blockers.length} bloqueo(s) que deben resolverse antes de aplicar cambios.`)
  if (!apply) {
    console.log('\nDRY RUN completado. No se ha modificado ningún dato.')
    console.log('Para aplicar exactamente este plan usa --apply, mantén la misma ruta académica segura y define OMNIQUEST_TFM_DATASET_CONFIRM=OMNIQUEST.')
  } else {
    await applyPlan(plan)
    console.log('\nDataset TFM preparado correctamente.')
    console.log(`Proyecto: ${projectRef}`)
    console.log(`Profesor demo: ${TEACHER_IDENTITIES[0].email}`)
    console.log(`Alumno demo: ${STUDENT_IDENTITIES[0].email}`)
    console.log('La contraseña de ambos se ha leído de OMNIQUEST_TFM_DEMO_PASSWORD y no se muestra.')
    console.log('Los avatares se han dejado vacíos de forma intencionada; el siguiente paso será cargar únicamente retratos sintéticos bajo avatars/demo/.')
  }
} catch (error) {
  console.error(`\nPreparación del dataset no completada: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}

async function loadState() {
  const profiles = await selectAll('profiles', 'id,email,alias,role_id,active,avatar,created_at,points,visibility')
  const assignments = await selectAll('admin_role_assignments', 'user_id,role_id,assigned_by')
  const subjects = await selectAll('subjects', 'id,name,teacher_id,is_archived,active,archive_reason,archived_at,retention_until,created_at')
  const classrooms = await selectAll('classrooms', 'id,subject_id,name,active,created_at')
  const topics = await selectAll('subject_topics', 'id,subject_id,title,active,sort_order,created_at')
  const enrollments = await selectAll('enrollments', 'id,student_id,subject_id,classroom_id,joined_at')
  const attempts = await selectAll('attempt_history', 'id,student_id,question_id,manual_review_status,submitted_answer_text,submitted_answer_payload,review_notes,reviewed_by,attempted_at')
  const questions = await selectAll('questions', 'id,subject_id,topic_id,type,text,media_path,media_url,media_type,media_alt_text,media_caption,active,created_at')
  const mediaAssets = await selectAll('question_media_assets', 'path,processed_path,thumbnail_path,attached_question_id,subject_id,owner_id')
  const authUsers = await listAuthUsers()
  const storage = {}
  for (const bucket of ['avatars', 'account-exports', 'admin-exports', 'support-attachments', 'teacher-audit-exports', 'question-media']) storage[bucket] = await listStoragePaths(bucket)
  const immutableTables = ['admin_audit_logs', 'teacher_audit_logs', 'admin_user_change_history', 'manual_review_history']
  const immutableRows = {}
  for (const table of immutableTables) immutableRows[table] = await selectAll(table, '*')
  return { profiles, assignments, subjects, classrooms, topics, enrollments, attempts, questions, mediaAssets, authUsers, storage, immutableRows }
}

function buildPlan(state) {
  const blockers = []
  const admins = state.profiles.filter((profile) => profile.role_id === 'admin')
  const teachers = state.profiles.filter((profile) => profile.role_id === 'teacher')
  const students = state.profiles.filter((profile) => profile.role_id === 'student')
  const guests = state.profiles.filter((profile) => profile.role_id === 'guest')
  const superAdmins = state.assignments.filter((assignment) => assignment.role_id === 'super_admin')
  if (admins.length !== 1) blockers.push(`Se esperaba 1 perfil admin y hay ${admins.length}.`)
  if (superAdmins.length !== 1 || superAdmins[0]?.user_id !== admins[0]?.id) blockers.push('El único administrador debe tener la asignación super_admin antes de sanear el dataset.')
  if (teachers.length !== TEACHER_IDENTITIES.length) blockers.push(`Se esperaban ${TEACHER_IDENTITIES.length} profesores y hay ${teachers.length}.`)
  if (students.length !== STUDENT_IDENTITIES.length) blockers.push(`Se esperaban ${STUDENT_IDENTITIES.length} alumnos y hay ${students.length}.`)
  if (state.authUsers.length !== state.profiles.length) blockers.push(`Auth y profiles no tienen la misma cantidad de usuarios (${state.authUsers.length} vs ${state.profiles.length}).`)

  const admin = admins[0] || null
  const mathSubject = state.subjects.find((subject) => normalize(subject.name) === normalize('Matemáticas')) || null
  const primaryTeacherId = mathSubject?.teacher_id || teachers.sort(compareCreated)[0]?.id || null
  const mathStudentIds = new Set(state.enrollments.filter((row) => row.subject_id === mathSubject?.id).map((row) => row.student_id))
  const attemptCounts = new Map()
  for (const attempt of state.attempts) attemptCounts.set(attempt.student_id, (attemptCounts.get(attempt.student_id) || 0) + 1)
  const primaryStudent = students.filter((student) => mathStudentIds.has(student.id)).sort((a, b) => (attemptCounts.get(b.id) || 0) - (attemptCounts.get(a.id) || 0) || compareCreated(a, b))[0] || students.sort(compareCreated)[0] || null
  const teacherMappings = buildStableMappings(teachers, TEACHER_IDENTITIES, primaryTeacherId, new Map())
  const studentMappings = buildStableMappings(students, STUDENT_IDENTITIES, primaryStudent?.id || null, attemptCounts)
  const allMappings = [...teacherMappings, ...studentMappings]

  const safeEmails = new Set([admin?.email, ...allMappings.map((item) => item.identity.email)].filter(Boolean).map((value) => value.toLowerCase()))
  for (const [table, rows] of Object.entries(state.immutableRows)) {
    const forbidden = findForbiddenEmails(rows, safeEmails)
    if (forbidden.length) blockers.push(`${table} contiene ${forbidden.length} correo(s) no sintético(s) en historial protegido: ${forbidden.slice(0, 3).join(', ')}${forbidden.length > 3 ? '…' : ''}`)
  }

  const requestedKeep = new Set(keepMediaPaths)
  const mediaKeep = new Set()
  for (const asset of state.mediaAssets) if (requestedKeep.has(asset.path)) for (const path of [asset.path, asset.processed_path, asset.thumbnail_path].filter(Boolean)) mediaKeep.add(path)
  for (const path of requestedKeep) mediaKeep.add(path)
  const questionMediaToDelete = state.storage['question-media'].filter((path) => !mediaKeep.has(path))
  if (keepMediaPaths.some((path) => !state.storage['question-media'].includes(path))) blockers.push('Alguna ruta indicada con --keep-question-media-path no existe actualmente en el bucket question-media.')
  if (!keepMediaPaths.length && state.storage['question-media'].length) blockers.push('Debes indicar qué objeto de question-media has confirmado visualmente como académico antes de aplicar.')

  const duplicateFisio = chooseArchivedSubject(state)
  if (!mathSubject) blockers.push('No se encontró el curso Matemáticas, necesario para elegir las cuentas demo principales.')
  for (const question of DEMO_QUESTIONS) if (!state.subjects.some((subject) => normalize(subject.name) === normalize(question.subject))) blockers.push(`No se encontró el curso objetivo para la pregunta demo: ${question.subject}.`)

  return { ...state, blockers, admin, guests, teacherMappings, studentMappings, allMappings, mathSubject, primaryTeacherId, primaryStudentId: primaryStudent?.id || null, mediaKeep, questionMediaToDelete, archivedSubject: duplicateFisio }
}

function printPlan(plan) {
  console.log(`\nOmniQuest TFM dataset · ${apply ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Proyecto: ${projectRef}`)
  console.log(`URL: ${url}`)
  console.table([
    { elemento: 'Admin preservado', valor: plan.admin ? '1' : '0' },
    { elemento: 'Profesores anonimizados', valor: String(plan.teacherMappings.length) },
    { elemento: 'Alumnos anonimizados', valor: String(plan.studentMappings.length) },
    { elemento: 'Invitados eliminados', valor: String(plan.guests.length) },
    { elemento: 'Avatares privados eliminados', valor: String(plan.storage.avatars.length) },
    { elemento: 'Account exports eliminados', valor: String(plan.storage['account-exports'].length) },
    { elemento: 'Question media eliminado', valor: String(plan.questionMediaToDelete.length) },
    { elemento: 'Question media conservado', valor: String(plan.mediaKeep.size) },
  ])
  console.log('\nCuentas demo que conservarán una contraseña conocida:')
  console.table([{ rol: 'Profesor', correo: TEACHER_IDENTITIES[0].email, alias: TEACHER_IDENTITIES[0].alias }, { rol: 'Alumno', correo: STUDENT_IDENTITIES[0].email, alias: STUDENT_IDENTITIES[0].alias }])
  if (plan.archivedSubject) console.log(`Curso histórico: ${plan.archivedSubject.id} · ${plan.archivedSubject.name} → Fisioterapia · Curso 2025/26 (archivado)`)
  console.log(`Preguntas demo adicionales: ${DEMO_QUESTIONS.length}`)
  console.log(`Tickets de soporte sintéticos: ${DEMO_SUPPORT_TICKETS.length}`)
  console.log(`Bloqueos: ${plan.blockers.length}`)
  for (const blocker of plan.blockers) console.log(` - ${blocker}`)
}

async function applyPlan(plan) {
  await deleteGuests(plan.guests)
  await anonymizeUsers(plan)
  await clearEphemeralData(plan)
  await sanitizeStorage(plan)
  await curateCourses(plan)
  await sanitizeManualReviewContent(plan)
  await seedQuestions(plan)
  await seedTeacherNotes(plan)
  await seedSupportTickets(plan)
  await seedNotifications(plan)
}

async function deleteGuests(guests) {
  for (const guest of guests) {
    const { error } = await supabase.auth.admin.deleteUser(guest.id)
    if (error) throw new Error(`No se pudo eliminar el invitado ${guest.id}: ${error.message}`)
  }
  console.log(`✓ ${guests.length} invitados eliminados de Auth.`)
}

async function anonymizeUsers(plan) {
  for (const { profile, identity } of plan.allMappings) {
    const password = identity.demoLogin ? demoPassword : `${randomBytes(24).toString('base64url')}Aa1!`
    const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, { email: identity.email, password, email_confirm: true, user_metadata: { alias: identity.alias, role_id: profile.role_id, dataset: 'tfm-demo' } })
    if (authError) throw new Error(`No se pudo anonimizar Auth ${profile.id}: ${authError.message}`)
    await updateOne('profiles', profile.id, { email: identity.email, alias: identity.alias, avatar: null, active: true, visibility: 'public', deactivated_at: null, deactivation_reason: null, reactivate_at: null, expires_at: null })
    const notificationPrefs = await maybeSingle('user_notification_preferences', 'user_id', profile.id)
    if (notificationPrefs) await updateBy('user_notification_preferences', 'user_id', profile.id, { push_enabled: false, email_enabled: false, support_preferred_channel: 'in_app', support_contact_email: identity.email, teacher_digest_frequency: 'off', teacher_reminder_email: profile.role_id === 'teacher' ? identity.email : null, teacher_digest_last_sent_at: null, teacher_digest_unsubscribed_at: null, teacher_notifications_muted_until: null })
  }
  if (plan.admin) await updateOne('profiles', plan.admin.id, { avatar: null })
  const { error: backupError } = await supabase.from('account_backup_codes').delete().neq('user_id', plan.admin.id)
  if (backupError) throw backupError
  console.log(`✓ ${plan.allMappings.length} identidades no administrativas anonimizadas y contraseñas rotadas.`)
}

async function clearEphemeralData(plan) {
  const deletes = [
    ['notifications', 'id'], ['notification_state', 'id'], ['push_tokens', 'id'], ['teacher_student_recovery_requests', 'id'], ['teacher_digest_deliveries', 'id'], ['user_sessions', 'id'], ['auth_rate_limits', 'key_hash'],
    ['data_export_requests', 'id'], ['account_deletion_requests', 'id'], ['admin_export_jobs', 'id'], ['teacher_audit_export_requests', 'id'], ['teacher_student_notes', 'id'], ['manual_review_comments', 'id'], ['user_support_tickets', 'id'],
  ]
  for (const [table, column] of deletes) await deleteAll(table, column)
  console.log('✓ Colas, sesiones, tokens, exportaciones temporales, notas y soporte previo limpiados.')
}

async function sanitizeStorage(plan) {
  for (const bucket of ['avatars', 'account-exports', 'admin-exports', 'support-attachments', 'teacher-audit-exports']) await removeStoragePaths(bucket, plan.storage[bucket])
  if (plan.questionMediaToDelete.length) {
    const affectedQuestions = plan.questions.filter((question) => question.media_path && plan.questionMediaToDelete.includes(question.media_path))
    for (const question of affectedQuestions) await updateOne('questions', question.id, { media_type: null, media_url: null, media_path: null, media_alt_text: null, media_caption: null })
    const deleteAssetPaths = plan.mediaAssets.filter((asset) => plan.questionMediaToDelete.includes(asset.path)).map((asset) => asset.path)
    if (deleteAssetPaths.length) {
      const { error } = await supabase.from('question_media_assets').delete().in('path', deleteAssetPaths)
      if (error) throw error
    }
    await removeStoragePaths('question-media', plan.questionMediaToDelete)
  }
  console.log('✓ Storage saneado: exports y avatares eliminados; solo se conserva question-media marcado explícitamente como académico.')
}

async function curateCourses(plan) {
  if (!plan.archivedSubject) return
  const now = new Date()
  const retention = new Date(now.getTime() + 90 * 86400000)
  await updateOne('subjects', plan.archivedSubject.id, { name: 'Fisioterapia · Curso 2025/26', is_archived: true, active: false, archive_reason: 'Curso histórico incluido en el dataset de demostración del TFM', archived_at: now.toISOString(), retention_until: retention.toISOString(), academic_year: '2025/2026' })
  const { error } = await supabase.from('classrooms').update({ active: false, deactivation_reason: 'Curso histórico del dataset TFM', deactivated_at: now.toISOString() }).eq('subject_id', plan.archivedSubject.id)
  if (error) throw error
  console.log(`✓ Curso ${plan.archivedSubject.id} convertido en caso histórico archivado.`)
}

async function sanitizeManualReviewContent(plan) {
  const openQuestionIds = new Set(plan.questions.filter((question) => question.type === 'open_answer').map((question) => question.id))
  for (const attempt of plan.attempts.filter((row) => openQuestionIds.has(row.question_id))) {
    const updates = { submitted_answer_text: 'Respuesta desarrollada por el alumno para la demostración académica de OmniQuest.', submitted_answer_payload: null }
    if (attempt.manual_review_status === 'approved') updates.review_notes = 'Respuesta correcta, bien argumentada y suficiente para el criterio esperado.'
    else if (attempt.manual_review_status === 'rejected') updates.review_notes = 'La respuesta necesita mayor precisión y justificar mejor el concepto principal.'
    else if (attempt.manual_review_status === 'needs_changes') updates.review_notes = 'Revisa la explicación y añade una justificación más completa.'
    else if (attempt.manual_review_status === 'pending') updates.review_notes = null
    await updateOne('attempt_history', attempt.id, updates)
  }
  const reviewed = plan.attempts.find((attempt) => ['approved', 'rejected'].includes(attempt.manual_review_status) && attempt.reviewed_by)
  if (reviewed) {
    const body = reviewed.manual_review_status === 'approved' ? 'La explicación identifica correctamente la idea principal.' : 'Conviene desarrollar mejor el razonamiento antes de dar la respuesta por finalizada.'
    await insertOne('manual_review_comments', { attempt_history_id: reviewed.id, author_id: reviewed.reviewed_by, audience: 'student', body })
  }
  console.log('✓ Respuestas abiertas y comentarios de revisión convertidos a contenido sintético.')
}

async function seedQuestions(plan) {
  const topicsBySubject = new Map()
  for (const subject of plan.subjects) topicsBySubject.set(subject.id, plan.topics.filter((topic) => topic.subject_id === subject.id && topic.active !== false).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || compareCreated(a, b)))
  for (const item of DEMO_QUESTIONS) {
    const candidates = plan.subjects.filter((subject) => normalize(subject.name) === normalize(item.subject) && !subject.is_archived)
    const subject = candidates.sort((a, b) => a.id - b.id)[0]
    if (!subject) throw new Error(`No existe curso activo para ${item.subject}.`)
    const topic = topicsBySubject.get(subject.id)?.[0]
    if (!topic) throw new Error(`El curso ${subject.name} no tiene tema activo para insertar preguntas demo.`)
    const existing = await maybeSingleByTwo('questions', 'subject_id', subject.id, 'text', item.text)
    let questionId = existing?.id
    const values = { subject_id: subject.id, topic_id: topic.id, classroom_id: null, type: item.type, text: item.text, points_base: 10, time_limit_seconds: item.type === 'open_answer' ? 90 : 45, difficulty: item.type === 'open_answer' ? 2 : 1, explanation: item.explanation, hint: item.hint, active: true, media_type: null, media_url: null, media_path: null, media_alt_text: null, media_caption: null }
    if (questionId) await updateOne('questions', questionId, values)
    else questionId = (await insertOne('questions', values, 'id')).id
    const hasHistoricalAttempts = plan.attempts.some((attempt) => attempt.question_id === questionId)
    if (!existing || !hasHistoricalAttempts) {
      const { error: deleteError } = await supabase.from('answers').delete().eq('question_id', questionId)
      if (deleteError) throw deleteError
      const rows = item.answers.map(([text, isCorrect], index) => ({ question_id: questionId, text, is_correct: isCorrect, sort_order: index + 1 }))
      const { error: answerError } = await supabase.from('answers').insert(rows)
      if (answerError) throw answerError
    }
  }
  console.log(`✓ ${DEMO_QUESTIONS.length} preguntas académicas demo aseguradas de forma idempotente.`)
}

async function seedTeacherNotes(plan) {
  const teacher = plan.teacherMappings[0]
  const students = plan.studentMappings.slice(0, 3)
  if (!teacher || students.length < 3 || !plan.mathSubject) return
  const classroom = plan.classrooms.find((row) => row.subject_id === plan.mathSubject.id && row.active !== false) || null
  const notes = [
    'Participa con regularidad y mantiene un progreso estable. Conviene proponerle actividades de ampliación.',
    'Ha mejorado en los últimos intentos. Reforzar la interpretación de problemas antes de aumentar la dificultad.',
    'Buen ritmo de trabajo. Puede beneficiarse de repasar los errores del último tema antes de la siguiente actividad.',
  ]
  for (let index = 0; index < students.length; index += 1) await insertOne('teacher_student_notes', { teacher_id: teacher.profile.id, student_id: students[index].profile.id, subject_id: plan.mathSubject.id, classroom_id: classroom?.id || null, body: notes[index] })
  console.log('✓ 3 notas docentes sintéticas creadas.')
}

async function seedSupportTickets(plan) {
  const now = Date.now()
  for (let index = 0; index < DEMO_SUPPORT_TICKETS.length; index += 1) {
    const template = DEMO_SUPPORT_TICKETS[index]
    const student = plan.studentMappings[template.studentIndex]
    if (!student) continue
    const createdAt = new Date(now - (index + 2) * 86400000).toISOString()
    const resolved = template.status === 'resolved'
    const ticket = await insertOne('user_support_tickets', { user_id: student.profile.id, role: 'student', category: template.category, subject: template.subject, message: template.message, contact_email: student.identity.email, priority: template.priority, priority_source: 'user', status: template.status, preferred_channel: 'in_app', assigned_admin_id: template.status === 'open' ? null : plan.admin.id, admin_response: template.adminResponse || null, first_responded_at: template.status === 'open' ? null : new Date(Date.parse(createdAt) + 3600000).toISOString(), last_response_at: template.status === 'open' ? null : new Date(Date.parse(createdAt) + 3600000).toISOString(), resolved_at: resolved ? new Date(Date.parse(createdAt) + 7200000).toISOString() : null, created_at: createdAt, updated_at: resolved ? new Date(Date.parse(createdAt) + 7200000).toISOString() : createdAt }, 'id')
    if (template.adminResponse) await insertOne('support_ticket_messages', { ticket_id: ticket.id, author_id: plan.admin.id, author_role: 'admin', body: template.adminResponse, is_internal: false, created_at: new Date(Date.parse(createdAt) + 3600000).toISOString() })
    if (template.status === 'in_progress') await insertOne('support_ticket_messages', { ticket_id: ticket.id, author_id: plan.admin.id, author_role: 'admin', body: 'Revisar el calendario del tema antes de cerrar el caso.', is_internal: true, created_at: new Date(Date.parse(createdAt) + 3700000).toISOString() })
  }
  console.log(`✓ ${DEMO_SUPPORT_TICKETS.length} tickets de soporte sintéticos creados.`)
}

async function seedNotifications(plan) {
  const notifications = []
  const now = Date.now()
  const mainStudent = plan.studentMappings[0]
  const mainTeacher = plan.teacherMappings[0]
  if (mainStudent) {
    notifications.push(notification(mainStudent.profile.id, 'student', 'achievement', 'Nuevo logro desbloqueado', 'Has desbloqueado un logro por tu constancia en las últimas actividades.', '/(student)/badges', 'demo-student-achievement', 2, false))
    notifications.push(notification(mainStudent.profile.id, 'student', 'announcement', 'Nuevo contenido disponible', 'Tu profesor ha publicado nuevas preguntas de práctica en Matemáticas.', '/(student)/classes', 'demo-student-content', 1, false))
    notifications.push(notification(mainStudent.profile.id, 'student', 'student_activity', 'Progreso actualizado', 'Tu progreso se ha actualizado después de la última partida completada.', '/(student)/progress', 'demo-student-progress', 4, true))
  }
  if (mainTeacher) {
    notifications.push(notification(mainTeacher.profile.id, 'teacher', 'enrollment', 'Nuevo alumno incorporado', 'Un alumno se ha incorporado recientemente a una de tus clases.', '/(teacher)/students', 'demo-teacher-enrollment', 1, false))
    notifications.push(notification(mainTeacher.profile.id, 'teacher', 'student_activity', 'Revisiones pendientes', 'Tienes respuestas abiertas pendientes de revisión manual.', '/(teacher)/reviews', 'demo-teacher-reviews', 0, false))
  }
  for (let index = 1; index < Math.min(plan.studentMappings.length, 11); index += 1) notifications.push(notification(plan.studentMappings[index].profile.id, 'student', index % 2 ? 'announcement' : 'achievement', index % 2 ? 'Actividad recomendada' : 'Racha de aprendizaje', index % 2 ? 'Hay una nueva actividad recomendada para continuar practicando.' : 'Has mantenido una buena constancia durante esta semana.', '/(student)', `demo-student-${index}`, index + 1, index % 3 === 0))
  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) throw error
  console.log(`✓ ${notifications.length} notificaciones sintéticas creadas.`)

  function notification(userId, audience, type, title, description, actionUrl, fingerprint, daysAgo, read) {
    const createdAt = new Date(now - daysAgo * 86400000).toISOString()
    return { user_id: userId, audience, type, title, description, icon: type === 'achievement' ? 'trophy-outline' : 'notifications-outline', color: audience === 'teacher' ? '#58B5FF' : '#8B5CF6', action_url: actionUrl, related_table: null, related_id: null, fingerprint, metadata: { dataset: 'tfm-demo' }, read_at: read ? new Date(Date.parse(createdAt) + 3600000).toISOString() : null, created_at: createdAt, updated_at: createdAt }
  }
}

function chooseArchivedSubject(state) {
  const fisio = state.subjects.filter((subject) => normalize(subject.name) === normalize('Fisioterapia'))
  if (fisio.length < 2) return fisio.find((subject) => subject.is_archived) || null
  const counts = new Map()
  for (const enrollment of state.enrollments) counts.set(enrollment.subject_id, (counts.get(enrollment.subject_id) || 0) + 1)
  return [...fisio].sort((a, b) => (counts.get(a.id) || 0) - (counts.get(b.id) || 0) || b.id - a.id)[0]
}

function buildStableMappings(profiles, identities, primaryId, activityCounts) {
  const remainingProfiles = [...profiles]
  const mappings = []
  for (const identity of identities) {
    const index = remainingProfiles.findIndex((profile) => String(profile.email || '').toLowerCase() === identity.email.toLowerCase())
    if (index >= 0) mappings.push({ profile: remainingProfiles.splice(index, 1)[0], identity })
  }
  const remainingIdentities = identities.filter((identity) => !mappings.some((mapping) => mapping.identity.email === identity.email))
  remainingProfiles.sort((a, b) => a.id === primaryId ? -1 : b.id === primaryId ? 1 : (activityCounts.get(b.id) || 0) - (activityCounts.get(a.id) || 0) || compareCreated(a, b))
  for (let index = 0; index < remainingIdentities.length; index += 1) mappings.push({ profile: remainingProfiles[index], identity: remainingIdentities[index] })
  return identities.map((identity) => mappings.find((mapping) => mapping.identity.email === identity.email)).filter(Boolean)
}

function compareCreated(a, b) { return String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id)) }
function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() }
function readRepeatedArg(name) { const result = []; for (let i = 0; i < process.argv.length; i += 1) if (process.argv[i] === name && process.argv[i + 1]) result.push(process.argv[i + 1]); return result }
function findForbiddenEmails(value, safeEmails) { const matches = JSON.stringify(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []; return [...new Set(matches.map((email) => email.toLowerCase()).filter((email) => !safeEmails.has(email) && !email.endsWith('@demo.omniquest.test')))] }

async function listAuthUsers() {
  const users = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

async function selectAll(table, columns = '*') {
  const result = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
    if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`)
    result.push(...(data || []))
    if (!data || data.length < 1000) return result
  }
}

async function maybeSingle(table, column, value) { const { data, error } = await supabase.from(table).select('*').eq(column, value).maybeSingle(); if (error) throw error; return data }
async function maybeSingleByTwo(table, columnA, valueA, columnB, valueB) { const { data, error } = await supabase.from(table).select('*').eq(columnA, valueA).eq(columnB, valueB).maybeSingle(); if (error) throw error; return data }
async function updateOne(table, id, values) { return updateBy(table, 'id', id, values) }
async function updateBy(table, column, value, values) { const { error } = await supabase.from(table).update(values).eq(column, value); if (error) throw new Error(`No se pudo actualizar ${table}: ${error.message}`) }
async function insertOne(table, values, returning = null) { const request = supabase.from(table).insert(values); if (!returning) { const { error } = await request; if (error) throw new Error(`No se pudo insertar en ${table}: ${error.message}`); return values } const { data, error } = await request.select(returning).single(); if (error) throw new Error(`No se pudo insertar en ${table}: ${error.message}`); return data }
async function deleteAll(table, column) { const { error } = await supabase.from(table).delete().not(column, 'is', null); if (error) throw new Error(`No se pudo limpiar ${table}: ${error.message}`) }

async function listStoragePaths(bucket, prefix = '') {
  const paths = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`No se pudo listar storage ${bucket}/${prefix}: ${error.message}`)
    for (const item of data || []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) paths.push(path)
      else paths.push(...await listStoragePaths(bucket, path))
    }
    if (!data || data.length < 1000) return paths
  }
}

async function removeStoragePaths(bucket, paths) {
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100)
    if (!batch.length) continue
    const { error } = await supabase.storage.from(bucket).remove(batch)
    if (error) throw new Error(`No se pudieron eliminar objetos de ${bucket}: ${error.message}`)
  }
}
