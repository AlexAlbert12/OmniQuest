import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('student and teacher onboarding is persisted and routed only for those roles', async () => {
  const [layout, onboarding, migration] = await Promise.all([
    read('app/_layout.tsx'),
    read('lib/onboarding.ts'),
    read('supabase/migrations/20260815163000_student_teacher_onboarding.sql'),
  ])

  assert.match(layout, /networkAvailable\s*&&\s*!profileError\s*&&\s*profileNeedsOnboarding\(profile\)/)
  assert.match(layout, /\(student\).*onboarding/)
  assert.match(layout, /\(teacher\).*onboarding/)
  assert.match(onboarding, /CURRENT_ONBOARDING_VERSION\s*=\s*1/)
  assert.match(onboarding, /profile\.role_id !== 'student' && profile\.role_id !== 'teacher'/)
  assert.match(migration, /complete_current_user_onboarding/)
  assert.match(migration, /grant execute on function public\.complete_current_user_onboarding\(integer\) to authenticated, service_role/i)
})

test('onboarding can be replayed from student and teacher help without resetting completion state', async () => {
  const [helpCenter, screen, studentRoute, teacherRoute] = await Promise.all([
    read('components/support/RoleHelpCenter.tsx'),
    read('components/onboarding/RoleOnboardingScreen.tsx'),
    read('app/(student)/onboarding.tsx'),
    read('app/(teacher)/onboarding.tsx'),
  ])

  assert.match(helpCenter, /onboarding\?replay=1/)
  assert.match(helpCenter, /support\.tutorial\.action/)
  assert.match(screen, /replayValue === '1'/)
  assert.match(screen, /if \(replay\) \{\s*leaveReplay\(\)/)
  assert.match(studentRoute, /role="student"/)
  assert.match(teacherRoute, /role="teacher"/)
})
