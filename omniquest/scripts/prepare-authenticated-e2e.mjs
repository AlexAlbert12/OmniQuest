import { createClient } from '@supabase/supabase-js'
import { loadLocalSupabaseEnvironment } from './local-supabase-environment.mjs'

const accounts = [
  readAccount('student', 'Alumno E2E', 'student'),
  readAccount('teacher', 'Profesor E2E', 'teacher'),
  readAccount('admin', 'Administrador E2E', 'admin'),
]

assertDistinctEmails(accounts)
const { url, serviceRoleKey } = loadLocalSupabaseEnvironment()
const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const knownUsers = await listAuthUsers()
const users = {}
for (const account of accounts) users[account.key] = await ensureUser(account, knownUsers)

await assertNoError(supabase.from('admin_role_assignments').upsert({ user_id: users.admin.id, role_id: 'super_admin', assigned_by: users.admin.id }, { onConflict: 'user_id' }), 'No se pudo asignar super_admin a la cuenta E2E.')
await assertNoError(supabase.from('user_sessions').delete().in('user_id', [users.teacher.id, users.admin.id]), 'No se pudieron limpiar las sesiones gestionadas E2E.')

const courseName = String(process.env.E2E_COURSE_NAME || 'Curso E2E autenticado').trim()
const topicName = String(process.env.E2E_TOPIC_NAME || 'Fundamentos E2E').trim()
const questionText = String(process.env.E2E_QUESTION_TEXT || '¿Cuál es el resultado de 2 + 2?').trim()
const subject = await ensureSubject({ teacherId: users.teacher.id, name: courseName })
const classroom = await ensureClassroom({ subjectId: subject.id })
const topic = await ensureTopic({ subjectId: subject.id, classroomId: classroom.id, title: topicName })
const question = await ensureQuestion({ subjectId: subject.id, classroomId: classroom.id, topicId: topic.id, text: questionText })
await ensureEnrollment({ studentId: users.student.id, subjectId: subject.id, classroomId: classroom.id })

console.log('Fixtures E2E autenticadas preparadas en Supabase local.')
console.table([
  { recurso: 'curso', valor: courseName },
  { recurso: 'clase', valor: 'Clase E2E' },
  { recurso: 'tema', valor: topicName },
  { recurso: 'pregunta', valor: questionText },
  { recurso: 'id_pregunta', valor: question.id },
])

function readAccount(key, alias, roleId) {
  const prefix = `E2E_${key.toUpperCase()}`
  const email = requireEnvironment(`${prefix}_EMAIL`).toLowerCase()
  const password = requireEnvironment(`${prefix}_PASSWORD`)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${prefix}_EMAIL no contiene un correo válido.`)
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password)) throw new Error(`${prefix}_PASSWORD debe tener al menos 12 caracteres, mayúscula, minúscula, número y símbolo.`)
  return { key, email, password, alias, roleId }
}

function requireEnvironment(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`)
  return value
}

function assertDistinctEmails(rows) {
  const emails = rows.map((row) => row.email)
  if (new Set(emails).size !== emails.length) throw new Error('Las cuentas E2E de alumno, profesor y administrador deben usar correos distintos.')
}

async function listAuthUsers() {
  const result = new Map()
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const user of data.users) if (user.email) result.set(user.email.toLowerCase(), user)
    if (data.users.length < 1000) return result
  }
}

async function ensureUser(account, knownUsers) {
  const current = knownUsers.get(account.email)
  const attributes = { email: account.email, password: account.password, email_confirm: true, user_metadata: { alias: account.alias, role_id: account.roleId } }
  const result = current ? await supabase.auth.admin.updateUserById(current.id, attributes) : await supabase.auth.admin.createUser(attributes)
  if (result.error || !result.data.user) throw result.error || new Error(`No se pudo preparar ${account.email}.`)
  const user = result.data.user
  await assertNoError(supabase.from('profiles').upsert({ id: user.id, email: account.email, alias: account.alias, role_id: account.roleId, active: true, visibility: 'public', expires_at: null, onboarding_version: account.roleId === 'student' || account.roleId === 'teacher' ? 1 : 0, onboarding_completed_at: account.roleId === 'student' || account.roleId === 'teacher' ? new Date().toISOString() : null }, { onConflict: 'id' }), `No se pudo preparar el perfil ${account.email}.`)
  return user
}

