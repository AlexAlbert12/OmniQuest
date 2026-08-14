import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('topic mistakes open an exact read-only game review and replay starts the full game', () => {
  const course = read('app/(student)/class/[id].tsx')
  const play = read('app/(student)/play/[id].tsx')
  const gameHook = read('hooks/useGame.ts')
  const review = read('app/(student)/review/[attemptId].tsx')
  const selector = read('components/student/course/TopicDifficultyModal.tsx')

  assert.match(course, /pathname: '\/\(student\)\/review\/\[attemptId\]'/)
  assert.doesNotMatch(course, /review:\s*'failed'/)
  assert.doesNotMatch(play, /reviewMode/)
  assert.doesNotMatch(gameHook, /p_review_failed/)
  assert.match(play, /attemptId: game\.attemptId \|\| 'latest'/)
  assert.match(review, /fetchGameAttemptReview/)
  assert.match(review, /Solo lectura/)
  assert.match(review, /Tu respuesta/)
  assert.match(review, /Respuesta correcta/)
  assert.match(review, /pathname: '\/\(student\)\/play\/\[id\]'/)
  assert.match(selector, /Revisar fallos/)
  assert.match(selector, /Jugar de nuevo/)
})

test('game review index is learner-owned and exposes only failed history ids plus submitted display', () => {
  const migration = read('supabase/migrations/20260811120000_student_game_attempt_review.sql')
  const secureData = read('lib/studentSecureData.ts')

  assert.match(migration, /ga\.student_id = v_user_id/)
  assert.match(migration, /failed_attempt_history_ids/)
  assert.match(migration, /submitted_answer_display/)
  assert.match(migration, /revoke all on function public\.get_game_attempt_review_index[\s\S]*from public, anon/)
  assert.match(migration, /grant execute on function public\.get_game_attempt_review_index[\s\S]*to authenticated/)
  assert.match(secureData, /fetchActivityAttemptDetail\(historyId\)/)
  assert.match(secureData, /fetchAttemptFeedback\(historyId\)/)
})

test('sidebar and help center labels are backed by both locale dictionaries', () => {
  const studentSidebar = read('components/student/StudentSidebar.tsx')
  const teacherSidebar = read('components/teacher/TeacherSidebar.tsx')
  const i18n = read('lib/i18n.tsx')

  assert.match(studentSidebar, /t\(item\.labelKey\)/)
  assert.match(teacherSidebar, /t\(item\.labelKey\)/)
  for (const key of [
    'nav.student.home',
    'nav.student.courses',
    'nav.student.progress',
    'nav.student.ranking',
    'nav.student.badges',
    'nav.student.notifications',
    'nav.student.profile',
    'nav.student.settings',
    'support.form.contactPreference',
    'support.channel.inApp',
    'support.channel.email',
    'support.channel.both',
    'support.emailHistory.title',
    'support.emailHistory.empty',
    'teacher.profile.participation.title',
    'teacher.profile.participation.period',
    'teacher.profile.participation.participants',
    'teacher.profile.participation.result',
    'settings.data.teacherOwn.title',
    'settings.data.teacherOwn.description',
  ]) {
    assert.equal(i18n.split(`'${key}'`).length - 1, 2, `${key} must exist in Spanish and English`)
  }
})

test('long app modals scroll and achievement reward keeps high contrast', () => {
  const provider = read('components/AppModalProvider.tsx')
  const confirm = read('components/AppConfirmModal.tsx')
  const achievement = read('components/gamification/BadgeUnlockModal.tsx')
  const bottomSheet = read('components/ui/AppBottomSheet.tsx')
  const typedConfirmation = read('components/admin/shared/AdminTypedConfirmation.tsx')
  const dangerZone = read('components/settings/SettingsDangerZone.tsx')

  assert.match(provider, /title=\{modal\?\.title\}[\s\S]*scrollable/)
  assert.match(provider, /style=\{styles\.banner\}/)
  assert.match(confirm, /title=\{title\}[\s\S]*scrollable/)
  assert.match(confirm, /selectable[\s\S]*\{message\}/)
  assert.match(bottomSheet, /scrollable = true/)
  assert.match(bottomSheet, /scrollContent:[\s\S]*flexShrink: 1/)
  assert.match(typedConfirmation, /<ScrollView[\s\S]*maxHeight: '90%'/)
  assert.match(dangerZone, /max-h-\[90%\][\s\S]*<ScrollView/)
  assert.match(achievement, /Recompensa conseguida/)
  assert.match(achievement, /<ScrollView/)
  assert.doesNotMatch(achievement, /bg-semantic-warning/)
})