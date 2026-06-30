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
import { Link, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AppConfirmModal from '../../components/AppConfirmModal'
import { supabase } from '../../lib/supabase'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentSidebar from '../../components/StudentSidebar'
import BrandLogo from '../../components/BrandLogo'
import NotificationBadge from '../../components/NotificationBadge'
import { fetchStudentProgressSummary, type StudentProgressSubject } from '../../lib/studentProgress'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentHeaderAvatar from '../../components/student/StudentHeaderAvatar'
import { useAppTheme } from '../../lib/appTheme'
import { joinClassByInviteCode } from '../../lib/studentClassJoin'

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
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectScores, setSubjectScores] = useState<Record<string, number>>({})
  const [topicsBySubject, setTopicsBySubject] = useState<Record<string, number>>({})
  const [teacherNamesBySubject, setTeacherNamesBySubject] = useState<Record<string, string>>({})
  const [lastActivityBySubject, setLastActivityBySubject] = useState<Record<string, string | null>>({})
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

  const recommendedCourse = useMemo(() => {
    return classRows
      .map((subject) => ({
        subject,
        progress: progressBySubject[getCourseRowKey(subject)],
      }))
      .sort((a, b) => {
        const failedDiff = (b.progress?.failedQuestions ?? 0) - (a.progress?.failedQuestions ?? 0)
        if (failedDiff !== 0) return failedDiff

        const pendingDiff = (b.progress?.pendingQuestions ?? 0) - (a.progress?.pendingQuestions ?? 0)
        if (pendingDiff !== 0) return pendingDiff

        return (b.progress?.percent ?? 0) - (a.progress?.percent ?? 0)
      })[0]
  }, [classRows, progressBySubject])

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

  const fetchClasses = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) return

      const [profileResult, enrollmentsResult, scoresResult, progressResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, points, avatar').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('id, student_id, subject_id, classroom_id, joined_at, subjects(id, name, description, icon, theme_color, teacher_id), classrooms(id, name, code)')
          .eq('student_id', userId)
          .order('joined_at', { ascending: false }),
        supabase
          .from('subject_scores')
          .select('subject_id, classroom_id, max_score, played_at')
          .eq('student_id', userId),
        fetchStudentProgressSummary(userId),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (scoresResult.error) throw scoresResult.error

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

      const subjectIds = Array.from(new Set(nextSubjects.map((subject) => subject.id).filter(Boolean)))
      const classroomIds = nextSubjects
        .map((subject) => subject.classroom_id)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

      if (subjectIds.length > 0) {
        const teacherIds = Array.from(
          new Set(
            nextSubjects
              .map((subject) => subject.teacher_id)
              .filter((value): value is string => typeof value === 'string' && value.length > 0)
          )
        )

        const [topicsResult, teachersResult] = await Promise.all([
          supabase
            .from('subject_topics')
            .select('subject_id, classroom_id')
            .in('subject_id', subjectIds)
            .in('classroom_id', classroomIds.length > 0 ? classroomIds : [-1])
            .eq('active', true),
          teacherIds.length > 0
            ? supabase.from('profiles').select('id, alias').in('id', teacherIds)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (topicsResult.error) throw topicsResult.error
        if (teachersResult.error) throw teachersResult.error

        const nextTopicsBySubject: Record<string, number> = {}
        nextSubjects.forEach((subject) => {
          const key = getCourseRowKey(subject)
          nextTopicsBySubject[key] = topicsResult.data?.filter((topic) =>
            Number(topic.subject_id) === Number(subject.id)
            && Number(topic.classroom_id ?? 0) === Number(subject.classroom_id ?? 0)
          ).length || 0
        })
        setTopicsBySubject(nextTopicsBySubject)

        const teachersById = new Map<string, string>(
          (teachersResult.data || []).map((teacher: { id: string; alias: string | null }) => [teacher.id, teacher.alias || 'Profesor/a'])
        )
        const nextTeacherNamesBySubject: Record<string, string> = {}
        nextSubjects.forEach((subject) => {
          const teacherId = subject.teacher_id
          if (typeof teacherId === 'string') {
            nextTeacherNamesBySubject[getCourseRowKey(subject)] = teachersById.get(teacherId) || 'Profesor/a'
          }
        })
        setTeacherNamesBySubject(nextTeacherNamesBySubject)
      } else {
        setTopicsBySubject({})
        setTeacherNamesBySubject({})
      }

      const scoreMap: Record<string, number> = {}
      const activityMap: Record<string, string | null> = {}
      scoresResult.data?.forEach((score) => {
        const scoreKey = getScoreRowKey(score.subject_id, score.classroom_id)
        if (scoreKey && score.max_score !== null) {
          scoreMap[scoreKey] = score.max_score
        }
        if (scoreKey) {
          const currentTimestamp = getSortableTimestamp(activityMap[scoreKey])
          const nextTimestamp = getSortableTimestamp(score.played_at)
          if (nextTimestamp >= currentTimestamp) {
            activityMap[scoreKey] = score.played_at ?? null
          }
        }
      })
      setSubjectScores(scoreMap)
      setLastActivityBySubject(activityMap)
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
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color={accentColor} />
        <Text className="mt-4 text-[#8FA7C7]">Cargando tus cursos...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
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
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 22 : 18,
            paddingBottom: isDesktop ? 28 : 104,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              {!isDesktop ? (
                <BrandLogo size={30} style={{ marginBottom: 12 }} />
              ) : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="book" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Mis Cursos</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Administra tus cursos y continúa aprendiendo
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <NotificationBadge />
              <StudentHeaderAvatar />
            </View>
          </View>

          <View className={isDesktop ? 'flex-row gap-4' : 'gap-4'}>
            <StatCard icon="school" color={accentColor} value={String(activeClasses)} label="Cursos activos" detail="Sigue aprendiendo 🚀" />
            <StatCard icon="refresh-circle" color="#FB7185" value={String(failedQuestions)} label="Fallos pendientes" detail="Para repasar" />
            <StatCard icon="help-circle" color="#58B5FF" value={String(pendingQuestions)} label="Por practicar" detail="Preguntas disponibles" />
            <StatCard icon="time" color="#F6A64A" value={`${points.toLocaleString()} XP`} label="XP global" detail="Acumulada en tu perfil" />
          </View>

          {recommendedCourse?.progress ? (
            <RecommendedCourseCard
              subject={recommendedCourse.subject}
              progress={recommendedCourse.progress}
            />
          ) : null}

          <View className="mt-5 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
            <View className="mb-4 gap-3">
              <View className="min-w-[220px] flex-1 flex-row items-center rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4">
                <Ionicons name="search-outline" size={18} color="#7F91AD" />
                <TextInput
                  className="min-w-0 flex-1 px-3 py-3 text-white"
                  placeholder="Buscar curso..."
                  placeholderTextColor="#60799C"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              {isDesktop ? (
                <View className="flex-row flex-wrap items-center gap-3">
                  <View className="flex-row gap-2">
                    {studentClassFilters.map((filter) => {
                      const active = selectedFilter === filter.id
                      return (
                        <Pressable
                          key={filter.id}
                          onPress={() => setSelectedFilter(filter.id)}
                          className="rounded-lg px-5 py-3"
                          style={{ backgroundColor: active ? accentColor : '#0A1A34' }}
                        >
                          <Text className={`font-bold ${active ? 'text-white' : 'text-[#AFC2DB]'}`}>{filter.label}</Text>
                        </Pressable>
                      )
                    })}
                  </View>

                  <View className="ml-auto flex-row flex-wrap items-center gap-2">
                    <Text className="font-semibold text-[#AFC2DB]">Ordenar por:</Text>
                    {studentClassSorts.map((sort) => {
                      const active = selectedSort === sort.id
                      return (
                        <Pressable
                          key={sort.id}
                          onPress={() => setSelectedSort(sort.id)}
                          className="rounded-lg px-4 py-3"
                          style={{ backgroundColor: active ? accentColor : '#0A1A34' }}
                        >
                          <Text className={`font-bold ${active ? 'text-white' : 'text-[#AFC2DB]'}`}>{sort.label}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              ) : (
                <View className="flex-row gap-3">
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

            <View style={{ gap: 8 }}>
              {classRows.length > 0 ? (
                classRows.map((subject, index) => (
                  <ClassRow
                    key={getCourseRowKey(subject)}
                    subject={subject}
                    index={index}
                    isFallback={false}
                    score={subjectScores[getCourseRowKey(subject)]}
                    topicsCount={topicsBySubject[getCourseRowKey(subject)] || 0}
                    teacherName={teacherNamesBySubject[getCourseRowKey(subject)]}
                    lastActivityAt={lastActivityBySubject[getCourseRowKey(subject)] || null}
                    progress={progressBySubject[getCourseRowKey(subject)]}
                    onLeave={handleLeaveClass}
                    leaving={leavingSubjectId === (subject.classroom_id ?? subject.id)}
                  />
                ))
              ) : (
                <EmptyClasses hasAnyClasses={subjects.length > 0} />
              )}
            </View>

            <JoinClassCard
              inviteCode={inviteCode}
              joining={joining}
              onChangeCode={setInviteCode}
              onJoin={handleJoinClass}
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

function StatCard({
  icon,
  color,
  value,
  label,
  detail,
}: {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  value: string
  label: string
  detail: string
}) {
  return (
    <View className="min-w-[210px] flex-1 flex-row items-center gap-4 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[24px] font-black text-white">{value}</Text>
        <Text className="mt-1 text-[13px] font-bold text-[#DDE7F4]">{label}</Text>
        <Text className="mt-1 text-[13px] text-[#8FA7C7]">{detail}</Text>
      </View>
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
        onPress={onToggle}
        className="flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3"
      >
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-bold uppercase text-[#8FA7C7]">{label}</Text>
          <Text className="mt-0.5 font-bold text-white" numberOfLines={1}>{value}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color="#AFC2DB" />
      </Pressable>

      {open ? (
        <View className="absolute left-0 right-0 top-[66px] z-30 overflow-hidden rounded-xl border border-[#263E61] bg-[#08172E]">
          {options.map((option) => (
            <Pressable
              key={option.key}
              onPress={option.onPress}
              className="flex-row items-center justify-between border-b border-[#172A4A] px-4 py-3 last:border-b-0"
              style={{ backgroundColor: option.active ? `${accentColor}24` : 'transparent' }}
            >
              <Text className="font-bold" style={{ color: option.active ? accentColor : '#DDE7F4' }}>
                {option.label}
              </Text>
              {option.active ? <Ionicons name="checkmark" size={16} color={accentColor} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function RecommendedCourseCard({
  progress,
  subject,
}: {
  progress: StudentProgressSubject
  subject: Subject
}) {
  const { accentColor } = useAppTheme()
  const failed = progress.failedQuestions ?? 0
  const pending = progress.pendingQuestions ?? 0
  const title = failed > 0 ? `Repasa ${subject.name}` : `Continúa ${subject.name}`
  const detail = failed > 0
    ? `Tienes ${failed} ${failed === 1 ? 'fallo pendiente' : 'fallos pendientes'} en ${subject.classroom_name || 'tu clase'}.`
    : pending > 0
      ? `Tienes ${pending} ${pending === 1 ? 'pregunta' : 'preguntas'} por practicar.`
      : `Puedes repetir el curso para mejorar tu puntuación.`
  const buttonLabel = failed > 0 ? 'Repasar ahora' : pending > 0 ? 'Continuar' : 'Repetir'

  return (
    <View className="mt-5 overflow-hidden rounded-2xl border border-[#2B3F7A] bg-[#101D4A] p-5">
      <View className="absolute right-[-34px] top-[-44px] h-36 w-36 rounded-full bg-[#6C5CE7]/20" />
      <Text className="text-[12px] font-black uppercase tracking-[0.08em] text-[#A78BFA]">Recomendado para ti</Text>
      <Text className="mt-2 text-[22px] font-black text-white">{title}</Text>
      <Text className="mt-1 text-[13px] leading-5 text-[#AFC2DB]">{detail}</Text>
      <Link href={buildClassHref(subject) as any} asChild>
        <Pressable className="mt-4 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: accentColor }}>
          <Ionicons name={failed > 0 ? 'refresh' : pending > 0 ? 'play-forward' : 'repeat'} size={16} color="#FFFFFF" />
          <Text className="font-black text-white">{buttonLabel}</Text>
        </Pressable>
      </Link>
    </View>
  )
}

function getClassProgressStatus(progress?: StudentProgressSubject) {
  const percent = progress?.percent ?? 0
  const failed = progress?.failedQuestions ?? 0
  const pending = progress?.pendingQuestions ?? 0

  if (failed > 0) {
    return {
      label: 'Repasar fallos',
      color: '#FB7185',
      backgroundColor: '#2A1420',
      icon: 'refresh-circle-outline' as const,
    }
  }

  if (pending > 0 && percent > 0) {
    return {
      label: 'Continuar',
      color: '#FBBF24',
      backgroundColor: '#2A210F',
      icon: 'play-forward-outline' as const,
    }
  }

  if (progress?.isCompleted || percent >= 100) {
    return {
      label: 'Completado',
      color: '#43D991',
      backgroundColor: '#0F2F2B',
      icon: 'checkmark-circle-outline' as const,
    }
  }

  return {
    label: 'Sin empezar',
    color: '#AFC2DB',
    backgroundColor: '#122544',
    icon: 'play-circle-outline' as const,
  }
}

function getPrimaryCourseActionLabel(progress: StudentProgressSubject | undefined, progressPercent: number) {
  if ((progress?.failedQuestions ?? 0) > 0) return 'Repasar fallos'
  if ((progress?.pendingQuestions ?? 0) > 0) return 'Continuar'
  if (progressPercent > 0) return 'Repetir'
  return 'Empezar'
}

function getPrimaryCourseActionIcon(progress: StudentProgressSubject | undefined, progressPercent: number): keyof typeof Ionicons.glyphMap {
  if ((progress?.failedQuestions ?? 0) > 0) return 'refresh'
  if ((progress?.pendingQuestions ?? 0) > 0) return 'play-forward'
  if (progressPercent > 0) return 'repeat'
  return 'play'
}

function getCourseActionMessage(progress?: StudentProgressSubject) {
  const failed = progress?.failedQuestions ?? 0
  const pending = progress?.pendingQuestions ?? 0

  if (failed > 0) {
    return `Tienes ${failed} ${failed === 1 ? 'fallo' : 'fallos'} para repasar`
  }

  if (pending > 0) {
    return `${pending} ${pending === 1 ? 'pregunta pendiente' : 'preguntas pendientes'} por practicar`
  }

  if ((progress?.percent ?? 0) > 0) {
    return 'Curso completado'
  }

  return 'Listo para empezar'
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

function ClassRow({
  subject,
  index,
  isFallback,
  score,
  topicsCount,
  teacherName,
  lastActivityAt,
  progress,
  onLeave,
  leaving,
}: {
  subject: Subject
  index: number
  isFallback: boolean
  score?: number
  topicsCount: number
  teacherName?: string
  lastActivityAt?: string | null
  progress?: StudentProgressSubject
  onLeave: (subject: Subject) => void
  leaving: boolean
}) {
  const colors = ['#43D991', '#8B5CF6', '#3B82F6', '#F6A64A', '#718096']
  const iconNames: (keyof typeof Ionicons.glyphMap)[] = ['book', 'calculator', 'flask', 'business', 'color-palette']
  const color = subject.theme_color || colors[index] || '#58B5FF'
  const hasScore = typeof score === 'number'
  const progressPercent = progress?.percent ?? 0
  const scoreLabel = hasScore ? `${score.toLocaleString()} XP` : isFallback ? 'Demo' : 'Sin XP'
  const teacherLabel = teacherName ? `Profesor/a: ${teacherName}` : 'Profesor/a no asignado'
  const topicsLabel = `${topicsCount} tema${topicsCount === 1 ? '' : 's'}`
  const status = getClassProgressStatus(progress)
  const activityLabel = formatLastActivity(lastActivityAt)
  const { accentColor } = useAppTheme()
  const [optionsOpen, setOptionsOpen] = React.useState(false)
  const totalQuestions = progress?.totalQuestions ?? 0
  const primaryActionLabel = getPrimaryCourseActionLabel(progress, progressPercent)
  const primaryActionIcon = getPrimaryCourseActionIcon(progress, progressPercent)
  const actionMessage = getCourseActionMessage(progress)
  const metaParts = [
    subject.classroom_name || 'Clase principal',
    topicsLabel,
    `${totalQuestions} pregunta${totalQuestions === 1 ? '' : 's'}`,
  ]

  const content = (
    <View className="rounded-xl border border-[#172A4A] bg-[#0B1A32] p-4">
      <View className="flex-row flex-wrap items-start gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}24` }}>
          {subject.icon && !isFallback ? (
            <Text className="text-2xl">{subject.icon}</Text>
          ) : (
            <Ionicons name={iconNames[index] || 'book'} size={28} color={color} />
          )}
        </View>

        <View className="min-w-[240px] flex-1">
          <Text className="text-[18px] font-black text-white">{subject.name}</Text>
          <Text className="mt-1 text-[13px] text-[#AFC2DB]" numberOfLines={1}>{metaParts.join(' · ')}</Text>
          <Text className="mt-2 text-[14px] font-black" style={{ color: status.color }}>{actionMessage}</Text>

          <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13294C]">
            <View className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: status.color }} />
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <View className="flex-row items-center gap-1 rounded px-2 py-1" style={{ backgroundColor: status.backgroundColor }}>
              <Ionicons name={status.icon} size={12} color={status.color} />
              <Text className="text-[12px] font-bold" style={{ color: status.color }}>{status.label}</Text>
            </View>
            <View className="rounded bg-[#122544] px-2 py-1">
              <Text className="text-[12px] text-[#AFC2DB]">{progressPercent}% completado</Text>
            </View>
            <View className="rounded bg-[#122544] px-2 py-1">
              <Text className="text-[12px] text-[#AFC2DB]">{scoreLabel}</Text>
            </View>
            <View className="rounded bg-[#122544] px-2 py-1">
              <Text className="text-[12px] text-[#AFC2DB]">{teacherLabel}</Text>
            </View>
          </View>
        </View>

        <View className="items-end">
          <View className="flex-row items-center gap-3">
          {isFallback ? (
            <Pressable
              className="flex-row items-center gap-2 rounded-lg px-4 py-3"
              style={{ backgroundColor: accentColor }}
            >
              <Ionicons name="play" size={15} color="#FFFFFF" />
              <Text className="font-bold text-white">Continuar</Text>
            </Pressable>
          ) : (
            <>
              <Link
                href={{
                  pathname: '/(student)/class/[id]',
                  params: { id: String(subject.id), ...(subject.classroom_id ? { classroomId: String(subject.classroom_id) } : {}) },
                }}
                asChild
              >
                <Pressable className="flex-row items-center gap-2 rounded-lg px-4 py-3" style={{ backgroundColor: accentColor }}>
                  <Ionicons name={primaryActionIcon} size={15} color="#FFFFFF" />
                  <Text className="font-bold text-white">{primaryActionLabel}</Text>
                </Pressable>
              </Link>
              <View className="relative">
                <Pressable
                  onPress={() => setOptionsOpen((current) => !current)}
                  disabled={leaving}
                  className="flex-row items-center gap-2 rounded-lg border border-[#263E61] bg-[#071326] px-3 py-3"
                  style={({ pressed }) => ({ opacity: leaving ? 0.7 : pressed ? 0.84 : 1 })}
                >
                  {leaving ? (
                    <ActivityIndicator color="#AFC2DB" />
                  ) : (
                    <>
                      <Text className="font-bold text-[#DDE7F4]">Más opciones</Text>
                      <Ionicons name={optionsOpen ? 'chevron-up' : 'chevron-down'} size={15} color="#AFC2DB" />
                    </>
                  )}
                </Pressable>
                {optionsOpen ? (
                  <View className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-xl border border-[#263E61] bg-[#08172E]">
                    <Link
                      href={{
                        pathname: '/(student)/class/[id]',
                        params: { id: String(subject.id), ...(subject.classroom_id ? { classroomId: String(subject.classroom_id) } : {}) },
                      }}
                      asChild
                    >
                      <Pressable className="flex-row items-center gap-2 px-4 py-3" onPress={() => setOptionsOpen(false)}>
                        <Ionicons name="albums-outline" size={16} color="#AFC2DB" />
                        <Text className="font-bold text-[#DDE7F4]">Ver detalles</Text>
                      </Pressable>
                    </Link>
                    <Pressable
                      onPress={() => {
                        setOptionsOpen(false)
                        onLeave(subject)
                      }}
                      className="flex-row items-center gap-2 border-t border-[#172A4A] px-4 py-3"
                    >
                      <Ionicons name="exit-outline" size={16} color="#FF6B6B" />
                      <Text className="font-bold text-[#FF6B6B]">Abandonar clase</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </>
          )}
          </View>

          <Text className="mt-2 text-right text-[13px] text-[#8FA7C7]">{activityLabel}</Text>
        </View>
      </View>
    </View>
  )

  return content
}

function JoinClassCard({
  inviteCode,
  joining,
  onChangeCode,
  onJoin,
}: {
  inviteCode: string
  joining: boolean
  onChangeCode: (value: string) => void
  onJoin: () => void
}) {
  const { accentColor } = useAppTheme()

  return (
    <View className="mt-4 flex-row flex-wrap items-center gap-4 rounded-2xl border border-dashed bg-[#101B49] p-5" style={{ borderColor: accentColor }}>
      <View className="h-14 w-14 items-center justify-center rounded-full border bg-[#0D1D3B]" style={{ borderColor: accentColor }}>
        <Ionicons name="add" size={28} color={accentColor} />
      </View>
      <View className="min-w-[220px] flex-1">
        <Text className="text-[16px] font-black" style={{ color: accentColor }}>Unirse a un curso o clase</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]">
          ¿Tienes un código de invitación? Únete y empieza a aprender.
        </Text>
      </View>
      <View className="flex-row gap-3">
        <TextInput
          className="w-36 rounded-xl border border-[#253C67] bg-[#091A35] px-4 py-3 text-center font-bold uppercase tracking-widest text-white"
          placeholder="CÓDIGO"
          placeholderTextColor="#60799C"
          value={inviteCode}
          onChangeText={(value) => onChangeCode(value.trim().toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
        />
        <Pressable
          onPress={onJoin}
          disabled={joining}
          className="flex-row items-center justify-center gap-2 rounded-xl border px-5 py-3"
          style={({ pressed }) => ({ borderColor: accentColor, opacity: joining ? 0.7 : pressed ? 0.82 : 1 })}
        >
          {joining ? <ActivityIndicator color={accentColor} /> : <Text className="font-bold" style={{ color: accentColor }}>Unirse</Text>}
          {!joining ? <Ionicons name="arrow-forward" size={16} color={accentColor} /> : null}
        </Pressable>
      </View>
    </View>
  )
}

function EmptyClasses({ hasAnyClasses }: { hasAnyClasses: boolean }) {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#20375E] bg-[#0D1D3B] px-4 py-6">
      <Ionicons name="school-outline" size={34} color="#60799C" />
      <Text className="mt-3 text-center font-bold text-white">
        {hasAnyClasses ? 'No hay cursos que coincidan' : 'Aún no tienes cursos'}
      </Text>
      <Text className="mt-1 text-center text-[12px] leading-5 text-[#8FA7C7]">
        {hasAnyClasses
          ? 'Cambia el filtro o la búsqueda para ver más cursos.'
          : 'Introduce el código de tu profesor para unirte a un curso o clase real.'}
      </Text>
    </View>
  )
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

function formatLastActivity(value: string | null | undefined) {
  if (!value) return 'Sin actividad'

  const timestamp = getSortableTimestamp(value)
  if (timestamp === 0) return 'Sin actividad'

  const now = Date.now()
  const diffDays = Math.floor((now - timestamp) / 86_400_000)

  if (diffDays <= 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `${diffDays} días atrás`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} semana${weeks === 1 ? '' : 's'} atrás`
  }

  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(timestamp))
}
