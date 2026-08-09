import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const json = (path) => JSON.parse(read(path))

test('Expo configuration enables real localization, official dark appearance and native push', () => {
  const app = json('app.json').expo
  const pkg = json('package.json')
  const plugins = JSON.stringify(app.plugins)

  assert.equal(app.userInterfaceStyle, 'dark')
  assert.match(plugins, /expo-notifications/)
  assert.match(plugins, /expo-localization/)
  for (const dependency of ['expo-notifications', 'expo-device', 'expo-localization', 'expo-network']) {
    assert.ok(pkg.dependencies[dependency], `${dependency} must be installed`)
  }
})

test('root providers initialize persisted locale, official theme and push response routing', () => {
  const source = read('app/_layout.tsx')
  assert.match(source, /<I18nProvider>/)
  assert.match(source, /<AppThemeProvider>/)
  assert.match(source, /usePushNotificationObserver\(\)/)
  assert.match(source, /StatusBar style=\{theme === 'dark' \? 'light' : 'dark'\}/)
})

test('push registration and server delivery are implemented', () => {
  const client = read('lib/pushNotifications.ts')
  const migration = read('supabase/migrations/20260720102000_push_notifications.sql')
  const sender = read('supabase/functions/_shared/push.ts')
  const worker = read('supabase/functions/process-notification-delivery/index.ts')

  assert.match(client, /getExpoPushTokenAsync\(\{ projectId \}\)/)
  assert.match(client, /register_push_token/)
  assert.match(migration, /create table if not exists public\.push_tokens/)
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(sender, /https:\/\/exp\.host\/--\/api\/v2\/push\/send/)
  assert.match(worker, /DeviceNotRegistered/)
  assert.match(worker, /getExpoPushReceipts/)
})

test('game answers are resumable, idempotent and retried after connectivity returns', () => {
  const hook = read('hooks/useGame.ts')
  const offline = read('lib/gameOffline.ts')
  const migration = read('supabase/migrations/20260720104000_game_resume_idempotency.sql')

  assert.match(hook, /loadGameSnapshot/)
  assert.match(hook, /saveGameSnapshot/)
  assert.match(hook, /submit_answer_resumable/)
  assert.match(hook, /retryPendingAnswer/)
  assert.match(offline, /expo-network/)
  assert.match(migration, /primary key \(student_id, submission_id\)/)
  assert.match(migration, /pg_advisory_xact_lock/)
})

test('high-volume lists use server pagination RPCs', () => {
  const activity = read('app/(student)/activity-log.tsx')
  const studentData = read('lib/studentSecureData.ts')
  const ranking = read('app/(student)/ranking.tsx') + read('hooks/student/useStudentRanking.ts')
  const teacherHistory = read('app/(teacher)/student/[id]/history.tsx') + read('hooks/teacher/useTeacherStudentHistory.ts') + read('components/teacher/student-history/StudentHistoryTimeline.tsx')
  const teacherAudit = read('app/(teacher)/audit.tsx') + read('hooks/teacher/useTeacherAudit.ts') + read('components/teacher/audit/TeacherAuditTimeline.tsx')
  const admin = read('components/admin/audit/AdminAuditSection.tsx') + read('components/admin/shared/AdminPrimitives.tsx')

  assert.match(activity, /fetchStudentAttemptHistoryPage/)
  assert.match(studentData, /get_student_attempt_history_page/)
  assert.match(ranking, /get_ranking_profiles_page/)
  assert.match(teacherHistory, /get_teacher_student_history_timeline_page/)
  assert.match(teacherAudit, /get_teacher_audit_logs_page/)
  assert.match(admin, /get_admin_audit_logs_page/)
  for (const source of [activity, ranking, teacherHistory, teacherAudit, admin]) {
    assert.match(source, /Pagination/)
  }
})

test('shared interactive components expose accessibility semantics and web focus', () => {
  const navigation = read('components/ui/mobile/MobileBottomNavigation.tsx')
  const header = read('components/ui/RolePageHeader.tsx')
  const metrics = read('components/ui/mobile/MobileMetricCard.tsx')
  const pagination = read('components/ui/PaginationControls.tsx')
  const css = read('global.css')

  assert.match(navigation, /accessibilityRole="tab"/)
  assert.match(navigation, /accessibilityState=\{\{ selected: isActive \}\}/)
  assert.match(header, /accessibilityRole="header"/)
  assert.match(metrics, /accessibilityRole="button"/)
  assert.match(pagination, /accessibilityLabel/)
  assert.match(css, /:focus-visible/)
  assert.match(css, /prefers-reduced-motion/)
})

test('Edge Function deployment uses a Node 24 compatible Supabase launcher', () => {
  const script = read('scripts/deploy-edge-functions.mjs')

  assert.match(script, /require\.resolve\('supabase\/dist\/supabase\.js'\)/)
  assert.match(script, /spawnSync\(process\.execPath/)
  assert.match(script, /if \(result\.error\)/)
  assert.doesNotMatch(script, /npx\.cmd/)
})

test('locale is persisted while OmniQuest keeps a single official dark theme', () => {
  const locale = read('lib/i18n.tsx')
  const theme = read('lib/appTheme.tsx')
  const settings = read('components/settings/SettingsSections.tsx')

  assert.match(locale, /expo-localization/)
  assert.match(locale, /LOCALE_STORAGE_KEY/)
  assert.match(theme, /AppThemeMode = 'dark'/)
  assert.match(theme, /OFFICIAL_THEME: AppThemeMode = 'dark'/)
  assert.match(theme, /OFFICIAL_ACCENT_COLOR = '#09acf4'/)
  assert.doesNotMatch(theme, /useColorScheme/)
  assert.doesNotMatch(theme, /AsyncStorage/)
  assert.doesNotMatch(settings, /settings\.appearance\.(?:system|dark|light)/)
})
