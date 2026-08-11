import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('student profile hero uses a dark high-contrast card with restrained cyan accents', () => {
  const hero = read('components/student/profile/StudentProfileHero.tsx')
  assert.match(hero, /gradientColors = \[tokens\.surface\.raised, tokens\.surface\.default, tokens\.background\.secondary\]/)
  assert.match(hero, /heroText = tokens\.text\.primary/)
  assert.match(hero, /borderColor: tokens\.border\.default/)
  assert.match(hero, /backgroundColor: withAlpha\(tokens\.brand\.student, '14'\)/)
  assert.match(hero, /XP global/)
  assert.doesNotMatch(hero, /tokens\.text\.inverse/)
  assert.doesNotMatch(hero, /\[tokens\.brand\.student, tokens\.brand\.student/)
  assert.match(hero, /showLevel=\{false\}/)
  assert.match(hero, /minHeight: isMobile \? 218 : 210/)
  assert.doesNotMatch(hero, /min-h-\[230px\]/)
})

test('student profile and achievements share the canonical badge catalog source of truth', () => {
  const hook = read('hooks/student/useStudentProfile.ts')
  assert.match(hook, /fetchStudentBadgeCatalog\(\{ page: 0, pageSize: 50, status: 'all' \}\)/)
  assert.match(hook, /badgeCatalog\?\.summary\.streakDays/)
  assert.match(hook, /badgeCatalog\?\.summary\.unlocked/)
  assert.match(hook, /badgeCatalog\?\.summary\.total/)
  assert.match(hook, /badgeAwardTimestamp\(right\) - badgeAwardTimestamp\(left\)/)
  assert.doesNotMatch(hook, /buildStudentBadges/)
  assert.doesNotMatch(hook, /getStudentBadgeMetrics/)
})

test('student profile separates personal data from quick navigation and labels profile visibility explicitly', () => {
  const screen = read('app/(student)/profile.tsx')
  const privacy = read('components/student/profile/StudentProfilePrivacy.tsx')
  assert.match(screen, /Accesos rápidos/)
  assert.match(screen, /borderTopColor: tokens\.border\.subtle/)
  assert.match(screen, /withAlpha\(tokens\.surface\.raised, '88'\)/)
  assert.match(privacy, /'Perfil visible'/)
  assert.match(privacy, /'Perfil privado'/)
})

test('compact profile streak follows the shared count-formatting convention', () => {
  const metrics = read('components/student/profile/StudentProfileMetrics.tsx')
  assert.match(metrics, /formatCount\(streakDays, 'd', 'd'\)/)
})
