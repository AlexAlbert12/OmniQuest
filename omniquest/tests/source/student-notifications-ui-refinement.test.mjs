import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('student notification screen keeps counters, filters and empty states coherent', () => {
  const screen = read('app/(student)/notifications.tsx')
  const hook = read('hooks/useNotifications.ts')

  assert.match(screen, /badge: count > 0 \? count : undefined/)
  assert.match(screen, /if \(unreadCount === 0\) return \{ title: 'Todo está leído'/)
  assert.match(screen, /Quedan novedades sin leer/)
  assert.match(screen, /No hay notificaciones de/)
  assert.doesNotMatch(screen, /\{filteredNotifications\.length\}\/\{total\}/)
  assert.doesNotMatch(screen, /Marcar cargadas como leídas/)
  assert.match(hook, /normalizeNotificationSnapshot/)
  assert.match(hook, /const hasNoRenderableRows = snapshot\.notifications\.length === 0 && !snapshot\.hasMore/)
  assert.match(hook, /const persistentNotifications = persistentPage\.notifications/)
})

test('mark all read affects every persistent notification for the current audience', () => {
  const hook = read('hooks/useNotifications.ts')
  const persistent = read('lib/notifications/persistent.ts')
  const migration = read('supabase/migrations/20260808213000_notification_mark_all_read.sql')

  assert.match(persistent, /mark_all_notifications_read/)
  assert.match(hook, /markAllPersistentNotificationsRead\(audience\)/)
  assert.match(hook, /unreadCount: 0/)
  assert.match(migration, /where n\.user_id = v_user_id[\s\S]*n\.audience = v_audience[\s\S]*n\.read_at is null/)
  assert.match(migration, /Notification audience does not match current role/)
})

test('student notification mobile navigation and rails follow secondary-screen design rules', () => {
  const screen = read('app/(student)/notifications.tsx')
  const studentNav = read('components/student/StudentBottomNav.tsx')
  const mobileNav = read('components/ui/mobile/MobileBottomNavigation.tsx')
  const tabs = read('components/ui/AppTabs.tsx')
  const empty = read('components/notifications/NotificationEmptyState.tsx')
  const item = read('components/notifications/NotificationListItem.tsx')

  assert.match(screen, /<StudentBottomNav active="notifications"/)
  assert.doesNotMatch(screen, /accessibilityLabel="Actualizar notificaciones"/)
  assert.match(studentNav, /badges' \|\| active === 'notifications' \|\| active === 'settings'.*return 'more'/)
  assert.match(mobileNav, /activeKey: Key \| null/)
  assert.match(screen, /mobileRail=\{!isDesktop\}/)
  assert.match(tabs, /mobileRailTab:[\s\S]*minHeight: 42/)
  assert.doesNotMatch(empty, /border-dashed/)
  assert.match(item, /const SWIPE_LIMIT = 80/)
  assert.match(item, /className="min-w-0 flex-1"[\s\S]*<\/Pressable>\s*<View className="flex-row gap-2"/)
  assert.match(item, /w-20 items-center justify-center/)
})
