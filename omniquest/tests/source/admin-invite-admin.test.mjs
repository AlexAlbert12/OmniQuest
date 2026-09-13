import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')

test('admin invitation is exposed only through the secured administrative workflow', () => {
  const panel = read('components/admin/users/AdminRoleManagementPanel.tsx')
  const api = read('components/admin/api/adminApi.ts')
  const hubs = read('components/admin/mobile/AdminMobileHubScreens.tsx')

  assert.match(hubs, /permission: 'admin\.roles\.manage'/)
  assert.match(hubs, /canManage=\{canManage\}/)
  assert.match(panel, /if \(!canManage\) return null/)
  assert.match(panel, /label="Añadir administrador"/)
  assert.match(panel, /title="Añadir administrador"/)
  assert.match(panel, /Correo del nuevo administrador/)
  assert.match(panel, /Alias \/ nombre visible/)
  assert.match(panel, /Perfil de permisos/)
  assert.match(panel, /Motivo de la invitación/)
  assert.match(panel, /Enviar invitación de administrador/)
  assert.doesNotMatch(panel, /Contraseña temporal|password/i)
  assert.match(api, /invokeAdminAction<AdminInviteResult>\('admin-invite-admin'/)
})

test('super admin invitations require the same explicit privilege warning used by role changes', () => {
  const panel = read('components/admin/users/AdminRoleManagementPanel.tsx')
  assert.match(panel, /inviteRoleId === 'super_admin'/)
  assert.match(panel, /Conceder acceso de administrador global/)
  assert.match(panel, /acceso completo a usuarios, contenido, soporte, auditoría y gestión de otros administradores/)
  assert.match(panel, /role: 'danger', onPress: performInvite/)
})

test('admin invitation edge function validates permission, account conflicts and server-side provisioning', () => {
  assert.equal(existsSync('supabase/functions/admin-invite-admin/index.ts'), true)
  const edge = read('supabase/functions/admin-invite-admin/index.ts')

  assert.match(edge, /getAdminContext\(req, 'admin\.roles\.manage'\)/)
  assert.match(edge, /normalizeEmail\(body\.email\)/)
  assert.match(edge, /findAuthUserByEmail/)
  assert.match(edge, /account_role_conflict/)
  assert.match(edge, /admin_pending_assignment/)
  assert.doesNotMatch(edge, /updateUserById\(existingUser\.id/)
  assert.match(edge, /auth\.admin\.generateLink\(\{[\s\S]*type: 'invite'/)
  assert.match(edge, /role_id: 'admin'/)
  assert.match(edge, /actorClient\.rpc\('assign_admin_role'/)
  assert.match(edge, /p_reason: reason/)
  assert.doesNotMatch(edge, /actor_id|adminUserId:\s*body/)
})

test('admin invitation mail is safe, redirectable and never exposes a generated password', () => {
  const edge = read('supabase/functions/admin-invite-admin/index.ts')

  assert.match(edge, /ADMIN_INVITE_REDIRECT_TO/)
  assert.match(edge, /SITE_URL/)
  assert.match(edge, /RESEND_API_KEY/)
  assert.match(edge, /MAIL_FROM/)
  assert.match(edge, /EMAIL_DELIVERY_MODE/)
  assert.match(edge, /RESEND_TEST_TO/)
  assert.match(edge, /https:\/\/api\.resend\.com\/emails/)
  assert.doesNotMatch(edge, /generateTemporaryPassword|temporaryPassword|password:/)
  assert.match(edge, /Aceptar invitación/)
})

test('failed provisioning rolls back only the auth user created by the current request', () => {
  const edge = read('supabase/functions/admin-invite-admin/index.ts')
  assert.match(edge, /let createdUserId: string \| null = null/)
  assert.match(edge, /createdUserId = invitedUser\.id/)
  assert.match(edge, /if \(createdUserId && !completed && adminClientForRollback\) await rollbackInvitedUser/)
  assert.match(edge, /auth\.admin\.deleteUser\(userId\)/)
  assert.doesNotMatch(edge, /deleteUser\(existingUser\.id\)/)
})

test('public signup remains unable to self-elevate to admin', () => {
  const migration = read('supabase/migrations/20260728130000_public_auth_hardening.sql')
  const register = read('app/(auth)/register.tsx')

  assert.match(migration, /when coalesce\(new\.is_anonymous, false\) then 'guest'/)
  assert.match(migration, /else 'student'/)
  assert.doesNotMatch(migration, /raw_user_meta_data->>'role_id'/)
  assert.doesNotMatch(register, /role_id:\s*['"]admin['"]/)
})

test('admin invitation writes a dedicated audit event and keeps existing role audit semantics', () => {
  const edge = read('supabase/functions/admin-invite-admin/index.ts')
  const utils = read('components/admin/utils/adminUtils.ts')

  assert.match(edge, /action: 'admin\.user\.invite'/)
  assert.match(edge, /source: 'admin-invite-admin'/)
  assert.match(edge, /actorClient\.rpc\('assign_admin_role'/)
  assert.match(utils, /'admin\.user\.invite': 'Administrador invitado'/)
})
