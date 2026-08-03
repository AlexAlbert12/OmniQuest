import { Ionicons } from '@expo/vector-icons'

export type AdminSection = 'home' | 'teachers' | 'students' | 'courses' | 'classrooms' | 'support' | 'audit' | 'users' | 'content' | 'more' | 'profile' | 'settings'
export type IconName = keyof typeof Ionicons.glyphMap

export type AdminPermission =
  | 'dashboard.read'
  | 'users.read'
  | 'users.manage'
  | 'users.security'
  | 'users.export'
  | 'courses.read'
  | 'courses.manage'
  | 'courses.transfer'
  | 'courses.delete'
  | 'audit.read'
  | 'audit.export'
  | 'support.read'
  | 'support.manage'
  | 'admin.roles.manage'

export type AdminPortalContext = {
  user_id: string
  role_id: string
  role_name: string
  permissions: AdminPermission[]
}

export type ProfileRow = {
  id: string
  alias: string
  email: string | null
  role_id: string | null
  active: boolean | null
  created_at: string
  subject_count?: number | null
  enrollment_count?: number | null
  last_activity_at?: string | null
  activity_state?: 'recent' | 'inactive' | 'never' | string | null
  last_sign_in_at?: string | null
  security_status?: 'secure' | 'attention' | 'inactive' | 'locked' | 'unverified' | 'never_signed_in' | string | null
  mfa_factor_count?: number | null
  deactivation_reason?: string | null
  deactivated_at?: string | null
  reactivate_at?: string | null
  admin_role_name?: string | null
  admin_permissions?: string[] | null
  change_count?: number | null
  total_count?: number | null
}

export type SubjectRow = {
  id: number
  name: string
  teacher_id: string | null
  active: boolean | null
  is_archived: boolean | null
  created_at: string | null
  teacher_alias?: string | null
  teacher_email?: string | null
  classes_count?: number | null
  enrollments_count?: number | null
  last_activity_at?: string | null
  incidents_count?: number | null
  pending_reviews_count?: number | null
  inactive_classrooms_count?: number | null
  missing_code_count?: number | null
  duplicate_code_count?: number | null
  expired_code_count?: number | null
  orphaned?: boolean | null
  archive_reason?: string | null
  archived_at?: string | null
  retention_until?: string | null
  deletion_eligible_at?: string | null
  total_count?: number | null
}

export type ClassroomRow = {
  id: number
  subject_id: number | null
  name: string
  code: string | null
  active: boolean | null
  created_at: string
  subject_name?: string | null
  teacher_id?: string | null
  teacher_alias?: string | null
  teacher_email?: string | null
  enrollments_count?: number | null
  last_activity_at?: string | null
  incidents_count?: number | null
  pending_reviews_count?: number | null
  duplicate_code_count?: number | null
  code_expires_at?: string | null
  code_status?: 'valid' | 'missing' | 'duplicate' | 'expired' | string | null
  deactivation_reason?: string | null
  deactivated_at?: string | null
  total_count?: number | null
}

export type AdminAuditLogRow = {
  id: number
  chain_seq?: number | null
  admin_id: string
  actor_alias?: string | null
  actor_email?: string | null
  action: string
  target_table: string | null
  target_id: string | null
  severity?: 'info' | 'warning' | 'critical' | string | null
  metadata: Record<string, unknown> | null
  before_state?: Record<string, unknown> | null
  after_state?: Record<string, unknown> | null
  previous_hash?: string | null
  chain_hash?: string | null
  retention_until?: string | null
  created_at: string
  total_count?: number | null
}

export type AdminProfileActivityRow = {
  event_id: string
  profile_id: string
  event_type: string
  title: string
  description: string | null
  entity_table: string | null
  entity_id: string | null
  severity: 'info' | 'warning' | 'critical' | 'success' | string
  metadata: Record<string, unknown> | null
  occurred_at: string
  total_count?: number | null
}

export type AdminUserChangeRow = {
  id: number
  profile_id: string
  changed_by: string | null
  change_source?: 'admin' | 'system' | string
  action: string
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  reason: string | null
  created_at: string
  actor_alias?: string | null
  total_count?: number | null
}


export type AdminRoleRow = {
  id: string
  name: string
  description: string | null
  permissions: AdminPermission[]
  system: boolean
  assigned_count?: number | null
}

export type AdminRoleAssignmentRow = {
  user_id: string
  alias: string
  email: string | null
  role_id: string
  role_name: string
  permissions: AdminPermission[]
  assigned_at: string | null
  assigned_by: string | null
  total_count?: number | null
}


export type AdminSupportTag = {
  id: number
  slug: string
  label: string
  color: string
}

export type AdminSupportTemplate = {
  id: number
  title: string
  body: string
  category: string | null
}

