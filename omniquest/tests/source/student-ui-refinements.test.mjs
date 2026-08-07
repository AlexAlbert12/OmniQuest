import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(testDir, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('student galaxy screens use fixed gutters, canonical course language and compact mobile nodes', () => {
  const classes = read('app/(student)/classes.tsx')
  const detail = read('app/(student)/class/[id].tsx')
  const galaxy = read('components/student/galaxy/StudentGalaxyMap.tsx')
  const studentLayout = read('components/student/StudentLayout.tsx')

  assert.doesNotMatch(classes, /max-w-\[1480px\]/)
  assert.doesNotMatch(detail, /max-w-\[1480px\]/)
  assert.match(classes, /paddingHorizontal: isDesktop \? 28 : 18/)
  assert.match(detail, /paddingHorizontal: isDesktop \? 28 : 18/)
  assert.match(classes, /Elige un curso para continuar tu viaje\./)
  assert.match(classes, /placeholder="Buscar un curso\.\.\."/)
  assert.match(classes, /label="Experiencia"/)
  assert.match(galaxy, /isDesktop \? 1440 : 430/)
  assert.match(galaxy, /courseTitleDesktop/)
  assert.match(galaxy, /minHeight: isDesktop \? 76 : 80/)
  assert.match(galaxy, /side=\{pageItems\.length === 0 \? 'center'/)
  assert.match(studentLayout, /fluidContent/)
  assert.match(studentLayout, /horizontalPadding=\{isDesktop \? 28 : 18\}/)
})

test('ranking league cards stay inside the carousel during web hover', () => {
  const ranking = read('app/(student)/ranking.tsx') + read('components/student/ranking/LeagueCarousel.tsx')
  const css = read('global.css')

  assert.match(ranking, /omni-no-hover-lift/)
  assert.match(ranking, /style=\{\{ overflow: 'hidden' \}\}/)
  assert.match(css, /\.omni-no-hover-lift:hover/)
})

test('profile reuses shared metric cards and activity is grouped without an answer-key block', () => {
  const profile = read('app/(student)/profile.tsx')
  const activity = read('app/(student)/activity-log.tsx')

  assert.match(profile, /StudentMetricCard/)
  assert.doesNotMatch(profile, /function SummaryTile/)
  assert.match(activity, /buildActivityRows/)
  assert.match(activity, /ActivityDateHeader/)
  assert.match(activity, /Feedback de aprendizaje/)
  assert.doesNotMatch(activity, /label="Respuesta correcta"/)
})

test('shared headers protect descenders and settings navigation uses explicit border colors', () => {
  const header = read('components/ui/RolePageHeader.tsx')
  const settings = read('components/settings/SettingsUi.tsx')

  assert.match(header, /lineHeight: isDesktop \? 54 : 42/)
  assert.match(header, /paddingBottom: isDesktop \? 4 : 3/)
  assert.match(settings, /borderWidth: 1,\n\s+borderColor: active \? accentColor : colors\.border/)
})
