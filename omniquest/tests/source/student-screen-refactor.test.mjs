import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(testDir, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('student home delegates data loading and renders the learning-first section order', () => {
  const home = read('app/(student)/homeStudent.tsx')
  const hook = read('hooks/student/useStudentHome.ts')

  for (const component of [
    'StudentRecommendedAction',
    'StudentContinueCourse',
    'StudentDailyMission',
    'StudentHomeSummary',
    'StudentHomeAchievements',
    'StudentHomeRankingPreview',
  ]) {
    assert.match(home, new RegExp(component))
  }

  const order = [
    home.indexOf('<StudentRecommendedAction'),
    home.indexOf('<StudentContinueCourse'),
    home.indexOf('<StudentDailyMission'),
    home.indexOf('<StudentHomeSummary'),
    home.indexOf('<StudentHomeAchievements'),
    home.indexOf('<StudentHomeRankingPreview'),
  ]
  assert.ok(order.every((position) => position >= 0))
  assert.deepEqual(order, [...order].sort((left, right) => left - right))
  assert.match(home, /useStudentHome\(\)/)
  assert.doesNotMatch(home, /\.from\(['"]/)
  assert.match(hook, /Promise\.all/)
  assert.match(hook, /buildRecommendedAction/)
})

test('student courses expose searchable grouped list and paginated galaxy experiences', () => {
  const classes = read('app/(student)/classes.tsx')
  const galaxy = read('components/student/galaxy/StudentGalaxyMap.tsx')

  assert.match(classes, /subjects\.length > 5/)
  assert.match(classes, /'in_progress' as const/)
  assert.match(classes, /'practice' as const/)
  assert.match(classes, /'completed' as const/)
  assert.match(galaxy, /Vista galáctica/)
  assert.match(galaxy, /Vista lista/)
  assert.match(galaxy, /GalaxyPagination/)
  assert.match(galaxy, /groupCourseItems/)
  assert.match(galaxy, /visibleListCount/)
  assert.match(galaxy, /responsive\.isTablet/)
})

test('course detail uses focused components, an accessible list and a sticky next mission', () => {
  const detail = read('app/(student)/class/[id].tsx')
  const galaxy = read('components/student/galaxy/StudentGalaxyMap.tsx')

  for (const component of [
    'CourseGalaxyHeader',
    'CourseNextMission',
    'CourseProgressPanel',
    'TopicDifficultyModal',
  ]) {
    assert.match(detail, new RegExp(component))
  }

  assert.match(detail, /position: 'absolute'/)
  assert.match(detail, /recommendedTopicPosition/)
  assert.match(galaxy, /TopicPlanet/)
  assert.match(galaxy, /Cursos disponibles en formato lista|Temas disponibles en formato lista/)
})
