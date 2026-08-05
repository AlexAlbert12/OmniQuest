import { createClient } from '@supabase/supabase-js'
import { loadLocalSupabaseEnvironment } from './local-supabase-environment.mjs'

const afterWalkthroughs = process.argv.includes('--after')
const password = String(process.env.OMNIQUEST_DEMO_PASSWORD || '')
const { url, anonKey, serviceRoleKey } = loadLocalSupabaseEnvironment()
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const emails = ['demo.student@omniquest.test', 'demo.teacher@omniquest.test', 'demo.admin@omniquest.test', 'demo.auditor@omniquest.test', 'demo.imported@omniquest.test']
const { data: profiles, error: profileError } = await admin.from('profiles').select('id,email,alias,role_id,active,points').in('email', emails)
if (profileError) throw profileError
const byEmail = new Map((profiles || []).map((profile) => [profile.email, profile]))
const checks = []
const check = (name, passed, detail = '') => checks.push({ comprobacion: name, resultado: passed ? 'PASS' : 'FAIL', detalle: detail })

for (const email of emails) check(`Existe ${email}`, byEmail.has(email), byEmail.get(email)?.role_id || '')
const adminProfile = byEmail.get('demo.admin@omniquest.test')
const auditorProfile = byEmail.get('demo.auditor@omniquest.test')
const teacherProfile = byEmail.get('demo.teacher@omniquest.test')
const studentProfile = byEmail.get('demo.student@omniquest.test')
const importedProfile = byEmail.get('demo.imported@omniquest.test')
check('El alumno importado conserva el alias de prueba', importedProfile?.alias === '=Demo CSV', importedProfile?.alias || '')

if (adminProfile && auditorProfile) {
  const { data: assignments, error } = await admin.from('admin_role_assignments').select('user_id,role_id').in('user_id', [adminProfile.id, auditorProfile.id])
  if (error) throw error
  const assignmentMap = new Map((assignments || []).map((item) => [item.user_id, item.role_id]))
  check('Administrador principal es super_admin', assignmentMap.get(adminProfile.id) === 'super_admin', assignmentMap.get(adminProfile.id) || '')
  check('Administrador restringido es auditor', assignmentMap.get(auditorProfile.id) === 'auditor', assignmentMap.get(auditorProfile.id) || '')
}

const { data: fixtures, error: fixtureError } = await admin.from('classrooms').select('code,code_expires_at,active,subjects!inner(code,is_archived,active)').in('code', ['ARCHCL01', 'EXPCL001'])
if (fixtureError) throw fixtureError
check('Existe el caso de curso archivado', (fixtures || []).some((item) => item.code === 'ARCHCL01' && item.subjects?.is_archived === true))
check('Existe el caso de código caducado', (fixtures || []).some((item) => item.code === 'EXPCL001' && item.code_expires_at && new Date(item.code_expires_at) <= new Date()))

if (afterWalkthroughs && teacherProfile && studentProfile && importedProfile && adminProfile && auditorProfile) await verifyWalkthroughResults()
console.table(checks)
const failed = checks.filter((item) => item.resultado === 'FAIL')
if (failed.length) throw new Error(`${failed.length} comprobaciones no cumplen el criterio de aceptación.`)

