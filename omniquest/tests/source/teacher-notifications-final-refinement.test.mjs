import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher notifications expose truthful shell metrics and secondary mobile navigation', () => {
  const screen = read('app/(teacher)/notifications.tsx')
  const hook = read('hooks/teacher/useTeacherNotifications.ts')
  const bottomNav = read('components/teacher/TeacherBottomNav.tsx')
  const migration = read('supabase/migrations/20260811143000_teacher_notifications_experience_refinement.sql')

  assert.match(migration, /'active_subjects', v_active_subjects/)
  assert.match(hook, /activeSubjects: Number\(payload\.active_subjects/)
  assert.match(screen, /subjectsCount=\{notifications\.summary\.activeSubjects\}/)
  assert.match(bottomNav, /active === 'notifications' \|\| active === 'settings' \|\| active === 'audit'\) return null/)
})

test('teacher notification read actions are global and unread filtering stays coherent', () => {
  const hook = read('hooks/teacher/useTeacherNotifications.ts')
  const screen = read('app/(teacher)/notifications.tsx')
  const badge = read('components/NotificationBadge.tsx')

  assert.match(hook, /useNotifications\('teacher'\)/)
  assert.match(hook, /await markAllSharedNotificationsAsRead\(\)/)
  assert.match(hook, /await markSharedNotificationAsRead\(notification\.id\)/)
  assert.match(hook, /await deleteSharedNotification\(notification\.id\)/)
  assert.match(hook, /void refreshSharedNotifications\(\)/)
  assert.doesNotMatch(hook, /markAllPersistentNotificationsRead\('teacher'\)/)
  assert.doesNotMatch(hook, /const ids = page\.rows\.filter/)
  assert.match(hook, /unreadOnly \? current\.rows\.filter/)
  assert.match(hook, /if \(unreadOnly\) void loadPage\('reset'\)/)
  assert.match(badge, /const \{ refresh, unreadCount \} = useNotifications\(inferredAudience\)/)
  assert.match(badge, /void refresh\(\)/)
  assert.match(screen, /Marcar todas como leídas/)
})

test('teacher notification realtime refresh is silent after the initial page load', () => {
  const hook = read('hooks/teacher/useTeacherNotifications.ts')

  assert.match(hook, /initialPageLoadedRef/)
  assert.match(hook, /backgroundRefreshing/)
  assert.match(hook, /backgroundRefreshRef\.current\(\)/)
  assert.doesNotMatch(hook, /payload\.new\.audience === 'teacher'\) void refreshRef\.current\(\)/)
  assert.match(hook, /\.channel\(`teacher-notification-center:\$\{data\.user\.id\}:\$\{subscriptionId\}`\)/)
})

test('teacher notification mobile UI prioritizes content and keeps desktop filters complete', () => {
  const screen = read('app/(teacher)/notifications.tsx')
  const teacherLayout = read('components/layouts/TeacherScreenLayout.tsx')

  assert.doesNotMatch(screen, /label="Actualizar"/)
  assert.match(screen, /compact=\{!responsive\.isDesktop\}/)
  assert.match(screen, /title="Filtros"/)
  assert.match(screen, /Tipo de notificación/)
  assert.match(screen, /Solo sin leer|Mostrar solo sin leer/)
  assert.match(screen, /Silenciar avisos informativos/)
  assert.match(screen, /Durante 8 horas/)
  assert.match(screen, /Las notificaciones seguirán disponibles/)
  assert.match(screen, /Alertas de auditoría/)
  assert.doesNotMatch(screen, /maxContentWidth=\{1220\}/)
  assert.doesNotMatch(screen, /fluidContent=\{false\}/)
  assert.match(teacherLayout, /fluidContent = true/)
  assert.match(screen, /horizontalPadding=\{shellHorizontalPadding\}/)
})

test('question failure teaching signals are classified as course notifications', () => {
  const migration = read('supabase/migrations/20260811143000_teacher_notifications_experience_refinement.sql')
  assert.match(migration, /title = 'Pregunta con muchos fallos'/)
  assert.match(migration, /'category', 'courses'/)
  assert.match(migration, /notify_question_failure_threshold_event/)
})
