import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import AppButton from '../../components/ui/AppButton'
import AppTabs from '../../components/ui/AppTabs'
import PaginationControls from '../../components/ui/PaginationControls'
import TeacherCoursesList from '../../components/teacher/classes/TeacherCoursesList'
import TeacherClassroomsList from '../../components/teacher/classes/TeacherClassroomsList'
import CreateCourseCTA from '../../components/teacher/classes/CreateCourseCTA'
import type {
  TeacherClassroom,
  TeacherClassroomAnalytics,
  TeacherCourse,
  TeacherCourseAnalytics,
} from '../../components/teacher/classes/types'
import {
  useTeacherCoursesPage,
  type TeacherCourseFilter,
  type TeacherCourseSort,
} from '../../hooks/teacher/useTeacherCoursesPage'
import { useTeacherClassroomsPage } from '../../hooks/teacher/useTeacherClassroomsPage'

const filters: { key: TeacherCourseFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todas', icon: 'apps-outline' },
  { key: 'unconfigured', label: 'Sin configurar', icon: 'construct-outline' },
  { key: 'no_activity', label: 'Sin actividad', icon: 'pause-circle-outline' },
  { key: 'in_progress', label: 'En curso', icon: 'time-outline' },
  { key: 'completed', label: 'Completadas', icon: 'checkmark-done-outline' },
]

const sorts: { key: TeacherCourseSort; label: string }[] = [
  { key: 'recent', label: 'Reciente' },
  { key: 'name', label: 'Nombre' },
  { key: 'participation', label: 'Participación' },
]

type CatalogTab = 'courses' | 'classrooms'

