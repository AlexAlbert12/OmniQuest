import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('student history actions navigate to the real teacher history route', () => {
  const students = read('features/teacher-students/screen.tsx')
  const navigation = read('features/teacher-students/model.ts') + read('features/teacher-students/useTeacherStudentsController.ts')
  const table = read('components/teacher/students/TeacherStudentsDesktop.tsx')
  assert.match(navigation, /pathname: '\/\(teacher\)\/student\/\[id\]\/history'/)
  assert.doesNotMatch(students + navigation, /Puedes conectar esta acción con una pantalla de historial/)
  assert.match(table, /label="Ver historial"/)
})

test('teacher student selectors use explicit themed borders', () => {
  const list = read('components/teacher/students/TeacherStudentList.tsx')
  assert.match(list, /borderWidth: 1/)
  assert.match(list, /borderColor: tokens\.border\.default/)
})

test('teacher audit exposes the requested categories and a useful empty state', () => {
  const audit = read('app/(teacher)/audit.tsx') + read('components/teacher/audit/TeacherAuditFilters.tsx') + read('components/teacher/audit/TeacherAuditTimeline.tsx')
  assert.match(audit, /label: 'Alumnos'/)
  assert.match(audit, /label: 'Cursos'/)
  assert.match(audit, /label: 'Preguntas'/)
  assert.match(audit, /label: 'Perfil'/)
  assert.match(audit, /label: 'Códigos'/)
  assert.doesNotMatch(audit, /id: 'topic'/)
  assert.match(audit, /No hay eventos con los filtros seleccionados/)
})

test('teacher profile keeps one profile editor and focused teacher shortcuts', () => {
  const profile = read('app/(teacher)/profile.tsx')
  const hero = read('components/teacher/profile/TeacherProfileHero.tsx')
  assert.match(profile, /Accesos docentes/)
  assert.match(profile, /Accede rápidamente a las tareas habituales\./)
  assert.match(profile, /Crear pregunta/)
  assert.match(profile, /Importar alumnos/)
  assert.match(profile, /Revisar respuestas/)
  assert.match(profile, /Revisar alumnos/)
  assert.match(profile, /Auditoría/)
  assert.doesNotMatch(profile, /label=\{responsive\.isDesktop \? 'Ajustes'/)
  assert.doesNotMatch(profile, /Configurar perfil/)
  assert.doesNotMatch(profile, /activeStudents/)
  assert.match(hero, /label="Editar perfil"/)
  assert.match(hero, /label="Seguridad"/)
})

test('teacher notifications use teacher categories and priority summaries', () => {
  const notifications = read('app/(teacher)/notifications.tsx')
  assert.match(notifications, /label: 'Revisión'/)
  assert.match(notifications, /label: 'Auditoría'/)
  assert.match(notifications, /Pendientes de revisar/)
  assert.match(notifications, /Sin actividad/)
  assert.match(notifications, /Alertas de auditoría/)
})
