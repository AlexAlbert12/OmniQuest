import { callTeacherRpc, type TeacherClassroomsPayload, type TeacherCoursesPayload } from '../../lib/teacherServerData'
import { supabase } from '../../lib/supabase'
import type { TeacherCourseFilter, TeacherCourseSort } from './types'

export function fetchTeacherCoursesPage({ page, pageSize, search, status, sort }: {
  page: number
  pageSize: number
  search: string
  status: TeacherCourseFilter
  sort: TeacherCourseSort
}) {
  return callTeacherRpc<TeacherCoursesPayload>('get_teacher_courses_page', {
    p_search: search.trim() || undefined,
    p_status: status === 'all' ? undefined : status,
    p_sort: sort,
    p_limit: pageSize,
    p_offset: page * pageSize,
  })
}

export function fetchTeacherClassroomsPage({ page, pageSize, search }: { page: number; pageSize: number; search: string }) {
  return callTeacherRpc<TeacherClassroomsPayload>('get_teacher_classrooms_page', {
    p_search: search.trim() || undefined,
    p_limit: pageSize,
    p_offset: page * pageSize,
  })
}

export async function signOutTeacherCatalog() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