async function ensureSubject({ teacherId, name }) {
  const code = 'E2E2601'
  const values = { teacher_id: teacherId, name, description: 'Curso estable para las pruebas E2E autenticadas.', icon: '🧪', code, theme_color: '#8B5CF6', active: true, is_archived: false, archive_reason: null, archived_at: null, retention_until: null, education_level: 'E2E', academic_year: '2026/2027', subject_label: 'E2E_AUTHENTICATED' }
  const { data: current, error: readError } = await supabase.from('subjects').select('id').eq('code', code).maybeSingle()
  if (readError) throw readError
  if (current) {
    const { data, error } = await supabase.from('subjects').update(values).eq('id', current.id).select('id').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('subjects').insert(values).select('id').single()
  if (error) throw error
  return data
}

async function ensureClassroom({ subjectId }) {
  const code = 'E2E001'
  const values = { subject_id: subjectId, name: 'Clase E2E', academic_year: '2026/2027', code, active: true, code_expires_at: null, deactivation_reason: null, deactivated_at: null }
  const { data: current, error: readError } = await supabase.from('classrooms').select('id').eq('code', code).maybeSingle()
  if (readError) throw readError
  if (current) {
    const { data, error } = await supabase.from('classrooms').update(values).eq('id', current.id).select('id').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('classrooms').insert(values).select('id').single()
  if (error) throw error
  return data
}

async function ensureTopic({ subjectId, classroomId, title }) {
  const values = { subject_id: subjectId, classroom_id: classroomId, title, description: 'Tema estable para abrir una partida E2E.', icon: '📘', sort_order: 1, active: true, available_until: null }
  const { data: current, error: readError } = await supabase.from('subject_topics').select('id').eq('subject_id', subjectId).eq('classroom_id', classroomId).eq('title', title).limit(1).maybeSingle()
  if (readError) throw readError
  if (current) {
    const { data, error } = await supabase.from('subject_topics').update(values).eq('id', current.id).select('id').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('subject_topics').insert(values).select('id').single()
  if (error) throw error
  return data
}

async function ensureQuestion({ subjectId, classroomId, topicId, text }) {
  const values = { subject_id: subjectId, classroom_id: classroomId, topic_id: topicId, type: 'multiple_choice', text, points_base: 10, time_limit_seconds: 60, difficulty: 1, explanation: 'La suma de dos y dos es cuatro.', active: true }
  const { data: current, error: readError } = await supabase.from('questions').select('id').eq('subject_id', subjectId).eq('classroom_id', classroomId).eq('topic_id', topicId).eq('text', text).limit(1).maybeSingle()
  if (readError) throw readError
  const question = current
    ? await updateAndSelect('questions', current.id, values)
    : await insertAndSelect('questions', values)
  await assertNoError(supabase.from('answers').delete().eq('question_id', question.id), 'No se pudieron reiniciar las respuestas E2E.')
  await assertNoError(supabase.from('answers').insert([
    { question_id: question.id, text: '3', is_correct: false, sort_order: 1 },
    { question_id: question.id, text: '4', is_correct: true, sort_order: 2 },
    { question_id: question.id, text: '5', is_correct: false, sort_order: 3 },
    { question_id: question.id, text: '6', is_correct: false, sort_order: 4 },
  ]), 'No se pudieron crear las respuestas E2E.')
  return question
}

async function ensureEnrollment({ studentId, subjectId, classroomId }) {
  const { data: current, error: readError } = await supabase.from('enrollments').select('id').eq('student_id', studentId).eq('classroom_id', classroomId).limit(1).maybeSingle()
  if (readError) throw readError
  if (current) return assertNoError(supabase.from('enrollments').update({ subject_id: subjectId }).eq('id', current.id), 'No se pudo actualizar la matrícula E2E.')
  return assertNoError(supabase.from('enrollments').insert({ student_id: studentId, subject_id: subjectId, classroom_id: classroomId }), 'No se pudo crear la matrícula E2E.')
}

async function updateAndSelect(table, id, values) {
  const { data, error } = await supabase.from(table).update(values).eq('id', id).select('id').single()
  if (error) throw error
  return data
}

async function insertAndSelect(table, values) {
  const { data, error } = await supabase.from(table).insert(values).select('id').single()
  if (error) throw error
  return data
}

async function assertNoError(request, message) {
  const { error } = await request
  if (error) throw new Error(`${message} ${error.message}`)
}
