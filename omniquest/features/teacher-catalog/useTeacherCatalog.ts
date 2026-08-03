import { useEffect, useMemo, useState } from 'react'
import { buildTeacherClassroomItems, buildTeacherCourseItems } from './model'
import { useTeacherClassroomsPage } from './useTeacherClassroomsPage'
import { useTeacherCoursesPage } from './useTeacherCoursesPage'
import type { TeacherCatalogTab, TeacherCourseFilter, TeacherCourseSort } from './types'

export function useTeacherCatalog(pageSize: number) {
  const [catalogTab, setCatalogTabState] = useState<TeacherCatalogTab>('courses')
  const [page, setPage] = useState(0)
  const [filter, setFilterState] = useState<TeacherCourseFilter>('all')
  const [sort, setSortState] = useState<TeacherCourseSort>('recent')
  const [searchInput, setSearchInputState] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 250)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const coursesPage = useTeacherCoursesPage({ enabled: catalogTab === 'courses', page, pageSize, search, sort, status: filter })
  const classroomsPage = useTeacherClassroomsPage({ enabled: catalogTab === 'classrooms', page, pageSize, search })
  const activePayload = catalogTab === 'courses' ? coursesPage : classroomsPage
  const total = activePayload.total
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1)
  const safePage = Math.min(page, maxPage)

  useEffect(() => { if (page > maxPage) setPage(maxPage) }, [maxPage, page])

  const items = useMemo(() => catalogTab === 'courses'
    ? buildTeacherCourseItems(coursesPage.items)
    : buildTeacherClassroomItems(classroomsPage.items), [catalogTab, classroomsPage.items, coursesPage.items])

  const courseSummary = coursesPage.summary
  const participation = courseSummary.students > 0 ? Math.round((courseSummary.activeStudents / courseSummary.students) * 100) : 0
  const subjectsCount = catalogTab === 'courses' ? coursesPage.summary.courses : classroomsPage.summary.courses

  return {
    catalogTab,
    page,
    filter,
    sort,
    searchInput,
    coursesPage,
    classroomsPage,
    activePayload,
    items,
    total,
    maxPage,
    safePage,
    courseSummary,
    participation,
    subjectsCount,
    setCatalogTab: (value: TeacherCatalogTab) => { setCatalogTabState(value); setPage(0); setSearchInputState(''); setSearch('') },
    setPage,
    setFilter: (value: TeacherCourseFilter) => { setFilterState(value); setPage(0) },
    setSort: (value: TeacherCourseSort) => { setSortState(value); setPage(0) },
    setSearchInput: (value: string) => { setSearchInputState(value); setPage(0) },
  }
}
