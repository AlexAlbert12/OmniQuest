import { getStatusMeta } from '../../components/teacher/students/studentUtils'
import type { XlsxCell, XlsxSheet } from '../../lib/xlsxWriter'
import { sortOptions, statusFilterOptions, type StudentRow, type StudentSortKey, type StudentStatusFilter } from './types'

export type TeacherStudentsExportKind = 'selection' | 'no_activity'

export type TeacherStudentsExportContext = {
  subjectName: string | null
  classroomName: string | null
  scopeLabel: string
  scoreScopeLabel: string
  status: StudentStatusFilter
  sort: StudentSortKey
  search: string
  exportedAt: Date
  kind: TeacherStudentsExportKind
}

export type TeacherStudentExportRow = {
  student: string
  status: string
  accuracy: number | null
  participation: number | null
  answeredQuestions: number
  scopeScore: number
  totalXp: number
  lastActivity: Date | null
  courses: string
  classrooms: string
}

export function buildTeacherStudentExportRows(students: StudentRow[]): TeacherStudentExportRow[] {
  return students.map((student) => ({
    student: student.alias,
    status: getStatusMeta(student.status).label,
    accuracy: student.hasActivity && student.questions > 0 ? toPercentFraction(student.accuracyPercent) : null,
    participation: toPercentFraction(student.participation),
    answeredQuestions: finiteNumber(student.questions) ?? 0,
    scopeScore: finiteNumber(student.subjectScore) ?? 0,
    totalXp: finiteNumber(student.globalPoints) ?? 0,
    lastActivity: parseOptionalDate(student.lastActivityAt),
    courses: student.subjectNames.join(' · '),
    classrooms: student.classroomNames.join(' · '),
  }))
}

export function getTeacherStudentExportHeaders(context: TeacherStudentsExportContext) {
  return [
    'Alumno',
    'Estado',
    'Precisión',
    'Participación',
    'Preguntas respondidas',
    context.scoreScopeLabel,
    'XP total',
    'Última actividad',
    'Cursos',
    'Clases',
  ]
}

export function buildTeacherStudentsSheet(students: StudentRow[], context: TeacherStudentsExportContext): XlsxSheet {
  const exportRows = buildTeacherStudentExportRows(students)
  const headers = getTeacherStudentExportHeaders(context)
  const rows: XlsxCell[][] = [[text('OmniQuest — Informe de alumnos', 'title'), ...Array.from({ length: headers.length - 1 }, blank)]]
  const merges = [`A1:${columnName(headers.length)}1`]

  appendMetadataRow(rows, merges, headers.length, 'Ámbito', context.scopeLabel)
  appendMetadataRow(rows, merges, headers.length, 'Estado', getStatusFilterLabel(context.status))
  appendMetadataRow(rows, merges, headers.length, 'Fecha de exportación', context.exportedAt, 'date')
  appendMetadataRow(rows, merges, headers.length, 'Alumnos exportados', students.length, 'integer')
  if (context.search.trim()) appendMetadataRow(rows, merges, headers.length, 'Búsqueda', context.search.trim())
  appendMetadataRow(rows, merges, headers.length, 'Ordenación', getSortLabel(context.sort))
  rows.push(headers.map(() => blank()))

  const headerRow = rows.length + 1
  rows.push(headers.map((header) => text(header, 'header')))
  for (const item of exportRows) {
    rows.push([
      text(item.student, 'wrap'),
      text(item.status, 'border'),
      percent(item.accuracy),
      percent(item.participation),
      integer(item.answeredQuestions),
      integer(item.scopeScore),
      integer(item.totalXp),
      date(item.lastActivity, 'date'),
      text(item.courses, 'wrap'),
      text(item.classrooms, 'wrap'),
    ])
  }

  return {
    name: 'Alumnos',
    rows,
    columnWidths: [28, 20, 14, 15, 22, 28, 14, 18, 42, 34],
    freezeRows: headerRow,
    autoFilter: { fromRow: headerRow, toRow: rows.length, toColumn: headers.length },
    merges,
  }
}

export function getStatusFilterLabel(status: StudentStatusFilter) {
  return statusFilterOptions.find((option) => option.value === status)?.label || 'Todos'
}

export function getSortLabel(sort: StudentSortKey) {
  return sortOptions.find((option) => option.value === sort)?.label || 'Necesitan atención'
}

function appendMetadataRow(rows: XlsxCell[][], merges: string[], columnCount: number, label: string, value: string | number | Date, valueStyle: XlsxCell['style'] = 'wrap') {
  const rowNumber = rows.length + 1
  rows.push([text(label, 'label'), { value, style: valueStyle }, ...Array.from({ length: Math.max(0, columnCount - 2) }, blank)])
  if (columnCount > 2) merges.push(`B${rowNumber}:${columnName(columnCount)}${rowNumber}`)
}

function finiteNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toPercentFraction(value: number | null | undefined) {
  const numeric = finiteNumber(value)
  return numeric === null ? null : numeric / 100
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function text(value: string, style: XlsxCell['style'] = 'border'): XlsxCell { return { value, style } }
function blank(): XlsxCell { return { value: null } }
function integer(value: number | null | undefined): XlsxCell { return { value: finiteNumber(value), style: 'integer' } }
function percent(value: number | null | undefined): XlsxCell { return { value: finiteNumber(value), style: 'percent' } }
function date(value: Date | null, style: 'date' | 'datetime'): XlsxCell { return { value, style } }

function columnName(index: number) {
  let value = index
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name || 'A'
}
