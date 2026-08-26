import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('settings keep cyan as the structural accent and remove the accent-color picker', () => {
  const theme = read('lib/appTheme.tsx')
  const sections = read('components/settings/SettingsSections.tsx')
  const hook = read('hooks/useSettingsData.ts')

  assert.match(theme, /OFFICIAL_ACCENT_COLOR = '#09acf4'/)
  assert.match(theme, /keepStructuralAccent/)
  assert.doesNotMatch(theme, /APP_ACCENT_STORAGE_KEY/)
  assert.doesNotMatch(sections, /settings\.accent\./)
  assert.doesNotMatch(hook, /accentColors/)
})

test('profile settings use the current avatar, keep language in preferences and save after editable fields', () => {
  const sections = read('components/settings/SettingsSections.tsx')
  const roleSections = read('components/settings/StudentSettingsSections.tsx')
  const aliasIndex = sections.indexOf("<Field label={t('settings.profile.alias')}")
  const emailIndex = sections.indexOf("<Field label={t('settings.profile.email')}")
  const saveIndex = sections.indexOf("t('settings.profile.save')")

  assert.match(roleSections, /avatar=\{data\.profile\?\.avatar\}/)
  assert.match(sections, /<AvatarImage[^>]*uri=\{avatar as string\}/)
  assert.doesNotMatch(sections.slice(sections.indexOf('export function SettingsProfilePanel'), sections.indexOf('export function SettingsPreferencesPanel')), /settings\.profile\.language/)
  assert.ok(aliasIndex >= 0 && emailIndex > aliasIndex && saveIndex > emailIndex, 'save action must follow the profile fields')
  assert.match(sections, /<AppButton[\s\S]*label=\{saving \? t\('settings\.profile\.saving'\) : t\('settings\.profile\.save'\)\}[\s\S]*icon="save-outline"[\s\S]*role=\{isTeacher \? 'teacher' : 'student'\}[\s\S]*variant="primary"/)
})

test('settings navigation and switches follow the shared mobile interaction rules', () => {
  const screen = read('app/(student)/settings.tsx')
  const ui = read('components/settings/SettingsUi.tsx')
  const sections = read('components/settings/SettingsSections.tsx')

  assert.match(screen, /settings\.section\.preferences\.short/)
  assert.match(ui, /gap: 8/)
  assert.match(ui, /paddingHorizontal: 16/)
  assert.match(ui, /scrollTo\(\{ x: targetX, animated: true \}\)/)
  assert.match(ui, /backgroundColor: active \? withAlpha\(accentColor, '24'\) : colors\.surfaceRaised/)
  assert.match(ui, /trackColor=\{\{ false: offTrackColor, true: accentColor \}\}/)
  assert.match(ui, /thumbColor="#FFFFFF"/)
  assert.match(ui, /hitSlop=\{8\}/)
  assert.match(sections, /<View className="mt-6">\s*<PreferenceRow\s*label=\{t\('settings\.preference\.language'\)\}/)
  assert.match(ui, /borderColor: withAlpha\(accentColor, open \? 'B8' : '73'\)/)
  assert.match(ui, /borderWidth: open \? 2 : 1\.5/)
  assert.match(ui, /border-b border-border-default pb-4/)
  assert.match(ui, /borderBottomColor: colors\.border/)
  assert.doesNotMatch(ui, /rounded-lg border px-4 py-3/)
})

test('student security is session-aware, keeps account deletion under Data and avoids contradictory actions', () => {
  const sections = read('components/settings/SettingsSections.tsx')
  const security = read('components/settings/SettingsSecurity.tsx')
  const sessions = read('components/settings/ManagedSessionsCard.tsx')
  const edge = read('supabase/functions/manage-account-security/index.ts')
  const rootLayout = read('app/_layout.tsx')
  const login = read('app/(auth)/login.tsx')

  assert.match(sections, /<AccountDataRequestsCard/)
  const securityPanel = sections.slice(sections.indexOf('export function SettingsSecurityPanel'), sections.indexOf('export function SettingsAboutPanel'))
  assert.doesNotMatch(securityPanel, /SecurityDangerCard|onDeleteAccount|onRequestDeletion/)
  assert.match(security, /label=\{t\('security\.password\.current'\)\}/)
  assert.match(security, /label=\{t\('security\.password\.new'\)\}/)
  assert.match(security, /label=\{t\('security\.password\.confirm'\)\}/)
  assert.match(sessions, /activeOtherSessions\.length > 0/)
  assert.match(edge, /\['student','teacher','admin'\]\.includes\(profile\.role_id\)/)
  assert.match(rootLayout, /profile\.role_id === 'student' \|\| profile\.role_id === 'teacher' \|\| profile\.role_id === 'admin'/)
  assert.match(login, /profile\?\.role_id === 'student' \|\| profile\?\.role_id === 'teacher' \|\| profile\?\.role_id === 'admin'/)
})

test('settings copy stays user-facing and password validation matches the eight-character auth policy', () => {
  const i18n = read('lib/i18n.tsx')
  const hook = read('hooks/useSettingsData.ts')
  const teacherDelivery = read('components/settings/TeacherDeliveryPreferencesPanel.tsx')
  const userFacingSettings = i18n + hook + teacherDelivery

  assert.match(hook, /newPassword\.length >= 8/)
  assert.match(i18n, /'security\.password\.rule\.length': 'Mínimo 8 caracteres'/)
  assert.match(i18n, /'accountRequests\.export\.title': 'Exportar mis datos'/)
  assert.match(i18n, /'security\.account\.sessionSource': 'Último inicio de sesión registrado en tu cuenta\.'/)
  assert.doesNotMatch(userFacingSettings, /Supabase Auth|Exportación asíncrona|Preferencias aplicadas en servidor|Cargando preferencias del servidor|Falta la tabla .*Supabase|Aplica la migración/)
})
