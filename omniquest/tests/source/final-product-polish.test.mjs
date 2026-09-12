import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const json = (path) => JSON.parse(read(path))

test('OmniQuest ships with one official dark theme and no appearance picker', () => {
  const theme = read('lib/appTheme.tsx')
  const settings = read('components/settings/SettingsSections.tsx')
  const app = json('app.json').expo

  assert.equal(app.userInterfaceStyle, 'dark')
  assert.match(theme, /OFFICIAL_THEME: AppThemeMode = 'dark'/)
  assert.match(theme, /OFFICIAL_ACCENT_COLOR = '#09acf4'/)
  assert.doesNotMatch(theme, /useColorScheme|APP_THEME_STORAGE_KEY|APP_ACCENT_STORAGE_KEY/)
  assert.doesNotMatch(settings, /settings\.appearance\.(?:system|dark|light)|settings\.accent\./)
})

test('student course leave is a deliberate action inside course detail, not an ellipsis menu', () => {
  const classes = read('app/(student)/classes.tsx')
  const detail = read('app/(student)/class/[id].tsx')
  const galaxy = read('components/student/galaxy/StudentGalaxyMap.tsx')

  assert.doesNotMatch(classes, /class\.leave|leaveConfirmationVisible|onMore=/)
  assert.doesNotMatch(galaxy, /ellipsis-horizontal|onMore\??:/)
  assert.match(detail, /label="Abandonar clase"/)
  assert.match(detail, /kind: 'class\.leave'/)
  assert.match(detail, /title="¿Abandonar clase\?"/)
  assert.match(detail, /Dejarás de tener acceso a la clase, pero tu progreso y resultados se conservarán\./)
  assert.match(detail, /necesitarás nuevamente el código de invitación de la clase\./)
  assert.doesNotMatch(detail, /Vas a salir de/)
})

test('full-screen loading uses the shared Omni waiting state', () => {
  const loader = read('components/ui/OmniLoadingScreen.tsx')
  const layout = read('components/layouts/RoleScreenLayout.tsx')
  const home = read('features/student-home/screen.tsx')
  const notifications = read('app/(student)/notifications.tsx')

  assert.match(loader, /OmniGuide state="blink" size=\{116\}/)
  assert.match(loader, /t\('loading\.omni'\)/)
  assert.match(loader, /w-full flex-1 items-center justify-center/)
  assert.match(loader, /accessibilityRole="progressbar"/)
  assert.match(layout, /OmniGuide state="blink" size=\{116\}/)
  assert.match(layout, /loading \? styles\.loadingViewport : null/)
  assert.match(layout, /loadingViewport: \{ minHeight: '100%' \}/)
  assert.match(layout, /loading: \{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' \}/)
  assert.doesNotMatch(layout, /minHeight: 260/)
  assert.match(home, /<OmniLoadingScreen/)
  assert.match(notifications, /<OmniLoadingScreen/)
})

test('teacher-authored optional hints are delivered safely and only shown when present', () => {
  const migration = read('supabase/migrations/20260809143000_question_hints_and_academic_icons.sql')
  const form = read('components/teacher/question-form/QuestionSettingsPanel.tsx')
  const hook = read('hooks/useGame.ts')
  const play = read('app/(student)/play/[id].tsx')
  const hud = read('components/student/game/GameHud.tsx')

  assert.match(migration, /add column if not exists hint text/)
  assert.match(migration, /create or replace function public\.get_safe_game_questions_v2/)
  assert.match(migration, /create or replace function public\.save_teacher_question_v2/)
  assert.match(form, /Pista para el alumno \(opcional\)/)
  assert.match(hook, /rpc\('get_safe_game_questions_v2'/)
  assert.match(hook, /question\?\.hint/)
  assert.match(play, /showHint=\{Boolean\(currentQuestion\?\.hint\?\.trim\(\)\)\}/)
  assert.match(hud, /showHint \? <HudAction/)
})

test('courses default to galaxy view and cached-copy implementation text is not user-visible', () => {
  const galaxy = read('components/student/galaxy/StudentGalaxyMap.tsx')
  const banner = read('components/OfflineSyncBanner.tsx')

  assert.match(galaxy, /DEFAULT_GALAXY_VIEW_MODE: GalaxyViewMode = 'galaxy'/)
  assert.match(galaxy, /useState<GalaxyViewMode>\(DEFAULT_GALAXY_VIEW_MODE\)/)
  assert.doesNotMatch(banner, /Mostrando una copia local mientras se recupera la conexión|copia local/)
})

test('support success confirmation and academic entities use standard application icons', () => {
  const support = read('components/support/RoleHelpCenter.tsx')
  const modal = read('components/AppModalProvider.tsx')
  const icons = read('lib/academicIcons.ts')
  const subjectForm = read('components/teacher/TeacherSubjectForm.tsx')
  const topicForm = read('components/teacher/TeacherTopicForm.tsx')

  assert.match(support, /support\.form\.created[\s\S]*variant: 'success'/)
  assert.match(modal, /success:[\s\S]*bannerVariant: 'success'[\s\S]*omniState: 'happy'/)
  assert.match(icons, /COURSE_ICON_CHOICES/)
  assert.match(icons, /TOPIC_ICON_CHOICES/)
  assert.match(subjectForm, /COURSE_ICON_CHOICES/)
  assert.match(topicForm, /TOPIC_ICON_CHOICES/)
  assert.doesNotMatch(subjectForm, /\['📚'|\['📘'/)
  assert.doesNotMatch(topicForm, /\['📚'|\['📘'/)
})

test('OmniQuest lets users select and persist Spanish or English', () => {
  const i18n = read('lib/i18n.tsx')
  const settings = read('hooks/useSettingsData.ts')
  const app = JSON.parse(read('app.json')).expo
  const localization = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-localization')[1]

  assert.deepEqual(localization.supportedLocales.android, ['es', 'en'])
  assert.deepEqual(localization.supportedLocales.ios, ['es', 'en'])
  assert.ok(i18n.includes("storedLocale === 'es-ES' || storedLocale === 'en-US'"))
  assert.ok(i18n.includes('setLocaleState(nextLocale)'))
  assert.ok(settings.includes("language: ['es-ES', 'en-US']"))
})

test('the English UI catalog remains available to the selectable English locale', () => {
  const i18n = read('lib/i18n.tsx')

  assert.match(i18n, /sourceTextToEnglishLower/)
  assert.match(i18n, /Mapa visual de cursos/)
  assert.match(i18n, /Repasa \(\\d\+\) fallos/)
  assert.match(i18n, /Recordatorio enviado/)
  assert.match(i18n, /Se activará la cuenta/)
  assert.match(i18n, /Portal de administración/)
  assert.match(i18n, /Abrir canal/)
  assert.match(i18n, /for \(const \[pattern, formatter\][\s\S]*if \(match\) return[\s\S]*return input/)
})