export default function TeacherClassesScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const isDesktop = width >= 1024
  const pageSize = isDesktop ? 12 : 6
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('courses')
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<TeacherCourseFilter>('all')
  const [sort, setSort] = useState<TeacherCourseSort>('recent')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 250)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const coursesPage = useTeacherCoursesPage({
    enabled: catalogTab === 'courses',
    page,
    pageSize,
    search,
    sort,
    status: filter,
  })
  const classroomsPage = useTeacherClassroomsPage({
    enabled: catalogTab === 'classrooms',
    page,
    pageSize,
    search,
  })

  const courses = useMemo<TeacherCourse[]>(() => coursesPage.items.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    code: row.code,
    theme_color: row.themeColor,
    created_at: row.createdAt,
  })), [coursesPage.items])

  const analyticsByCourse = useMemo<Record<number, TeacherCourseAnalytics>>(() => coursesPage.items.reduce((rows, item) => {
    rows[item.id] = item.analytics
    return rows
  }, {} as Record<number, TeacherCourseAnalytics>), [coursesPage.items])

  const classrooms = useMemo<TeacherClassroom[]>(() => classroomsPage.items.map((row) => ({
    id: row.classroom.id,
    subject_id: row.classroom.subjectId,
    name: row.classroom.name,
    code: row.classroom.code,
    academic_year: row.classroom.academicYear,
    created_at: row.classroom.createdAt,
    active: row.classroom.active,
  })), [classroomsPage.items])

  const analyticsByClassroom = useMemo<Record<number, TeacherClassroomAnalytics>>(() => classroomsPage.items.reduce((rows, item) => {
    rows[item.classroom.id] = item.analytics
    return rows
  }, {} as Record<number, TeacherClassroomAnalytics>), [classroomsPage.items])

  const coursesById = useMemo<Record<number, TeacherCourse>>(() => classroomsPage.items.reduce((rows, item) => {
    rows[item.course.id] = {
      id: item.course.id,
      name: item.course.name,
      description: item.course.description,
      icon: item.course.icon,
      code: item.course.code,
      theme_color: item.course.themeColor,
      created_at: item.course.createdAt,
    }
    return rows
  }, {} as Record<number, TeacherCourse>), [classroomsPage.items])

  const activePayload = catalogTab === 'courses' ? coursesPage : classroomsPage
  const total = activePayload.total
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1)
  const safePage = Math.min(page, maxPage)
  const subjectsCount = catalogTab === 'courses' ? coursesPage.summary.courses : classroomsPage.summary.courses

  useEffect(() => {
    if (page > maxPage) setPage(maxPage)
  }, [maxPage, page])

  if (activePayload.loading && activePayload.items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-text-muted">Cargando catálogo docente...</Text>
      </View>
    )
  }

  const courseSummary = coursesPage.summary
  const participation = courseSummary.students > 0
    ? Math.round((courseSummary.activeStudents / courseSummary.students) * 100)
    : 0

  return (
    <View className="flex-1 bg-background-primary">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar activeSection="classes" subjectsCount={subjectsCount} onSignOut={() => supabase.auth.signOut()} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 28 : 18,
            paddingBottom: isDesktop ? 32 : MOBILE_BOTTOM_NAV_SPACER + 84,
          }}
          refreshControl={<RefreshControl refreshing={activePayload.refreshing} onRefresh={activePayload.refresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <TeacherPageHeader
            icon="book"
            isDesktop={isDesktop}
            title="Cursos y clases"
            mobileTitle="Cursos y clases"
            subtitle="Resultados paginados y métricas agregadas en servidor."
            notificationOnPress={() => router.push('/(teacher)/notifications' as never)}
            actions={isDesktop ? (
              <AppButton label="Crear curso" accessibilityLabel="Crear curso" icon="add" role="teacher" onPress={() => router.push('/(teacher)/create-subject' as never)} />
            ) : undefined}
          />

          {activePayload.error ? (
            <View className="mb-4 rounded-xl border border-semantic-danger bg-semantic-surface-danger p-4">
              <Text className="font-bold text-semantic-danger">{activePayload.error}</Text>
            </View>
          ) : null}

          <View className="mb-4">
            <AppTabs<CatalogTab>
              accessibilityLabel="Ver cursos o clases"
              fill
              items={[
                { key: 'courses', label: `Cursos (${coursesPage.summary.courses})`, icon: 'book-outline' },
                { key: 'classrooms', label: `Clases (${classroomsPage.summary.classrooms})`, icon: 'people-outline' },
              ]}
              onChange={(nextTab) => {
                setCatalogTab(nextTab)
                setPage(0)
                setSearchInput('')
                setSearch('')
              }}
              role="teacher"
              value={catalogTab}
            />
          </View>

          <View className="mb-4 gap-3">
            <View className="min-h-12 flex-row items-center rounded-xl border border-border-default bg-surface-default px-4 py-2">
              <Ionicons name="search-outline" size={20} color="#AFC2DB" />
              <TextInput
                accessibilityLabel={catalogTab === 'courses' ? 'Buscar curso' : 'Buscar clase'}
                className="ml-3 min-w-0 flex-1 text-text-primary"
                placeholder={catalogTab === 'courses' ? 'Buscar curso...' : 'Buscar clase o curso...'}
                placeholderTextColor="#8FA7C7"
                value={searchInput}
                onChangeText={(value: string) => {
                  setSearchInput(value)
                  setPage(0)
                }}
              />
            </View>

            {catalogTab === 'courses' ? (
              <View className="gap-3">
                <AppTabs<TeacherCourseFilter>
                  accessibilityLabel="Filtrar cursos"
                  compact
                  role="teacher"
                  items={filters}
                  value={filter}
                  onChange={(value) => { setFilter(value); setPage(0) }}
                />
                {isDesktop ? (
                  <AppTabs<TeacherCourseSort>
                    accessibilityLabel="Ordenar cursos"
                    compact
                    role="teacher"
                    items={sorts.map((item) => ({ ...item, icon: 'swap-vertical-outline' as const }))}
                    value={sort}
                    onChange={(value) => { setSort(value); setPage(0) }}
                  />
                ) : null}
              </View>
            ) : null}
          </View>

          <View className="mb-3 flex-row items-center justify-between gap-3">
            <Text className="min-w-0 flex-1 text-[13px] text-text-secondary">
              {catalogTab === 'courses'
                ? `${total} cursos · ${courseSummary.students} matrículas · ${courseSummary.questions} preguntas · ${participation}% participación`
                : `${total} clases activas`}
            </Text>
            {!isDesktop && catalogTab === 'courses' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Orden actual: ${sort}`}
                onPress={() => {
                  const index = sorts.findIndex((item) => item.key === sort)
                  setSort(sorts[(index + 1) % sorts.length].key)
                  setPage(0)
                }}
                className="flex-row items-center gap-2 rounded-lg bg-surface-interactive px-3 py-2"
              >
                <Ionicons name="swap-vertical-outline" size={15} color="#B9A7FF" />
                <Text className="text-[12px] font-black text-brand-teacher">{sorts.find((item) => item.key === sort)?.label}</Text>
              </Pressable>
            ) : null}
          </View>

          {catalogTab === 'courses' ? (
            <TeacherCoursesList analyticsByCourse={analyticsByCourse} courses={courses} isDesktop={isDesktop} />
          ) : (
            <TeacherClassroomsList analyticsByClassroom={analyticsByClassroom} classrooms={classrooms} coursesById={coursesById} isDesktop={isDesktop} />
          )}

          <PaginationControls
            compact={!isDesktop}
            onNext={() => setPage((current) => Math.min(maxPage, current + 1))}
            onPrevious={() => setPage((current) => Math.max(0, current - 1))}
            page={safePage}
            pageSize={pageSize}
            total={total}
          />

          {isDesktop ? <CreateCourseCTA onPress={() => router.push('/(teacher)/create-subject' as never)} /> : null}
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="classes" /> : null}
      {!isDesktop ? <CreateCourseCTA onPress={() => router.push('/(teacher)/create-subject' as never)} sticky /> : null}
    </View>
  )
}
