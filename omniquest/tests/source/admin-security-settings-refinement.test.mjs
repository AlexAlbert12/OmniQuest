import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')

test('admin More links directly to account security and the obsolete settings route only redirects', () => {
  const hubs = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  const settingsRoute = read('app/(admin)/settings.tsx')
  const moreBlock = hubs.match(/export function AdminMoreScreen\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(moreBlock, /const data = useAdminPortalContext\(\)/)
  assert.match(moreBlock, /title: 'Seguridad de la cuenta'/)
  assert.match(moreBlock, /href: '\/\(admin\)\/security'/)
  assert.doesNotMatch(moreBlock, /title: 'Configuración'/)
  assert.doesNotMatch(moreBlock, /\/\(admin\)\/settings/)
  assert.doesNotMatch(hubs, /export function AdminSettingsScreen/)
  assert.match(settingsRoute, /<Redirect href="\/\(admin\)\/security" \/>/)
})

test('admin security uses the lightweight context, explicit More navigation and admin identity accents', () => {
  const security = read('app/(admin)/security.tsx')
  assert.match(security, /useAdminPortalContext\(\)/)
  assert.doesNotMatch(security, /useAdminData\(\)/)
  assert.match(security, /activeSection="security"/)
  assert.match(security, /router\.replace\('\/\(admin\)\/more'/)
  assert.doesNotMatch(security, /router\.back\(\)/)
  assert.match(security, /Volver a Más/)
  assert.match(security, /tokens\.brand\.admin/)
  assert.match(security, /<ManagedSessionsCard role="admin" splitSections \/>/)
  assert.match(security, /showModal\(\{ title: 'Cerrar sesión'/)
})

test('admin security separates sessions from recovery codes and confirms regeneration', () => {
  const sessions = read('components/settings/ManagedSessionsCard.tsx')
  const i18n = read('lib/i18n.tsx')
  assert.match(sessions, /splitSections/)
  assert.match(sessions, /responsive\.isDesktop \? 'row' : 'column'/)
  assert.match(sessions, /sessions\.codes\.available/)
  assert.match(sessions, /sessions\.codes\.regenerateAction/)
  assert.match(sessions, /sessions\.codes\.regenerateConfirmTitle/)
  assert.match(sessions, /sessions\.codes\.regenerateConfirmDetail/)
  assert.match(sessions, /role === 'admin' \? tokens\.brand\.admin/)
  assert.match(i18n, /'sessions\.codes\.regenerateConfirmDetail': 'Se crearán 10 códigos nuevos y todos los códigos anteriores dejarán de ser válidos\.'/)
})

test('security is represented as a More sub-section instead of settings in admin navigation types', () => {
  const types = read('components/admin/types/admin.ts')
  const scaffold = read('components/admin/shared/AdminScaffold.tsx')
  const bottom = read('components/admin/AdminBottomNav.tsx')
  const utils = read('components/admin/utils/adminUtils.ts')
  assert.match(types, /'security'/)
  assert.doesNotMatch(types.match(/export type AdminSection[^\n]+/)?.[0] || '', /'settings'/)
  assert.match(scaffold, /security: \['dashboard\.read'\]/)
  assert.match(scaffold, /\['profile', 'security', 'exports', 'permissions', 'push'\]/)
  assert.match(bottom, /active === 'security'/)
  assert.match(utils, /security: 'shield-checkmark'/)
})
