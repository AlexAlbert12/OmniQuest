import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher student priorities and status counts come from the server scope instead of the current page', () => {
  const hook = read('features/teacher-students/useTeacherStudentsPage.ts')
  const model = read('features/teacher-students/model.ts')
  const migration = read('supabase/migrations/20260810170000_teacher_students_directory_consistency.sql')

  assert.match(hook, /setAttention\(payload\.attention \|\| \[\]\)/)
  assert.match(hook, /setPending\(payload\.pending \|\| \[\]\)/)
  assert.match(model, /needsAttention: attention/)
  assert.match(model, /pendingStudents: pending/)
  assert.doesNotMatch(model, /needsAttention: students\.filter/)
  assert.match(migration, /v_status = 'attention'/)
  assert.match(migration, /'needsHelp'.*status = 'needs_help'/s)
  assert.match(migration, /'inactive'.*status = 'inactive'/s)
  assert.match(migration, /'attention'.*status in \('needs_help', 'inactive'\)/s)
  assert.match(migration, /preview_rows as/)
  assert.match(migration, /from searched[\s\S]*status in \('needs_help', 'inactive'\)[\s\S]*limit 4/)
})

test('mobile teacher student filters are explicit selectors and expose every status consistently', () => {
  const mobile = read('components/teacher/students/MobileTeacherStudents.tsx')
  const types = read('components/teacher/students/types.ts')

  assert.match(types, /StudentStatusFilter = 'all' \| 'attention' \| StudentStatus/)
  assert.match(types, /value: 'attention', label: 'Necesitan atención'/)
  assert.match(mobile, /AppDropdown<StudentStatusFilter>/)
  assert.match(mobile, /AppDropdown<StudentSortKey>/)
  assert.match(mobile, /AppDropdown<number \| 'all'> label="Curso"/)
  assert.match(mobile, /AppDropdown<number \| 'all'> label="Clase"/)
  assert.doesNotMatch(mobile, /getNextStringOption/)
  assert.doesNotMatch(mobile, /Cambia a la siguiente opción disponible/)
  assert.match(mobile, /if \(status === 'attention'\) return stats\.attention/)
  assert.match(mobile, /if \(status === 'needs_help'\) return stats\.needsHelp/)
  assert.match(mobile, /if \(status === 'inactive'\) return stats\.inactive/)
  assert.match(mobile, /if \(status === 'excellent'\) return stats\.excellent/)
})

test('student metrics distinguish XP scope, attempts and accuracy equivalence', () => {
  const modal = read('components/teacher/students/StudentModals.tsx')
  const desktop = read('components/teacher/students/TeacherStudentsDesktop.tsx')
  const controller = read('features/teacher-students/useTeacherStudentsController.ts')

  assert.match(desktop, /label="XP global"/)
  assert.match(desktop, /label="Intentos"/)
  assert.match(desktop, /label="Preguntas respondidas"/)
  assert.match(desktop, /label="Equivalencia \/10"/)
  assert.match(modal, /label="Intentos"/)
  assert.match(modal, /label="Preguntas respondidas"/)
  assert.match(modal, /label=\{xpLabel\}/)
  assert.match(modal, /label="Equivalencia \/10"/)
  assert.match(controller, /XP en cursos seleccionados/)
})

test('no-activity bulk actions operate on the whole server-filtered selection', () => {
  const controller = read('features/teacher-students/useTeacherStudentsController.ts')
  const mobile = read('components/teacher/students/MobileTeacherStudents.tsx')

  assert.match(controller, /loadAllStudents\('no_activity'\)/)
  assert.match(controller, /pageSize: batchSize/)
  assert.match(controller, /exportStudents\('no_activity'\)/)
  assert.match(mobile, /count=\{stats\.noActivity\}/)
  assert.match(mobile, /Exportar sin actividad/)
  assert.match(mobile, /Recordar a \$\{count\}/)
  assert.doesNotMatch(controller, /Sin pendientes en esta página/)
})

test('student progress reset and reminders preserve the selected classroom scope', () => {
  const api = read('features/teacher-students/api.ts')
  const controller = read('features/teacher-students/useTeacherStudentsController.ts')
  const resetFunction = read('supabase/functions/teacher-reset-student-progress/index.ts')
  const reminderFunction = read('supabase/functions/teacher-student-reminder/index.ts')

  assert.match(api, /resetStudentProgress\(student: StudentRow, classroomId:/)
  assert.match(api, /classroomId !== null \? \{ classroomId \}/)
  assert.match(controller, /resetStudentProgress\(student, selectedClassroomId\)/)
  assert.match(controller, /Se eliminarán las puntuaciones y los intentos de/)
  assert.match(resetFunction, /ensureClassroomInScope/)
  assert.match(reminderFunction, /requestedClassroomId/)
  assert.match(reminderFunction, /enrollmentQuery = enrollmentQuery\.eq\('classroom_id', requestedClassroomId\)/)
})

test('teacher student directory copy stays product-facing', () => {
  const screen = read('features/teacher-students/screen.tsx')
  const desktop = read('components/teacher/students/TeacherStudentsDesktop.tsx')
  const utils = read('components/teacher/students/studentUtils.ts')

  assert.match(screen, /Consulta y realiza el seguimiento de tus alumnos\./)
  assert.match(screen, /Alumnos en la selección actual/)
  assert.match(screen, /Consulta y gestiona los alumnos según los filtros seleccionados\./)
  assert.doesNotMatch(screen, /Calculado por la RPC/)
  assert.doesNotMatch(screen, /métricas calculadas en servidor/)
  assert.match(desktop, /Baja precisión o ausencia prolongada de actividad\./)
  assert.match(utils, /No registra actividad reciente desde hace más de 14 días\./)
})
