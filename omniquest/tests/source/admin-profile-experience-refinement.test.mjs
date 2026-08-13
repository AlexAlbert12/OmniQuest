import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')

test('admin profile uses the lightweight own-context hook instead of the aggregate admin data loader', () => {
  const hubs = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  const hook = read('components/admin/hooks/useAdminPortalContext.ts')
  const profileBlock = hubs.match(/export function AdminProfileScreen\(\) \{[\s\S]*?\n\}\n\ntype HubItem/)?.[0] || ''
  assert.match(profileBlock, /const data = useAdminPortalContext\(\)/)
  assert.doesNotMatch(profileBlock, /useAdminData\(\)/)
  assert.match(hook, /fetchAdminPortalContext\(\)/)
  assert.doesNotMatch(hook, /get_admin_dashboard_metrics/)
  assert.doesNotMatch(hook, /get_admin_profiles_page/)
  assert.doesNotMatch(hook, /admin_audit_logs/)
})

test('admin profile reuses the shared avatar and keeps administrative identity icons purple', () => {
  const hubs = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  assert.match(hubs, /<AdminProfileAvatar alias=\{alias\} avatar=\{profile\?\.avatar\} size=\{96\} \/>/)
  assert.match(hubs, /<Ionicons name=\{icon\} size=\{19\} color=\{tokens\.brand\.admin\} \/>/)
  assert.match(hubs, /<Ionicons name=\{icon\} size=\{20\} color=\{tokens\.brand\.admin\} \/>/)
})

test('admin profile adapts density by breakpoint and replaces redundant status with access information', () => {
  const hubs = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  assert.match(hubs, /responsive\.isDesktop \? <View/)
  assert.match(hubs, /label="Perfil de acceso"/)
  assert.match(hubs, /label="Seguridad" value="Acceso verificado"/)
  assert.match(hubs, /Identidad y permisos validados en servidor/)
  assert.doesNotMatch(hubs, /label="Estado" value=\{profile\?\.active/)
})

test('assigned permissions are exposed as human functional scopes without technical codes in the visible sheet', () => {
  const hubs = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  assert.match(hubs, /detail="Ver permisos asignados"/)
  assert.match(hubs, /testID="admin-profile-permissions-sheet"/)
  for (const label of ['Portal administrativo', 'Usuarios', 'Cursos y clases', 'Auditoría', 'Soporte', 'Notificaciones', 'Administración']) assert.match(hubs, new RegExp(`title: '${label}'`))
  assert.match(hubs, /Acceso completo/)
  assert.match(hubs, /Sin acceso/)
})
