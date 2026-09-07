import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

const structuralScreens = [
  'app/(auth)/login.tsx',
  'app/(auth)/register.tsx',
  'app/(auth)/forgot-password.tsx',
  'app/(auth)/update-password.tsx',
  'app/(student)/notifications.tsx',
  'app/(student)/settings.tsx',
  'app/(student)/review/[attemptId].tsx',
  'app/(teacher)/audit.tsx',
  'components/teacher/TeacherQuestionForm.tsx',
  'components/admin/support/AdminSupportSection.tsx',
]

test('full-screen structure comes from the canonical responsive modes', () => {
  for (const path of structuralScreens) {
    const source = read(path)
    assert.match(source, /useResponsiveLayout/, `${path} should use the shared responsive hook`)
    assert.doesNotMatch(source, /useWindowDimensions/, `${path} should not own screen breakpoints`)
    assert.doesNotMatch(source, /isDesktop\s*=\s*width\s*[<>]=?/, `${path} should not own a desktop threshold`)
  }
})

test('priority student identity is allowed to wrap while secondary metadata stays compact', () => {
  const mobile = read('components/teacher/students/MobileTeacherStudents.tsx')
  const modals = read('components/teacher/students/StudentModals.tsx')
  assert.doesNotMatch(mobile, /student\.alias[^\n]*numberOfLines=\{1\}|numberOfLines=\{1\}[^\n]*student\.alias/)
  assert.doesNotMatch(modals, /student\.alias[^\n]*numberOfLines=\{1\}|numberOfLines=\{1\}[^\n]*student\.alias/)
  assert.match(mobile, /student\.alias[^\n]*numberOfLines=\{2\}|numberOfLines=\{2\}[^\n]*student\.alias/)
  assert.doesNotMatch(mobile, /context\.subjectName} · \$\{context\.classroomName/)
})

test('course and classroom cards share one visual tree controlled by density', () => {
  for (const path of ['components/teacher/classes/TeacherCourseCard.tsx', 'components/teacher/classes/TeacherClassroomCard.tsx']) {
    const source = read(path)
    assert.match(source, /density: 'compact' \| 'comfortable'/)
    assert.match(source, /const compact = density === 'compact'/)
    assert.doesNotMatch(source, /if \(isDesktop\)/)
    assert.equal((source.match(/<AppPressable/g) || []).length, 1)
  }
})

test('remote avatars share the expo-image memory and disk cache', () => {
  const avatarImage = read('components/ui/AvatarImage.tsx')
  assert.match(avatarImage, /from 'expo-image'/)
  assert.match(avatarImage, /contentFit="cover"/)
  assert.match(avatarImage, /cachePolicy="memory-disk"/)
  assert.match(avatarImage, /recyclingKey=\{uri\}/)

  for (const path of [
    'components/ui/RoleHeaderAvatar.tsx',
    'components/gamification/GamifiedAvatar.tsx',
    'components/teacher/profile/TeacherProfessionalAvatar.tsx',
    'components/teacher/students/StudentProfileAvatar.tsx',
    'components/admin/shared/AdminProfileAvatar.tsx',
    'components/settings/SettingsSections.tsx',
    'components/teacher/TeacherSidebar.tsx',
  ]) {
    const source = read(path)
    assert.match(source, /AvatarImage/)
    assert.doesNotMatch(source, /\bImage\b.*from 'react-native'/)
  }
})

test('shared mobile primitives use semantic shadows and the app pressable', () => {
  const dropdown = read('components/ui/AppDropdown.tsx')
  const navigation = read('components/ui/mobile/MobileBottomNavigation.tsx')
  assert.match(dropdown, /createShadowStyle/)
  assert.doesNotMatch(dropdown, /#[0-9A-Fa-f]{3,8}/)
  assert.match(navigation, /<AppPressable/)
  assert.match(navigation, /createShadowStyle/)
  assert.doesNotMatch(navigation, /shadowColor:\s*['"]#000000/)
})

test('Android keyboard resize has an executable Maestro guard and stable auth ids', () => {
  const app = read('app.json')
  const flow = read('.maestro/android-keyboard-resize.yaml')
  const register = read('app/(auth)/register.tsx')
  assert.match(app, /"softwareKeyboardLayoutMode": "resize"/)
  for (const id of ['login-submit', 'register-alias', 'register-email', 'register-password', 'register-confirm-password', 'register-submit']) {
    assert.match(flow + register, new RegExp(id))
  }
  assert.match(flow, /scrollUntilVisible/)
  assert.match(flow, /hideKeyboard/)
})
