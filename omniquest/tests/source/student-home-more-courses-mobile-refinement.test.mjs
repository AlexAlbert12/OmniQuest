import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('student home keeps primary actions compact, complete-card pressable and in one-row summary', () => {
  const home = read('features/student-home/screen.tsx')
  const recommended = read('components/student/home/StudentRecommendedAction.tsx')
  const course = read('components/student/home/StudentContinueCourse.tsx')
  const mission = read('components/student/home/StudentDailyMission.tsx')
  const summary = read('components/student/home/StudentHomeSummary.tsx')
  const achievements = read('components/student/home/StudentHomeAchievements.tsx')
  const ranking = read('components/student/home/StudentHomeRankingPreview.tsx')

  assert.match(home, /getCompactGreetingName\(alias\)/)
  assert.match(home, /titleNumberOfLines=\{responsive\.isDesktop \? 2 : 1\}/)
  assert.match(home, /<StudentRecommendedAction[\s\S]*compact=\{!responsive\.isDesktop\}/)
  assert.match(recommended, /padding: compact \? 14 : 24/)
  assert.match(course, /<AppPressable/)
  assert.match(mission, /<AppPressable/)
  assert.match(home, /<StudentDailyMission[\s\S]*compact=\{!responsive\.isDesktop\}/)
  assert.match(course, /minHeight: compact \? 112 : 148/)
  assert.match(course, /borderRadius: compact \? 20 : 24/)
  assert.match(mission, /minHeight: compact \? 108 : 148/)
  assert.match(mission, /borderRadius: compact \? 20 : 24/)
  assert.match(course + mission, /transform: \[\{ scale: pressed \? 0\.99 : 1 \}\]/)
  assert.doesNotMatch(course, /AppButton|Repasar curso|Ver todos/)
  assert.doesNotMatch(mission, /AppButton|Empezar reto/)
  assert.doesNotMatch(summary, /Solo lo esencial de tu progreso|flex-wrap/)
  assert.match(summary, /flex-row/)
  assert.match(achievements, /<AppPressable/)
  assert.match(ranking, /<AppPressable/)
  assert.doesNotMatch(achievements, /AppButton/)
  assert.doesNotMatch(ranking, /AppButton/)
})

test('student bottom navigation exposes a More destination with the secondary student areas', () => {
  const bottomNav = read('components/student/StudentBottomNav.tsx')
  const moreRoute = read('app/(student)/more.tsx')
  const more = read('components/student/StudentMoreScreen.tsx')

  assert.match(bottomNav, /key: 'more'.*label: 'Más'.*href: '\/\(student\)\/more'/)
  assert.match(bottomNav, /student-nav-more/)
  assert.match(bottomNav, /active === 'profile'.*active === 'badges'.*active === 'notifications'/)
  assert.match(moreRoute, /<StudentMoreScreen/)
  for (const destination of ['profile', 'activity-log', 'badges', 'notifications', 'settings', 'security', 'help-center']) {
    assert.ok(more.includes('/(student)/' + destination), 'missing student More destination: ' + destination)
  }
})

test('student courses respects the safe area and uses a compact four-column mobile overview', () => {
  const classes = read('app/(student)/classes.tsx')
  const galaxy = read('components/student/galaxy/StudentGalaxyMap.tsx')

  assert.match(classes, /<SafeAreaView edges=\{\['top', 'left', 'right'\]\}/)
  assert.match(classes, /mobileStackedIdentity=\{!isDesktop\}/)
  assert.match(classes, /showNotifications\s+showAvatar/)
  assert.match(classes, /dense=\{!isDesktop\}/)
  assert.doesNotMatch(classes, /minWidth: isDesktop \? undefined : '47%'/)
  assert.match(classes, /density=\{isDesktop \? 'comfortable' : 'compact'\}/)
  assert.match(galaxy, /density\?: 'compact' \| 'comfortable'/)
  assert.match(galaxy, /const planetSize = compact \? 124/)
  assert.match(galaxy, /courseTitleCompact/)
  assert.match(galaxy, /planetBadgeCompact/)
})
