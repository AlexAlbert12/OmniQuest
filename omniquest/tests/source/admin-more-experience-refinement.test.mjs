import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')

test('admin More keeps desktop secondary navigation concise and mobile navigation compact', () => {
  const hubs = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  assert.match(hubs, /subtitle="Soporte, notificaciones, exportaciones, permisos y gestión de tu cuenta\."/)
  assert.match(hubs, /!responsive\.isDesktop \? \[\{ title: 'Soporte'/)
  assert.match(hubs, /compactOnMobile/)
  assert.match(hubs, /min-h-\[104px\]/)
  assert.match(hubs, /Supervisa envíos, entregas, reintentos y dispositivos registrados\./)
  assert.match(hubs, /Gestiona el acceso y los permisos de otros administradores\./)
  assert.match(hubs, /!responsive\.isDesktop \? <Pressable[\s\S]*accessibilityLabel="Cerrar sesión"/)
  assert.match(hubs, /color=\{tokens\.semantic\.danger\}/)
})

test('administrative sign out requires confirmation from desktop and mobile entry points', () => {
  const scaffold = read('components/admin/shared/AdminScaffold.tsx')
  const hubs = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  for (const source of [scaffold, hubs]) {
    assert.match(source, /title: 'Cerrar sesión'/)
    assert.match(source, /Se cerrará tu sesión administrativa en este dispositivo\./)
    assert.match(source, /\{ label: 'Cancelar', role: 'cancel' \}/)
    assert.match(source, /\{ label: 'Cerrar sesión', role: 'danger'/)
  }
  assert.match(scaffold, /onSignOut=\{requestSignOut\}/)
})

test('admin own profile identity is independent from users.read', () => {
  const hubs = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  const api = read('components/admin/api/adminApi.ts')
  const types = read('components/admin/types/admin.ts')
  const migration = read('supabase/migrations/20260813094500_admin_more_own_identity.sql')
  assert.match(hubs, /const profile = data\.portalContext\?\.profile/)
  assert.doesNotMatch(hubs, /data\.profiles\.find/)
  assert.match(types, /export type AdminPortalProfile/)
  assert.match(api, /profilePayload/)
  assert.match(migration, /jsonb_build_object\('id', v_user_id, 'alias', v_alias, 'email', v_email, 'active', v_active, 'avatar', v_avatar\)/)
  assert.doesNotMatch(migration, /admin_has_permission\('users\.read'\)/)
})
