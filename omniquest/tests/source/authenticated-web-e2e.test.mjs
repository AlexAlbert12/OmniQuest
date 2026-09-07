import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const repositoryRoot = dirname(root)
const readRepository = (path) => readFileSync(join(repositoryRoot, path), 'utf8')
const specifications = [
  'e2e/web/student-authenticated.spec.ts',
  'e2e/web/teacher-authenticated.spec.ts',
  'e2e/web/admin-authenticated.spec.ts',
]

const requiredEnvironment = [
  'E2E_STUDENT_EMAIL',
  'E2E_STUDENT_PASSWORD',
  'E2E_TEACHER_EMAIL',
  'E2E_TEACHER_PASSWORD',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
]

test('authenticated web E2E specifications cover each role with Supabase-backed assertions', () => {
  for (const path of specifications) {
    const source = read(path)
    assert.match(source, /loginAs\(page, '(?:student|teacher|admin)'\)/, `${path} must log in through the user interface`)
    assert.match(source, /(?:supabaseSelect|supabaseRpc)\</, `${path} must query authenticated Supabase data directly`)
    assert.match(source, /readSupabaseJson</, `${path} must assert an application Supabase response`)
    assert.doesNotMatch(source, /password\s*:\s*['"`]/i, `${path} must not contain a password literal`)
  }

  const student = read(specifications[0])
  const teacher = read(specifications[1])
  const admin = read(specifications[2])
  assert.match(student, /getByTestId\('student-nav-classes'\)/)
  assert.match(student, /getByTestId\(`student-course-\$\{subjectId\}-\$\{classroomId\}`\)/)
  assert.match(student, /locator\('\[data-testid\^="student-topic-"\]'\)/)
  assert.match(student, /DEMO_FALLBACK_COURSE/)
  assert.match(student, /getByTestId\('game-question-prompt'\)/)
  assert.match(student, /toHaveText\(visibleQuestion\.text\)/)
  assert.match(teacher, /\?\? coursesPage\.items\[0\]/)
  assert.ok(teacher.includes("getByRole('heading', { name: /^Cursos(?: y clases)?$/ })"), 'teacher catalog heading must follow the responsive title')
  assert.match(read('app/(student)/play/[id].tsx'), /testID="game-question-prompt"/)
  assert.ok(student.includes('new RegExp(`/class/${subjectId}(?:\\\\?|$)`)'), 'student course URL matcher must escape the query delimiter')
  assert.match(student, /get_safe_game_questions/)
  assert.match(student, /start_game_attempt/)
  assert.match(teacher, /get_teacher_courses_page/)
  assert.match(teacher, /get_teacher_subject_overview/)
  assert.match(teacher, /getByRole\('tab', \{ name: 'Preguntas', exact: true \}\)/)
  assert.match(teacher, /get_teacher_subject_questions_page/)
  assert.match(teacher, /getByRole\('button', \{ name: 'Añadir pregunta', exact: true \}\)/)
  assert.match(admin, /get_admin_profiles_page/)
  assert.match(admin, /getByTestId\('admin-nav-audit'\)/)
  assert.match(admin, /verify_admin_audit_chain/)
})

test('authenticated E2E credentials come exclusively from the six required environment variables', () => {
  const helper = read('e2e/web/authenticated.helpers.ts')
  const setup = read('e2e/web/global-setup.ts')
  const fixture = read('scripts/prepare-authenticated-e2e.mjs')

  for (const name of requiredEnvironment) assert.match(helper, new RegExp(name))
  assert.match(fixture, /onboarding_version/)
  assert.match(fixture, /onboarding_completed_at/)
  assert.match(fixture, /readAccount\('student'/)
  assert.match(fixture, /readAccount\('teacher'/)
  assert.match(fixture, /readAccount\('admin'/)
  assert.match(fixture, /requireEnvironment\(`\$\{prefix\}_EMAIL`\)/)
  assert.match(helper, /process\.env\[name\]/)
  assert.match(fixture, /requireEnvironment\(`\$\{prefix\}_PASSWORD`\)/)
  assert.match(fixture, /loadLocalSupabaseEnvironment\(\)/)
  assert.doesNotMatch(fixture, /(?:student|teacher|admin)[^\n]{0,60}password\s*:\s*['"`]/i)
  assert.match(setup, /prepare-authenticated-e2e\.mjs/)
  assert.match(setup, /La configuración E2E autenticada está incompleta/)
})

test('authenticated Supabase assertions reuse the JWT returned by the UI login', () => {
  const helper = read('e2e/web/authenticated.helpers.ts')
  assert.match(helper, /access_token/)
  assert.match(helper, /tokenResponse\.request\(\)\.headers\(\)\.apikey/)
  assert.match(helper, /Authorization: `Bearer \$\{session\.accessToken\}`/)
  assert.match(helper, /page\.request\.get/)
  assert.match(helper, /page\.request\.post/)
  assert.match(helper, /clickRoleNavigation/)

  const studentSidebar = read('components/student/StudentSidebar.tsx')
  const studentBottomNav = read('components/student/StudentBottomNav.tsx')
  const adminScaffold = read('components/admin/shared/AdminScaffold.tsx')
  const adminBottomNav = read('components/admin/AdminBottomNav.tsx')
  const studentClasses = read('app/(student)/classes.tsx')
  assert.match(studentSidebar, /student-nav-classes/)
  assert.match(studentBottomNav, /student-nav-classes/)
  assert.match(adminScaffold, /admin-nav-\$\{item\.section\}/)
  assert.match(adminBottomNav, /admin-nav-audit/)
  assert.match(studentClasses, /student-course-\$\{subject\.id\}-\$\{subject\.classroom_id \?\? 'all'\}/)
})

test('Playwright runs authenticated E2E in desktop and mobile Chromium with deterministic setup', () => {
  const config = read('playwright.config.ts')
  const server = read('scripts/start-playwright-web.mjs')
  const packageJson = read('package.json')
  const workflow = readRepository('.github/workflows/quality.yml')

  assert.match(config, /globalSetup: '\.\/e2e\/web\/global-setup\.ts'/)
  assert.match(config, /process\.platform === 'win32'/)
  assert.match(config, /System32/)
  assert.match(config, /process\.env\.PATH =/)
  assert.match(config, /name: 'chromium-desktop'/)
  assert.match(config, /name: 'chromium-mobile'/)
  assert.match(config, /devices\['Desktop Chrome'\]/)
  assert.match(config, /devices\['Pixel 7'\]/)
  assert.match(config, /PLAYWRIGHT_PORT \|\| 8082/)
  assert.match(config, /PLAYWRIGHT_REUSE_EXISTING_SERVER === '1'/)
  assert.match(config, /reuseExistingServer,/)
  assert.doesNotMatch(config, /reuseExistingServer: !process\.env\.CI/)
  assert.match(config, /locale: 'es-ES'/)
  assert.match(read('e2e/web/authenticated.helpers.ts'), /localStorage\.setItem\('omniquest:locale', 'es-ES'\)/)
  assert.match(config, /command: 'node scripts\/start-playwright-web\.mjs'/)
  assert.match(config, /timeout: 360_000/)
  assert.match(server, /assertPortAvailable\(port\)/)
  assert.match(server, /El puerto \$\{value\} está ocupado/)
  assert.match(server, /BROWSER: 'none'/)
  assert.match(server, /require\.resolve\('expo\/bin\/cli'\)/)
  assert.match(server, /spawn\(process\.execPath/)
  assert.doesNotMatch(server, /npx\.cmd/)
  assert.match(server, /let stopping = false/)
  assert.match(server, /if \(stopping\) \{[\s\S]*process\.exitCode = 0/)
  assert.doesNotMatch(server, /process\.kill\(process\.pid, signal\)/)
  assert.match(server, /PLAYWRIGHT_CLEAR_CACHE === '1'/)
  assert.match(server, /loadLocalSupabaseEnvironment\(\)/)
  assert.match(server, /EXPO_PUBLIC_SUPABASE_URL = url/)
  assert.match(server, /EXPO_PUBLIC_SUPABASE_ANON_KEY = anonKey/)
  assert.match(packageJson, /"e2e:web-server": "node scripts\/start-playwright-web\.mjs"/)
  assert.match(packageJson, /"e2e:prepare": "node scripts\/prepare-authenticated-e2e\.mjs"/)
  assert.match(workflow, /PLAYWRIGHT_PORT: 8082/)
  assert.match(workflow, /Configure authenticated E2E accounts/)
  for (const name of requiredEnvironment) assert.match(workflow, new RegExp(name))
  assert.match(workflow, /npx playwright install --with-deps chromium/)
  assert.match(workflow, /npm run test:e2e/)
  assert.doesNotMatch(workflow, /supabase\/setup-cli@/)
})
