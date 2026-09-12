import { buildCsv, exportBinaryFile, formatExportDate, slugifyFilename } from '../../lib/reportExports'
import { buildXlsxWorkbook } from '../../lib/xlsxWriter'
import type { StudentRow } from './types'
import { buildTeacherStudentExportRows, buildTeacherStudentsSheet, getTeacherStudentExportHeaders, type TeacherStudentsExportContext } from './exportModel'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function exportTeacherStudentsXlsx(students: StudentRow[], context: TeacherStudentsExportContext) {
  const sheet = buildTeacherStudentsSheet(students, context)
  const binary = buildXlsxWorkbook([sheet])
  const filename = buildTeacherStudentsFilename(context)
  const exported = await exportBinaryFile(filename, binary, XLSX_MIME)
  if (!exported) throw new Error('No se pudo abrir el sistema de descarga del informe de alumnos.')
  return { filename, count: students.length }
}

export function buildTeacherStudentsCsv(students: StudentRow[], context: TeacherStudentsExportContext) {
  const rows = buildTeacherStudentExportRows(students)
  return buildCsv(getTeacherStudentExportHeaders(context), rows.map((row) => [
    row.student,
    row.status,
    formatCsvPercent(row.accuracy),
    formatCsvPercent(row.participation),
    row.answeredQuestions,
    row.scopeScore,
    row.totalXp,
    row.lastActivity ? formatExportDate(row.lastActivity.toISOString()) : '',
    row.courses,
    row.classrooms,
  ]))
}

export function buildTeacherStudentsFilename(context: TeacherStudentsExportContext) {
  const parts = ['OmniQuest', 'Alumnos']
  if (context.kind === 'no_activity') parts.push('Sin-actividad')
  if (context.subjectName) parts.push(slugifyFilename(context.subjectName))
  if (context.classroomName) parts.push(slugifyFilename(context.classroomName))
  if (!context.subjectName && !context.classroomName && context.kind === 'selection') parts.push('Seleccion')
  const date = context.exportedAt
  const dateLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return `${parts.join('_')}_${dateLabel}.xlsx`
}

function formatCsvPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return ''
  return `${(value * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`
}
