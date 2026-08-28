import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher profile exposes settings directly alongside profile and security actions', () => {
  const screen = read('app/(teacher)/profile.tsx')
  const hero = read('components/teacher/profile/TeacherProfileHero.tsx')
  const metrics = read('components/teacher/profile/TeacherProfileMetrics.tsx')
  const resources = read('components/teacher/profile/TeacherProfileLazyResources.tsx')
  assert.match(screen, /settingsRoot: '\/\(teacher\)\/settings'/)
  assert.match(screen, /onSettings=\{\(\) => router\.push\(ROUTES\.settingsRoot\)\}/)
  assert.match(hero, /label="Configuración"/)
  assert.match(hero, /icon="settings-outline"/)
  assert.match(hero, /flexBasis: '46%'/)
  assert.match(hero, /flexBasis: '100%'/)
  assert.match(screen, /flexGrow: 1, flexBasis: '46%'/)
  assert.match(metrics, /<MobileMetricCard/)
  assert.match(metrics, /dense/)
  assert.match(metrics, /flexDirection: 'row', flexWrap: 'wrap', gap: 8/)
  assert.match(metrics, /index === cards.length - 1 \? '100%' : '46%'/)
  assert.match(resources, /role="teacher" variant="secondary" fullWidth/)
  assert.match(resources, /borderColor: tokens\.border\.subtle/)
})

test('teacher mobile navigation groups account destinations under a dedicated more hub', () => {
  const bottomNav = read('components/teacher/TeacherBottomNav.tsx')
  const hub = read('components/teacher/TeacherMoreScreen.tsx')
  const route = read('app/(teacher)/more.tsx')

  assert.match(bottomNav, /key: 'more'.*href: '\/\(teacher\)\/more'/)
  assert.doesNotMatch(bottomNav, /key: 'profile'/)
  assert.match(bottomNav, /active === 'profile'.*return 'more'/)
  assert.match(route, /<TeacherMoreScreen/)
  for (const label of ['Perfil docente', 'Configuración', 'Seguridad', 'Auditoría', 'Notificaciones', 'Centro de ayuda']) {
    assert.match(hub, new RegExp(label))
  }
  assert.match(hub, /label="Cerrar sesión"/)
})

test('teacher settings expose sign out outside the desktop-only side menu', () => {
  const settings = read('app/(student)/settings.tsx')
  assert.match(settings, /!securityOnly && !isDesktop && data\.isTeacher/)
  assert.match(settings, /label=\{t\('settings\.signOut'\)\}/)
  assert.match(settings, /variant="danger"/)
  assert.match(settings, /onPress=\{data\.handleSignOut\}/)
})

test('teacher mobile course cards use the shared default border and create CTA clears the bottom nav', () => {
  const card = read('components/teacher/classes/TeacherCourseCard.tsx')
  const cta = read('components/teacher/classes/CreateCourseCTA.tsx')
  assert.match(card, /border border-border-default bg-surface-default/)
  assert.doesNotMatch(card, /borderColor: needsAttention/)
  assert.match(cta, /MOBILE_BOTTOM_NAV_HEIGHT \+ insets\.bottom \+ 18/)
  assert.doesNotMatch(cta, /bottom-\[82px\]/)
})

test('teacher catalog pages reload on focus so created courses appear when returning', () => {
  for (const path of ['features/teacher-catalog/useTeacherCoursesPage.ts', 'features/teacher-catalog/useTeacherClassroomsPage.ts']) {
    const hook = read(path)
    assert.match(hook, /useFocusEffect/)
    assert.match(hook, /useFocusEffect\(useCallback\(\(\) => \{ void load\(false\) \}, \[load\]\)\)/)
  }
})
