export type TeacherAuditCategory = 'all' | 'student' | 'question' | 'subject' | 'code' | 'profile'
export type TeacherAuditSeverity = 'all' | 'info' | 'warning' | 'critical'

export type TeacherAuditFilters = {
  category: TeacherAuditCategory
  search: string
  action: string | null
  severity: TeacherAuditSeverity
  from: string | null
  to: string | null
}

export type TeacherAuditLog = {
  id: number
  teacher_id: string
  action: string
  target_table: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  before_state: Record<string, unknown>
  after_state: Record<string, unknown>
  severity: 'info' | 'warning' | 'critical'
  request_id: string | null
  created_at: string
}

export type TeacherAuditPage = {
  items: TeacherAuditLog[]
  total: number
  stats: { last7Days: number; critical: number; warning: number }
  actions: string[]
}

export type TeacherAuditAlert = {
  id: number
  teacher_id: string
  pattern_key: string
  severity: 'warning' | 'critical'
  title: string
  description: string
  window_started_at: string
  window_ended_at: string
  event_count: number
  acknowledged_at: string | null
  created_at: string
}

export type TeacherAuditExport = {
  id: string
  teacher_id: string
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired'
  filters: TeacherAuditFilters & { locale?: 'es-ES' | 'en-US' }
  object_path: string | null
  row_count: number | null
  requested_at: string
  started_at: string | null
  completed_at: string | null
  expires_at: string | null
  error_message: string | null
  updated_at: string
}

export type TeacherAuditConfiguration = {
  retentionDays: number
  subjectsCount: number
  alerts: TeacherAuditAlert[]
  exports: TeacherAuditExport[]
}
