import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (file) => fs.readFileSync(file, 'utf8')

test('responsive API defines the shared application breakpoints', () => {
  const source = read('lib/responsive.ts')
  assert.match(source, /mobile:\s*0\b/)
  assert.match(source, /tablet:\s*600\b/)
  assert.match(source, /desktop:\s*1024\b/)
  assert.match(source, /wide:\s*1440\b/)
  assert.match(source, /export function useResponsiveLayout/)
})

test('role layouts reuse one responsive screen shell', () => {
  for (const role of ['Student', 'Teacher', 'Admin']) {
    const source = read(`components/layouts/${role}ScreenLayout.tsx`)
    assert.match(source, /RoleScreenLayout/)
    assert.match(source, new RegExp(`role=\\"${role.toLowerCase()}\\"`))
  }
  assert.match(read('components/student/StudentLayout.tsx'), /StudentScreenLayout/)
})

test('galaxy screens expose an equivalent linear view', () => {
  const source = read('components/student/galaxy/StudentGalaxyMap.tsx')
  assert.match(source, /Vista galáctica/)
  assert.match(source, /Vista lista/)
  assert.match(source, /AccessibilityInfo\.isScreenReaderEnabled/)
  assert.match(source, /Cursos disponibles en formato lista/)
  assert.match(source, /Temas del curso en formato lista/)
})

test('shared typography permits 200 percent scaling and multiline headings', () => {
  for (const file of [
    'components/ui/RolePageHeader.tsx',
    'components/ui/mobile/MobileHeader.tsx',
    'components/ui/mobile/MobileSectionHeader.tsx',
    'components/ui/AppButton.tsx',
  ]) {
    const source = read(file)
    assert.match(source, /maxFontSizeMultiplier=\{2\}/, file)
    assert.doesNotMatch(source, /numberOfLines=\{1\}/, file)
  }
})

test('keyboard focus and non-swipe notification actions are available', () => {
  const css = read('global.css')
  assert.match(css, /:focus-visible/)
  assert.match(css, /forced-colors:\s*active/)

  const notifications = read('components/notifications/NotificationListItem.tsx')
  assert.match(notifications, /Marcar como leída/)
  assert.match(notifications, /Eliminar notificación/)
  assert.match(notifications.toLowerCase(), /alternativa al gesto/)
})
