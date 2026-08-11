export type ManualReviewStatus = 'pending' | 'needs_changes' | 'approved' | 'rejected'
export type ManualReviewDecision = Exclude<ManualReviewStatus, 'pending'>

export type ManualReviewQueueRow = {
  id: number
  student_id: string
  student_name: string
  student_email: string | null
  question_id: number
  question_text: string
  answer_text: string | null
  answer_payload: unknown
  status: ManualReviewStatus
  attempted_at: string
  reviewed_at: string | null
  review_notes: string | null
  earned_points: number
  possible_points: number
  time_taken_seconds: number | null
  subject_id: number
  subject_name: string
  classroom_id: number | null
  classroom_name: string
  topic_id: number | null
  topic_name: string | null
  due_at: string | null
  pending_seconds: number | null
  is_overdue: boolean
  comments_count: number
  latest_comment: string | null
}

export type ManualReviewQueueResponse = {
  items: ManualReviewQueueRow[]
  total: number
  summary: {
    pending: number
    needs_changes: number
    due_soon: number
    overdue: number
  }
}

export type ManualReviewTemplate = {
  id: string
  teacher_id: string
  title: string
  body: string
  audience: 'student' | 'internal'
  active: boolean
  created_at: string
  updated_at: string
}

export type ManualReviewSubject = { id: number; name: string }
export type ManualReviewClassroom = { id: number; subject_id: number; name: string }

export type ManualReviewConfiguration = {
  slaHours: number
  templates: ManualReviewTemplate[]
  subjects: ManualReviewSubject[]
  classrooms: ManualReviewClassroom[]
}

export type ManualReviewFilters = {
  subjectId: number | null
  classroomId: number | null
  status: 'all' | ManualReviewStatus
  search: string
}

export type ManualReviewComment = {
  id: number
  author_id: string
  author_name: string
  audience: 'student' | 'internal'
  body: string
  created_at: string
}

export type ManualReviewHistoryItem = {
  id: number
  eventType: string
  fromStatus: string | null
  toStatus: string | null
  actorName: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  createdAt: string
}
