import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import type { TeacherStudentsPageSummary } from '../../lib/teacherServerData'
import type { Classroom, StudentRow, StudentSortKey, StudentStatusFilter, Subject } from './types'
import { fetchTeacherStudentsPage } from './api'

const DEFAULT_SUMMARY: TeacherStudentsPageSummary = {
  total: 0, active: 0, noActivity: 0, needsHelp: 0, inactive: 0, excellent: 0, attention: 0, withActivity: 0,
  averageXp: 0, averageGrade: 0, averageAccuracy: 0, completedChallenges: 0,
}

export function useTeacherStudentsPage({ initialSubjectId = 'all', initialClassroomId = 'all', initialStatus = 'all', pageSize = 12 }: {
  initialSubjectId?: number | 'all'
  initialClassroomId?: number | 'all'
  initialStatus?: StudentStatusFilter
  pageSize?: number
} = {}) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [summary, setSummary] = useState<TeacherStudentsPageSummary>(DEFAULT_SUMMARY)
  const [attention, setAttention] = useState<StudentRow[]>([])
  const [pending, setPending] = useState<StudentRow[]>([])
  const [selectedSubjectId, setSelectedSubjectIdState] = useState<number | 'all'>(initialSubjectId)
  const [selectedClassroomId, setSelectedClassroomIdState] = useState<number | 'all'>(initialClassroomId)
  const [selectedStatus, setSelectedStatusState] = useState<StudentStatusFilter>(initialStatus)
  const [selectedSort, setSelectedSortState] = useState<StudentSortKey>('attention')
  const [search, setSearchState] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timeout)
  }, [search])
  useEffect(() => { setPage(0) }, [debouncedSearch, selectedClassroomId, selectedSort, selectedStatus, selectedSubjectId])

  const loadPage = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const payload = await fetchTeacherStudentsPage({
        subjectId: selectedSubjectId,
        classroomId: selectedClassroomId,
        status: selectedStatus,
        search: debouncedSearch,
        order: selectedSort,
        page,
        pageSize,
      })
      setStudents(payload.items || [])
      setTotal(payload.total || 0)
      setSummary(payload.summary || DEFAULT_SUMMARY)
      setSubjects(payload.subjects || [])
      setClassrooms(payload.classrooms || [])
      setAttention(payload.attention || [])
      setPending(payload.pending || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los alumnos.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [debouncedSearch, page, pageSize, selectedClassroomId, selectedSort, selectedStatus, selectedSubjectId])

  useFocusEffect(useCallback(() => { void loadPage(false) }, [loadPage]))

  const classroomOptions = useMemo(() => selectedSubjectId === 'all' ? classrooms : classrooms.filter((classroom) => classroom.subject_id === selectedSubjectId), [classrooms, selectedSubjectId])
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return {
    subjects, classrooms, classroomOptions, students, summary, attention, pending,
    selectedSubjectId, selectedClassroomId, selectedStatus, selectedSort, search,
    page, pageSize, pageCount, total, loading, refreshing, error,
    setSelectedSubjectId: (value: number | 'all') => { setSelectedSubjectIdState(value); setSelectedClassroomIdState('all') },
    setSelectedClassroomId: setSelectedClassroomIdState,
    setSelectedStatus: setSelectedStatusState,
    setSelectedSort: setSelectedSortState,
    setSearch: setSearchState,
    setPage,
    refresh: () => loadPage(true),
    reload: () => loadPage(false),
  }
}
