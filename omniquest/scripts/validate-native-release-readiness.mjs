import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const readJson = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'))
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const failures = []
const checks = []

function check(name, condition, detail) {
  checks.push({ check: name, status: condition ? 'PASS' : 'FAIL', detail })
  if (!condition) failures.push(`${name}: ${detail}`)
}

const app = readJson('app.json')
const eas = readJson('eas.json')
const pkg = readJson('package.json')
const lock = readJson('package-lock.json')
const expo = app.expo || {}
const plugins = expo.plugins || []
const plugin = (name) => plugins.find((entry) => entry === name || (Array.isArray(entry) && entry[0] === name))
const version = (name) => lock.packages?.[`node_modules/${name}`]?.version || null

check('Expo SDK 54 fijado', /^54\./.test(version('expo') || ''), `expo=${version('expo') || 'ausente'}`)
check('React Native compatible con SDK 54', /^0\.81\./.test(version('react-native') || ''), `react-native=${version('react-native') || 'ausente'}`)
check('React compatible con SDK 54', /^19\.1\./.test(version('react') || ''), `react=${version('react') || 'ausente'}`)
check('Package Android definido', expo.android?.package === 'com.alexalbert.omniquest', expo.android?.package || 'ausente')
check('Esquema nativo definido', expo.scheme === 'omniquest', expo.scheme || 'ausente')
check('Proyecto EAS enlazado', typeof expo.extra?.eas?.projectId === 'string' && expo.extra.eas.projectId.length > 20, expo.extra?.eas?.projectId || 'ausente')
check('Preview es distribución interna', eas.build?.preview?.distribution === 'internal', String(eas.build?.preview?.distribution || 'ausente'))
check('Preview genera APK', eas.build?.preview?.android?.buildType === 'apk', String(eas.build?.preview?.android?.buildType || 'ausente'))
check('Preview usa entorno EAS preview', eas.build?.preview?.environment === 'preview', String(eas.build?.preview?.environment || 'ausente'))
check('EAS CLI usa versión publicada compatible', /^>=\s*19\.1\.0$/.test(eas.cli?.version || ''), eas.cli?.version || 'ausente')
check('Plugin expo-notifications configurado', Boolean(plugin('expo-notifications')), 'expo-notifications')
const imagePicker = plugin('expo-image-picker')
check('Plugin expo-image-picker configurado', Boolean(imagePicker), 'expo-image-picker')
check('ImagePicker no solicita micrófono', Array.isArray(imagePicker) && imagePicker[1]?.microphonePermission === false, 'microphonePermission=false')
check('ImagePicker limita el build a galería', Array.isArray(imagePicker) && imagePicker[1]?.cameraPermission === false, 'cameraPermission=false; la validación usa galería')
check('DocumentPicker instalado', /^14\.0\./.test(version('expo-document-picker') || ''), `expo-document-picker=${version('expo-document-picker') || 'ausente'}`)
check('Sharing instalado', /^14\.0\./.test(version('expo-sharing') || ''), `expo-sharing=${version('expo-sharing') || 'ausente'}`)
check('Notifications instalado', /^0\.32\./.test(version('expo-notifications') || ''), `expo-notifications=${version('expo-notifications') || 'ausente'}`)
check('ImagePicker instalado', /^17\.0\./.test(version('expo-image-picker') || ''), `expo-image-picker=${version('expo-image-picker') || 'ausente'}`)
check('Expo Image instalado para avatares remotos', /^3\.0\./.test(version('expo-image') || ''), `expo-image=${version('expo-image') || 'ausente'}`)
check('Teclado Android conserva resize', expo.android?.softwareKeyboardLayoutMode === 'resize', String(expo.android?.softwareKeyboardLayoutMode || 'ausente'))
check('Variables locales no se versionan', read('.gitignore').includes('.env.*'), '.gitignore excluye .env y variantes')
check('Redirect nativo de recuperación permitido', read('supabase/config.toml').includes('"omniquest://update-password"'), 'supabase/config.toml')
check('Observador nativo de recuperación registrado', read('app/_layout.tsx').includes('usePasswordRecoveryLinkObserver()'), 'app/_layout.tsx')
check('Recuperación nativa procesa sesión o PKCE', /setSession\(/.test(read('lib/nativeAuthLinks.ts')) && /exchangeCodeForSession\(/.test(read('lib/nativeAuthLinks.ts')), 'lib/nativeAuthLinks.ts')
check('Push registra ExpoPushToken con projectId', /getExpoPushTokenAsync\(\{ projectId \}\)/.test(read('lib/pushNotifications.ts')), 'lib/pushNotifications.ts')
check('Galería multimedia implementada', /launchImageLibraryAsync\(/.test(read('lib/questionMedia.ts')), 'lib/questionMedia.ts')
check('Selector de archivos implementado', /DocumentPicker\.getDocumentAsync\(/.test(read('lib/questionMedia.ts')) && /DocumentPicker\.getDocumentAsync\(/.test(read('lib/support.ts')), 'questionMedia/support')
check('Compartir exportaciones implementado', /Sharing\.shareAsync\(/.test(read('lib/reportExports.ts')), 'lib/reportExports.ts')
check('Offline nativo implementado', /expo-network/.test(read('lib/gameOffline.ts')), 'lib/gameOffline.ts')

for (const flow of ['public-login-smoke.yaml', 'student-authenticated-smoke.yaml', 'teacher-authenticated-smoke.yaml', 'admin-authenticated-smoke.yaml', 'android-keyboard-resize.yaml']) {
  check(`Maestro ${flow}`, existsSync(resolve(root, '.maestro', flow)), `.maestro/${flow}`)
}

console.table(checks)
if (failures.length) {
  console.error(`\nNative readiness failed with ${failures.length} issue(s):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}
console.log(`\nNative readiness: ${checks.length} checks passed.`)
