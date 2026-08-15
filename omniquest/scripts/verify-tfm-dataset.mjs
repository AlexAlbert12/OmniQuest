import { loadTfmDatasetEnvironment } from './tfm-dataset-environment.mjs'
import { STUDENT_IDENTITIES, TEACHER_IDENTITIES } from './tfm-dataset-config.mjs'

const keepMediaPaths = readRepeatedArg('--keep-question-media-path')
const { projectRef, supabase } = loadTfmDatasetEnvironment()

try {
  const checks = []
  const check = (name, passed, detail = '') => checks.push({ comprobacion: name, resultado: passed ? 'PASS' : 'FAIL', detalle: String(detail ?? '') })
  const profiles = await selectAll('profiles', 'id,email,alias,role_id,active,avatar,points')
  const assignments = await selectAll('admin_role_assignments', 'user_id,role_id')
  const subjects = await selectAll('subjects', 'id,name,teacher_id,is_archived,active')
  const questions = await selectAll('questions', 'id,subject_id,type,text,media_path')
  const attempts = await selectAll('attempt_history', 'id,student_id,manual_review_status,submitted_answer_text,submitted_answer_payload,review_notes')
  const games = await selectAll('game_attempts', 'id,student_id,status,total_score')
  const badges = await selectAll('student_badges', 'id,student_id,badge_id')
  const tickets = await selectAll('user_support_tickets', 'id,user_id,status,subject,message,contact_email')
  const notes = await selectAll('teacher_student_notes', 'id,teacher_id,student_id,body')
  const notifications = await selectAll('notifications', 'id,user_id,title,description,metadata')
  const prefs = await selectAll('user_notification_preferences', 'user_id,push_enabled,email_enabled,support_contact_email,teacher_reminder_email,teacher_digest_frequency')
  const authUsers = await listAuthUsers()
  const roleCounts = countBy(profiles, 'role_id')
  const questionTypes = new Set(questions.map((question) => question.type))
  const expectedTypes = new Set(['multiple_choice', 'true_false', 'open_answer', 'fill_blank', 'ordering', 'match_pairs', 'drag_drop'])
  const expectedEmails = new Set([...TEACHER_IDENTITIES, ...STUDENT_IDENTITIES].map((identity) => identity.email))
  const nonAdminEmails = new Set(profiles.filter((profile) => profile.role_id !== 'admin').map((profile) => profile.email).filter(Boolean))
  const authNonAdminEmails = new Set(authUsers.filter((user) => profiles.find((profile) => profile.id === user.id)?.role_id !== 'admin').map((user) => user.email).filter(Boolean))
  const admins = profiles.filter((profile) => profile.role_id === 'admin')
  const superAdminIds = new Set(assignments.filter((assignment) => assignment.role_id === 'super_admin').map((assignment) => assignment.user_id))

  check('1 administrador', roleCounts.admin === 1, roleCounts.admin || 0)
  check('Administrador conservado como super_admin', admins.length === 1 && superAdminIds.has(admins[0].id), admins[0]?.alias || '')
  check('4 profesores sintéticos', roleCounts.teacher === 4, roleCounts.teacher || 0)
  check('25 alumnos sintéticos', roleCounts.student === 25, roleCounts.student || 0)
  check('0 invitados', (roleCounts.guest || 0) === 0, roleCounts.guest || 0)
  check('Auth y profiles alineados', authUsers.length === profiles.length, `${authUsers.length}/${profiles.length}`)
  check('Emails sintéticos completos en profiles', setEquals(nonAdminEmails, expectedEmails), `${nonAdminEmails.size}/${expectedEmails.size}`)
  check('Emails sintéticos completos en Auth', setEquals(authNonAdminEmails, expectedEmails), `${authNonAdminEmails.size}/${expectedEmails.size}`)
  check('Profesor demo principal disponible', profiles.some((profile) => profile.email === TEACHER_IDENTITIES[0].email && profile.role_id === 'teacher' && profile.active), TEACHER_IDENTITIES[0].email)
  check('Alumno demo principal disponible', profiles.some((profile) => profile.email === STUDENT_IDENTITIES[0].email && profile.role_id === 'student' && profile.active), STUDENT_IDENTITIES[0].email)

  const activeSubjects = subjects.filter((subject) => !subject.is_archived && subject.active !== false)
  const archivedSubjects = subjects.filter((subject) => subject.is_archived)
  check('Al menos 4 cursos activos', activeSubjects.length >= 4, activeSubjects.length)
  check('Existe curso histórico archivado', archivedSubjects.some((subject) => subject.name === 'Fisioterapia · Curso 2025/26'), archivedSubjects.map((subject) => subject.name).join(', '))
  check('Banco con al menos 30 preguntas', questions.length >= 30, questions.length)
  check('7/7 tipos de pregunta representados', [...expectedTypes].every((type) => questionTypes.has(type)), [...questionTypes].sort().join(', '))
  check('Actividad histórica suficiente', attempts.length >= 100, attempts.length)
  check('Al menos 20 partidas finalizadas', games.filter((game) => game.status === 'finished').length >= 20, games.filter((game) => game.status === 'finished').length)
  check('Revisiones pendientes disponibles', attempts.some((attempt) => attempt.manual_review_status === 'pending'), countStatus(attempts, 'pending'))
  check('Revisiones completadas disponibles', attempts.some((attempt) => ['approved', 'rejected'].includes(attempt.manual_review_status)), `approved=${countStatus(attempts, 'approved')}, rejected=${countStatus(attempts, 'rejected')}`)
  check('Logros disponibles', badges.length > 0, badges.length)
  check('3 tickets de soporte sintéticos', tickets.length === 3, tickets.length)
  check('3 notas docentes sintéticas', notes.length === 3, notes.length)
  check('Notificaciones demo disponibles', notifications.length >= 10, notifications.length)

  const ephemeralChecks = [
    ['push_tokens', 'id'], ['data_export_requests', 'id'], ['account_deletion_requests', 'id'], ['admin_export_jobs', 'id'], ['teacher_audit_export_requests', 'id'], ['teacher_student_recovery_requests', 'id'], ['teacher_digest_deliveries', 'id'], ['user_sessions', 'id'],
  ]
  for (const [table, column] of ephemeralChecks) { const count = await countRows(table, column); check(`${table} limpio`, count === 0, count) }
  const nonAdminBackupCodes = await countRowsFiltered('account_backup_codes', 'id', 'user_id', 'neq', admins[0]?.id || '00000000-0000-0000-0000-000000000000')
  check('Sin backup codes de cuentas demo', nonAdminBackupCodes === 0, nonAdminBackupCodes)
  check('Preferencias de correo/push desactivadas en cuentas demo', prefs.filter((pref) => expectedEmails.has(profileEmail(profiles, pref.user_id))).every((pref) => !pref.push_enabled && !pref.email_enabled && pref.teacher_digest_frequency === 'off'), prefs.length)

  const storage = {}
  for (const bucket of ['avatars', 'account-exports', 'admin-exports', 'support-attachments', 'teacher-audit-exports', 'question-media']) storage[bucket] = await listStoragePaths(bucket)
  check('Sin exports personales en Storage', storage['account-exports'].length === 0, storage['account-exports'].length)
  check('Sin adjuntos privados de soporte', storage['support-attachments'].length === 0, storage['support-attachments'].length)
  check('Sin exports administrativos anteriores', storage['admin-exports'].length === 0, storage['admin-exports'].length)
  check('Sin exports docentes anteriores', storage['teacher-audit-exports'].length === 0, storage['teacher-audit-exports'].length)
  check('Avatares antiguos eliminados o sustituidos solo en demo/', storage.avatars.every((path) => path.startsWith('demo/')), storage.avatars.length ? storage.avatars.join(', ') : '0')
  const mediaAssets = await selectAll('question_media_assets', 'path,processed_path,thumbnail_path')
  const allowedMedia = new Set(keepMediaPaths)
  for (const asset of mediaAssets) if (keepMediaPaths.includes(asset.path)) for (const path of [asset.path, asset.processed_path, asset.thumbnail_path].filter(Boolean)) allowedMedia.add(path)
  check('Question media limitado a material aprobado', keepMediaPaths.length > 0 && storage['question-media'].every((path) => allowedMedia.has(path)), storage['question-media'].join(', '))

  const immutableTables = ['admin_audit_logs', 'teacher_audit_logs', 'admin_user_change_history', 'manual_review_history']
  const adminEmails = new Set(admins.map((admin) => admin.email).filter(Boolean).map((email) => email.toLowerCase()))
  for (const table of immutableTables) {
    const rows = await selectAll(table, '*')
    const forbidden = findForbiddenEmails(rows, adminEmails)
    check(`${table} sin correos personales`, forbidden.length === 0, forbidden.join(', '))
  }
  const mutablePrivacyRows = { tickets, notes, notifications, attempts }
  const forbiddenMutable = findForbiddenEmails(mutablePrivacyRows, adminEmails)
  check('Contenido visible sin correos personales', forbiddenMutable.length === 0, forbiddenMutable.join(', '))

  const primaryTeacher = profiles.find((profile) => profile.email === TEACHER_IDENTITIES[0].email)
  const primaryStudent = profiles.find((profile) => profile.email === STUDENT_IDENTITIES[0].email)
  const math = subjects.find((subject) => normalize(subject.name) === normalize('Matemáticas'))
  const mathEnrollments = math ? await selectAllFiltered('enrollments', 'id,student_id,subject_id', 'subject_id', math.id) : []
  check('Profesor demo principal controla Matemáticas', Boolean(primaryTeacher && math && math.teacher_id === primaryTeacher.id), math?.teacher_id || '')
  check('Alumno demo principal está matriculado en Matemáticas', Boolean(primaryStudent && mathEnrollments.some((row) => row.student_id === primaryStudent.id)), primaryStudent?.id || '')
  check('Alumno demo principal conserva actividad', Boolean(primaryStudent && attempts.filter((attempt) => attempt.student_id === primaryStudent.id).length > 0), primaryStudent ? attempts.filter((attempt) => attempt.student_id === primaryStudent.id).length : 0)

  console.log(`\nVerificación dataset TFM · ${projectRef}`)
  console.table(checks)
  const failed = checks.filter((item) => item.resultado === 'FAIL')
  if (failed.length) throw new Error(`${failed.length} comprobación(es) no cumplen el criterio de aceptación.`)
  console.log('\nDataset TFM verificado correctamente.')
} catch (error) {
  console.error(`\nVerificación no superada: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}

function countBy(rows, key) { return rows.reduce((acc, row) => { const value = row[key] || 'null'; acc[value] = (acc[value] || 0) + 1; return acc }, {}) }
function countStatus(rows, status) { return rows.filter((row) => row.manual_review_status === status).length }
function setEquals(a, b) { return a.size === b.size && [...a].every((value) => b.has(value)) }
function profileEmail(profiles, userId) { return profiles.find((profile) => profile.id === userId)?.email || null }
function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() }
function readRepeatedArg(name) { const result = []; for (let i = 0; i < process.argv.length; i += 1) if (process.argv[i] === name && process.argv[i + 1]) result.push(process.argv[i + 1]); return result }
function findForbiddenEmails(value, allowedAdminEmails) { const matches = JSON.stringify(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []; return [...new Set(matches.map((email) => email.toLowerCase()).filter((email) => !email.endsWith('@demo.omniquest.test') && !allowedAdminEmails.has(email)))] }

async function listAuthUsers() { const users = []; for (let page = 1; ; page += 1) { const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 }); if (error) throw error; users.push(...data.users); if (data.users.length < 1000) return users } }
async function selectAll(table, columns = '*') { const result = []; for (let from = 0; ; from += 1000) { const { data, error } = await supabase.from(table).select(columns).range(from, from + 999); if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`); result.push(...(data || [])); if (!data || data.length < 1000) return result } }
async function selectAllFiltered(table, columns, filterColumn, filterValue) { const { data, error } = await supabase.from(table).select(columns).eq(filterColumn, filterValue); if (error) throw error; return data || [] }
async function countRows(table, column) { const { count, error } = await supabase.from(table).select(column, { count: 'exact', head: true }); if (error) throw new Error(`No se pudo contar ${table}: ${error.message}`); return Number(count || 0) }
async function countRowsFiltered(table, column, filterColumn, operator, value) { let request = supabase.from(table).select(column, { count: 'exact', head: true }); request = operator === 'neq' ? request.neq(filterColumn, value) : request.eq(filterColumn, value); const { count, error } = await request; if (error) throw error; return Number(count || 0) }
async function listStoragePaths(bucket, prefix = '') { const paths = []; for (let offset = 0; ; offset += 1000) { const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }); if (error) throw new Error(`No se pudo listar storage ${bucket}/${prefix}: ${error.message}`); for (const item of data || []) { const path = prefix ? `${prefix}/${item.name}` : item.name; if (item.id) paths.push(path); else paths.push(...await listStoragePaths(bucket, path)) } if (!data || data.length < 1000) return paths } }
