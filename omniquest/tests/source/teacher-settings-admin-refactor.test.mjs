import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher settings separate personal and teaching preferences', () => {
  const route = read('app/(teacher)/settings.tsx') + read('app/(student)/settings.tsx') + read('components/settings/TeacherSettingsSections.tsx')
  const sections = read('components/settings/TeacherSettingsSections.tsx')
  const hook = read('hooks/useSettingsData.ts')
  const migration = read('supabase/migrations/20260722200000_teacher_preferences.sql')

  assert.match(route, /Ajustes personales/)
  assert.match(route, /Preferencias docentes/)
  assert.match(sections, /Correo para recordatorios/)
  assert.match(sections, /Alumnos sin actividad/)
  assert.match(sections, /Revisiones manuales pendientes/)
  assert.match(sections, /Acciones sensibles/)
  assert.match(sections, /Frecuencia del resumen docente/)
  assert.match(hook, /updateTeacherNotificationPreference/)
  assert.match(migration, /teacher_reminder_email/)
  assert.match(migration, /teacher_digest_frequency/)
})

test('teacher help shows ticket status, response and contact tracking', () => {
  const help = read('app/(teacher)/help-center.tsx') + read('components/support/RoleHelpCenter.tsx')
  assert.match(help, /fetchOwnSupportTickets/)
  assert.match(help, /fetchSupportThread/)
  assert.match(help, /TicketSla/)
  assert.match(help, /MessageBubble/)
  assert.match(help, /addSupportReply/)
})

test('admin portal is split into focused sections and shared primitives', () => {
  const expected = [
    'AdminDashboard.tsx',
    'AdminUsersSection.tsx',
    'AdminTeachersSection.tsx',
    'AdminStudentsSection.tsx',
    'AdminCoursesSection.tsx',
    'AdminClassroomsSection.tsx',
    'AdminAuditSection.tsx',
    'AdminMetrics.tsx',
    'AdminAlerts.tsx',
    'AdminSearchBar.tsx',
    'AdminPagination.tsx',
    'AdminActionMenu.tsx',
  ]

  for (const file of expected) {
    assert.equal(existsSync(join(root, 'components/admin/portal', file)), true, `${file} should exist`)
  }

  const barrel = read('components/admin/AdminPortal.tsx')
  assert.ok(barrel.split('\n').length < 20, 'AdminPortal.tsx should be a small barrel')
})

test('admin mobile navigation has five stable groups and internal entity tabs', () => {
  const bottom = read('components/admin/AdminBottomNav.tsx')
  const core = read('components/admin/shared/AdminScaffold.tsx')

  assert.match(bottom, /'home' \| 'users' \| 'content' \| 'audit' \| 'more'/)
  assert.match(bottom, /label: 'Usuarios'/)
  assert.match(bottom, /label: 'Más'/)
  assert.doesNotMatch(bottom, /scrollable/)
  assert.match(core, /\['teachers', 'students', 'courses', 'classrooms', 'audit'\]/)
})
