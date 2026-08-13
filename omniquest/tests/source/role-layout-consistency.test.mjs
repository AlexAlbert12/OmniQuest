import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('admin screens use the same fluid canvas and gutters as student home', () => {
  const adminLayout = read('components/layouts/AdminScreenLayout.tsx')
  const studentLayout = read('components/student/StudentLayout.tsx')

  assert.match(adminLayout, /fluidContent = true/)
  assert.match(adminLayout, /horizontalPadding=\{horizontalPadding \?\? \(isDesktop \? 28 : 18\)\}/)
  assert.match(adminLayout, /topPadding=\{topPadding \?\? \(isDesktop \? 24 : 18\)\}/)
  assert.match(studentLayout, /fluidContent/)
  assert.match(studentLayout, /horizontalPadding=\{isDesktop \? 28 : 18\}/)
  assert.match(studentLayout, /topPadding=\{isDesktop \? 24 : 18\}/)
  assert.doesNotMatch(adminLayout, /ADMIN_CONTENT_MAX_WIDTH|maxContentWidth/)
})

test('admin security keeps the shared admin structure', () => {
  const security = read('app/(admin)/security.tsx')

  assert.match(security, /<AdminScaffold/)
  assert.match(security, /activeSection="security"/)
  assert.doesNotMatch(security, /mx-auto/)
  assert.doesNotMatch(security, /max-w-\[860px\]/)
})

test('student and teacher screens default to the same fluid canvas', () => {
  const studentLayout = read('components/layouts/StudentScreenLayout.tsx')
  const teacherLayout = read('components/layouts/TeacherScreenLayout.tsx')

  for (const layout of [studentLayout, teacherLayout]) {
    assert.match(layout, /fluidContent = true/)
    assert.match(layout, /horizontalPadding=\{horizontalPadding \?\? \(isDesktop \? 28 : 18\)\}/)
    assert.match(layout, /topPadding=\{topPadding \?\? \(isDesktop \? 24 : 18\)\}/)
  }
})

test('student and teacher page shells do not opt back into centered fixed widths', () => {
  const teacherNotifications = read('app/(teacher)/notifications.tsx')
  const teacherProfile = read('app/(teacher)/profile.tsx')
  const studentReview = read('app/(student)/review/[attemptId].tsx')
  const teacherQuestionForm = read('components/teacher/TeacherQuestionForm.tsx')

  assert.doesNotMatch(teacherNotifications, /maxContentWidth=\{1220\}|fluidContent=\{false\}/)
  assert.doesNotMatch(teacherProfile, /maxContentWidth=\{1220\}/)
  assert.doesNotMatch(studentReview, /mx-auto w-full max-w-\[980px\]/)
  assert.doesNotMatch(teacherQuestionForm, /mx-auto w-full max-w-\[1440px\]/)
})
