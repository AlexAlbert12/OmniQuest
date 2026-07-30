import { useCallback, useState } from 'react'
import {
  callTeacherRpc,
  type TeacherSubjectStudentsPayload,
} from '../../../lib/teacherServerData'
import type { StudentSortKey, StudentStatusFilter } from '../../../lib/teacherSubjectAnalytics'
import { useTeacherSubjectResource } from './useTeacherSubjectResource'

const EMPTY: TeacherSubjectStudentsPayload = {
  items: [], total: 0, limit: 50, offset: 0,
  summary: {
    enrolled: 0, answered: 0, participation: 0, averageGrade: 0, averageAccuracy: 0,
    failedAnswers: 0, correctAnswers: 0, averageXp: 0, questionsCount: 0,
  },
  gradeDistribution: [],
}

export function useTeacherSubjectStudents({ subjectId, classroomId, enabled }: {
  subjectId: number
  classroomId: number | null
  enabled: boolean
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StudentStatusFilter>('all')
  const [sort, setSort] = useState<StudentSortKey>('xp')

  const loader = useCallback(() => callTeacherRpc<TeacherSubjectStudentsPayload>('get_teacher_subject_students_page', {
    p_subject_id: subjectId,
    p_classroom_id: classroomId,
    p_search: search.trim() || undefined,
    p_status: status === 'all' ? undefined : status,
    p_sort: sort,
    p_limit: 100,
    p_offset: 0,
  }), [classroomId, search, sort, status, subjectId])

  const resource = useTeacherSubjectResource({ enabled: enabled && Boolean(classroomId), initialValue: EMPTY, loader })

  return { ...resource, search, setSearch, setSort, setStatus, sort, status }
}
