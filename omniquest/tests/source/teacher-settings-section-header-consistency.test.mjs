import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher settings sections share the same introductory header pattern', () => {
  const sections = read('components/settings/TeacherSettingsSections.tsx')

  assert.match(sections, /SettingsSectionIntro icon="person-circle-outline" title="Ajustes personales"/)
  assert.match(sections, /SettingsSectionIntro icon="school-outline" title="Preferencias docentes"/)
  assert.match(sections, /SettingsSectionIntro icon="shield-checkmark-outline" title=\{t\('settings\.section\.privacy'\)\}/)
  assert.match(sections, /SettingsSectionIntro icon="server-outline" title=\{t\('settings\.section\.data'\)\}/)
  assert.match(sections, /SettingsSectionIntro icon="information-circle-outline" title=\{t\('settings\.section\.about'\)\}/)
  assert.doesNotMatch(sections, /TeacherPrivacyNotice/)
  assert.doesNotMatch(sections, /TeacherDataNotice/)
})
