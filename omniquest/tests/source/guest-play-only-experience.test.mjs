import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('anonymous users enter a dedicated play-only guest surface', () => {
  const rootLayout = read('app/_layout.tsx')
  const home = read('features/student-home/screen.tsx')
  const guestHome = read('features/student-home/GuestHomeScreen.tsx')
  const sidebar = read('components/student/StudentSidebar.tsx')
  const bottomNav = read('components/student/StudentBottomNav.tsx')
  const settings = read('app/(student)/settings.tsx')

  assert.match(rootLayout, /GUEST_STUDENT_ROUTES = new Set\(\['homeStudent', 'class', 'play', 'settings'\]\)/)
  assert.match(rootLayout, /profile\.role_id === 'guest'[\s\S]*!isGuestStudentRouteAllowed\(childSegment\)/)
  assert.match(home, /if \(guest\.isGuest\) return <GuestHomeScreen alias=\{guest\.alias\} \/>/)
  assert.match(guestHome, /testID="guest-game-code"/)
  assert.match(guestHome, /title=\{t\('guest\.home\.title'\)\}/)
  assert.doesNotMatch(guestHome, /useStudentHome/)
  assert.match(sidebar, /guestNavItems[\s\S]*nav\.guest\.play[\s\S]*nav\.guest\.settings/)
  assert.match(bottomNav, /guestMode[\s\S]*nav\.guest\.play[\s\S]*nav\.guest\.settings/)
  assert.match(settings, /guestSettingsSectionDefinitions[\s\S]*key: 'preferences'/)
  assert.match(settings, /<StudentSidebar[\s\S]*guestMode=\{data\.isGuest\}/)
  assert.match(settings, /showAvatar=\{!data\.isGuest\}/)
  assert.match(settings, /showNotifications=\{!data\.isGuest\}/)
  assert.match(settings, /!data\.isGuest && settingsMenuVariant/)
})

test('guest identity is stable and guest providers do not load personal data', () => {
  const guestSession = read('hooks/useGuestSession.ts')
  const notifications = read('hooks/useNotifications.ts')
  const offline = read('hooks/useOfflineSync.tsx')
  const analytics = read('lib/analytics.ts')
  const settingsData = read('hooks/useSettingsData.ts')
  const classes = read('app/(student)/classes.tsx')

  assert.match(guestSession, /user_metadata\?\.alias/)
  assert.match(guestSession, /return alias \? alias\.slice\(0, 30\) : 'Invitado'/)
  assert.match(notifications, /nextSession\?\.user\.is_anonymous/)
  assert.match(offline, /guestUserId[\s\S]*clearOfflineCacheForUser\(guestUserId\)/)
  assert.match(analytics, /session\?\.user\.is_anonymous\) return null/)
  assert.match(settingsData, /if \(session\.user\.is_anonymous\)[\s\S]*setIsGuest\(true\)[\s\S]*return/)
  assert.doesNotMatch(classes, /'Alex'/)
})

test('guest gameplay and sign-out leave no persisted progress', () => {
  const migration = read('supabase/migrations/20260908120000_guest_play_only_sessions.sql')
  const game = read('hooks/useGame.ts')
  const play = read('app/(student)/play/[id].tsx')
  const result = read('components/student/game/GameStateView.tsx')
  const signOut = read('lib/pushNotifications.ts')

  assert.match(migration, /now\(\) \+ interval '24 hours'/)
  assert.match(migration, /create function public\.submit_answer_resumable/)
  assert.match(migration, /delete from public\.attempt_history/)
  assert.match(migration, /delete from public\.subject_scores/)
  assert.match(migration, /delete from public\.topic_scores/)
  assert.match(migration, /delete from public\.enrollments where student_id = v_user_id/)
  assert.match(migration, /create or replace function public\.discard_current_guest_session/)
  assert.match(migration, /delete from public\.profiles/)
  assert.match(migration, /create or replace function public\.cleanup_expired_guests[\s\S]*delete from public\.profiles profile/)
  assert.match(game, /guestSession[\s\S]*clearGameSnapshot\(gameSnapshotKey\)/)
  assert.match(play, /!game\.isGuest \? <GameAchievementModal/)
  assert.match(result, /!isGuest && summary\.reviewQuestions\.length > 0/)
  assert.match(result, /isGuest \? t\('guest\.game\.again'\) : 'Volver al curso'/)
  assert.match(play, /game\.isGuest[\s\S]*router\.replace\('\/\(student\)\/homeStudent'/)
  assert.match(signOut, /clearGameSnapshotsForUser\(userId\)/)
  assert.match(signOut, /rpc\('discard_current_guest_session'\)/)
})
