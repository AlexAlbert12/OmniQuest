import { callTeacherRpc, type TeacherStudentsPagePayload } from '../../lib/teacherServerData'
import { supabase } from '../../lib/supabase'
import type { StudentRow, StudentSortKey, StudentStatusFilter, TeacherActionResult } from './types'

export function fetchTeacherStudentsPage({ subjectId, classroomId, status, search, order, page, pageSize }: {
  subjectId: number | 'all'
  classroomId: number | 'all'
  status: StudentStatusFilter
  search: string
  order: StudentSortKey
  page: number
  pageSize: number
}) {
  return callTeacherRpc<TeacherStudentsPagePayload<StudentRow>>('get_teacher_students_page', {
    p_subject_id: subjectId === 'all' ? undefined : subjectId,
    p_classroom_id: classroomId === 'all' ? undefined : classroomId,
    p_status: status === 'all' ? undefined : status,
    p_search: search || undefined,
    p_order: order,
    p_limit: pageSize,
    p_offset: page * pageSize,
  })
}

async function invokeTeacherStudentAction<T extends TeacherActionResult>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) throw error
  const result = (data || {}) as T
  if (result.error) throw new Error(result.error)
  return result
}

export function removeStudentFromClasses(student: StudentRow) {
  return invokeTeacherStudentAction('teacher-remove-student-from-class', {
    studentId: student.id,
    subjectIds: student.subjectIds,
    classroomIds: student.classroomIds,
  })
}

export function resetStudentProgress(student: StudentRow) {
  return invokeTeacherStudentAction('teacher-reset-student-progress', { studentId: student.id, subjectIds: student.subjectIds })
}

export async function sendTeacherStudentMessage(studentIds: string[], subjectIds: number[], mode: 'reminder' | 'recovery') {
  const { data, error } = await supabase.functions.invoke('teacher-student-reminder', { body: { studentIds, subjectIds, mode } })
  if (error) throw new Error(error.message || 'No se pudo enviar el mensaje.')
  const result = (data || {}) as { sent?: number; failed?: number; results?: { error?: string }[] }
  if (Number(result.failed || 0) > 0 && studentIds.length === 1) throw new Error(result.results?.[0]?.error || 'No se pudo enviar el mensaje.')
  return result
}

export async function signOutTeacherStudents() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
