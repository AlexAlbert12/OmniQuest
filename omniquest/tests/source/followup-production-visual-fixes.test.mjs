import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('desktop learning path centers its primary action with the book icon', () => {
  const mission = read('components/student/course/CourseNextMission.tsx')
  assert.ok(mission.includes("minWidth: 190, alignSelf: 'center'"))
})

test('settings exposes and persists Spanish and English', () => {
  const app = JSON.parse(read('app.json')).expo
  const settings = read('hooks/useSettingsData.ts')
  const i18n = read('lib/i18n.tsx')
  const localization = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-localization')[1]

  assert.deepEqual(localization.supportedLocales.android, ['es', 'en'])
  assert.deepEqual(localization.supportedLocales.ios, ['es', 'en'])
  assert.ok(settings.includes("language: ['es-ES', 'en-US']"))
  assert.ok(settings.includes("value === 'en-US' ? 'settings.language.english'"))
  assert.ok(i18n.includes("storedLocale === 'es-ES' || storedLocale === 'en-US'"))
  assert.ok(i18n.includes('setLocaleState(nextLocale)'))
  assert.ok(i18n.includes('persistLocale(nextLocale)'))
})

test('course detail exposes a return to My courses on web and native', () => {
  const header = read('components/student/course/CourseGalaxyHeader.tsx')
  const screen = read('app/(student)/class/[id].tsx')

  assert.ok(header.includes("guestMode ? 'Nueva partida' : 'Mis cursos'"))
  assert.ok(screen.includes("guest.isGuest ? '/(student)/homeStudent' as never : '/(student)/classes' as never"))
})

test('game feedback uses the canonical blue next-question action', () => {
  const feedback = read('components/student/game/GameQuestionUi.tsx')
  const action = feedback.slice(feedback.indexOf('accessibilityLabel="Siguiente pregunta"'))

  assert.ok(action.includes('label="Siguiente pregunta"'))
  assert.ok(action.includes('role="student"'))
  assert.ok(action.includes('variant="primary"'))
})

test('mobile web history reserves only the visible fixed navigation height', () => {
  const activity = read('app/(student)/activity-log.tsx')

  assert.ok(activity.includes('bottomPadding={0}'))
  assert.ok(activity.includes("Platform.OS === 'web' ? MOBILE_BOTTOM_NAV_HEIGHT : MOBILE_BOTTOM_NAV_SPACER"))
})

test('security actions use shared themed buttons instead of black custom borders', () => {
  const security = read('components/settings/SettingsSecurity.tsx')

  assert.ok(security.includes("label={t('security.password.update')}"))
  assert.ok(security.includes('borderColor: checks.canSubmit ? accentColor : tokens.border.default'))
  assert.ok(security.includes("label={t('security.account.signOut')}"))
  assert.ok(security.includes('variant="danger"'))
})

test('help center uses the canonical blue back button', () => {
  const help = read('components/support/RoleHelpCenter.tsx')

  assert.ok(help.includes('<AppBackButton'))
  assert.ok(help.includes("label={t('settings.back')}"))
})

test('teacher create-course action follows the list instead of floating over it', () => {
  const screen = read('features/teacher-catalog/screen.tsx')
  const cta = read('components/teacher/classes/CreateCourseCTA.tsx')

  assert.ok(screen.indexOf('<CreateCourseCTA') > screen.indexOf('<PaginationControls'))
  assert.ok(!screen.includes('sticky'))
  assert.ok(!cta.includes("position: 'absolute'"))
  assert.ok(!cta.includes('useSafeAreaInsets'))
})
