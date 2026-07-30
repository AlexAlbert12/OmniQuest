import { useCallback } from 'react'
import { callTeacherRpc, type PagedPayload, type TeacherSubjectTopic } from '../../../lib/teacherServerData'
import { useTeacherSubjectResource } from './useTeacherSubjectResource'

const EMPTY: PagedPayload<TeacherSubjectTopic> = { items: [], total: 0, limit: 100, offset: 0 }

export function useTeacherSubjectTopics({ subjectId, classroomId, enabled }: {
  subjectId: number
  classroomId: number | null
  enabled: boolean
}) {
  const loader = useCallback(() => callTeacherRpc<PagedPayload<TeacherSubjectTopic>>('get_teacher_subject_topics_page', {
    p_subject_id: subjectId,
    p_classroom_id: classroomId,
    p_limit: 100,
    p_offset: 0,
  }), [classroomId, subjectId])

  return useTeacherSubjectResource({ enabled: enabled && Boolean(classroomId), initialValue: EMPTY, loader })
}
