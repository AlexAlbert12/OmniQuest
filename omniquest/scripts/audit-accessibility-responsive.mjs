import fs from 'node:fs'

const priorityScreens = [
  'app/(teacher)/homeTeacher.tsx',
  'components/teacher/students/MobileTeacherStudents.tsx',
  'app/(teacher)/subject/[id].tsx',
  'app/(teacher)/profile.tsx',
  'components/teacher/students/StudentModals.tsx',
  'components/admin/AdminPortal.tsx',
  'app/(student)/homeStudent.tsx',
  'app/index.tsx',
]

const structuralResponsiveScreens = [
  'app/(auth)/login.tsx',
  'app/(auth)/register.tsx',
  'app/(auth)/forgot-password.tsx',
  'app/(auth)/update-password.tsx',
  'app/(student)/notifications.tsx',
  'app/(student)/settings.tsx',
  'app/(student)/review/[attemptId].tsx',
  'app/(teacher)/audit.tsx',
  'app/(teacher)/question-report/[id].tsx',
  'app/(teacher)/topic/[id].tsx',
  'components/teacher/TeacherQuestionForm.tsx',
  'components/admin/support/AdminSupportSection.tsx',
  'components/support/RoleHelpCenter.tsx',
  'features/teacher-catalog/screen.tsx',
  'features/teacher-students/screen.tsx',
]

const failures = []
const read = (file) => fs.readFileSync(file, 'utf8')

function openingTags(source, componentName) {
  const tags = []
  const needle = `<${componentName}`
  let from = 0

  while (from < source.length) {
    const start = source.indexOf(needle, from)
    if (start < 0) break

    let braces = 0
    let quote = null
    let escaped = false
    let end = start + needle.length

    for (; end < source.length; end += 1) {
      const char = source[end]
      if (quote) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = null
        continue
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char
        continue
      }
      if (char === '{') braces += 1
      else if (char === '}') braces = Math.max(0, braces - 1)
      else if (char === '>' && braces === 0) {
        end += 1
        break
      }
    }

    tags.push(source.slice(start, end))
    from = end
  }

  return tags
}

for (const file of priorityScreens) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: falta el archivo`)
    continue
  }

  const source = read(file)
  const pressables = openingTags(source, 'Pressable')
  pressables.forEach((tag, index) => {
    if (!/accessibilityRole=/.test(tag)) failures.push(`${file}: Pressable ${index + 1} sin accessibilityRole`)
    if (!/accessibilityLabel=/.test(tag)) failures.push(`${file}: Pressable ${index + 1} sin accessibilityLabel`)
    if (!/accessibilityHint=/.test(tag)) failures.push(`${file}: Pressable ${index + 1} sin accessibilityHint`)
  })

  const unsafeSingleLineText = openingTags(source, 'Text').filter((tag) => /numberOfLines=\{1\}/.test(tag) && !/adjustsFontSizeToFit/.test(tag))
  if (unsafeSingleLineText.length > 0) {
    failures.push(`${file}: conserva ${unsafeSingleLineText.length} texto(s) prioritario(s) forzado(s) a una sola línea sin ajuste de tamaño`)
  }
}

for (const file of structuralResponsiveScreens) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: falta el archivo responsive estructural`)
    continue
  }
  const source = read(file)
  if (!/useResponsiveLayout/.test(source)) failures.push(`${file}: no usa useResponsiveLayout para el modo estructural`)
  if (/useWindowDimensions/.test(source)) failures.push(`${file}: decide la estructura con useWindowDimensions`)
  if (/isDesktop\s*=\s*width\s*[<>]=?/.test(source)) failures.push(`${file}: conserva un breakpoint desktop local`)
}

const responsive = read('lib/responsive.ts')
for (const [name, value] of [['mobile', 0], ['tablet', 600], ['desktop', 1024], ['wide', 1440]]) {
  if (!new RegExp(`${name}:\\s*${value}\\b`).test(responsive)) {
    failures.push(`lib/responsive.ts: breakpoint ${name}=${value} ausente`)
  }
}
for (const symbol of ['getAppBreakpoint', 'getResponsiveLayout', 'useResponsiveLayout']) {
  if (!new RegExp(`\\b${symbol}\\b`).test(responsive)) failures.push(`lib/responsive.ts: falta ${symbol}`)
}

for (const layout of ['StudentScreenLayout', 'TeacherScreenLayout', 'AdminScreenLayout']) {
  const file = `components/layouts/${layout}.tsx`
  if (!fs.existsSync(file)) failures.push(`${file}: falta el layout compartido`)
  else if (!/RoleScreenLayout/.test(read(file))) failures.push(`${file}: no delega en RoleScreenLayout`)
}

if (!/StudentScreenLayout/.test(read('components/student/StudentLayout.tsx'))) {
  failures.push('components/student/StudentLayout.tsx: no reutiliza StudentScreenLayout')
}

const galaxy = read('components/student/galaxy/StudentGalaxyMap.tsx')
for (const text of ['Vista galáctica', 'Vista lista', 'screenReaderChanged', 'Cursos disponibles en formato lista']) {
  if (!galaxy.includes(text)) failures.push(`StudentGalaxyMap.tsx: falta ${text}`)
}

const notifications = read('components/notifications/NotificationListItem.tsx')
for (const text of ['Marcar como leída', 'Eliminar notificación', 'alternativa al gesto']) {
  if (!notifications.toLowerCase().includes(text.toLowerCase())) {
    failures.push(`NotificationListItem.tsx: falta la alternativa accesible «${text}»`)
  }
}

const css = read('global.css')
if (!/:focus-visible/.test(css)) failures.push('global.css: falta foco visible con :focus-visible')
if (!/@media\s*\(forced-colors:\s*active\)/.test(css)) failures.push('global.css: falta compatibilidad con forced-colors')

const appPressable = read('components/ui/AppPressable.tsx')
for (const pattern of [/forwardRef/, /focusable/, /accessibilityLabel/]) {
  if (!pattern.test(appPressable)) failures.push(`AppPressable.tsx: falta ${pattern}`)
}

for (const file of ['components/ui/RolePageHeader.tsx', 'components/ui/mobile/MobileHeader.tsx', 'components/ui/mobile/MobileSectionHeader.tsx']) {
  const source = read(file)
  if (!/maxFontSizeMultiplier=\{2\}/.test(source)) failures.push(`${file}: no admite escala de fuente hasta 200%`)
  if (/numberOfLines=\{1\}/.test(source)) failures.push(`${file}: fuerza títulos esenciales a una sola línea`)
}

if (failures.length > 0) {
  console.error('Auditoría de accesibilidad y responsive fallida:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log('Auditoría de accesibilidad y responsive superada.')
  console.log(`Pantallas prioritarias revisadas: ${priorityScreens.length}`)
  console.log('Breakpoints: mobile <600, tablet 600–1023, desktop 1024–1439, wide >=1440.')
  console.log('Vista galáctica y vista lista accesible disponibles.')
}
