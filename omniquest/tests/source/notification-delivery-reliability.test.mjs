import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('badge notifications are realtime, persistent and queued for high-priority push delivery', () => {
  const migration = read('supabase/migrations/20260808183000_notification_delivery_reliability.sql')

  assert.match(migration, /alter publication supabase_realtime add table public\.notifications/)
  assert.match(migration, /create or replace function public\.notify_badge_award_event\(\)/)
  assert.match(migration, /'preference_category', 'activity'/)
  assert.match(migration, /'push_priority', 'high'/)
  assert.match(migration, /'\/\(student\)\/badges'/)
})

test('push token registration follows the current authenticated account on shared devices', () => {
  const migration = read('supabase/migrations/20260808183000_notification_delivery_reliability.sql')
  const client = read('lib/pushNotifications.ts')

  assert.match(migration, /on conflict \(expo_push_token\) do update[\s\S]*user_id = excluded\.user_id/)
  assert.doesNotMatch(migration, /Push token already belongs to another active user/)
  assert.match(client, /register_push_token/)
  assert.match(client, /signOutCurrentDeviceSession/)
  assert.match(client, /deactivateCurrentDevicePushToken/)
})

test('student notification screen refreshes from the server whenever it receives focus', () => {
  const screen = read('app/(student)/notifications.tsx')
  assert.match(screen, /useFocusEffect\(useCallback\(\(\) => \{\s*void Promise\.all\(\[fetchProfile\(\), refresh\(\)\]\)/)
})

test('notification hook exposes stable audience-bound callbacks so focus refresh cannot loop on every render', () => {
  const hook = read('hooks/useNotifications.ts')

  assert.match(hook, /const contextRefresh = context\?\.refresh/)
  assert.match(hook, /const refresh = useCallback\([\s\S]*?contextRefresh\(audience\)[\s\S]*?\[audience, contextRefresh\]\)/)
  assert.match(hook, /const loadMore = useCallback\([\s\S]*?contextLoadMore\(audience\)[\s\S]*?\[audience, contextLoadMore\]\)/)
  assert.doesNotMatch(hook, /refresh:\s*\(\)\s*=>\s*context\.refresh\(audience\)/)
})

test('teacher notification realtime subscription uses an isolated topic and a stable effect', () => {
  const hook = read('hooks/teacher/useTeacherNotifications.ts')

  assert.match(hook, /const backgroundRefreshRef = useRef\(backgroundRefresh\)/)
  assert.match(hook, /const subscriptionId = `\$\{Date\.now\(\)\}:\$\{Math\.random\(\)\.toString\(36\)\.slice\(2\)\}`/)
  assert.match(hook, /teacher-notification-center:\$\{data\.user\.id\}:\$\{subscriptionId\}/)
  assert.match(hook, /payload\.new\.audience === 'teacher'\) void backgroundRefreshRef\.current\(\)/)
  assert.doesNotMatch(hook, /teacher-notification-center:\$\{data\.user\.id\}`/)
})
