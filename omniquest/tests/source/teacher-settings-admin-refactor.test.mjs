import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher settings use one teacher-specific notification source of truth', () => {
  const route = read('app/(teacher)/settings.tsx') + read('app/(student)/settings.tsx') + read('components/settings/TeacherSettingsSections.tsx')
  const sections = read('components/settings/TeacherSettingsSections.tsx')
  const delivery = read('components/settings/TeacherDeliveryPreferencesPanel.tsx')
  const teacherHook = read('hooks/teacher/useTeacherCommunicationSettings.ts')
  const settingsHook = read('hooks/useSettingsData.ts')
  const migration = read('supabase/migrations/20260811170000_teacher_settings_privacy_refinement.sql')

  assert.match(route, /Ajustes personales/)
  assert.match(route, /Preferencias docentes/)
  assert.match(sections, /TeacherDeliveryPreferencesPanel/)
  assert.doesNotMatch(sections, /SettingsNotificationsPanel/)
  assert.match(delivery, /Correo para recordatorios/)
  assert.match(delivery, /Alumnos sin actividad/)
  assert.match(delivery, /Revisiones manuales pendientes/)
  assert.match(delivery, /Alertas de auditoría/)
  assert.match(delivery, /Frecuencia del resumen docente/)
  assert.match(teacherHook, /set_teacher_notification_preferences/)
  assert.match(teacherHook, /set_teacher_digest_preference/)
  assert.match(teacherHook, /set_teacher_course_notification_preference/)
  assert.match(settingsHook, /detectedRole === 'student'[\s\S]*user_notification_preferences/)
  assert.match(migration, /teacher_inactive_student_alerts/)
  assert.match(migration, /return null;/)
  assert.match(migration, /email_enabled = \(v_frequency <> 'off'\)/)
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
    'dashboard/AdminDashboard.tsx',
    'users/AdminUsersSection.tsx',
    'users/AdminTeachersSection.tsx',
    'users/AdminStudentsSection.tsx',
    'courses/AdminCoursesSection.tsx',
    'classrooms/AdminClassroomsSection.tsx',
    'audit/AdminAuditSection.tsx',
    'dashboard/AdminMetrics.tsx',
    'dashboard/AdminAlerts.tsx',
    'shared/AdminSearchBar.tsx',
    'shared/AdminPrimitives.tsx',
  ]

  for (const file of expected) {
    assert.equal(existsSync(join(root, 'components/admin', file)), true, `${file} should exist`)
  }

  const entrypoint = read('components/admin/AdminPortal.tsx')
  assert.ok(entrypoint.split('\n').length < 80, 'AdminPortal.tsx should remain a small route coordinator')
})

test('admin mobile navigation has five stable groups without duplicated entity tabs', () => {
  const bottom = read('components/admin/AdminBottomNav.tsx')
  const core = read('components/admin/shared/AdminScaffold.tsx')

  assert.match(bottom, /'home' \| 'users' \| 'content' \| 'audit' \| 'more'/)
  assert.match(bottom, /label: 'Usuarios'/)
  assert.match(bottom, /label: 'Más'/)
  assert.doesNotMatch(bottom, /scrollable/)
  assert.doesNotMatch(core, /AdminMobileSectionTabs/)
  assert.doesNotMatch(core, /GlobalSearchButton role="admin" compact/)
  assert.match(bottom, /\/\(admin\)\/users/)
  assert.match(bottom, /\/\(admin\)\/content/)
})