export type AdminSupportDirectory = {
  admins: Array<{ id: string; alias: string; email: string | null }>
  tags: AdminSupportTag[]
  templates: AdminSupportTemplate[]
}

export type AdminSupportTicketRow = {
  id: number
  user_id: string
  user_alias: string | null
  user_email: string | null
  role: 'student' | 'teacher'
  category: string
  subject: string
  message: string
  contact_email: string | null
  priority: 'low' | 'medium' | 'high'
  priority_source?: 'user' | 'automatic' | 'admin' | string
  auto_priority_score?: number | null
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  admin_response: string | null
  assigned_admin_id: string | null
  assigned_admin_alias?: string | null
  tags?: AdminSupportTag[] | null
  sla_state?: 'on_track' | 'at_risk' | 'breached' | 'completed' | string | null
  resolved_at: string | null
  last_response_at: string | null
  first_response_due_at: string | null
  resolution_due_at: string | null
  first_responded_at: string | null
  message_count: number
  attachment_count: number
  created_at: string
  updated_at: string
  total_count?: number | null
}

export type AdminUsageAnalytics = {
  days: number
  screen_views: number
  form_abandoned: number
  course_joins: number
  game_started: number
  game_finished: number
  game_abandoned: number
  game_errors: number
  edge_function_errors: number
  badges_unlocked: number
  active_users: number
  completion_rate: number
  funnel?: { screen_view?: number; course_joined?: number; game_started?: number; game_finished?: number }
  retention?: { d1?: number; d7?: number; d30?: number }
  question_types?: Record<string, number>
  rpc_latency_ms?: { p50?: number; p95?: number }
}

export type EnrollmentRow = {
  id: number
  student_id: string
  subject_id: number
  classroom_id: number | null
}

export type AdminDashboardMetrics = {
  totalProfiles: number
  teachersCount: number
  studentsCount: number
  subjectsCount: number
  classroomsCount: number
  enrollmentsCount: number
  activeCourses: number
  archivedCourses: number
  activeClassrooms: number
  inactiveUsers: number
  coursesWithoutClassrooms: number
  studentsWithoutActivity: number
  classroomsWithoutCode: number
}

export type CreateTeacherResult = {
  status: 'created' | 'existing'
  teacher: { id: string; alias: string; email: string }
  temporaryPassword?: string
}

export type AdminData = {
  profiles: ProfileRow[]
  teachers: ProfileRow[]
  students: ProfileRow[]
  subjects: SubjectRow[]
  classrooms: ClassroomRow[]
  enrollments: EnrollmentRow[]
  metrics: AdminDashboardMetrics
  auditLogs: AdminAuditLogRow[]
  teacherById: Map<string, ProfileRow>
  studentById: Map<string, ProfileRow>
  subjectById: Map<number, SubjectRow>
  classroomById: Map<number, ClassroomRow>
  portalContext: AdminPortalContext | null
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
  refresh: () => Promise<void>
  version: number
}

export type AdminActionResult = { error?: string; ok?: boolean }

export type RowAction = {
  label: string
  icon: IconName
  onPress: () => void
  destructive?: boolean
  disabled?: boolean
}

export type AdminBulkEntity = 'profiles' | 'subjects' | 'classrooms'
export type AdminBulkAction =
  | 'activate_users'
  | 'deactivate_users'
  | 'archive_courses'
  | 'restore_courses'
  | 'transfer_courses'
  | 'delete_courses'
  | 'activate_classrooms'
  | 'deactivate_classrooms'

export type AdminExportJob = {
  id: string
  requested_by: string
  export_type: 'profiles' | 'subjects' | 'classrooms' | 'audit' | 'support'
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired'
  filters: Record<string, unknown>
  row_count: number | null
  processed_rows: number
  storage_path: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
  expires_at: string | null
  total_count?: number | null
}

export const ADMIN_PAGE_SIZE = 50

export const adminSections: { section: AdminSection; label: string; icon: IconName; href: string; permission: AdminPermission }[] = [
  { section: 'home', label: 'Inicio', icon: 'home-outline', href: '/(admin)/homeAdmin', permission: 'dashboard.read' },
  { section: 'teachers', label: 'Profesores', icon: 'school-outline', href: '/(admin)/teachers', permission: 'users.read' },
  { section: 'students', label: 'Alumnos', icon: 'people-outline', href: '/(admin)/students', permission: 'users.read' },
  { section: 'courses', label: 'Cursos', icon: 'book-outline', href: '/(admin)/courses', permission: 'courses.read' },
  { section: 'classrooms', label: 'Clases', icon: 'albums-outline', href: '/(admin)/classrooms', permission: 'courses.read' },
  { section: 'support', label: 'Soporte', icon: 'headset-outline', href: '/(admin)/support', permission: 'support.read' },
  { section: 'audit', label: 'Auditoría', icon: 'receipt-outline', href: '/(admin)/audit', permission: 'audit.read' },
]
