import { useCallback, useState } from 'react'
import { callTeacherRpc, type PagedPayload, type TeacherSubjectQuestion } from '../../../lib/teacherServerData'
import { useTeacherSubjectResource } from './useTeacherSubjectResource'

const EMPTY: PagedPayload<TeacherSubjectQuestion> = { items: [], total: 0, limit: 50, offset: 0 }

export function useTeacherSubjectQuestions({ subjectId, classroomId, enabled }: {
  subjectId: number
  classroomId: number | null
  enabled: boolean
}) {
  const [topicId, setTopicId] = useState<number | 'all' | 'general'>('all')
  const [difficulty, setDifficulty] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')

  const loader = useCallback(() => callTeacherRpc<PagedPayload<TeacherSubjectQuestion>>('get_teacher_subject_questions_page', {
    p_subject_id: subjectId,
    p_classroom_id: classroomId,
    p_topic_id: typeof topicId === 'number' ? topicId : undefined,
    p_general_topic: topicId === 'general',
    p_difficulty: typeof difficulty === 'number' ? difficulty : undefined,
    p_search: search.trim() || undefined,
    p_limit: 100,
    p_offset: 0,
  }), [classroomId, difficulty, search, subjectId, topicId])

  const resource = useTeacherSubjectResource({ enabled: enabled && Boolean(classroomId), initialValue: EMPTY, loader })

  return { ...resource, difficulty, search, setDifficulty, setSearch, setTopicId, topicId }
}
