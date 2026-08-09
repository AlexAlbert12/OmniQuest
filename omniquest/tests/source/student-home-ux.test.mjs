import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('student home uses cyan role styling and honest empty, ranking and mobile navigation states', () => {
  const tokens = read('lib/designTokens.ts')
  const home = read('features/student-home/screen.tsx')
  const summary = read('components/student/home/StudentHomeSummary.tsx')
  const ranking = read('components/student/home/StudentHomeRankingPreview.tsx')
  const recommended = read('components/student/home/StudentRecommendedAction.tsx')
  const bottomNav = read('components/ui/mobile/MobileBottomNavigation.tsx')
  const layout = read('components/layouts/RoleScreenLayout.tsx')

  assert.match(tokens, /student: '#09acf4'/)
  assert.match(tokens, /teacher: '#09acf4'/)
  assert.doesNotMatch(home, /Actualizar pantalla de inicio|icon="refresh"/)
  assert.match(home, /compact=\{!responsive\.isDesktop\}/)
  assert.match(home, /rows=\{home\.rankingPreview\}/)

  assert.match(summary, /attemptCount > 0 \? `\$\{accuracyPercent\}%` : '\\u2014'/)
  assert.match(summary, /border-border-subtle bg-surface-raised/)
  assert.match(summary, /paddingVertical: isDesktop \? 13 : 16/)

  assert.match(ranking, /summary\.estimated \? 'Tu posición estimada' : 'Tu posición'/)
  assert.match(ranking, /row\.estimated \? `≈\$\{row\.position\}` : row\.position/)
  assert.match(recommended, /width: compact \? 56 : 64/)
  assert.match(recommended, /fontSize: compact \? 24 : 26/)

  assert.match(bottomNav, /inactiveColor = tokens\.text\.secondary/)
  assert.match(bottomNav, /styles\.activeIndicator/)
  assert.match(bottomNav, /height: 70/)
  assert.match(bottomNav, /fontSize: 11\.5/)
  assert.match(layout, /MOBILE_BOTTOM_NAV_SPACER/)
})
