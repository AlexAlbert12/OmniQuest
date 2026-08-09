import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('auth flows share modern cards, inline validation and verification resend', () => {
  const login = read('app/(auth)/login.tsx')
  const register = read('app/(auth)/register.tsx')
  const forgot = read('app/(auth)/forgot-password.tsx')
  const update = read('app/(auth)/update-password.tsx')
  const strength = read('components/auth/PasswordStrength.tsx')

  for (const source of [login, register, forgot, update]) {
    assert.match(source, /AuthCard/)
    assert.match(source, /AuthStatusBanner/)
  }
  assert.match(login, /supabase\.auth\.resend/)
  assert.match(register, /EmailVerificationPanel/)
  assert.match(register, /PasswordStrength/)
  assert.match(register, /getPasswordStrength/)
  assert.match(strength, /auth\.password\.strength\.title/)
})

test('student progress leads with an actionable daily recommendation', () => {
  const progress = read('app/(student)/progress.tsx') + read('hooks/student/useStudentProgress.ts') + read('components/student/progress/DailyPracticeRecommendation.tsx') + read('components/student/progress/PracticeOpportunityList.tsx') + read('components/student/progress/ProgressOverview.tsx')

  assert.match(progress, /Tu recomendación de hoy/)
  assert.match(progress, /Oportunidades de práctica/)
  assert.match(progress, /Oportunidades de mejora/)
  assert.match(progress, /últimos 30 días/)
  assert.match(progress, /item\.id !== progress\.recommendation\?\.id/)
  assert.match(progress, /primaryRecommendationShown/)
  assert.match(progress, /Precisión global/)
  assert.match(progress, /streakDays === 1 \? 'día' : 'días'/)
  assert.match(progress, /Revisar historial/)
  assert.match(progress, /stackActionOnMobile/)
  assert.doesNotMatch(progress, /Este formato de pregunta está reduciendo tu precisión global/)
})

test('ranking highlights the current student and keeps server pagination', () => {
  const ranking = read('app/(student)/ranking.tsx') + read('hooks/student/useStudentRanking.ts') + read('components/student/ranking/RankingTabs.tsx') + read('components/student/ranking/CurrentPositionCard.tsx')

  assert.match(ranking, /Tu posición/)
  assert.match(ranking, /label: 'Global'/)
  assert.match(ranking, /label: 'Semanal'/)
  assert.match(ranking, /label: 'Clase'/)
  assert.match(ranking, /PaginationControls/)
  assert.match(ranking, /get_ranking_profiles_page/)
  assert.doesNotMatch(ranking, /demoRanking|fallbackRanking/i)
})

test('badges expose compact categories and the next unlock', () => {
  const badges = read('app/(student)/badges.tsx')
  const badgeModel = read('lib/studentBadges.ts')

  assert.match(badges, /Siguiente logro/)
  assert.match(badges, /categories\.map/)
  assert.match(badges, /label: category\.name/)
  assert.match(badgeModel, /fetchStudentBadgeCatalog/)
  assert.match(badges, /'48%'/)
  assert.match(badgeModel, /StudentBadgeCategory/)
})

test('student and teacher notifications share swipe actions and empty states', () => {
  const student = read('app/(student)/notifications.tsx')
  const teacher = read('app/(teacher)/notifications.tsx')
  const feed = read('components/notifications/NotificationFeed.tsx')
  const item = read('components/notifications/NotificationListItem.tsx')

  for (const source of [student, teacher]) assert.match(source, /NotificationFeed/)
  assert.match(student, /Marcar todas como leídas/)
  assert.match(teacher, /Marcar leídas|Marcar todas como leídas/)
  assert.match(feed, /NotificationListItem/)
  assert.match(feed, /NotificationEmptyState/)
  assert.match(item, /PanResponder/)
  assert.match(item, /commitAction\('read'\)/)
  assert.match(item, /commitAction\('delete'\)/)
  assert.match(item, /numberOfLines=\{2\}/)
})
