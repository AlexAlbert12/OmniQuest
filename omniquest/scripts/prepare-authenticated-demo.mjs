import { createClient } from '@supabase/supabase-js'
import { loadLocalSupabaseEnvironment } from './local-supabase-environment.mjs'

const password = String(process.env.OMNIQUEST_DEMO_PASSWORD || '')
if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password)) throw new Error('Define OMNIQUEST_DEMO_PASSWORD con al menos 12 caracteres, mayúscula, minúscula, número y símbolo.')

const { url, serviceRoleKey } = loadLocalSupabaseEnvironment()
const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const accounts = [
  { key: 'student', email: 'demo.student@omniquest.test', alias: 'Alumno Demo', roleId: 'student' },
  { key: 'teacher', email: 'demo.teacher@omniquest.test', alias: 'Profesor Demo', roleId: 'teacher' },
  { key: 'admin', email: 'demo.admin@omniquest.test', alias: 'Administrador Demo', roleId: 'admin' },
  { key: 'auditor', email: 'demo.auditor@omniquest.test', alias: 'Auditor Demo', roleId: 'admin' },
  { key: 'imported', email: 'demo.imported@omniquest.test', alias: '=Demo CSV', roleId: 'student' },
]

const authUsers = await listAuthUsers()
const users = {}
for (const account of accounts) users[account.key] = await ensureUser(account, authUsers)

await assertNoError(supabase.from('admin_role_assignments').upsert([
  { user_id: users.admin.id, role_id: 'super_admin', assigned_by: users.admin.id },
  { user_id: users.auditor.id, role_id: 'auditor', assigned_by: users.admin.id },
], { onConflict: 'user_id' }), 'No se pudieron asignar los perfiles administrativos.')

const archivedSubject = await ensureSubject({ code: 'ARCH2601', name: 'Curso archivado de validación', teacherId: users.teacher.id, active: false, archived: true, reason: 'Caso negativo de validación' })
await ensureClassroom({ code: 'ARCHCL01', name: 'Clase archivada', subjectId: archivedSubject.id, active: true, expiresAt: null })
const expiredSubject = await ensureSubject({ code: 'EXP26001', name: 'Curso con código caducado', teacherId: users.teacher.id, active: true, archived: false, reason: null })
await ensureClassroom({ code: 'EXPCL001', name: 'Clase con código caducado', subjectId: expiredSubject.id, active: true, expiresAt: new Date(Date.now() - 86_400_000).toISOString() })

console.log('\nEntorno demo preparado en Supabase local.')
console.table(accounts.map((account) => ({ cuenta: account.key, correo: account.email, rol: account.roleId })))
console.log('Contraseña demo cargada desde OMNIQUEST_DEMO_PASSWORD.')
console.log('Código inexistente: NOEXISTE')
console.log('Código de clase caducado: EXPCL001')
console.log('Código de curso archivado: ARCHCL01')
console.log('Alumno para importación: demo.imported@omniquest.test')

async function ensureUser(account, knownUsers) {
  let user = knownUsers.get(account.email)
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({ email: account.email, password, email_confirm: true, user_metadata: { alias: account.alias, role_id: account.roleId } })
    if (error || !data.user) throw error || new Error(`No se pudo crear ${account.email}.`)
    user = data.user
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: { alias: account.alias, role_id: account.roleId } })
    if (error || !data.user) throw error || new Error(`No se pudo actualizar ${account.email}.`)
    user = data.user
  }
  await assertNoError(supabase.from('profiles').upsert({ id: user.id, email: account.email, alias: account.alias, role_id: account.roleId, active: true, visibility: 'public', expires_at: null }, { onConflict: 'id' }), `No se pudo preparar el perfil ${account.email}.`)
  return user
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

async function ensureSubject({ code, name, teacherId, active, archived, reason }) {
  const { data: current, error: readError } = await supabase.from('subjects').select('id').eq('code', code).maybeSingle()
  if (readError) throw readError
  const values = { teacher_id: teacherId, name, description: 'Datos controlados para validación funcional.', icon: '🧪', code, active, is_archived: archived, archive_reason: reason, archived_at: archived ? new Date().toISOString() : null, retention_until: archived ? new Date(Date.now() + 90 * 86_400_000).toISOString() : null, education_level: 'Demo', academic_year: '2026/2027', subject_label: 'VALIDATION_FIXTURE' }
  if (current) {
    const { data, error } = await supabase.from('subjects').update(values).eq('id', current.id).select('id').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('subjects').insert(values).select('id').single()
  if (error) throw error
  return data
}

async function ensureClassroom({ code, name, subjectId, active, expiresAt }) {
  const { data: current, error: readError } = await supabase.from('classrooms').select('id').eq('code', code).maybeSingle()
  if (readError) throw readError
  const values = { subject_id: subjectId, name, academic_year: '2026/2027', code, active, code_expires_at: expiresAt, deactivation_reason: null, deactivated_at: null }
  if (current) return assertNoError(supabase.from('classrooms').update(values).eq('id', current.id), `No se pudo actualizar la clase ${code}.`)
  return assertNoError(supabase.from('classrooms').insert(values), `No se pudo crear la clase ${code}.`)
}

async function assertNoError(request, message) {
  const { error } = await request
  if (error) throw new Error(`${message} ${error.message}`)
}
