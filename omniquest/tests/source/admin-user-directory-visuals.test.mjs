import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (file) => readFileSync(join(root, file), 'utf8')

test('admin Users hub uses the purple Admin identity for card icons and actions', () => {
  const hub = read('components/admin/mobile/AdminMobileHubScreens.tsx')

  assert.match(hub, /<Ionicons name=\{item\.icon\} size=\{25\} color=\{tokens\.brand\.admin\}/)
  assert.match(hub, /<Ionicons name="arrow-forward" size=\{17\} color=\{tokens\.brand\.admin\}/)
  assert.match(hub, /borderColor: withAlpha\(tokens\.brand\.admin, '50'\)/)
})

test('teacher, student and activity views render profile photos with an initials fallback', () => {
  const avatar = read('components/admin/shared/AdminProfileAvatar.tsx')
  const primitives = read('components/admin/shared/AdminPrimitives.tsx')
  const activity = read('components/admin/users/AdminProfileActivityScreen.tsx')
  const types = read('components/admin/types/admin.ts')
  const migration = read('supabase/migrations/20260812170000_admin_profile_avatars.sql')

  assert.match(avatar, /<Image source=\{\{ uri: avatarUri \}\}/)
  assert.match(avatar, /getInitials\(alias\)/)
  assert.match(avatar, /onError=\{\(\) => setFailed\(true\)\}/)
  assert.match(primitives, /<AdminProfileAvatar alias=\{profile\.alias\} avatar=\{profile\.avatar\}/)
  assert.match(activity, /<AdminProfileAvatar alias=\{profile\.alias\} avatar=\{profile\.avatar\} size=\{56\}/)
  assert.match(types, /avatar\?: string \| null/)
  assert.match(migration, /returns table \([\s\S]*avatar text/)
  assert.match(migration, /filtered\.id, filtered\.alias, filtered\.avatar/)
})

test('all shared Admin date ranges open a calendar instead of accepting manual date text', () => {
  const filters = read('components/admin/shared/AdminAdvancedFilters.tsx')
  const push = read('components/admin/push/AdminPushCenterScreen.tsx')
  const calendar = read('components/ui/DateCalendar.tsx')
  const governance = read('components/admin/shared/AdminGovernanceModal.tsx')

  assert.match(filters, /export function AdminDateField/)
  assert.match(filters, /<DateCalendar month=\{month\}/)
  assert.match(filters, /accessibilityHint="Abre un calendario para elegir la fecha"/)
  assert.match(filters, /selectionColor=\{tokens\.brand\.admin\}/)
  assert.doesNotMatch(filters, /placeholder="AAAA-MM-DD"/)
  assert.match(push, /<DateCalendar[\s\S]*selectionColor=\{tokens\.brand\.admin\}/)
  assert.match(governance, /<AdminDateField label="Fecha de reactivación opcional"/)
  assert.doesNotMatch(governance, /placeholder="AAAA-MM-DD"/)
  assert.match(calendar, /selectionColor\?: string/)
})
