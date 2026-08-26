import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher catalog keeps one desktop create CTA and a contextual mobile action', () => {
  const screen = read('features/teacher-catalog/screen.tsx')
  assert.match(screen, /actions=\{isDesktop \? <AppButton label="Crear curso"/)
  assert.match(screen, /ListFooterComponent=\{<PaginationControls/)
  assert.equal((screen.match(/<CreateCourseCTA/g) || []).length, 1)
  assert.match(screen, /!isDesktop \? <CreateCourseCTA[\s\S]*sticky/)
})

test('course participation keeps the same metric across breakpoints and routine navigation is not duplicated', () => {
  const screen = read('features/teacher-catalog/screen.tsx')
  const card = read('components/teacher/classes/TeacherCourseCard.tsx')
  assert.match(screen, />Participación<\/Text>/)
  assert.doesNotMatch(screen, />Estado<\/Text>/)
  assert.match(card, /\{participation\}% participación/)
  assert.doesNotMatch(card, /\{participation\}% activo/)
  assert.doesNotMatch(card, />Gestionar<\/Text>/)
  assert.match(card, /accessibilityLabel=\{`Abrir curso \$\{course\.name\}`\}/)
})

test('class cards open the selected classroom context and say Abrir clase', () => {
  const card = read('components/teacher/classes/TeacherClassroomCard.tsx')
  const screen = read('app/(teacher)/subject/[id].tsx')
  const hook = read('features/teacher-subject/useTeacherSubjectDetail.ts')
  assert.match(card, /\?classroomId=\$\{classroom\.id\}/)
  assert.match(card, />Abrir clase<\/Text>/)
  assert.match(screen, /classroomId\?: string \| string\[\]/)
  assert.match(screen, /classroomId: params\.classroomId/)
  assert.match(hook, /requestedClassroomId = getPositiveNumberParam\(classroomId\)/)
})

test('teacher catalog mobile rails and sort copy are deliberate and tabs keep a restrained hover lift', () => {
  const screen = read('features/teacher-catalog/screen.tsx')
  const tabs = read('components/ui/AppTabs.tsx')
  const css = read('global.css')
  assert.match(screen, /compact mobileRail role="teacher"/)
  assert.match(read('features/teacher-catalog/types.ts'), /key: 'all', label: 'Todos'/)
  assert.match(screen, /<AppDropdown<TeacherCourseSort>/)
  assert.match(screen, /label: `Orden: \${item\.label}`/)
  assert.match(screen, /mobileTitle="Cursos"/)
  assert.doesNotMatch(screen, /matrículas/)
  assert.doesNotMatch(tabs, /className="omni-no-hover-lift"/)
  assert.match(css, /\[role='tab'\]:not\(\[aria-disabled='true'\]\):hover \{[\s\S]*?translateY\(-0\.5px\) scale\(1\.005\)/)
  assert.match(tabs, /paddingLeft: 8/)
})

test('teacher catalog product copy avoids implementation language and remains localizable', () => {
  const screen = read('features/teacher-catalog/screen.tsx')
  const catalog = read('lib/uiEnglishCatalog.ts')
  const i18n = read('lib/i18n.tsx')
  assert.match(screen, /Gestiona tus cursos, clases, alumnos y contenidos\./)
  assert.doesNotMatch(screen, /Resultados paginados y métricas agregadas en servidor/)
  assert.match(catalog, /"Gestiona tus cursos, clases, alumnos y contenidos\.": "Manage your courses, classes, students and content\."/)
  assert.match(catalog, /"Abrir clase": "Open class"/)
  assert.match(i18n, /\/\^Orden: \(.\+\)\$\//)
})
