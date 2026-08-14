import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('student settings no longer expose or persist a timezone preference', () => {
  const types = read('components/settings/SettingsTypes.ts')
  const sections = read('components/settings/SettingsSections.tsx')
  const hook = read('hooks/useSettingsData.ts')
  const i18n = read('lib/i18n.tsx')

  assert.doesNotMatch(types, /'timezone'/)
  assert.doesNotMatch(types, /timezone:\s*string/)
  assert.doesNotMatch(sections, /settings\.preference\.timezone/)
  assert.doesNotMatch(sections, /hideTimezone/)
  assert.doesNotMatch(hook, /timezone:\s*next\.timezone/)
  assert.doesNotMatch(hook, /select\('language, timezone,/)
  assert.doesNotMatch(hook, /America\/Mexico_City|America\/Bogota/)
  assert.doesNotMatch(i18n, /settings\.preference\.timezone/)
  assert.match(i18n, /Ajusta idioma, fecha, hora e inicio de semana\./)
})

test('database timezone support remains untouched for server-side scheduling', () => {
  const migration = read('supabase/migrations/20260723120000_teacher_digests_sessions_guest_lifecycle.sql')
  assert.match(migration, /coalesce\(up\.timezone,'Europe\/Madrid'\)/)
})
