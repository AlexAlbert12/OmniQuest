import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('usage analytics records game lifecycle, errors and badge unlocks', () => {
  const migration = read('supabase/migrations/20260720110000_product_operations.sql')
  const hook = read('hooks/useGame.ts')
  const play = read('app/(student)/play/[id].tsx')
  const analytics = read('lib/analytics.ts')

  assert.match(migration, /create table if not exists public\.analytics_events/)
  assert.match(migration, /v_event_name := 'game_started'/)
  assert.match(migration, /v_event_name := 'game_abandoned'/)
  assert.match(migration, /'badge_unlocked'/)
  assert.match(migration, /get_admin_usage_analytics/)
  assert.match(hook, /trackUsageEvent\('game_error'/)
  assert.match(hook, /trackUsageEvent\('game_resumed'/)
  assert.match(hook, /const abandonGame = useCallback/)
  assert.match(play, /La partida se marcará como abandonada/)
  assert.match(analytics, /track_usage_event/)
})

test('admin exports fetch every server page while preserving current filters', () => {
  const exports = read('lib/adminExports.ts')
  const csv = read('lib/reportExports.ts')
  const admin = read('components/admin/portal/AdminTeachersSection.tsx') + read('components/admin/portal/AdminStudentsSection.tsx') + read('components/admin/portal/AdminCoursesSection.tsx') + read('components/admin/portal/AdminClassroomsSection.tsx') + read('components/admin/portal/AdminSearchBar.tsx')

  assert.match(exports, /fetchAllRpcRows/)
  assert.match(exports, /get_admin_profiles_page/)
  assert.match(exports, /get_admin_subjects_page/)
  assert.match(exports, /get_admin_classrooms_page/)
  assert.match(exports, /get_admin_audit_logs_page/)
  assert.match(exports, /get_admin_support_tickets_page/)
  assert.match(admin, /AdminSearchBar/)
  assert.match(admin, /onExport/)
  assert.match(csv, /Prevent spreadsheet formula injection/)
})

test('admin support has a paginated queue, protected update RPC and user-visible replies', () => {
  const migration = read('supabase/migrations/20260720110000_product_operations.sql')
  const admin = read('components/admin/portal/AdminSupportSection.tsx')
  const studentHelp = read('app/(student)/help-center.tsx')
  const teacherHelp = read('app/(teacher)/help-center.tsx')

  assert.match(migration, /get_admin_support_tickets_page/)
  assert.match(migration, /admin_update_support_ticket/)
  assert.match(migration, /drop policy if exists "user_support_tickets_self"/)
  assert.match(migration, /create policy "user_support_tickets_insert_self"/)
  assert.match(admin, /AdminSupportScreen/)
  assert.match(admin, /Guardar y notificar/)
  assert.match(studentHelp, /Respuesta de soporte/)
  assert.match(teacherHelp, /Respuesta de soporte/)
})

test('global search is role-aware and injected into admin and teacher headers', () => {
  const migration = read('supabase/migrations/20260720110000_product_operations.sql')
  const search = read('components/search/GlobalSearchButton.tsx')
  const teacherHeader = read('components/teacher/TeacherPageHeader.tsx')
  const admin = read('components/admin/portal/AdminPortalCore.tsx')

  assert.match(migration, /search_app_entities/)
  assert.match(migration, /if v_role = 'admin'/)
  assert.match(migration, /if v_role = 'teacher'/)
  assert.match(search, /search_app_entities/)
  assert.match(search, /Búsqueda global/)
  assert.match(teacherHeader, /GlobalSearchButton role="teacher"/)
  assert.match(admin, /GlobalSearchButton role="admin"/)
})
