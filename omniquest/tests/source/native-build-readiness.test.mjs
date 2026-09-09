import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(file, 'utf8')
const readJson = (file) => JSON.parse(read(file))

test('preview EAS build is an installable APK on a published EAS CLI line', () => {
  const eas = readJson('eas.json')
  assert.equal(eas.build.preview.distribution, 'internal')
  assert.equal(eas.build.preview.environment, 'preview')
  assert.equal(eas.build.preview.android.buildType, 'apk')
  assert.equal(eas.cli.version, '>= 19.1.0')
})

test('production Android build targets Google Play while preview and TFM builds remain installable', () => {
  const eas = readJson('eas.json')
  assert.equal(eas.build.production.android.buildType, 'app-bundle')
  assert.equal(eas.build.preview.android.buildType, 'apk')
  assert.equal(eas.build['tfm-apk'].android.buildType, 'apk')
  assert.equal(eas.build.production.autoIncrement, true)
})

test('native config uses least privilege for media and keeps notifications configured', () => {
  const app = readJson('app.json')
  const imagePicker = app.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-image-picker')
  const notifications = app.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-notifications')
  assert.ok(imagePicker)
  assert.equal(imagePicker[1].cameraPermission, false)
  assert.equal(imagePicker[1].microphonePermission, false)
  assert.match(imagePicker[1].photosPermission, /galería/)
  assert.ok(notifications)
  assert.equal(app.expo.scheme, 'omniquest')
  assert.equal(app.expo.android.package, 'com.alexalbert.omniquest')
})

test('native password recovery consumes real Supabase recovery links', () => {
  const links = read('lib/nativeAuthLinks.ts')
  const hook = read('hooks/usePasswordRecoveryLinkObserver.ts')
  const layout = read('app/_layout.tsx')
  const config = read('supabase/config.toml')
  assert.match(links, /access_token/)
  assert.match(links, /refresh_token/)
  assert.match(links, /exchangeCodeForSession/)
  assert.match(links, /markPasswordRecoverySession/)
  assert.match(hook, /Linking\.getInitialURL/)
  assert.match(hook, /Linking\.addEventListener\('url'/)
  assert.match(layout, /usePasswordRecoveryLinkObserver\(\)/)
  assert.match(config, /omniquest:\/\/update-password/)
})

test('Maestro covers public and authenticated mobile smoke tests without committed passwords', () => {
  const publicFlow = read('.maestro/public-login-smoke.yaml')
  const student = read('.maestro/student-authenticated-smoke.yaml')
  const teacher = read('.maestro/teacher-authenticated-smoke.yaml')
  const admin = read('.maestro/admin-authenticated-smoke.yaml')
  assert.match(publicFlow, /landing-login/)
  assert.match(student, /\$\{MAESTRO_STUDENT_EMAIL\}/)
  assert.match(student, /student-nav-classes/)
  assert.match(teacher, /\$\{MAESTRO_TEACHER_EMAIL\}/)
  assert.match(teacher, /teacher-nav-classes/)
  assert.match(admin, /\$\{MAESTRO_ADMIN_EMAIL\}/)
  assert.match(admin, /admin-nav-users/)
  assert.match(admin, /admin-nav-audit/)
  for (const flow of [student, teacher, admin]) assert.doesNotMatch(flow, /password:\s*['"][^$]/i)
})

test('native readiness script checks device-only capabilities used by the acceptance list', () => {
  const script = read('scripts/validate-native-release-readiness.mjs')
  for (const expected of ['expo-notifications', 'expo-image-picker', 'expo-document-picker', 'expo-sharing', 'omniquest://update-password', 'lib/gameOffline.ts']) assert.match(script, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})