async function verifyWalkthroughResults() {
  const { data: allSubjects, error: subjectError } = await admin.from('subjects').select('id,name,code,is_archived,subject_label').eq('teacher_id', teacherProfile.id).eq('is_archived', false).order('created_at', { ascending: false })
  if (subjectError) throw subjectError
  const subjects = (allSubjects || []).filter((subject) => subject.subject_label !== 'VALIDATION_FIXTURE')
  const subjectIds = subjects.map((subject) => subject.id)
  check('El profesor creó un curso funcional', subjectIds.length > 0, subjects?.[0]?.name || '')
  if (!subjectIds.length) return

  const { data: classrooms, error: classroomError } = await admin.from('classrooms').select('id,subject_id,active').in('subject_id', subjectIds)
  if (classroomError) throw classroomError
  check('El curso tiene clase inicial', (classrooms || []).length > 0)
  check('La clase queda reactivada al finalizar el recorrido', (classrooms || []).some((classroom) => classroom.active === true))
  const { data: topics, error: topicError } = await admin.from('subject_topics').select('id,subject_id').in('subject_id', subjectIds)
  if (topicError) throw topicError
  check('El curso tiene tema inicial', (topics || []).length > 0)

  const expectedTypes = ['multiple_choice', 'true_false', 'open_answer', 'fill_blank', 'ordering', 'match_pairs', 'drag_drop']
  const { data: questions, error: questionError } = await admin.from('questions').select('id,type,active,media_type,media_path,media_alt_text').in('subject_id', subjectIds)
  if (questionError) throw questionError
  const actualTypes = new Set((questions || []).map((question) => question.type))
  check('Existen los siete tipos de pregunta', expectedTypes.every((type) => actualTypes.has(type)), [...actualTypes].sort().join(', '))
  const archivedQuestionIds = new Set((questions || []).filter((question) => question.active === false).map((question) => question.id))
  check('Al menos una pregunta quedó archivada', archivedQuestionIds.size > 0, String(archivedQuestionIds.size))
  const mediaQuestions = (questions || []).filter((question) => question.media_type === 'image' && question.media_path)
  check('Existe una pregunta con imagen privada y texto alternativo', mediaQuestions.some((question) => String(question.media_alt_text || '').trim().length > 0), String(mediaQuestions.length))
  if (mediaQuestions.length) {
    const mediaPaths = mediaQuestions.map((question) => question.media_path)
    const { data: mediaAssets, error: mediaError } = await admin.from('question_media_assets').select('path,attached_question_id,scan_status,processing_status,orphaned_at').in('path', mediaPaths)
    if (mediaError) throw mediaError
    check('La imagen quedó validada y vinculada a la pregunta', (mediaAssets || []).some((asset) => asset.attached_question_id && asset.scan_status === 'clean' && asset.orphaned_at === null), String(mediaAssets?.length || 0))
  }

  const { data: enrollments, error: enrollmentError } = await admin.from('enrollments').select('student_id,subject_id').in('subject_id', subjectIds).in('student_id', [studentProfile.id, importedProfile.id])
  if (enrollmentError) throw enrollmentError
  check('El alumno principal se matriculó', (enrollments || []).some((item) => item.student_id === studentProfile.id))
  check('El alumno de importación se matriculó', (enrollments || []).some((item) => item.student_id === importedProfile.id))
  check('El alumno importado queda reactivado al finalizar', importedProfile.active === true, String(importedProfile.active))
  const enrollmentKeys = (enrollments || []).map((item) => `${item.student_id}|${item.subject_id}`)
  check('No existen matrículas duplicadas', new Set(enrollmentKeys).size === enrollmentKeys.length, String(enrollmentKeys.length))

  const { data: attempts, error: attemptError } = await admin.from('attempt_history').select('id,question_id,attempt_id,earned_points,manual_review_status').eq('student_id', studentProfile.id)
  if (attemptError) throw attemptError
  check('El alumno registró varios intentos', (attempts || []).length >= 3, String(attempts?.length || 0))
  check('La pregunta archivada conserva sus intentos', (attempts || []).some((attempt) => archivedQuestionIds.has(attempt.question_id)))
  check('La respuesta abierta fue revisada', (attempts || []).some((item) => !['not_required', 'pending'].includes(item.manual_review_status)))
  const { data: games, error: gameError } = await admin.from('game_attempts').select('id,status,total_score').eq('student_id', studentProfile.id)
  if (gameError) throw gameError
  check('Existe una partida finalizada', (games || []).some((item) => item.status === 'finished'))
  const attemptQuestionKeys = (attempts || []).filter((item) => item.attempt_id).map((item) => `${item.attempt_id}|${item.question_id}`)
  check('La partida no contiene respuestas duplicadas para la misma pregunta', new Set(attemptQuestionKeys).size === attemptQuestionKeys.length, String(attemptQuestionKeys.length))
  const { count: receiptCount, error: receiptError } = await admin.from('game_answer_submission_receipts').select('submission_id', { count: 'exact', head: true }).eq('student_id', studentProfile.id)
  if (receiptError) throw receiptError
  check('Las respuestas reanudables generaron recibos idempotentes', Number(receiptCount || 0) > 0, String(receiptCount || 0))
  check('El alumno acumuló XP', Number(studentProfile.points || 0) > 0, String(studentProfile.points || 0))
  const { count: badgeCount, error: badgeError } = await admin.from('student_badges').select('id', { count: 'exact', head: true }).eq('student_id', studentProfile.id)
  if (badgeError) throw badgeError
  check('El alumno obtuvo o sincronizó un logro', Number(badgeCount || 0) > 0, String(badgeCount || 0))

  const { data: tickets, error: ticketError } = await admin.from('user_support_tickets').select('id,subject,status,admin_response,last_internal_note_at').eq('user_id', studentProfile.id).eq('subject', 'Validación funcional alumno').order('created_at', { ascending: false }).limit(1)
  if (ticketError) throw ticketError
  const ticket = tickets?.[0]
  check('El alumno creó el ticket de soporte esperado', Boolean(ticket), ticket?.subject || '')
  check('El administrador atendió el ticket', Boolean(ticket && ticket.status !== 'open' && String(ticket.admin_response || '').trim()), ticket?.status || '')
  if (ticket) {
    const { count: internalNoteCount, error: internalNoteError } = await admin.from('support_ticket_messages').select('id', { count: 'exact', head: true }).eq('ticket_id', ticket.id).eq('is_internal', true)
    if (internalNoteError) throw internalNoteError
    check('El ticket contiene una nota interna', Number(internalNoteCount || 0) > 0 || Boolean(ticket.last_internal_note_at), String(internalNoteCount || 0))
  }
  const { data: teacherAudit, error: teacherAuditError } = await admin.from('teacher_audit_logs').select('action').eq('teacher_id', teacherProfile.id)
  if (teacherAuditError) throw teacherAuditError
  check('El profesor consultó acciones auditadas', (teacherAudit || []).length > 0, [...new Set((teacherAudit || []).map((item) => item.action))].join(', '))
  check('El profesor archivó una pregunta', (teacherAudit || []).some((item) => item.action === 'teacher.question.archive'))

  const { data: adminAudit, error: adminAuditError } = await admin.from('admin_audit_logs').select('action').eq('admin_id', adminProfile.id)
  if (adminAuditError) throw adminAuditError
  const adminActions = new Set((adminAudit || []).map((item) => item.action))
  const requiredAdminActions = ['admin.user.deactivate', 'admin.user.activate', 'admin.course.archive', 'admin.course.restore', 'admin.classroom.deactivate', 'admin.classroom.activate', 'admin.support.update']
  check('Las acciones administrativas quedaron auditadas', requiredAdminActions.every((action) => adminActions.has(action)), [...adminActions].sort().join(', '))
  const { data: exportJobs, error: exportError } = await admin.from('admin_export_jobs').select('export_type,status,storage_path').eq('requested_by', adminProfile.id)
  if (exportError) throw exportError
  const readyProfileExport = (exportJobs || []).find((job) => job.export_type === 'profiles' && job.status === 'ready' && job.storage_path)
  check('La exportación administrativa de perfiles quedó disponible', Boolean(readyProfileExport), readyProfileExport?.status || '')
  if (readyProfileExport?.storage_path) {
    const { data: csvBlob, error: downloadError } = await admin.storage.from('admin-exports').download(readyProfileExport.storage_path)
    if (downloadError) throw downloadError
    const csv = await csvBlob.text()
    const csvRows = parseCsv(csv.replace(/^\uFEFF/, ''))
    const cells = csvRows.slice(1).flat()
    check('El alias CSV peligroso quedó neutralizado', cells.includes("'=Demo CSV"))
    check('El CSV no contiene celdas ejecutables como fórmula', cells.every((cell) => !isFormulaCell(cell)), String(cells.length))
  }

  if (!password) {
    check('Prueba 403 del administrador restringido', false, 'Falta OMNIQUEST_DEMO_PASSWORD')
  } else {
    const auditorClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: authData, error: authError } = await auditorClient.auth.signInWithPassword({ email: 'demo.auditor@omniquest.test', password })
    if (authError || !authData.session) throw authError || new Error('No se pudo iniciar sesión como auditor.')
    const response = await fetch(`${url}/functions/v1/admin-toggle-user`, { method: 'POST', headers: { apikey: anonKey, authorization: `Bearer ${authData.session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ profileId: importedProfile.id, active: false, reason: 'Prueba de permisos restringidos' }) })
    const responseText = await response.text()
    check('El administrador sin users.manage recibe 403', response.status === 403, String(response.status))
    const { data: unchangedProfile, error: unchangedError } = await admin.from('profiles').select('active').eq('id', importedProfile.id).single()
    if (unchangedError) throw unchangedError
    check('El intento 403 no modifica el usuario objetivo', unchangedProfile.active === importedProfile.active, String(unchangedProfile.active))
    check('La respuesta 403 no filtra datos del usuario objetivo', !responseText.includes(importedProfile.email || '') && !responseText.includes(importedProfile.alias || ''))
    await auditorClient.auth.signOut()
  }
}

function isFormulaCell(value) {
  const raw = String(value || '')
  return /^[\t\r]/.test(raw) || /^[=+@-]/.test(raw.trimStart())
}

function parseCsv(source) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted && char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (!quoted && char === ',') { row.push(cell); cell = ''; continue }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell); if (row.some((value) => value.length > 0)) rows.push(row); row = []; cell = ''; continue
    }
    cell += char
  }
  row.push(cell); if (row.some((value) => value.length > 0)) rows.push(row)
  return rows
}
