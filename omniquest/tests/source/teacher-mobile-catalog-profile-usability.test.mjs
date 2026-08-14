import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher profile exposes settings directly alongside profile and security actions', () => {
  const screen = read('app/(teacher)/profile.tsx')
  const hero = read('components/teacher/profile/TeacherProfileHero.tsx')
  assert.match(screen, /settingsRoot: '\/\(teacher\)\/settings'/)
  assert.match(screen, /onSettings=\{\(\) => router\.push\(ROUTES\.settingsRoot\)\}/)
  assert.match(hero, /label="Configuración"/)
  assert.match(hero, /icon="settings-outline"/)
})

test('teacher mobile course cards use the shared default border and create CTA clears the bottom nav', () => {
  const card = read('components/teacher/classes/TeacherCourseCard.tsx')
  const cta = read('components/teacher/classes/CreateCourseCTA.tsx')
  assert.match(card, /border border-border-default bg-surface-default/)
  assert.doesNotMatch(card, /borderColor: needsAttention/)
  assert.match(cta, /MOBILE_BOTTOM_NAV_HEIGHT \+ 14/)
  assert.doesNotMatch(cta, /bottom-\[82px\]/)
})

test('teacher catalog pages reload on focus so created courses appear when returning', () => {
  for (const path of ['features/teacher-catalog/useTeacherCoursesPage.ts', 'features/teacher-catalog/useTeacherClassroomsPage.ts']) {
    const hook = read(path)
    assert.match(hook, /useFocusEffect/)
    assert.match(hook, /useFocusEffect\(useCallback\(\(\) => \{ void load\(false\) \}, \[load\]\)\)/)
  }
})
