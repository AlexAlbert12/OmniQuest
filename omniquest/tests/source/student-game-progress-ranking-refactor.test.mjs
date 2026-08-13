import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

test('game screen is composed from dedicated modules', () => {
  const screen = read('app/(student)/play/[id].tsx')
  assert.ok(screen.split('\n').length < 400)
  for (const name of ['GameErrorBoundary', 'GameHeader', 'GameSyncStatus', 'GameDialogs', 'GameAchievementModal', 'GameQuestionRenderer']) {
    assert.match(screen, new RegExp(name))
  }
  assert.match(read('hooks/useGame.ts'), /measureRpc\(/)
  assert.match(read('hooks/useGame.ts'), /questionConflict/)
})

test('progress screen delegates data and sections', () => {
  const screen = read('app/(student)/progress.tsx')
  assert.ok(screen.split('\n').length < 300)
  for (const name of ['useStudentProgress', 'DailyPracticeRecommendation', 'ProgressOverview', 'PracticeOpportunityList', 'CourseProgressList', 'LatestResults']) {
    assert.match(screen, new RegExp(name))
  }
})

test('ranking screen delegates data and leagues without owning privacy settings', () => {
  const screen = read('app/(student)/ranking.tsx')
  assert.ok(screen.split('\n').length < 320)
  for (const name of ['useStudentRanking', 'LeagueCarousel', 'CurrentPositionCard', 'RankingTabs', 'RankingTable', 'RankingMobileList']) {
    assert.match(screen, new RegExp(name))
  }
  const hook = read('hooks/student/useStudentRanking.ts')
  assert.match(hook, /visibility/)
  assert.doesNotMatch(hook, /setRankingParticipation|privacySaving/)
  assert.doesNotMatch(screen, /RankingPrivacyCard/)
  assert.match(hook, /useState<RankingScope>\('global'\)/)
  assert.doesNotMatch(hook, /RankingScope = .*season/)
  assert.doesNotMatch(screen, /SeasonSummary|Temporada 0|temporadas claras/)
  assert.match(screen, /formatCount\(ranking\.total, 'participante', 'participantes'\)/)
  assert.match(read('components/student/ranking/RankingTabs.tsx'), /Semanal[\s\S]*Global[\s\S]*Clase/)
  assert.doesNotMatch(read('components/student/ranking/RankingTabs.tsx'), /Temporada|calendar/)
  const positionCard = read('components/student/ranking/CurrentPositionCard.tsx')
  assert.match(positionCard, /Eres el único participante por ahora/)
  assert.match(positionCard, /responsive\.isMobile/)
  assert.match(positionCard, />\{league\.name\}<\/Text>/)
  assert.match(positionCard, />\{points\.toLocaleString\('es-ES'\)\} XP<\/Text>/)
  assert.match(positionCard, /className="items-end"[\s\S]*league\.name[\s\S]*points\.toLocaleString/)
  assert.match(read('components/student/ranking/LeagueCarousel.tsx'), /borderColor: active \? league\.color : tokens\.border\.default/)

  const settings = read('components/settings/SettingsSections.tsx')
  const privacyCard = read('components/settings/StudentRankingPrivacyCard.tsx')
  assert.match(settings, /StudentRankingPrivacyCard/)
  assert.match(privacyCard, /Privacidad del ranking/)
  assert.match(privacyCard, /Participar en ranking/)
  assert.match(privacyCard, /Dejar de participar/)
})

test('database migration protects stale game answers and defines ranking seasons', () => {
  const migration = read('supabase/migrations/20260729120000_game_conflicts_ranking_seasons.sql')
  assert.match(migration, /add column if not exists updated_at/)
  assert.match(migration, /QUESTION_VERSION_CONFLICT/)
  assert.match(migration, /create table if not exists public\.ranking_seasons/)
  assert.match(migration, /tie_break/)
  assert.match(migration, /visibility.*private/s)
})
