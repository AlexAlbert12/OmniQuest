import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import { supabase } from '../../lib/supabase'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentSidebar from '../../components/student/StudentSidebar'
import { fetchStudentProgressSummary, type StudentProgressSubject } from '../../lib/studentProgress'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { useAppModal } from '../../components/AppModalProvider'
import { useResponsiveLayout } from '../../lib/responsive'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { CourseGalaxyMap } from '../../components/student/galaxy/StudentGalaxyMap'
import { readThroughCache } from '../../lib/offlineCache'
import { enqueueOfflineMutation } from '../../lib/offlineMutations'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import { isValidInviteCode, normalizeInviteCode } from '../../lib/classCode'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'
import OmniLoadingScreen from '../../components/ui/OmniLoadingScreen'

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
type ClassesCacheSnapshot = {
  profile: Profile
  subjects: Subject[]
  progressBySubject: Record<string, StudentProgressSubject>
}

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
  const responsive = useResponsiveLayout()
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
  const [openFilterMenu, setOpenFilterMenu] = useState<'state' | 'sort' | null>(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const isDesktop = responsive.isDesktop
  const { accentColor, tokens } = useAppTheme()
  const { showModal } = useAppModal()
  const { lastSyncedAt } = useOfflineSync()
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
        return compareCourseIdentity(left, right)
      }

      if (selectedSort === 'progress') {
        const rightProgress = progressBySubject[getCourseRowKey(right)]?.percent ?? 0
        const leftProgress = progressBySubject[getCourseRowKey(left)]?.percent ?? 0
        return rightProgress - leftProgress || compareCourseIdentity(left, right)
      }

      return getSortableTimestamp(right.joined_at) - getSortableTimestamp(left.joined_at)
        || compareCourseIdentity(left, right)
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
  const activeMobileFilterSummary = [
    selectedFilter !== 'all' ? getFilterLabel(selectedFilter) : null,
    selectedSort !== 'recent' ? `Orden: ${getSortLabel(selectedSort)}` : null,
    search.trim() ? `“${search.trim()}”` : null,
  ].filter(Boolean).join(' · ')
  const resetClassFilters = () => {
    setSelectedFilter('all')
    setSelectedSort('recent')
    setSearch('')
    setOpenFilterMenu(null)
  }

  const fetchClasses = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) return

      await readThroughCache<ClassesCacheSnapshot>({
        userId,
        resource: 'student:classes',
        fetcher: async () => {
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

          const nextProgress = progressResult.subjects.reduce<Record<string, StudentProgressSubject>>((acc, subject) => {
            acc[getProgressRowKey(subject)] = subject
            return acc
          }, {})
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
          return { profile: profileResult.data, subjects: nextSubjects, progressBySubject: nextProgress }
        },
        onData: (snapshot) => {
          setProfile(snapshot.profile)
          setProgressBySubject(snapshot.progressBySubject)
          setSubjects(snapshot.subjects)
          setLoading(false)
        },
      })
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

  useEffect(() => {
    if (lastSyncedAt) void fetchClasses()
  }, [fetchClasses, lastSyncedAt])

  const showAlert = (title: string, message: string) => {
    showModal({
      title,
      message,
      variant: title.toLowerCase().includes('error') ? 'error' : 'info',
    })
  }

  const handleJoinClass = async () => {
    setJoining(true)
    try {
      const normalizedCode = normalizeInviteCode(inviteCode)
      if (!isValidInviteCode(normalizedCode)) throw new Error('El código debe tener 6 caracteres alfanuméricos.')
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) throw new Error('No hay sesión activa.')
      await enqueueOfflineMutation({
        userId,
        kind: 'class.join',
        entityKey: `class:join:${normalizedCode}`,
        conflictPolicy: 'server_wins',
        payload: { code: normalizedCode },
      })
      showAlert('Solicitud guardada', 'La unión al curso se sincronizará automáticamente cuando haya conexión.')
      setInviteCode('')
    } catch (error: any) {
      showAlert('Error', error.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) return <OmniLoadingScreen />

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background-secondary">
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
            onSignOut={() => signOutCurrentDeviceSession()}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 24 : 18,
            paddingBottom: isDesktop ? 70 : MOBILE_BOTTOM_NAV_SPACER + 28,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full">
            <StudentPageHeader
              compactMobileTitle
              icon="book"
              isDesktop={isDesktop}
              mobileStackedIdentity={!isDesktop}
              title="Mis cursos"
              showNotifications
              showAvatar
              actionsPosition="top"
              actions={subjects.length > 0 ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showMobileFilters ? 'Ocultar filtros de cursos' : 'Mostrar filtros de cursos'}
                    onPress={() => setShowMobileFilters((value) => !value)}
                    className="h-12 w-12 items-center justify-center rounded-2xl border border-border-default bg-surface-interactive"
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                  >
                    <Ionicons name={showMobileFilters ? 'close' : 'options'} size={24} color={showMobileFilters ? tokens.brand.student : tokens.text.secondary} />
                  </Pressable>
                </>
              ) : undefined}
            />

            <View className={isDesktop ? 'mb-8 flex-row gap-4' : 'mb-6 flex-row gap-2'}>
              <MobileMetricCard
                compact={isDesktop}
                dense={!isDesktop}
                icon="school"
                color="#8B5CF6"
                value={activeClasses}
                label="Cursos"
                style={{ flex: 1, minWidth: 0 }}
              />
              <MobileMetricCard
                compact={isDesktop}
                dense={!isDesktop}
                icon="flame"
                color="#FB4772"
                value={failedQuestions}
                label="Repasar"
                style={{ flex: 1, minWidth: 0 }}
              />
              <MobileMetricCard
                compact={isDesktop}
                dense={!isDesktop}
                icon="star-outline"
                color="#4EC4FF"
                value={pendingQuestions}
                label="Practicar"
                style={{ flex: 1, minWidth: 0 }}
              />
              <MobileMetricCard
                compact={isDesktop}
                dense={!isDesktop}
                icon="sparkles"
                color="#F6A64A"
                value={`${points.toLocaleString()} XP`}
                label="Experiencia"
                style={{ flex: 1, minWidth: 0 }}
              />
            </View>

            {subjects.length > 5 ? (
              <View className="mb-5 flex-row items-center rounded-2xl border border-border-default bg-surface-default px-4">
                <Ionicons name="search-outline" size={20} color={tokens.text.muted} />
                <TextInput
                  accessibilityLabel="Buscar en mis cursos"
                  accessibilityHint="Filtra los cursos por nombre, clase o descripción"
                  className="min-w-0 flex-1 px-3 py-4 text-text-primary"
                  placeholder="Buscar entre mis cursos..."
                  placeholderTextColor={tokens.text.disabled}
                  value={search}
                  onChangeText={setSearch}
                />
                {search ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Limpiar búsqueda"
                    onPress={() => setSearch('')}
                    className="h-10 w-10 items-center justify-center rounded-xl"
                  >
                    <Ionicons name="close" size={18} color={tokens.text.muted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {showMobileFilters && subjects.length > 0 ? (
              <View className="mb-8 rounded-[24px] border border-border-default bg-surface-default p-4" style={{ position: 'relative', zIndex: openFilterMenu ? 50 : 1, overflow: 'visible' }}>
                <View className="mb-3 flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[13px] font-black text-text-primary">Filtrar y ordenar</Text>
                    <Text className="mt-1 text-[11px] leading-4 text-text-muted">Ajusta la lista sin perder de vista el criterio activo.</Text>
                  </View>
                  {hasActiveMobileFilters ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Restablecer filtros de cursos" onPress={resetClassFilters} className="min-h-10 flex-row items-center gap-1.5 rounded-xl border border-border-default bg-surface-interactive px-3 py-2" style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
                      <Ionicons name="refresh-outline" size={15} color={tokens.brand.student} />
                      <Text className="text-[11px] font-black" style={{ color: tokens.brand.student }}>Restablecer</Text>
                    </Pressable>
                  ) : null}
                </View>

                {subjects.length <= 5 ? (
                  <View className="flex-row items-center rounded-2xl border border-border-default bg-background-primary px-4">
                    <Ionicons name="search-outline" size={20} color={tokens.text.muted} />
                    <TextInput
                      accessibilityLabel="Buscar en mis cursos"
                      className="min-w-0 flex-1 px-3 py-4 text-text-primary"
                      placeholder="Buscar un curso..."
                      placeholderTextColor={tokens.text.disabled}
                      value={search}
                      onChangeText={setSearch}
                    />
                    {search ? <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda de cursos" onPress={() => setSearch('')} className="h-10 w-10 items-center justify-center rounded-xl"><Ionicons name="close" size={18} color={tokens.text.muted} /></Pressable> : null}
                  </View>
                ) : null}

                {isDesktop ? (
                  <View className="mt-4 flex-row flex-wrap items-center gap-3">
                    {studentClassFilters.map((filter) => {
                      const active = selectedFilter === filter.id
                      return (
                        <Pressable
                          key={filter.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Filtrar cursos por ${filter.label}`}
                          accessibilityState={{ selected: active }}
                          onPress={() => setSelectedFilter(filter.id)}
                          className="rounded-full border px-4 py-2.5"
                          style={({ pressed }) => ({
                            borderColor: active ? accentColor : tokens.border.default,
                            backgroundColor: active ? withAlpha(accentColor, '2E') : tokens.surface.interactive,
                            opacity: pressed ? 0.78 : 1,
                          })}
                        >
                          <Text className="font-black" style={{ color: active ? tokens.text.primary : tokens.text.secondary }}>{filter.label}</Text>
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
                            accessibilityLabel={`Ordenar cursos por ${sort.label}`}
                            accessibilityState={{ selected: active }}
                            onPress={() => setSelectedSort(sort.id)}
                            className="rounded-full border px-4 py-2.5"
                            style={({ pressed }) => ({ borderColor: active ? tokens.border.active : tokens.border.default, backgroundColor: active ? tokens.surface.selected : tokens.surface.interactive, opacity: pressed ? 0.78 : 1 })}
                          >
                            <Text className="font-bold" style={{ color: active ? tokens.text.primary : tokens.text.secondary }}>{sort.label}</Text>
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

            {subjects.length > 0 && hasActiveMobileFilters && !showMobileFilters ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir filtros activos"
                onPress={() => setShowMobileFilters(true)}
                className="mb-4 self-start flex-row items-center gap-2 rounded-full border border-border-default bg-surface-disabled px-4 py-2"
              >
                <Ionicons name="funnel" size={14} color={tokens.brand.student} />
                <Text className="text-[12px] font-black text-text-secondary">{activeMobileFilterSummary || 'Filtros activos'}</Text>
              </Pressable>
            ) : null}

            <CourseGalaxyMap
              density={isDesktop ? 'comfortable' : 'compact'}
              items={classRows.map((subject) => {
                const progress = progressBySubject[getCourseRowKey(subject)]
                const progressPercent = progress?.percent ?? 0
                const statusBadge = getMobileCourseStatusBadge(progress)
                const group = progress?.isCompleted || progressPercent >= 100
                  ? 'completed' as const
                  : (progress?.failedQuestions ?? 0) > 0
                    ? 'practice' as const
                    : 'in_progress' as const
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
                  group,
                  onPress: () => router.push(buildClassHref(subject) as any),
                  testID: `student-course-${subject.id}-${subject.classroom_id ?? 'all'}`,
                }
              })}
              inviteCode={inviteCode}
              joining={joining}
              onChangeInviteCode={setInviteCode}
              onJoin={handleJoinClass}
              emptyMessage={subjects.length > 0 ? 'Cambia los filtros para volver a ver tus cursos.' : 'Añade tu primer curso con el código de clase de tu profesor.'}
            />
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="classes" /> : null}
    </SafeAreaView>
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
  const { accentColor, tokens } = useAppTheme()

  return (
    <View className="relative flex-1" style={{ zIndex: open ? 60 : 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityHint="Abre las opciones disponibles"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        className="flex-row items-center justify-between rounded-2xl border px-4 py-3"
        style={({ pressed }) => ({ borderColor: tokens.border.default, backgroundColor: open ? tokens.surface.selected : tokens.surface.interactive, opacity: pressed ? 0.8 : 1 })}
      >
        <View className="min-w-0 flex-1">
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-text-muted">{label}</Text>
          <Text className="mt-1 font-black text-text-primary" numberOfLines={1}>{value}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={open ? accentColor : tokens.text.secondary} />
      </Pressable>

      {open ? (
        <View className="absolute left-0 right-0 top-[68px] z-30 overflow-hidden rounded-2xl border" style={{ zIndex: 70, elevation: 18, borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
          {options.map((option) => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityState={{ selected: option.active }}
              onPress={option.onPress}
              className="flex-row items-center justify-between border-b px-4 py-3 last:border-b-0"
              style={({ pressed }) => ({ borderColor: tokens.border.default, backgroundColor: option.active ? withAlpha(accentColor, '24') : pressed ? tokens.surface.interactive : tokens.surface.raised })}
            >
              <Text className="font-bold" style={{ color: option.active ? tokens.text.primary : tokens.text.secondary }}>{option.label}</Text>
              {option.active ? <Ionicons name="checkmark-circle" size={17} color={accentColor} /> : null}
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

function compareCourseIdentity(left: Subject, right: Subject) {
  return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
    || (left.classroom_id ?? 0) - (right.classroom_id ?? 0)
    || left.id - right.id
}
