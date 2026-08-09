import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher profile is composed from a period-aware aggregate hook and lazy resources', () => {
  const screenPath = 'app/(teacher)/profile.tsx'
  const hookPath = 'hooks/teacher/useTeacherProfile.ts'
  const migration = read('supabase/migrations/20260731100000_teacher_profile_notifications_support.sql')
  const screen = read(screenPath)
  const hook = read(hookPath)

  assert.ok(screen.split('\n').length < 260, 'teacher profile should remain a small composition screen')
  assert.equal(existsSync(join(root, 'components/teacher/profile/TeacherProfessionalAvatar.tsx')), true)
  assert.equal(existsSync(join(root, 'components/teacher/profile/TeacherProfileMetrics.tsx')), true)
  assert.match(screen, /useTeacherProfile/)
  assert.match(hook, /get_teacher_profile_summary/)
  assert.match(hook, /get_teacher_profile_recent_subjects_page/)
  assert.match(hook, /get_teacher_profile_recent_questions_page/)
  assert.match(hook, /Fotografía profesional/)
  assert.match(read('components/teacher/profile/TeacherProfileMetrics.tsx'), /Cómo se calcula la participación/)
  assert.match(migration, /p_period_days/)
  assert.match(migration, /participation_definition/)
})

test('teacher notification center uses server pages, buckets, mute and course preferences', () => {
  const screen = read('app/(teacher)/notifications.tsx') + read('components/notifications/NotificationFeed.tsx')
  const hook = read('hooks/teacher/useTeacherNotifications.ts')
  const settings = read('components/settings/TeacherDeliveryPreferencesPanel.tsx')
  const migration = read('supabase/migrations/20260731100000_teacher_profile_notifications_support.sql')

  assert.match(hook, /get_teacher_notifications_page/)
  assert.match(hook, /get_teacher_notification_center_summary/)
  assert.match(screen, /critical/)
  assert.match(screen, /informative/)
  assert.match(screen, /Cargar más/)
  assert.match(settings, /Resumen diario/)
  assert.match(settings, /Resumen semanal/)
  assert.match(settings, /Silenciar temporalmente/)
  assert.match(settings, /Preferencias por curso/)
  assert.match(migration, /teacher_notification_course_preferences/)
  assert.match(migration, /set_teacher_notifications_mute/)
  assert.match(migration, /enqueue_due_teacher_digests/)
})

test('support conversations expose paged tickets, attachments, contact channels and email history', () => {
  const support = read('lib/support.ts')
  const help = read('components/support/RoleHelpCenter.tsx')
  const migration = read('supabase/migrations/20260731100000_teacher_profile_notifications_support.sql')
  const worker = read('supabase/functions/process-support-email-delivery/index.ts')
  const types = read('types/database.types.ts')

  assert.match(support, /fetchOwnSupportTicketsPage/)
  assert.match(support, /fetchOwnSupportTicketById/)
  assert.match(support, /fetchSupportThreadPage/)
  assert.match(support, /fetchSupportContactChannels/)
  assert.match(support, /fetchOwnSupportEmailHistory/)
  assert.match(support, /openSupportContactChannel/)
  assert.match(help, /support\.tickets\.loadMore/)
  assert.match(help, /support\.thread\.loadOlder/)
  assert.match(help, /support\.form\.contactPreference/)
  assert.match(help, /support\.emailHistory\.title/)
  assert.match(help, /support\.emailHistory\.loadMore/)
  assert.match(migration, /support_email_deliveries/)
  assert.match(migration, /support_contact_channels/)
  assert.match(worker, /RESEND_API_KEY/)
  assert.match(types, /add_support_ticket_message/)
})
