import { createClient } from '@supabase/supabase-js'
import { loadLocalSupabaseEnvironment } from './local-supabase-environment.mjs'

const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase()
const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '')
const alias = String(process.env.BOOTSTRAP_ADMIN_ALIAS || 'Administrador').trim()

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Define BOOTSTRAP_ADMIN_EMAIL con un correo válido.')
if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password)) throw new Error('BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo.')
if (!alias) throw new Error('BOOTSTRAP_ADMIN_ALIAS no puede estar vacío.')

const { url, serviceRoleKey } = loadLocalSupabaseEnvironment()
const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: existingAdmins, error: assignmentError } = await supabase.from('admin_role_assignments').select('user_id').limit(1)
if (assignmentError) throw assignmentError
if (existingAdmins?.length) throw new Error('Ya existe un administrador con perfil administrativo asignado. El bootstrap inicial no puede ejecutarse de nuevo.')

const user = await findOrCreateAdmin()
const { error: profileError } = await supabase.from('profiles').upsert({ id: user.id, email, alias, role_id: 'admin', active: true }, { onConflict: 'id' })
if (profileError) throw profileError

const { error: roleError } = await supabase.from('admin_role_assignments').insert({ user_id: user.id, role_id: 'super_admin', assigned_by: user.id })
if (roleError) throw roleError

console.log(`Administrador global inicial creado correctamente: ${email}`)

async function findOrCreateAdmin() {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const existing = data.users.find((candidate) => candidate.email?.toLowerCase() === email)
    if (existing) {
      const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { alias, role_id: 'admin' } })
      if (updateError || !updated.user) throw updateError || new Error('No se pudo actualizar el usuario administrador.')
      return updated.user
    }
    if (data.users.length < 1000) break
  }

  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { alias, role_id: 'admin' } })
  if (error || !data.user) throw error || new Error('No se pudo crear el administrador inicial.')
  return data.user
}

findOrCreateAdmin().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Bootstrap de administrador no completado: ${message}`)
  process.exitCode = 1
})