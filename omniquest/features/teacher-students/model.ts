import { statusFilterOptions, type MobileStudentsStats, type StudentRow, type StudentStatusFilter } from './types'

export function parsePositiveNumberParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value
  const number = Number(raw)
  return Number.isFinite(number) && number > 0 ? number : null
}

export function parseStudentStatusParam(value?: string | string[]): StudentStatusFilter {
  const raw = Array.isArray(value) ? value[0] : value
  return statusFilterOptions.some((option) => option.value === raw) ? raw as StudentStatusFilter : 'all'
}

export function buildTeacherStudentPageView(students: StudentRow[], summary: MobileStudentsStats, attention: StudentRow[], pending: StudentRow[]) {
  return {
    needsAttention: attention,
    pendingStudents: pending,
    pagePendingStudents: students.filter((student) => student.status === 'no_activity'),
    stats: { ...summary },
  }
}

export function buildStudentHistoryRoute(student: StudentRow, subjectId: number | 'all', classroomId: number | 'all') {
  return {
    pathname: '/(teacher)/student/[id]/history',
    params: {
      id: student.id,
      ...(subjectId !== 'all' ? { subjectId: String(subjectId) } : {}),
      ...(classroomId !== 'all' ? { classroomId: String(classroomId) } : {}),
    },
  }
}

export function buildStudentActivityRoute(student: StudentRow, selectedSubjectId: number | 'all', selectedClassroomId: number | 'all') {
  const subjectId = selectedSubjectId !== 'all' ? selectedSubjectId : student.subjectIds[0]
  const classroomId = selectedClassroomId !== 'all' ? selectedClassroomId : student.classroomIds[0]
  if (!subjectId) return null
  return {
    pathname: '/(teacher)/subject/add-question',
    params: { subjectId: String(subjectId), ...(classroomId ? { classroomId: String(classroomId) } : {}) },
  }
}

