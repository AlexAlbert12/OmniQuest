import { buildTeacherStudentExportRows, buildTeacherStudentsSheet, getTeacherStudentExportHeaders, type TeacherStudentsExportContext } from '../../../../features/teacher-students/exportModel'
import type { StudentRow } from '../../../../features/teacher-students/types'

function createContext(overrides: Partial<TeacherStudentsExportContext> = {}): TeacherStudentsExportContext {
  return {
    subjectName: 'Matemáticas',
    classroomName: 'Clase principal',
    scopeLabel: 'Matemáticas · Clase principal',
    scoreScopeLabel: 'Puntuación en Matemáticas · Clase principal',
    status: 'all',
    sort: 'attention',
    search: '',
    exportedAt: new Date(2026, 8, 12, 17, 30),
    kind: 'selection',
    ...overrides,
  }
}

function createStudent(overrides: Partial<StudentRow> = {}): StudentRow {
  return {
    id: 'bbcd1c8f-580f-48df-804f-619b40dd1b8a',
    alias: 'Lucía Martín',
    avatar: null,
    handle: '@luciamartin',
    globalPoints: 1472,
    subjectScore: 280,
    averageScore: 3.4,
    accuracyPercent: 34,
    challenges: 13,
    questions: 13,
    participation: 87,
    progress: 87,
    status: 'needs_help',
    hasActivity: true,
    subjectIds: [1],
    subjectNames: ['Matemáticas'],
    classroomIds: [10],
    classroomNames: ['Clase principal'],
    courseContexts: [],
    weakAreas: [],
    recentAttempts: [],
    lastActivityAt: '2026-09-09T12:00:00.000Z',
    importedAt: '2026-07-01T08:00:00.000Z',
    ...overrides,
  }
}

describe('teacher student export model', () => {
  test('exports teacher-facing columns without UUIDs and translates statuses', () => {
    const context = createContext()
    const headers = getTeacherStudentExportHeaders(context)
    const rows = buildTeacherStudentExportRows([createStudent()])

    expect(headers[0]).toBe('Alumno')
    expect(headers).toEqual([
      'Alumno',
      'Estado',
      'Precisión',
      'Participación',
      'Preguntas respondidas',
      'Puntuación en Matemáticas · Clase principal',
      'XP total',
      'Última actividad',
      'Cursos',
      'Clases',
    ])
    expect(rows[0]).toEqual(expect.objectContaining({
      student: 'Lucía Martín',
      status: 'Necesita apoyo',
      accuracy: 0.34,
      participation: 0.87,
      answeredQuestions: 13,
      scopeScore: 280,
      totalXp: 1472,
      courses: 'Matemáticas',
      classrooms: 'Clase principal',
    }))
    expect(JSON.stringify(rows[0])).not.toContain('bbcd1c8f')
  })

  test('leaves accuracy empty when there are no answered questions while participation stays numeric', () => {
    const [row] = buildTeacherStudentExportRows([createStudent({
      alias: 'Adrián Torres',
      status: 'no_activity',
      hasActivity: false,
      questions: 0,
      accuracyPercent: 0,
      participation: 0,
      globalPoints: 0,
      subjectScore: 0,
      lastActivityAt: null,
    })])

    expect(row.status).toBe('Sin actividad')
    expect(row.accuracy).toBeNull()
    expect(row.participation).toBe(0)
    expect(row.lastActivity).toBeNull()
  })

  test('builds a contextual sheet with numeric percentages, real dates, filters and frozen headers', () => {
    const sheet = buildTeacherStudentsSheet([createStudent()], createContext({ search: 'Lucía', sort: 'accuracy' }))
    const headerRowIndex = sheet.rows.findIndex((row) => row[0]?.value === 'Alumno')
    const dataRow = sheet.rows[headerRowIndex + 1]

    expect(sheet.name).toBe('Alumnos')
    expect(sheet.freezeRows).toBe(headerRowIndex + 1)
    expect(sheet.autoFilter).toEqual({ fromRow: headerRowIndex + 1, toRow: sheet.rows.length, toColumn: 10 })
    expect(sheet.merges).toContain('A1:J1')
    expect(sheet.rows.some((row) => row[0]?.value === 'Ámbito' && row[1]?.value === 'Matemáticas · Clase principal')).toBe(true)
    expect(sheet.rows.some((row) => row[0]?.value === 'Búsqueda' && row[1]?.value === 'Lucía')).toBe(true)
    expect(dataRow[2]).toEqual({ value: 0.34, style: 'percent' })
    expect(dataRow[3]).toEqual({ value: 0.87, style: 'percent' })
    expect(dataRow[5]).toEqual({ value: 280, style: 'integer' })
    expect(dataRow[6]).toEqual({ value: 1472, style: 'integer' })
    expect(dataRow[7]?.value).toBeInstanceOf(Date)
  })
})
