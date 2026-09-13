import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('root route segments are widened before optional nested indexes are read', () => {
  const source = read('app/_layout.tsx')
  assert.match(source, /useSegments\(\) as readonly string\[\]/)
  assert.match(source, /const childSegment: string \| undefined = segments\[1\]/)
  assert.ok(!source.includes('const segments = useSegments()\n  const rootSegment = segments[0]\n  const childSegment = segments[1]'))
})

test('web fixed bottom navigation isolates the react-native-web compatibility cast', () => {
  const source = read('components/ui/mobile/MobileBottomNavigation.tsx')
  assert.match(source, /const WEB_FIXED_STYLE = \{ position: 'fixed' \} as unknown as ViewStyle/)
  assert.match(source, /Platform\.OS === 'web' \? WEB_FIXED_STYLE : null/)
  assert.doesNotMatch(source, /\{ position: 'fixed' \} as ViewStyle/)
})

test('reported topic, admin, settings and text export type regressions stay fixed', () => {
  const topic = read('app/(teacher)/topic/[id].tsx')
  const adminActions = read('components/admin/hooks/useAdminActions.ts')
  const studentSettings = read('components/settings/StudentSettingsSections.tsx')
  const teacherSettings = read('components/settings/TeacherSettingsSections.tsx')
  const exports = read('lib/reportExports.ts')

  assert.match(topic, /if \(!topicAction \|\| !subject \|\| !topic\) return/)
  assert.match(adminActions, /import type \{ AdminActionResult,/)
  assert.match(studentSettings, /<SettingsSecurityPanel[\s\S]*accentColor=\{accentColor\}/)
  assert.match(teacherSettings, /<SettingsSecurityPanel[\s\S]*accentColor=\{accentColor\}/)
  assert.match(exports, /function downloadTextFile[\s\S]*new Blob\(\[content\]/)
})
