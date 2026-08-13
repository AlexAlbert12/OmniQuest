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
  const profile = read('app/(student)/profile.tsx') + read('components/student/profile/StudentProfileMetrics.tsx')
  const activity = read('app/(student)/activity-log.tsx') + read('hooks/student/useStudentActivity.ts')

  assert.match(profile, /StudentMetricCard/)
  assert.doesNotMatch(profile, /function SummaryTile/)
  assert.match(activity, /buildActivityRows/)
  assert.match(activity, /ActivityDateHeader/)
  assert.doesNotMatch(activity, /label="Respuesta correcta"/)
})

test('shared headers protect descenders and settings navigation uses explicit border colors', () => {
  const header = read('components/ui/RolePageHeader.tsx')
  const settings = read('components/settings/SettingsUi.tsx')

  assert.match(header, /lineHeight: isDesktop \? 54 : compactMobileTitle \? 38 : 42/)
  assert.match(header, /paddingBottom: isDesktop \? 4 : 3/)
  assert.match(settings, /borderWidth: 1,\n\s+borderColor: active \? accentColor : colors\.border/)
})

test('course detail mobile refinement avoids duplicate mission labels and only shows sticky CTA after the inline mission leaves view', () => {
  const detail = read('app/(student)/class/[id].tsx')
  const mission = read('components/student/course/CourseNextMission.tsx')
  const progress = read('components/student/course/CourseProgressPanel.tsx')
  const galaxy = read('components/student/galaxy/StudentGalaxyMap.tsx')

  assert.match(detail, /showMobileStickyMission/)
  assert.match(detail, /handleInlineMissionLayout/)
  assert.match(detail, /handleCourseScroll/)
  assert.match(detail, /MOBILE_BOTTOM_NAV_HEIGHT \+ insets\.bottom/)
  assert.match(detail, /recommendedTopic && \(isDesktop \|\| showMobileStickyMission\)/)
  assert.match(detail, /if \(classRanking\.length === 1\) return '1\.º de 1'/)
  assert.match(detail, /<GalaxyScreenBackground subtle/)

  assert.match(mission, /buildMissionTitle/)
  assert.match(mission, /normalizedTitle === normalizedOrdinal/)
  assert.match(mission, /label="Continuar"/)
  assert.doesNotMatch(mission, /`Tema \$\{position \?\? ''\}\$\{position \? ' · ' : ''\}\$\{topic\.title\}`/)

  assert.match(progress, /isDesktop \? 'mt-6 rounded-\[28px\]/)
  assert.match(progress, /: 'mt-5'/)
  assert.match(progress, /minHeight: 44/)
  assert.match(progress, /marginTop=\{isDesktop \? 28 : 24\}/)

  assert.match(galaxy, /const rowHeight = isDesktop \? 286 : responsive\.isTablet \? 274 : 260/)
  assert.match(galaxy, /const minimumMapHeight = isDesktop \? 360 : responsive\.isTablet \? 340 : 312/)
  assert.match(galaxy, /decorationOpacity = subtle \? 0\.7 : 1/)
})
