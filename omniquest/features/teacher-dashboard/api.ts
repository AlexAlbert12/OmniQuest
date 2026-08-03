import {
  callTeacherRpc,
  type PagedPayload,
  type TeacherAttentionStudent,
  type TeacherDashboardSummary,
  type TeacherRecentActivity,
} from '../../lib/teacherServerData'
import { supabase } from '../../lib/supabase'

export async function fetchTeacherDashboard() {
  const [summary, attentionPage, activityPage] = await Promise.all([
    callTeacherRpc<TeacherDashboardSummary>('get_teacher_dashboard_summary'),
    callTeacherRpc<PagedPayload<TeacherAttentionStudent>>('get_teacher_attention_students_page', { p_limit: 6, p_offset: 0 }),
    callTeacherRpc<PagedPayload<TeacherRecentActivity>>('get_teacher_recent_activity_page', { p_limit: 6, p_offset: 0 }),
  ])
  return { summary, attention: attentionPage.items || [], recentActivity: activityPage.items || [] }
}

export async function signOutTeacher() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
