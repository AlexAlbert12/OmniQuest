import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  callTeacherRpc,
  type TeacherSubjectStudentsPayload,
} from '../../../lib/teacherServerData'
import type { StudentSortKey, StudentStatusFilter } from '../../../lib/teacherSubjectAnalytics'
import { useTeacherSubjectResource } from './useTeacherSubjectResource'

const PAGE_SIZE = 25
const EMPTY: TeacherSubjectStudentsPayload = {
  items: [], total: 0, limit: PAGE_SIZE, offset: 0,
  summary: {
    enrolled: 0, answered: 0, participation: 0, averageGrade: 0, averageAccuracy: 0,
    failedAnswers: 0, correctAnswers: 0, averageXp: 0, questionsCount: 0, activeThisWeek: 0,
  },
  gradeDistribution: [],
}

export function useTeacherSubjectStudents({ subjectId, classroomId, enabled }: {
  subjectId: number
  classroomId: number | null
  enabled: boolean
}) {
  const [search, setSearchState] = useState('')
  const [status, setStatusState] = useState<StudentStatusFilter>('all')
  const [sort, setSortState] = useState<StudentSortKey>('xp')
  const [page, setPage] = useState(0)

  useEffect(() => setPage(0), [classroomId, subjectId])

  const setSearch = useCallback((value: string) => { setPage(0); setSearchState(value) }, [])
  const setStatus = useCallback((value: StudentStatusFilter) => { setPage(0); setStatusState(value) }, [])
  const setSort = useCallback((value: StudentSortKey) => { setPage(0); setSortState(value) }, [])

  const loader = useCallback(() => callTeacherRpc<TeacherSubjectStudentsPayload>('get_teacher_subject_students_page', {
    p_subject_id: subjectId,
    p_classroom_id: classroomId,
    p_search: search.trim() || undefined,
    p_status: status === 'all' ? undefined : status,
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  }), [classroomId, page, search, sort, status, subjectId])

  const resource = useTeacherSubjectResource({ enabled: enabled && Boolean(classroomId), initialValue: EMPTY, loader })
  const pageCount = useMemo(() => Math.max(1, Math.ceil(resource.data.total / PAGE_SIZE)), [resource.data.total])

  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1))
  }, [page, pageCount])

  return { ...resource, page, pageCount, pageSize: PAGE_SIZE, search, setPage, setSearch, setSort, setStatus, sort, status }
}
