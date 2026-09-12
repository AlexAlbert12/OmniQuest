import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher student export uses the shared real-XLSX infrastructure and keeps CSV formula protection', () => {
  const controller = read('features/teacher-students/useTeacherStudentsController.ts')
  const exporter = read('features/teacher-students/export.ts')
  const model = read('features/teacher-students/exportModel.ts')
  const reports = read('lib/reportExports.ts')

  assert.match(controller, /exportTeacherStudentsXlsx/)
  assert.doesNotMatch(controller, /new Blob\(|\.csv`|text\/csv/)
  assert.match(controller, /La descarga del informe de alumnos está disponible desde la versión web\./)
  assert.match(exporter, /buildXlsxWorkbook/)
  assert.match(exporter, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/)
  assert.match(exporter, /buildCsv\(getTeacherStudentExportHeaders/)
  assert.match(reports, /\^\[=\+@-\]/)
  assert.match(model, /name: 'Alumnos'/)
  assert.match(model, /autoFilter:/)
  assert.match(model, /freezeRows: headerRow/)
})

test('teacher student export is teacher-facing, contextual and never exports internal IDs', () => {
  const model = read('features/teacher-students/exportModel.ts')
  const controller = read('features/teacher-students/useTeacherStudentsController.ts')

  assert.match(model, /'Alumno'/)
  assert.match(model, /'Estado'/)
  assert.match(model, /'Precisión'/)
  assert.match(model, /'Participación'/)
  assert.match(model, /'Preguntas respondidas'/)
  assert.match(model, /'XP total'/)
  assert.match(model, /'Última actividad'/)
  assert.match(model, /getStatusMeta\(student\.status\)\.label/)
  assert.doesNotMatch(model, /student\.id/)
  assert.match(model, /student\.hasActivity && student\.questions > 0 \? toPercentFraction\(student\.accuracyPercent\) : null/)
  assert.match(model, /student\.subjectNames\.join\(' · '\)/)
  assert.match(model, /student\.classroomNames\.join\(' · '\)/)
  assert.match(controller, /scoreScopeLabel: xpScopeLabel/)
  assert.match(controller, /Puntuación en cursos seleccionados/)
})

test('teacher student export keeps the whole server-filtered selection and preserves order', () => {
  const controller = read('features/teacher-students/useTeacherStudentsController.ts')
  const exporterModel = read('features/teacher-students/exportModel.ts')

  assert.match(controller, /const batchSize = 100/)
  assert.match(controller, /status: statusOverride \|\| directory\.selectedStatus/)
  assert.match(controller, /search: directory\.search\.trim\(\)/)
  assert.match(controller, /order: directory\.selectedSort/)
  assert.match(controller, /pageSize: batchSize/)
  assert.doesNotMatch(exporterModel, /\.sort\(/)
})
