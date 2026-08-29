import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher home priority headline is concise and never line-clamped', () => {
  const priorities = read('components/teacher/home/TeacherHomePriorities.tsx')
  assert.match(priorities, />Empieza por lo pendiente<\/Text>/)
  assert.doesNotMatch(priorities, /Hola, \{teacherAlias\}\. Empieza por lo pendiente/)
  assert.doesNotMatch(priorities, /numberOfLines=\{2\}>Empieza por lo pendiente/)
})

test('teacher dashboard places review work before recent activity on mobile and fills the desktop left column', () => {
  const screen = read('features/teacher-dashboard/screen.tsx')
  const courses = screen.indexOf('title="Cursos recientes"')
  const questions = screen.indexOf('title="Preguntas a revisar"')
  const activity = screen.indexOf('title="Actividad reciente"')
  assert.ok(courses >= 0 && questions > courses && activity > questions)
  assert.match(screen, /flex-\[1\.5\] gap-6/)
  assert.match(screen, /mobileTitle="Inicio"/)
  assert.doesNotMatch(screen, /subtitle=/)
})

test('teacher home keeps category colours informational and uses cyan for routine actions', () => {
  const priorities = read('components/teacher/home/TeacherHomePriorities.tsx')
  const sections = read('components/teacher/home/TeacherDashboardSections.tsx')
  assert.match(priorities, /text-brand-teacher">\{item\.actionLabel\}/)
  assert.match(priorities, /name="arrow-forward" size=\{18\} color="#09ACF4"/)
  assert.doesNotMatch(sections, /bg-semantic-surface-danger px-3 py-2[\s\S]{0,160}>Editar</)
  assert.match(sections, /border-border-active bg-surface-selected px-3 py-2/)
  assert.match(sections, /text-brand-teacher">Editar<\/Text>/)
})

test('pending recent activity uses a review-time icon and secondary detail is one line', () => {
  const sections = read('components/teacher/home/TeacherDashboardSections.tsx')
  assert.match(sections, /pendingReview \? 'time-outline'/)
  assert.match(sections, /incorrect \? '#FB7185'/)
  assert.match(sections, /numberOfLines=\{1\}>\{detail\}<\/Text>/)
})

test('teacher student taxonomy is consistently Alumnos in primary navigation and directory UI', () => {
  const sidebar = read('components/teacher/TeacherSidebar.tsx')
  const students = read('features/teacher-students/screen.tsx')
  const desktop = read('components/teacher/students/TeacherStudentsDesktop.tsx')
  const mobile = read('components/teacher/students/MobileTeacherStudents.tsx')
  assert.match(sidebar, /label: 'Alumnos'/)
  assert.doesNotMatch(sidebar, /label: 'Estudiantes'/)
  assert.match(students, /title="Alumnos"/)
  assert.match(students, /Total alumnos/)
  assert.match(students, /Buscar alumno, curso o clase/)
  assert.match(desktop, /Tabla de alumnos/)
  assert.match(mobile, /Alumnos de la página/)
})
