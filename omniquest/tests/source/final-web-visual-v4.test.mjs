import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('student security keeps the mobile section navigation available', () => {
  const settings = read('app/(student)/settings.tsx')
  assert.match(settings, /securityOnly && !isDesktop && !data\.isTeacher \? <StudentBottomNav active=\"security\" \/>/)
})

test('teacher notification center protects long titles and bucket labels at narrow widths', () => {
  const notifications = read('app/(teacher)/notifications.tsx')
  assert.match(notifications, /mobileStackedIdentity=\{responsive\.isMobile\}/)
  assert.match(notifications, /actionsPosition=\{responsive\.isDesktop \? 'below' : 'top'\}/)
  assert.match(notifications, /responsive\.isMobile && tab\.key === 'informative' \? 'Avisos' : tab\.label/)
})

test('teacher profile avoids squeezed three-action and five-metric mobile rows', () => {
  const hero = read('components/teacher/profile/TeacherProfileHero.tsx')
  const metrics = read('components/teacher/profile/TeacherProfileMetrics.tsx')
  assert.match(hero, /flexBasis: '46%'/)
  assert.match(hero, /flexBasis: '100%'/)
  assert.match(metrics, /\[cards\.slice\(0, 2\), cards\.slice\(2, 4\)\]/)
  assert.match(metrics, /style=\{\{ minWidth: 0, flex: 1 \}\}/)
  assert.match(metrics, /icon=\{cards\[4\]\.icon\}/)
  assert.match(metrics, /style=\{\{ width: '100%' \}\}/)
})

test('root preparation state is exposed to accessibility and visual E2E waits', () => {
  const layout = read('app/_layout.tsx')
  const visual = read('e2e/web/authenticated-visual.spec.ts')
  assert.match(layout, /accessibilityRole=\"progressbar\"/)
  assert.match(layout, /accessibilityLabel=\{t\('root\.preparing'\)\}/)
  assert.match(visual, /\[role=\"progressbar\"]:visible/)
})
