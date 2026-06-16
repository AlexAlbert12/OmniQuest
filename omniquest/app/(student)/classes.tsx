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
import { supabase } from '../../lib/supabase'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentSidebar from '../../components/StudentSidebar'
import NotificationBadge from '../../components/NotificationBadge'
import { fetchStudentProgressSummary, type StudentProgressSubject } from '../../lib/studentProgress'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentHeaderAvatar from '../../components/student/StudentHeaderAvatar'
import { useAppTheme } from '../../lib/appTheme'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
}

type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
  teacher_id?: string | null
  joined_at?: string | null
}

type ClassFilter = 'all' | 'in_progress' | 'completed'
type ClassSort = 'recent' | 'name' | 'progress'

const studentClassFilters: { id: ClassFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
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
  const [subjectScores, setSubjectScores] = useState<Record<number, number>>({})
  const [topicsBySubject, setTopicsBySubject] = useState<Record<number, number>>({})
  const [teacherNamesBySubject, setTeacherNamesBySubject] = useState<Record<number, string>>({})
  const [lastActivityBySubject, setLastActivityBySubject] = useState<Record<number, string | null>>({})
  const [progressBySubject, setProgressBySubject] = useState<Record<number, StudentProgressSubject>>({})
  const [selectedFilter, setSelectedFilter] = useState<ClassFilter>('all')
  const [selectedSort, setSelectedSort] = useState<ClassSort>('recent')
  const [inviteCode, setInviteCode] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [leavingSubjectId, setLeavingSubjectId] = useState<number | null>(null)

  const isDesktop = width >= 1024
  const { accentColor } = useAppTheme()
  const classRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    let rows = subjects

    if (selectedFilter === 'in_progress') {
      rows = rows.filter((subject) => !(progressBySubject[subject.id]?.isCompleted))
    }

    if (selectedFilter === 'completed') {
      rows = rows.filter((subject) => Boolean(progressBySubject[subject.id]?.isCompleted))
    }

    if (normalizedSearch) {
      rows = rows.filter((subject) =>
        `${subject.name} ${subject.description || ''}`.toLowerCase().includes(normalizedSearch)
      )
    }

    return [...rows].sort((left, right) => {
      if (selectedSort === 'name') {
        return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
      }

      if (selectedSort === 'progress') {
        const rightProgress = progressBySubject[right.id]?.percent ?? 0
        const leftProgress = progressBySubject[left.id]?.percent ?? 0
        return rightProgress - leftProgress || left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
      }

      return getSortableTimestamp(right.joined_at) - getSortableTimestamp(left.joined_at)
    })
  }, [progressBySubject, search, selectedFilter, selectedSort, subjects])

  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const realScores = useMemo(() => Object.values(subjectScores), [subjectScores])
  const progressSubjects = useMemo(() => Object.values(progressBySubject), [progressBySubject])
  const activeClasses = subjects.length
  const classesWithScore = subjects.filter((subject) => typeof subjectScores[subject.id] === 'number').length
  const averageScore = realScores.length > 0
    ? Math.round(realScores.reduce((total, score) => total + score, 0) / realScores.length)
    : 0
  const averageProgress = subjects.length > 0
    ? Math.round(subjects.reduce((total, subject) => total + (progressBySubject[subject.id]?.percent ?? 0), 0) / subjects.length)
    : 0

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
          .select('*, subjects(id, name, description, icon, theme_color, teacher_id)')
          .eq('student_id', userId)
          .order('joined_at', { ascending: false }),
        supabase
          .from('subject_scores')
          .select('subject_id, max_score, played_at')
          .eq('student_id', userId),
        fetchStudentProgressSummary(userId),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (scoresResult.error) throw scoresResult.error

      setProfile(profileResult.data)
      setProgressBySubject(
        progressResult.subjects.reduce<Record<number, StudentProgressSubject>>((acc, subject) => {
          acc[subject.id] = subject
          return acc
        }, {})
      )
      setSubjects(
        enrollmentsResult.data
          ?.map((enrollment: any) =>
            enrollment.subjects
              ? { ...enrollment.subjects, joined_at: enrollment.joined_at ?? null }
              : null
          )
          .filter(Boolean) || []
      )

      const subjectIds = enrollmentsResult.data
        ?.map((enrollment: any) => enrollment.subjects?.id)
        .filter(Boolean) || []

      if (subjectIds.length > 0) {
        const teacherIds = Array.from(
          new Set(
            enrollmentsResult.data
              ?.map((enrollment: any) => enrollment.subjects?.teacher_id)
              .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0) || []
          )
        )

        const [topicsResult, teachersResult] = await Promise.all([
          supabase
            .from('subject_topics')
            .select('subject_id')
            .in('subject_id', subjectIds)
            .eq('active', true),
          teacherIds.length > 0
            ? supabase.from('profiles').select('id, alias').in('id', teacherIds)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (topicsResult.error) throw topicsResult.error
        if (teachersResult.error) throw teachersResult.error

        const nextTopicsBySubject: Record<number, number> = {}
        subjectIds.forEach((subjectId: number) => {
          nextTopicsBySubject[subjectId] = topicsResult.data?.filter((topic) => Number(topic.subject_id) === Number(subjectId)).length || 0
        })
        setTopicsBySubject(nextTopicsBySubject)

        const teachersById = new Map(
          (teachersResult.data || []).map((teacher: { id: string; alias: string | null }) => [teacher.id, teacher.alias || 'Profesor/a'])
        )
        const nextTeacherNamesBySubject: Record<number, string> = {}
        enrollmentsResult.data?.forEach((enrollment: any) => {
          const subjectId = enrollment.subjects?.id
          const teacherId = enrollment.subjects?.teacher_id
          if (typeof subjectId === 'number' && typeof teacherId === 'string') {
            nextTeacherNamesBySubject[subjectId] = teachersById.get(teacherId) || 'Profesor/a'
          }
        })
        setTeacherNamesBySubject(nextTeacherNamesBySubject)
      } else {
        setTopicsBySubject({})
        setTeacherNamesBySubject({})
      }

      const scoreMap: Record<number, number> = {}
      const activityMap: Record<number, string | null> = {}
      scoresResult.data?.forEach((score) => {
        if (score.subject_id !== null && score.max_score !== null) {
          scoreMap[score.subject_id] = score.max_score
        }
        if (score.subject_id !== null) {
          const currentTimestamp = getSortableTimestamp(activityMap[score.subject_id])
          const nextTimestamp = getSortableTimestamp(score.played_at)
          if (nextTimestamp >= currentTimestamp) {
            activityMap[score.subject_id] = score.played_at ?? null
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

  const showComingSoon = (feature: string) => {
    showAlert('Próximamente', `${feature} estará disponible en una próxima iteración.`)
  }

  const handleJoinClass = async () => {
    const normalizedCode = inviteCode.trim().toUpperCase()
    if (!normalizedCode || normalizedCode.length !== 6) {
      return showAlert('Error', 'El código debe tener 6 caracteres.')
    }

    setJoining(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) throw new Error('No hay sesión activa.')

      const { data: subject, error: subjectError } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('code', normalizedCode)
        .single()

      if (subjectError || !subject) {
        throw new Error('No se ha encontrado ninguna clase con ese código.')
      }

      const { error: enrollError } = await supabase
        .from('enrollments')
        .insert([{ student_id: userId, subject_id: subject.id }])

      if (enrollError) {
        if (enrollError.code === '23505') throw new Error('Ya estás matriculado en esta clase.')
        throw enrollError
      }

      showAlert('¡Éxito!', `Te has unido a ${subject.name}`)
      setInviteCode('')
      fetchClasses()
    } catch (error: any) {
      showAlert('Error', error.message)
    } finally {
      setJoining(false)
    }
  }

  const executeLeaveClass = async (subject: Subject) => {
    setLeavingSubjectId(subject.id)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) {
        throw new Error('No hay sesión activa.')
      }

      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('student_id', userId)
        .eq('subject_id', subject.id)

      if (error) throw error

      showAlert('Clase abandonada', `Has salido de ${subject.name}.`)
      fetchClasses()
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo abandonar la clase.')
    } finally {
      setLeavingSubjectId(null)
    }
  }

  const handleLeaveClass = (subject: Subject) => {
    const message = `Vas a abandonar ${subject.name}. Si quieres volver, necesitarás de nuevo el código de invitación.`

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        void executeLeaveClass(subject)
      }
      return
    }

    Alert.alert('Abandonar clase', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Abandonar',
        style: 'destructive',
        onPress: () => void executeLeaveClass(subject),
      },
    ])
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color={accentColor} />
        <Text className="mt-4 text-[#8FA7C7]">Cargando tus clases...</Text>
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
                <Text
                  className="mb-3 text-[#9FD6FF]"
                  style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}
                >
                  OmniQuest
                </Text>
              ) : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="book" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Mis Clases</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Administra tus clases y continúa aprendiendo
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <NotificationBadge />
              <StudentHeaderAvatar />
            </View>
          </View>

          <View className={isDesktop ? 'flex-row gap-4' : 'gap-4'}>
            <StatCard icon="school" color={accentColor} value={String(activeClasses)} label="Clases activas" detail="Sigue aprendiendo 🚀" />
            <StatCard icon="checkmark-circle" color="#43D991" value={`${classesWithScore} / ${activeClasses}`} label="Clases con nota" detail={`${averageProgress}% de progreso medio`} />
            <StatCard icon="star" color="#F6A64A" value={averageScore > 0 ? `${averageScore} XP` : '0 XP'} label="Promedio de nota" detail="Basado en tus mejores notas" />
            <StatCard icon="time" color="#58B5FF" value={`${points.toLocaleString()} XP`} label="XP global" detail="Acumulada en tu perfil" />
          </View>

          <View className="mt-5 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
            <View className="mb-4 flex-row flex-wrap items-center gap-3">
              <View className="min-w-[220px] flex-1 flex-row items-center rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4">
                <Ionicons name="search-outline" size={18} color="#7F91AD" />
                <TextInput
                  className="min-w-0 flex-1 px-3 py-3 text-white"
                  placeholder="Buscar clase..."
                  placeholderTextColor="#60799C"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

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

            <View style={{ gap: 8 }}>
              {classRows.length > 0 ? (
                classRows.map((subject, index) => (
                  <ClassRow
                    key={subject.id}
                    subject={subject}
                    index={index}
                    isFallback={false}
                    score={subjectScores[subject.id]}
                    topicsCount={topicsBySubject[subject.id] || 0}
                    teacherName={teacherNamesBySubject[subject.id]}
                    lastActivityAt={lastActivityBySubject[subject.id] || null}
                    progress={progressBySubject[subject.id]}
                    onLeave={handleLeaveClass}
                    leaving={leavingSubjectId === subject.id}
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
  const scoreLabel = hasScore ? `${score.toLocaleString()} XP` : isFallback ? 'Demo' : 'Sin nota'
  const teacherLabel = teacherName ? `Profesor/a: ${teacherName}` : 'Profesor/a no asignado'
  const topicsLabel = `${topicsCount} tema${topicsCount === 1 ? '' : 's'}`
  const statusTag = progress?.isCompleted ? 'Completada' : hasScore ? 'Con nota' : null
  const activityLabel = formatLastActivity(lastActivityAt)
  const { accentColor } = useAppTheme()

  const content = (
    <View className="flex-row items-center rounded-xl border border-[#172A4A] bg-[#0B1A32] p-4">
      <View className="h-14 w-14 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}24` }}>
        {subject.icon && !isFallback ? (
          <Text className="text-2xl">{subject.icon}</Text>
        ) : (
          <Ionicons name={iconNames[index] || 'book'} size={28} color={color} />
        )}
      </View>

      <View className="ml-4 min-w-0 flex-[1.25]">
        <Text className="text-[18px] font-black text-white">{subject.name}</Text>
        <Text className="mt-1 text-[13px] text-[#AFC2DB]" numberOfLines={1}>
          {subject.description || 'Preguntas y ejercicios disponibles'}
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <View className="rounded bg-[#122544] px-2 py-1">
            <Text className="text-[12px] text-[#AFC2DB]">
              {teacherLabel}
            </Text>
          </View>
          {statusTag ? (
            <View className="rounded bg-[#1F2F42] px-2 py-1">
              <Text className="text-[12px] font-bold" style={{ color: accentColor }}>{statusTag}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="hidden flex-1 md:flex">
        <Text className="mb-2 text-[13px] text-[#AFC2DB]">Progreso</Text>
        <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: color }} />
        </View>
      </View>
      <Text className="mx-4 hidden w-10 text-right text-[13px] text-[#DDE7F4] md:flex">{progressPercent}%</Text>

      <View className="hidden w-24 border-l border-[#172A4A] pl-5 lg:flex">
        <Text className="text-[13px] text-[#8FA7C7]">Temas</Text>
        <Text className="mt-1 font-bold text-[#43D991]">{topicsLabel}</Text>
      </View>

      <View className="hidden w-28 border-l border-[#172A4A] pl-5 lg:flex">
        <Text className="text-[13px] text-[#8FA7C7]">Mejor nota</Text>
        <Text className="mt-1 font-bold" style={{ color: accentColor }}>{scoreLabel}</Text>
      </View>

      <View className="ml-4 items-end">
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
                  params: { id: String(subject.id) },
                }}
                asChild
              >
                <Pressable className="flex-row items-center gap-2 rounded-lg px-4 py-3" style={{ backgroundColor: accentColor }}>
                  <Ionicons name="albums" size={15} color="#FFFFFF" />
                  <Text className="font-bold text-white">Ver temas</Text>
                </Pressable>
              </Link>
              <Pressable
                onPress={() => onLeave(subject)}
                disabled={leaving}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#7F1D1D] bg-[#120A14]"
                style={({ pressed }) => ({ opacity: leaving ? 0.7 : pressed ? 0.84 : 1 })}
              >
                {leaving ? (
                  <ActivityIndicator color="#FF6B6B" />
                ) : (
                  <Ionicons name="ellipsis-horizontal" size={18} color="#FF6B6B" />
                )}
              </Pressable>
            </>
          )}
        </View>

        <Text className="mt-2 text-right text-[13px] text-[#8FA7C7]">{activityLabel}</Text>
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
        <Text className="text-[16px] font-black" style={{ color: accentColor }}>Unirse a una nueva clase</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]">
          ¿Tienes un código de clase? Únete y empieza a aprender.
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
          {joining ? <ActivityIndicator color={accentColor} /> : <Text className="font-bold" style={{ color: accentColor }}>Unirse a clase</Text>}
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
        {hasAnyClasses ? 'No hay clases que coincidan' : 'Aún no tienes clases'}
      </Text>
      <Text className="mt-1 text-center text-[12px] leading-5 text-[#8FA7C7]">
        {hasAnyClasses
          ? 'Cambia el filtro o la búsqueda para ver más clases.'
          : 'Introduce el código de tu profesor para unirte a una clase real.'}
      </Text>
    </View>
  )
}

function getNextClassSort(current: ClassSort) {
  const currentIndex = studentClassSorts.findIndex((sort) => sort.id === current)
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % studentClassSorts.length : 0
  return studentClassSorts[nextIndex].id
}

function getClassSortLabel(current: ClassSort) {
  return studentClassSorts.find((sort) => sort.id === current)?.label || 'Reciente'
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
