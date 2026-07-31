export type ManualReviewStatus = 'pending' | 'in_review' | 'needs_changes' | 'approved' | 'rejected'

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
  assigned_to: string | null
  assigned_to_name: string | null
  rubric_id: string | null
  rubric_name: string | null
  rubric_result: Record<string, number> | null
  pending_seconds: number
  is_overdue: boolean
  comments_count: number
  latest_comment: string | null
}

export type ManualReviewQueueResponse = {
  items: ManualReviewQueueRow[]
  total: number
  summary: {
    pending: number
    in_review: number
    needs_changes: number
    overdue: number
  }
}

export type ManualReviewRubricCriterion = {
  id: string
  label: string
  maxScore: number
}

export type ManualReviewRubric = {
  id: string
  teacher_id: string
  subject_id: number | null
  name: string
  criteria: ManualReviewRubricCriterion[]
  active: boolean
  created_at: string
  updated_at: string
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

export type ManualReviewSavedFilter = {
  id: string
  teacher_id: string
  name: string
  filters: ManualReviewFilters
  created_at: string
  updated_at: string
}

export type ManualReviewAssignee = { id: string; name: string }
export type ManualReviewSubject = { id: number; name: string }
export type ManualReviewClassroom = { id: number; subject_id: number; name: string }

export type ManualReviewConfiguration = {
  slaHours: number
  rubrics: ManualReviewRubric[]
  templates: ManualReviewTemplate[]
  savedFilters: ManualReviewSavedFilter[]
  assignees: ManualReviewAssignee[]
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
