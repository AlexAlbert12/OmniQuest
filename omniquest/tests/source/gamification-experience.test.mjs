import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const migrationPath = 'supabase/migrations/20260721130000_gamification_experience.sql'

test('haptics are centralized and configurable from settings', () => {
  const layout = read('app/_layout.tsx')
  const haptics = read('lib/haptics.tsx')
  const game = read('hooks/useGame.ts')
  const settings = read('components/settings/SettingsSections.tsx')
  const migration = read(migrationPath)

  assert.match(layout, /AppHapticsProvider/)
  assert.match(haptics, /HAPTICS_STORAGE_KEY/)
  assert.match(haptics, /Platform\.OS === 'web'/)
  assert.doesNotMatch(game, /from 'expo-haptics'/)
  assert.match(game, /useAppHaptics/)
  assert.match(settings, /settings\.haptics\.title/)
  assert.match(read('lib/i18n.tsx'), /'settings\.haptics\.title': 'Respuesta táctil'/)
  assert.match(migration, /haptics_enabled boolean not null default true/)
})

test('game feedback includes reusable XP and achievement microinteractions', () => {
  const questionUi = read('components/student/game/GameQuestionUi.tsx')
  const result = read('components/student/game/GameResultState.tsx')
  const game = read('hooks/useGame.ts')
  const badges = read('app/(student)/badges.tsx')

  assert.match(questionUi, /AnswerFeedbackMotion/)
  assert.match(questionUi, /XpGainBurst/)
  assert.match(questionUi, /CelebrationParticles/)
  assert.match(result, /AnimatedXpCounter/)
  assert.match(result, /BadgeUnlockModal/)
  assert.match(game, /newlyUnlockedBadges/)
  assert.match(game, /badge_sync/)
  assert.match(badges, /components\/gamification\/BadgeUnlockModal/)
})

test('avatar cosmetics are validated on the server and reused across profile and ranking', () => {
  const migration = read(migrationPath)
  const profile = read('app/(student)/profile.tsx') + read('components/student/profile/StudentAvatarCustomizationModal.tsx')
  const ranking = read('app/(student)/ranking.tsx') + read('hooks/student/useStudentRanking.ts') + read('components/student/ranking/CurrentPositionCard.tsx') + read('components/student/ranking/RankingTable.tsx')
  const offlineMutations = read('lib/offlineMutations.ts')
  const header = read('components/ui/RoleHeaderAvatar.tsx')
  const sidebar = read('components/student/StudentSidebar.tsx')

  assert.match(migration, /create table if not exists public\.avatar_frames/)
  assert.match(migration, /create table if not exists public\.profile_cosmetics/)
  assert.match(migration, /create or replace function public\.equip_profile_cosmetics/)
  assert.match(migration, /Required badge is not unlocked/)
  assert.match(profile, /AvatarCustomizationModal/)
  assert.match(profile, /kind: 'profile\.cosmetics'/)
  assert.match(offlineMutations, /equipProfileCosmetics/)
  assert.match(ranking, /fetchProfileCosmeticsForUsers/)
  assert.match(ranking, /GamifiedAvatar/)
  assert.match(header, /GamifiedAvatar/)
  assert.match(sidebar, /GamifiedAvatar/)
})

test('microinteractions respect the system reduced-motion preference', () => {
  const reducedMotion = read('hooks/useReducedMotion.ts')
  const xp = read('components/gamification/XpGainBurst.tsx')
  const feedback = read('components/gamification/AnswerFeedbackMotion.tsx')
  const particles = read('components/gamification/CelebrationParticles.tsx')

  assert.match(reducedMotion, /isReduceMotionEnabled/)
  assert.match(xp, /useReducedMotion/)
  assert.match(feedback, /useReducedMotion/)
  assert.match(particles, /useReducedMotion/)
})
