import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')

test('admin primary actions use a dedicated accessible action token without changing the role identity accent', () => {
  const tokens = read('lib/designTokens.ts')
  const button = read('components/ui/AppButton.tsx')
  const primitives = read('components/admin/shared/AdminPrimitives.tsx')
  assert.match(tokens, /admin: '#A78BFA'/)
  assert.match(tokens, /primary: '#7C3AED'/)
  assert.match(tokens, /pressed: '#6D28D9'/)
  assert.match(button, /role === 'admin' \? tokens\.action\.admin\.primary/)
  assert.match(button, /tokens\.action\.admin\.pressed/)
  assert.doesNotMatch(primitives, /bg-brand-admin[^\n]*Gestionar/)
  assert.match(primitives, /<AdminButton label="Gestionar"/)
})

test('admin role dropdown and save affordances reflect the effective role and prevent self-demotion in the UI', () => {
  const panel = read('components/admin/users/AdminRoleManagementPanel.tsx')
  const dropdown = read('components/ui/AppDropdown.tsx')
  const hubs = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  assert.match(panel, /<AppDropdown role="admin"/)
  assert.match(dropdown, /const activeColor = role \? tokens\.brand\[role\] : tokens\.border\.active/)
  assert.match(dropdown, /backgroundColor: active \? activeSurface/)
  assert.match(panel, /isSelf && option\.value !== assignment\.role_id/)
  assert.match(panel, /No puedes reducir ni retirar los permisos de tu propia cuenta administrativa\./)
  assert.match(panel, /disabled=\{!canSave\}/)
  assert.match(panel, /reason\.length >= 5/)
  assert.match(panel, /size=\{responsive\.isMobile \? 'md' : 'sm'\}/)
  assert.match(hubs, /currentAdminId=\{data\.portalContext\?\.user_id\}/)
})

test('critical role changes require explicit confirmation in both privilege directions', () => {
  const panel = read('components/admin/users/AdminRoleManagementPanel.tsx')
  assert.match(panel, /Conceder acceso de administrador global/)
  assert.match(panel, /Reducir privilegios administrativos/)
  assert.match(panel, /perderá acceso a determinadas áreas y acciones del portal/)
  assert.match(panel, /Retirar acceso administrativo/)
  assert.match(panel, /quedará sin acceso operativo al portal/)
})

test('administrative access revocation is server-controlled, self-protected and audited', () => {
  const api = read('components/admin/api/adminApi.ts')
  const migration = read('supabase/migrations/20260813140000_admin_permissions_experience_refinement.sql')
  const auditUtils = read('components/admin/utils/adminUtils.ts')
  const types = read('types/database.types.ts')
  assert.match(api, /supabase\.rpc\('revoke_admin_role'/)
  assert.match(types, /revoke_admin_role:/)
  assert.match(migration, /admin_has_permission\('admin\.roles\.manage'\)/)
  assert.match(migration, /length\(v_reason\) < 5/)
  assert.match(migration, /p_user_id = v_actor/)
  assert.match(migration, /delete from public\.admin_role_assignments/)
  assert.match(migration, /'admin\.role\.revoke'/)
  assert.match(migration, /insert into public\.admin_user_change_history/)
  assert.match(migration, /insert into public\.admin_audit_logs/)
  assert.match(migration, /revoke all on function public\.revoke_admin_role\(uuid, text\) from public, anon/)
  assert.match(auditUtils, /'admin\.role\.revoke': 'Acceso administrativo retirado'/)
})
