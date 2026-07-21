import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import AppConfirmModal from '../../components/AppConfirmModal'
import { supabase } from '../../lib/supabase'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentSidebar from '../../components/student/StudentSidebar'
import { fetchStudentProgressSummary, type StudentProgressSubject } from '../../lib/studentProgress'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { joinClassByInviteCode } from '../../lib/studentClassJoin'
import { CourseGalaxyMap } from '../../components/student/galaxy/StudentGalaxyMap'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
}

type Subject = {
  id: number
  classroom_id: number | null
  classroom_name: string | null
  classroom_code: string | null
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
  teacher_id?: string | null
  joined_at?: string | null
}

type ClassFilter = 'all' | 'review' | 'in_progress' | 'completed'
type ClassSort = 'recent' | 'name' | 'progress'

const studentClassFilters: { id: ClassFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'review', label: 'Para repasar' },
  { id: 'in_progress', label: 'En progreso' },
  { id: 'completed', label: 'Completadas' },
]

const studentClassSorts: { id: ClassSort; label: string }[] = [
  { id: 'recent', label: 'Reciente' },
  { id: 'name', label: 'Nombre' },
  { id: 'progress', label: 'Progreso' },
]

export default function ClassesScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [progressBySubject, setProgressBySubject] = useState<Record<string, StudentProgressSubject>>({})
  const [selectedFilter, setSelectedFilter] = useState<ClassFilter>('all')
  const [selectedSort, setSelectedSort] = useState<ClassSort>('recent')
  const [inviteCode, setInviteCode] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [leavingSubjectId, setLeavingSubjectId] = useState<number | null>(null)
  const [subjectToLeave, setSubjectToLeave] = useState<Subject | null>(null)
  const [openFilterMenu, setOpenFilterMenu] = useState<'state' | 'sort' | null>(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const isDesktop = width >= 1024
  const { accentColor } = useAppTheme()
  const classRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    let rows = subjects

    if (selectedFilter === 'review') {
      rows = rows.filter((subject) => (progressBySubject[getCourseRowKey(subject)]?.failedQuestions ?? 0) > 0)
    }

    if (selectedFilter === 'in_progress') {
      rows = rows.filter((subject) => {
        const progress = progressBySubject[getCourseRowKey(subject)]
        return (progress?.failedQuestions ?? 0) === 0 && (progress?.pendingQuestions ?? 0) > 0
      })
    }

    if (selectedFilter === 'completed') {
      rows = rows.filter((subject) => {
        const progress = progressBySubject[getCourseRowKey(subject)]
        return Boolean(progress?.isCompleted) && (progress?.failedQuestions ?? 0) === 0
      })
    }

    if (normalizedSearch) {
      rows = rows.filter((subject) =>
        `${subject.name} ${subject.classroom_name || ''} ${subject.description || ''}`.toLowerCase().includes(normalizedSearch)
      )
    }

    return [...rows].sort((left, right) => {
      if (selectedSort === 'name') {
        return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
      }

      if (selectedSort === 'progress') {
        const rightProgress = progressBySubject[getCourseRowKey(right)]?.percent ?? 0
        const leftProgress = progressBySubject[getCourseRowKey(left)]?.percent ?? 0
        return rightProgress - leftProgress || left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
      }

      return getSortableTimestamp(right.joined_at) - getSortableTimestamp(left.joined_at)
    })
  }, [progressBySubject, search, selectedFilter, selectedSort, subjects])

  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const activeClasses = subjects.length
  const failedQuestions = subjects.reduce(
    (total, subject) => total + (progressBySubject[getCourseRowKey(subject)]?.failedQuestions ?? 0),
    0
  )
  const pendingQuestions = subjects.reduce(
    (total, subject) => total + (progressBySubject[getCourseRowKey(subject)]?.pendingQuestions ?? 0),
    0
  )
  const hasActiveMobileFilters = selectedFilter !== 'all' || selectedSort !== 'recent' || search.trim().length > 0

  const fetchClasses = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) return

      const [profileResult, enrollmentsResult, progressResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, points, avatar').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('id, student_id, subject_id, classroom_id, joined_at, subjects(id, name, description, icon, theme_color, teacher_id), classrooms(id, name, code)')
          .eq('student_id', userId)
          .order('joined_at', { ascending: false }),
        fetchStudentProgressSummary(userId),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error

      setProfile(profileResult.data)
      setProgressBySubject(
        progressResult.subjects.reduce<Record<string, StudentProgressSubject>>((acc, subject) => {
          acc[getProgressRowKey(subject)] = subject
          return acc
        }, {})
      )
      const nextSubjects = enrollmentsResult.data
        ?.map((enrollment: any) => {
          const subject = normalizeRelation(enrollment.subjects)
          const classroom = normalizeRelation(enrollment.classrooms)
          return subject
            ? {
                ...subject,
                classroom_id: Number(enrollment.classroom_id ?? classroom?.id ?? 0) || null,
                classroom_name: classroom?.name ?? null,
                classroom_code: classroom?.code ?? null,
                joined_at: enrollment.joined_at ?? null,
              }
            : null
        })
        .filter(Boolean) as Subject[] || []

      setSubjects(nextSubjects)


    } catch (error) {
      console.error('Error fetching classes:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchClasses()
    }, [fetchClasses])
  )

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  const handleJoinClass = async () => {
    setJoining(true)
    try {
      const { subjectName, classroomName } = await joinClassByInviteCode(inviteCode)
      showAlert('¡Éxito!', `Te has unido a ${subjectName}${classroomName ? ` · ${classroomName}` : ''}`)
      setInviteCode('')
      fetchClasses()
    } catch (error: any) {
      showAlert('Error', error.message)
    } finally {
      setJoining(false)
    }
  }

  const executeLeaveClass = async (subject: Subject) => {
    setLeavingSubjectId(subject.classroom_id ?? subject.id)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) {
        throw new Error('No hay sesión activa.')
      }

      let deleteQuery = supabase
        .from('enrollments')
        .delete()
        .eq('student_id', userId)
        .eq('subject_id', subject.id)

      deleteQuery = typeof subject.classroom_id === 'number'
        ? deleteQuery.eq('classroom_id', subject.classroom_id)
        : deleteQuery.is('classroom_id', null)

      const { error } = await deleteQuery

      if (error) throw error

      showAlert('Clase abandonada', `Has salido de ${subject.name}${subject.classroom_name ? ` · ${subject.classroom_name}` : ''}.`)
      fetchClasses()
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo abandonar la clase.')
    } finally {
      setLeavingSubjectId(null)
    }
  }

  const handleLeaveClass = (subject: Subject) => {
    setSubjectToLeave(subject)
  }

  if (loading) {
    return (
      <View className="flex-1 bg-[#010611]">
        <HomeVisualBackground isDesktop={isDesktop} />
        <View className="z-10 flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={accentColor} />
          <Text className="mt-4" style={{ color: '#B8C4E0' }}>Cargando tus cursos...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#010611]">
      <HomeVisualBackground isDesktop={isDesktop} />
      <View className="z-10 flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection="classes"
            alias={alias}
            avatar={profile?.avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={() => supabase.auth.signOut()}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 32 : 16,
            paddingTop: isDesktop ? 28 : 30,
            paddingBottom: isDesktop ? 70 : MOBILE_BOTTOM_NAV_SPACER + 28,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mx-auto w-full max-w-[1120px]">
            <StudentPageHeader
              icon="book"
              isDesktop={isDesktop}
              title="Mis cursos"
              subtitle="Elige una galaxia para continuar tu viaje."
              showNotifications={isDesktop}
              showAvatar={isDesktop}
              actionsPosition="top"
              actions={(
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Abrir mis tareas"
                    onPress={() => router.push('/(student)/tasks' as any)}
                    className="h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-[#33405A] bg-[#1A2335] px-3"
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                  >
                    <Ionicons name="calendar-outline" size={22} color="#60A5FA" />
                    {isDesktop ? <Text className="text-[12px] font-black text-[#C7D5F2]">Mis tareas</Text> : null}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showMobileFilters ? 'Ocultar filtros de cursos' : 'Mostrar filtros de cursos'}
                    onPress={() => setShowMobileFilters((value) => !value)}
                    className="h-12 w-12 items-center justify-center rounded-2xl border border-[#33405A] bg-[#1A2335]"
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                  >
                    <Ionicons name={showMobileFilters ? 'close' : 'options'} size={24} color="#C7D5F2" />
                  </Pressable>
                </>
              )}
            />

            <View className={isDesktop ? 'mb-8 flex-row gap-4' : 'mb-7 flex-row gap-3'}>
              <MobileMetricCard
                compact
                icon="school"
                color="#8B5CF6"
                value={activeClasses}
                label="Cursos"
                style={{ flex: 1, minHeight: isDesktop ? 132 : 118 }}
              />
              <MobileMetricCard
                compact
                icon="flame"
                color="#FB4772"
                value={failedQuestions}
                label="Repasar"
                style={{ flex: 1, minHeight: isDesktop ? 132 : 118 }}
              />
              <MobileMetricCard
                compact
                icon="star-outline"
                color="#4EC4FF"
                value={pendingQuestions}
                label="Practicar"
                style={{ flex: 1, minHeight: isDesktop ? 132 : 118 }}
              />
              {isDesktop ? (
                <MobileMetricCard
                  compact
                  icon="sparkles"
                  color="#F6A64A"
                  value={`${points.toLocaleString()} XP`}
                  label="Experiencia"
                  style={{ flex: 1, minHeight: 132 }}
                />
              ) : null}
            </View>

            {showMobileFilters ? (
              <View className="mb-8 rounded-[24px] border border-[#2A3855] bg-[#11182B]/95 p-4">
                <View className="flex-row items-center rounded-2xl border border-[#2B3C5C] bg-[#0A1224] px-4">
                  <Ionicons name="search-outline" size={20} color="#93A5C2" />
                  <TextInput
                    className="min-w-0 flex-1 px-3 py-4 text-white"
                    placeholder="Buscar una galaxia..."
                    placeholderTextColor="#647896"
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>

                {isDesktop ? (
                  <View className="mt-4 flex-row flex-wrap items-center gap-3">
                    {studentClassFilters.map((filter) => {
                      const active = selectedFilter === filter.id
                      return (
                        <Pressable
                          key={filter.id}
                          accessibilityRole="button"
                          onPress={() => setSelectedFilter(filter.id)}
                          className="rounded-full border px-4 py-2.5"
                          style={{
                            borderColor: active ? accentColor : '#2B3C5C',
                            backgroundColor: active ? `${accentColor}2E` : '#0A1224',
                          }}
                        >
                          <Text className="font-black" style={{ color: active ? '#FFFFFF' : '#B8C4DC' }}>{filter.label}</Text>
                        </Pressable>
                      )
                    })}
                    <View className="ml-auto flex-row items-center gap-2">
                      {studentClassSorts.map((sort) => {
                        const active = selectedSort === sort.id
                        return (
                          <Pressable
                            key={sort.id}
                            accessibilityRole="button"
                            onPress={() => setSelectedSort(sort.id)}
                            className="rounded-full px-4 py-2.5"
                            style={{ backgroundColor: active ? '#253153' : '#0A1224' }}
                          >
                            <Text className="font-bold" style={{ color: active ? '#FFFFFF' : '#8FA2C1' }}>{sort.label}</Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                ) : (
                  <View className="mt-4 flex-row gap-3">
                    <CompactSelect
                      label="Estado"
                      value={getFilterLabel(selectedFilter)}
                      open={openFilterMenu === 'state'}
                      onToggle={() => setOpenFilterMenu((current) => current === 'state' ? null : 'state')}
                      options={studentClassFilters.map((filter) => ({
                        key: filter.id,
                        label: filter.label,
                        active: selectedFilter === filter.id,
                        onPress: () => {
                          setSelectedFilter(filter.id)
                          setOpenFilterMenu(null)
                        },
                      }))}
                    />
                    <CompactSelect
                      label="Orden"
                      value={getSortLabel(selectedSort)}
                      open={openFilterMenu === 'sort'}
                      onToggle={() => setOpenFilterMenu((current) => current === 'sort' ? null : 'sort')}
                      options={studentClassSorts.map((sort) => ({
                        key: sort.id,
                        label: sort.label,
                        active: selectedSort === sort.id,
                        onPress: () => {
                          setSelectedSort(sort.id)
                          setOpenFilterMenu(null)
                        },
                      }))}
                    />
                  </View>
                )}
              </View>
            ) : null}

            {hasActiveMobileFilters && !showMobileFilters ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir filtros activos"
                onPress={() => setShowMobileFilters(true)}
                className="mb-4 self-start flex-row items-center gap-2 rounded-full border border-[#3A4260] bg-[#131A2E] px-4 py-2"
              >
                <Ionicons name="funnel" size={14} color="#A96CFF" />
                <Text className="text-[12px] font-black text-[#C4B3FF]">{getFilterLabel(selectedFilter)}</Text>
              </Pressable>
            ) : null}

            <CourseGalaxyMap
              items={classRows.map((subject) => {
                const progress = progressBySubject[getCourseRowKey(subject)]
                const progressPercent = progress?.percent ?? 0
                const statusBadge = getMobileCourseStatusBadge(progress)
                return {
                  key: getCourseRowKey(subject),
                  title: subject.name,
                  subtitle: getMobileCourseSummary(progress, progressPercent),
                  progress: progressPercent,
                  color: subject.theme_color,
                  icon: subject.icon,
                  badgeLabel: statusBadge.label,
                  badgeColor: statusBadge.label === 'Repasar' ? '#DD365E' : statusBadge.label === 'Completado' ? '#159B79' : '#7C4DDB',
                  detailColor: statusBadge.color,
                  onPress: () => router.push(buildClassHref(subject) as any),
                  onMore: () => handleLeaveClass(subject),
                }
              })}
              inviteCode={inviteCode}
              joining={joining}
              onChangeInviteCode={setInviteCode}
              onJoin={handleJoinClass}
              emptyMessage={subjects.length > 0 ? 'Cambia los filtros para volver a ver tus cursos.' : 'Añade tu primera galaxia con el código de clase de tu profesor.'}
            />
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="classes" /> : null}
      <AppConfirmModal
        visible={Boolean(subjectToLeave)}
        variant="danger"
        title="¿Abandonar clase?"
        message={`Vas a salir de “${subjectToLeave?.name ?? ''}${subjectToLeave?.classroom_name ? ` · ${subjectToLeave.classroom_name}` : ''}”. Si quieres volver, necesitarás el código de invitación.`}
        cancelLabel="Cancelar"
        confirmLabel="Abandonar clase"
        busy={subjectToLeave ? leavingSubjectId === (subjectToLeave.classroom_id ?? subjectToLeave.id) : false}
        onCancel={() => setSubjectToLeave(null)}
        onConfirm={() => {
          if (!subjectToLeave) return
          void executeLeaveClass(subjectToLeave).then(() => setSubjectToLeave(null))
        }}
      />
    </View>
  )
}


function CompactSelect({
  label,
  onToggle,
  open,
  options,
  value,
}: {
  label: string
  onToggle: () => void
  open: boolean
  options: { key: string; label: string; active: boolean; onPress: () => void }[]
  value: string
}) {
  const { accentColor } = useAppTheme()

  return (
    <View className="relative flex-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        onPress={onToggle}
        className="flex-row items-center justify-between rounded-2xl border border-[#2B3C5C] bg-[#0A1224] px-4 py-3"
      >
        <View className="min-w-0 flex-1">
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-[#8294B2]">{label}</Text>
          <Text className="mt-1 font-black text-white" numberOfLines={1}>{value}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#B8C4DC" />
      </Pressable>

      {open ? (
        <View className="absolute left-0 right-0 top-[68px] z-30 overflow-hidden rounded-2xl border border-[#354866] bg-[#0A1224]">
          {options.map((option) => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              onPress={option.onPress}
              className="flex-row items-center justify-between border-b border-[#1E2C45] px-4 py-3 last:border-b-0"
              style={{ backgroundColor: option.active ? `${accentColor}24` : 'transparent' }}
            >
              <Text className="font-bold" style={{ color: option.active ? '#FFFFFF' : '#CAD5E7' }}>
                {option.label}
              </Text>
              {option.active ? <Ionicons name="checkmark" size={17} color={accentColor} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function getMobileCourseStatusBadge(progress?: StudentProgressSubject) {
  const percent = progress?.percent ?? 0
  const failed = progress?.failedQuestions ?? 0
  const pending = progress?.pendingQuestions ?? 0

  if (failed > 0) {
    return { label: 'Repasar', color: '#FB7185' }
  }

  if (progress?.isCompleted || percent >= 100) {
    return { label: 'Completado', color: '#43D991' }
  }

  if (pending > 0 || percent > 0) {
    return { label: 'Continuar', color: '#A96CFF' }
  }

  return { label: 'Empezar', color: '#58B5FF' }
}

function getMobileCourseSummary(progress: StudentProgressSubject | undefined, progressPercent: number) {
  const failed = progress?.failedQuestions ?? 0
  const pending = progress?.pendingQuestions ?? 0

  if (failed > 0) {
    return `${failed} ${failed === 1 ? 'fallo pendiente' : 'fallos pendientes'}`
  }

  if (progress?.isCompleted || progressPercent >= 100) {
    return 'curso completado'
  }

  if (pending > 0) {
    return `${pending} ${pending === 1 ? 'misión por practicar' : 'misiones por practicar'}`
  }

  return progressPercent > 0 ? 'continúa tu viaje' : 'listo para despegar'
}

function buildClassHref(subject: Subject) {
  return {
    pathname: '/(student)/class/[id]',
    params: { id: String(subject.id), ...(subject.classroom_id ? { classroomId: String(subject.classroom_id) } : {}) },
  }
}

function getFilterLabel(value: ClassFilter) {
  return studentClassFilters.find((filter) => filter.id === value)?.label || 'Todas'
}

function getSortLabel(value: ClassSort) {
  return studentClassSorts.find((sort) => sort.id === value)?.label || 'Reciente'
}

function getCourseRowKey(subject: { id: number; classroom_id?: number | null }) {
  return getScoreRowKey(subject.id, subject.classroom_id) || String(subject.id)
}

function getProgressRowKey(subject: StudentProgressSubject) {
  return getScoreRowKey(subject.id, subject.classroomId) || String(subject.id)
}

function getScoreRowKey(subjectId?: number | null, classroomId?: number | null) {
  if (typeof subjectId !== 'number') return null
  return `${subjectId}:${classroomId ?? 'general'}`
}

function normalizeRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function getSortableTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}
