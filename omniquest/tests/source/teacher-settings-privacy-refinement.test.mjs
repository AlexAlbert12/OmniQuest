import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher settings remove redundant security, timezone and profile visibility controls', () => {
  const settingsRoute = read('app/(student)/settings.tsx')
  const teacherDefinitions = settingsRoute.slice(settingsRoute.indexOf('const teacherSettingsSectionDefinitions'), settingsRoute.indexOf('function roleRoute'))
  const sections = read('components/settings/TeacherSettingsSections.tsx')
  const sharedSections = read('components/settings/SettingsSections.tsx')
  const bottomNav = read('components/teacher/TeacherBottomNav.tsx')

  assert.doesNotMatch(teacherDefinitions, /key: 'security'/)
  assert.match(sections, /hideTimezone/)
  assert.match(sharedSections, /!isTeacher \? \(/)
  assert.match(sharedSections, /StudentRankingPrivacyCard/)
  assert.doesNotMatch(sharedSections, /function VisibilityButton/)
  assert.match(bottomNav, /active === 'notifications' \|\| active === 'settings' \|\| active === 'audit'\) return null/)
})

test('teacher account export excludes individual student academic records', () => {
  const worker = read('supabase/functions/process-account-requests/index.ts')
  const start = worker.indexOf("if (role === 'teacher')")
  const end = worker.indexOf('\n  return {\n    ...common,\n    enrollments:', start)
  const teacherExport = worker.slice(start, end)

  assert.match(teacherExport, /exportScope: 'teacher-owned-data-only'/)
  assert.match(teacherExport, /subjects/)
  assert.match(teacherExport, /classrooms/)
  assert.match(teacherExport, /topics/)
  assert.match(teacherExport, /questions/)
  assert.match(teacherExport, /answers/)
  assert.match(teacherExport, /courseNotificationPreferences/)
  assert.match(teacherExport, /auditLogs/)
  assert.doesNotMatch(teacherExport, /enrollments:/)
  assert.doesNotMatch(teacherExport, /subjectScores:/)
  assert.doesNotMatch(teacherExport, /attempts:/)
})

test('teacher data area only resets teacher-owned preferences and personalization', () => {
  const dataPanel = read('components/settings/SettingsSections.tsx')
  const resetWorker = read('supabase/functions/teacher-reset-own-data/index.ts')
  const i18n = read('lib/i18n.tsx')

  assert.match(dataPanel, /settings\.data\.teacherOwn\.title/)
  assert.match(dataPanel, /onDeletePartialData\('teacher_data'\)/)
  assert.match(resetWorker, /resetType === 'personal_data'/)
  const personalBranch = resetWorker.slice(resetWorker.indexOf("if (resetType === 'personal_data')"), resetWorker.indexOf('const teacherSnapshot'))
  assert.match(personalBranch, /deleteTeacherPreferencesAndAvatar/)
  assert.doesNotMatch(personalBranch, /deleteTeacherTeachingData/)
  assert.doesNotMatch(personalBranch, /deleteTeacherProgress/)
  assert.equal(i18n.split("'settings.data.teacherOwn.title'").length - 1, 2)
})

test('teacher support channel preference lives in help center and settings stay responsive', () => {
  const help = read('components/support/RoleHelpCenter.tsx')
  const delivery = read('components/settings/TeacherDeliveryPreferencesPanel.tsx')
  const settingsUi = read('components/settings/SettingsUi.tsx')

  assert.match(help, /set_teacher_support_preference/)
  assert.match(help, /get_teacher_notification_settings/)
  assert.match(help, /support\.preference\.title/)
  assert.match(help, /support\.preference\.ticketChannel/)
  assert.doesNotMatch(delivery, /set_teacher_support_preference/)
  assert.match(settingsUi, /const stacked = width < 520/)
  assert.match(settingsUi, /LinearGradient/)
  assert.match(settingsUi, /showStartFade/)
  assert.match(settingsUi, /showEndFade/)
})
