import { supabase } from '../supabase'

export type TeacherNotificationType = 'student_activity' | 'announcement' | 'new_class'

export type CreateTeacherNotificationInput = {
  studentId: string
  subjectId: number
  classroomId?: number | null
  type: TeacherNotificationType
  message?: string | null
}

export async function createTeacherNotification({
  studentId,
  subjectId,
  classroomId = null,
  type,
  message = null,
}: CreateTeacherNotificationInput) {
  const { data, error } = await supabase.rpc('create_teacher_notification', {
    p_student_id: studentId,
    p_subject_id: subjectId,
    p_classroom_id: classroomId ?? undefined,
    p_type: type,
    p_message: message ?? undefined,
  })

  if (error) throw error
  return data
}
