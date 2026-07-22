import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('student history actions navigate to the real teacher history route', () => {
  const students = read('app/(teacher)/students.tsx')
  const table = read('components/teacher/students/TeacherStudentsDesktop.tsx')
  assert.match(students, /pathname: '\/\(teacher\)\/student\/\[id\]\/history'/)
  assert.doesNotMatch(students, /Puedes conectar esta acción con una pantalla de historial/)
  assert.match(table, /label="Ver historial"/)
})

test('teacher student selectors use explicit themed borders', () => {
  const list = read('components/teacher/students/TeacherStudentList.tsx')
  assert.match(list, /borderWidth: 1/)
  assert.match(list, /borderColor: tokens\.border\.default/)
})

test('teacher audit exposes the requested categories and a useful empty state', () => {
  const audit = read('app/(teacher)/audit.tsx')
  assert.match(audit, /label: 'Alumnos'/)
  assert.match(audit, /label: 'Cursos'/)
  assert.match(audit, /label: 'Preguntas'/)
  assert.match(audit, /label: 'Perfil'/)
  assert.match(audit, /label: 'Códigos'/)
  assert.doesNotMatch(audit, /id: 'topic'/)
  assert.match(audit, /allLogsTotal === 0/)
})

test('teacher profile prioritizes impact and provides four quick accesses', () => {
  const profile = read('app/(teacher)/profile.tsx')
  assert.match(profile, /Accesos docentes/)
  assert.match(profile, /Crear pregunta/)
  assert.match(profile, /Importar alumnos/)
  assert.match(profile, /Revisar alumnos/)
  assert.match(profile, /Configurar perfil/)
  assert.match(profile, /activeStudents/)
})

test('teacher notifications use teacher categories and priority summaries', () => {
  const notifications = read('app/(teacher)/notifications.tsx')
  assert.match(notifications, /label: 'Revisión'/)
  assert.match(notifications, /label: 'Auditoría'/)
  assert.match(notifications, /Pendientes de revisar/)
  assert.match(notifications, /Sin actividad/)
  assert.match(notifications, /Acciones sensibles/)
})
