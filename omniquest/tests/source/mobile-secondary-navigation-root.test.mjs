import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('secondary mobile screens keep their group highlighted while allowing a tap back to the group root', () => {
  const shared = read('components/ui/mobile/MobileBottomNavigation.tsx')
  const student = read('components/student/StudentBottomNav.tsx')
  const teacher = read('components/teacher/TeacherBottomNav.tsx')
  const admin = read('components/admin/AdminBottomNav.tsx')

  assert.match(shared, /disabledKey\?: Key \| null/)
  assert.match(shared, /disabledKey = activeKey/)
  assert.match(shared, /const isDisabled = item\.key === disabledKey/)
  assert.match(shared, /accessibilityState=\{\{ selected: isActive, disabled: isDisabled \}\}/)
  assert.match(student, /disabledKey=\{disabledKey\}/)
  assert.match(student, /active === 'profile'.*return 'more'/)
  assert.match(teacher, /disabledKey=\{disabledKey\}/)
  assert.match(teacher, /active === 'profile'.*return 'more'/)
  assert.match(admin, /disabledKey=\{disabledKey\}/)
  assert.match(admin, /function resolveDisabledGroup/)
})
