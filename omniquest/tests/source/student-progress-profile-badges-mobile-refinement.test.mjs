import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('progress and profile keep four compact metrics in one responsive row', () => {
  const progress = read('components/student/progress/ProgressOverview.tsx')
  const profile = read('components/student/profile/StudentProfileMetrics.tsx')

  assert.match(progress, /useResponsiveLayout/)
  assert.match(progress, /className="min-w-0 flex-1"/)
  assert.match(progress, /dense=\{dense\}/)
  assert.doesNotMatch(progress, /flex-wrap|detail:|Contenido respondido|Oportunidades de mejora/)
  assert.match(profile, /<View className=\{\`flex-row/)
  assert.doesNotMatch(profile, /flex-wrap|min-w-\[160px\]/)
})

test('achievement collection protects the safe area and defers secondary facts to detail', () => {
  const screen = read('app/(student)/badges.tsx')
  const collectionCard = screen.split('const BadgeCard')[1].split('function BadgeDetailModal')[0]
  const detailModal = screen.split('function BadgeDetailModal')[1]

  assert.match(screen, /<SafeAreaView edges=\{\['top', 'left', 'right'\]\}/)
  assert.doesNotMatch(screen, /function MetricTile|<MetricTile/)
  assert.match(collectionCard, /badge\.statusLabel/)
  assert.match(collectionCard, /badge\.title/)
  assert.match(collectionCard, /badge\.progressLabel/)
  assert.doesNotMatch(collectionCard, /badge\.requirement|badge\.xp|badge\.awardedAt/)
  assert.match(detailModal, /badge\.requirement/)
  assert.match(detailModal, /badge\.xp/)
  assert.match(detailModal, /badge\.awardedAt/)
})
