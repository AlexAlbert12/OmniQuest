import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('mobile login and registration protect their content with the native safe area', () => {
  for (const path of ['app/(auth)/login.tsx', 'app/(auth)/register.tsx']) {
    const source = read(path)
    assert.match(source, /from 'react-native-safe-area-context'/)
    assert.match(source, /<SafeAreaView edges=\{\['top', 'left', 'right'\]\} className="flex-1 bg-background-secondary">/)
    assert.match(source, /<AuthHomeLink \/>/)
  }

  const logo = read('components/BrandLogo.tsx')
  assert.match(logo, /overflow: 'visible'/)
  assert.match(logo, /paddingBottom: Math\.max/)
  assert.equal((logo.match(/includeFontPadding: true/g) || []).length, 2)
})

test('teacher mobile settings keep navigation icons and explicit blue primary actions', () => {
  const menu = read('components/settings/SettingsUi.tsx')
  const sections = read('components/settings/SettingsSections.tsx')
  const delivery = read('components/settings/TeacherDeliveryPreferencesPanel.tsx')

  assert.doesNotMatch(menu, /isChip \? null/)
  assert.match(menu, /name=\{section\.icon\}/)
  assert.match(sections, /icon="save-outline"[\s\S]*role=\{isTeacher \? 'teacher' : 'student'\}[\s\S]*variant="primary"/)
  assert.match(sections, /px-4 pb-4 pt-3/)
  assert.match(delivery, /function ToggleButton[\s\S]*role="teacher"[\s\S]*variant=\{enabled \? 'primary' : 'secondary'\}/)
  assert.match(delivery, /label="1 hora" role="teacher"/)
})

test('help actions are primary and onboarding navigation stays in one separated row on phones', () => {
  const help = read('components/support/RoleHelpCenter.tsx')
  const onboarding = read('components/onboarding/RoleOnboardingScreen.tsx')

  assert.match(help, /support\.tutorial\.action[\s\S]*variant="primary"[\s\S]*role=\{role\}/)
  assert.match(help, /support\.preference\.save[\s\S]*role="teacher"[\s\S]*variant="primary"/)
  assert.match(onboarding, /useResponsiveLayout/)
  assert.doesNotMatch(onboarding, /useWindowDimensions/)
  assert.doesNotMatch(onboarding, /flexDirection: width >= 560/)
  assert.match(onboarding, /flexDirection: 'row', justifyContent: 'space-between', gap: 12/)
  assert.match(onboarding, /<View style=\{\{ flex: 1 \}\} \/>/)
})
