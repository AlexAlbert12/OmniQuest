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
import StudentSidebar from '../../components/StudentSidebar'
import NotificationBadge from '../../components/NotificationBadge'

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
}

export default function ClassesScreen() {
  const { width } = useWindowDimensions()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectScores, setSubjectScores] = useState<Record<number, number>>({})
  const [topicsBySubject, setTopicsBySubject] = useState<Record<number, number>>({})
  const [inviteCode, setInviteCode] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [leavingSubjectId, setLeavingSubjectId] = useState<number | null>(null)

  const isDesktop = width >= 1024
  const classRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) return subjects

    return subjects.filter((subject) =>
      `${subject.name} ${subject.description || ''}`.toLowerCase().includes(normalizedSearch)
    )
  }, [search, subjects])

  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = Math.floor(points / 100) + 1
  const nextLevelProgress = points % 100
  const realScores = useMemo(() => Object.values(subjectScores), [subjectScores])
  const activeClasses = subjects.length
  const averageScore = realScores.length > 0
    ? Math.round(realScores.reduce((total, score) => total + score, 0) / realScores.length)
    : 0
  const averageProgress = subjects.length > 0
    ? Math.round((realScores.length / subjects.length) * 100)
    : 0

  const fetchClasses = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) return

      const [profileResult, enrollmentsResult, scoresResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, points, avatar').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('*, subjects(id, name, description, icon, theme_color)')
          .eq('student_id', userId)
          .order('joined_at', { ascending: false }),
        supabase
          .from('subject_scores')
          .select('subject_id, max_score')
          .eq('student_id', userId),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (scoresResult.error) throw scoresResult.error

      setProfile(profileResult.data)
      setSubjects(
        enrollmentsResult.data
          ?.map((enrollment: any) => enrollment.subjects)
          .filter(Boolean) || []
      )

      const subjectIds = enrollmentsResult.data
        ?.map((enrollment: any) => enrollment.subjects?.id)
        .filter(Boolean) || []

      if (subjectIds.length > 0) {
        const { data: topicsData, error: topicsError } = await supabase
          .from('subject_topics')
          .select('subject_id')
          .in('subject_id', subjectIds)
          .eq('active', true)

        if (topicsError) throw topicsError

        const nextTopicsBySubject: Record<number, number> = {}
        subjectIds.forEach((subjectId: number) => {
          nextTopicsBySubject[subjectId] = topicsData?.filter((topic) => Number(topic.subject_id) === Number(subjectId)).length || 0
        })
        setTopicsBySubject(nextTopicsBySubject)
      } else {
        setTopicsBySubject({})
      }

      const scoreMap: Record<number, number> = {}
      scoresResult.data?.forEach((score) => {
        if (score.subject_id !== null && score.max_score !== null) {
          scoreMap[score.subject_id] = score.max_score
        }
      })
      setSubjectScores(scoreMap)
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
    if (!inviteCode.trim() || inviteCode.length !== 6) {
      return showAlert('Error', 'El código debe tener 6 caracteres.')
    }

    setJoining(true)
    try {
      const { data: session } = await supabase.auth.getSession()

      const { data: subject, error: subjectError } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('code', inviteCode.toUpperCase())
        .single()

      if (subjectError || !subject) {
        throw new Error('No se ha encontrado ninguna clase con ese código.')
      }

      const { error: enrollError } = await supabase
        .from('enrollments')
        .insert([{ student_id: session.session?.user.id, subject_id: subject.id }])

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
        <ActivityIndicator size="large" color="#6574FF" />
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
            onComingSoon={showComingSoon}
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
            </View>
          </View>

          <View className={isDesktop ? 'flex-row gap-4' : 'gap-4'}>
            <StatCard icon="school" color="#6574FF" value={String(activeClasses)} label="Clases activas" detail="Sigue aprendiendo 🚀" />
            <StatCard icon="checkmark-circle" color="#43D991" value={`${averageProgress}%`} label="Clases completadas" detail="Con puntuación guardada" />
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
                {['Todas', 'En progreso', 'Completadas'].map((filter, index) => (
                  <Pressable
                    key={filter}
                    onPress={() => index > 0 && showComingSoon(`Filtro ${filter.toLowerCase()}`)}
                    className={`rounded-lg px-5 py-3 ${index === 0 ? 'bg-[#4F46E5]' : 'bg-[#0A1A34]'}`}
                  >
                    <Text className={`font-bold ${index === 0 ? 'text-white' : 'text-[#AFC2DB]'}`}>{filter}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable className="ml-auto flex-row items-center gap-2 rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3">
                <Text className="font-semibold text-[#AFC2DB]">Ordenar por: Reciente</Text>
                <Ionicons name="chevron-down" size={16} color="#AFC2DB" />
              </Pressable>
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
                    onComingSoon={showComingSoon}
                    onLeave={handleLeaveClass}
                    leaving={leavingSubjectId === subject.id}
                  />
                ))
              ) : (
                <EmptyClasses />
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

      {!isDesktop ? <BottomNav /> : null}
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
        <Text className="mt-1 text-[12px] font-bold text-[#DDE7F4]">{label}</Text>
        <Text className="mt-1 text-[11px] text-[#8FA7C7]">{detail}</Text>
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
  onComingSoon,
  onLeave,
  leaving,
}: {
  subject: Subject
  index: number
  isFallback: boolean
  score?: number
  topicsCount: number
  onComingSoon: (feature: string) => void
  onLeave: (subject: Subject) => void
  leaving: boolean
}) {
  const colors = ['#43D991', '#8B5CF6', '#3B82F6', '#F6A64A', '#718096']
  const iconNames: (keyof typeof Ionicons.glyphMap)[] = ['book', 'calculator', 'flask', 'business', 'color-palette']
  const teacherNames = ['Laura Smith', 'Carlos Ruiz', 'Ana Gómez', 'Miguel Torres', 'Sofía Hernández']
  const progressValues = [75, 60, 45, 50, 30]
  const lessons = ['15 / 20', '12 / 20', '9 / 20', '10 / 20', '6 / 20']
  const activity = ['Hoy', 'Ayer', 'Ayer', '2 días atrás', '3 días atrás']
  const color = subject.theme_color || colors[index] || '#58B5FF'
  const hasScore = typeof score === 'number'
  const progress = hasScore ? 100 : progressValues[index] || 35
  const scoreLabel = hasScore ? `${score.toLocaleString()} XP` : isFallback ? 'Demo' : 'Sin nota'

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
        <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>
          {subject.description || 'Preguntas y ejercicios disponibles'}
        </Text>
        <View className="mt-2 self-start rounded bg-[#122544] px-2 py-1">
          <Text className="text-[10px] text-[#AFC2DB]">
            {isFallback ? `Profesor/a: ${teacherNames[index] || 'OmniQuest'}` : `${topicsCount} tema${topicsCount === 1 ? '' : 's'} disponible${topicsCount === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>

      <View className="hidden flex-1 md:flex">
        <Text className="mb-2 text-[12px] text-[#AFC2DB]">Progreso</Text>
        <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color }} />
        </View>
      </View>
      <Text className="mx-4 hidden w-10 text-right text-[13px] text-[#DDE7F4] md:flex">{progress}%</Text>

      <View className="hidden w-24 border-l border-[#172A4A] pl-5 lg:flex">
        <Text className="text-[11px] text-[#8FA7C7]">Lecciones</Text>
        <Text className="mt-1 font-bold text-[#43D991]">{lessons[index] || '7 / 20'}</Text>
      </View>

      <View className="hidden w-28 border-l border-[#172A4A] pl-5 lg:flex">
        <Text className="text-[11px] text-[#8FA7C7]">Mejor nota</Text>
        <Text className="mt-1 font-bold text-[#9B6CFF]">{scoreLabel}</Text>
      </View>

      <View className="ml-4 items-end">
        <View className="flex-row items-center gap-3">
          {isFallback ? (
            <Pressable
              onPress={() => onComingSoon('Las preguntas de ejemplo')}
              className="flex-row items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-3"
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
                <Pressable className="flex-row items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-3">
                  <Ionicons name="albums" size={15} color="#FFFFFF" />
                  <Text className="font-bold text-white">Ver temas</Text>
                </Pressable>
              </Link>
              <Pressable
                onPress={() => onLeave(subject)}
                disabled={leaving}
                className="flex-row items-center gap-2 rounded-lg border border-[#7F1D1D] bg-[#2A0B18] px-4 py-3"
                style={({ pressed }) => ({ opacity: leaving ? 0.7 : pressed ? 0.84 : 1 })}
              >
                {leaving ? (
                  <ActivityIndicator color="#FF6B6B" />
                ) : (
                  <Ionicons name="exit-outline" size={15} color="#FF6B6B" />
                )}
                <Text className="font-bold text-[#FF6B6B]">Abandonar clase</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={() => onComingSoon('Más opciones de clase')}>
            <Ionicons name="ellipsis-vertical" size={18} color="#7F91AD" />
          </Pressable>
        </View>
        <Text className="mt-2 text-[10px] text-[#8FA7C7]">
          {hasScore ? `Mejor nota: ${score.toLocaleString()} XP` : `Última actividad: ${activity[index] || 'Hoy'}`}
        </Text>
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
  return (
    <View className="mt-4 flex-row flex-wrap items-center gap-4 rounded-2xl border border-dashed border-[#5364F5] bg-[#101B49] p-5">
      <View className="h-14 w-14 items-center justify-center rounded-full border border-[#5364F5] bg-[#0D1D3B]">
        <Ionicons name="add" size={28} color="#8290FF" />
      </View>
      <View className="min-w-[220px] flex-1">
        <Text className="text-[16px] font-black text-[#8290FF]">Unirse a una nueva clase</Text>
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
          onChangeText={onChangeCode}
          maxLength={6}
          autoCapitalize="characters"
        />
        <Pressable
          onPress={onJoin}
          disabled={joining}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-[#5364F5] px-5 py-3"
          style={({ pressed }) => ({ opacity: joining ? 0.7 : pressed ? 0.82 : 1 })}
        >
          {joining ? <ActivityIndicator color="#8290FF" /> : <Text className="font-bold text-[#8290FF]">Unirse a clase</Text>}
          {!joining ? <Ionicons name="arrow-forward" size={16} color="#8290FF" /> : null}
        </Pressable>
      </View>
    </View>
  )
}

function EmptyClasses() {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#20375E] bg-[#0D1D3B] px-4 py-6">
      <Ionicons name="school-outline" size={34} color="#60799C" />
      <Text className="mt-3 text-center font-bold text-white">Aún no tienes clases</Text>
      <Text className="mt-1 text-center text-[12px] leading-5 text-[#8FA7C7]">
        Introduce el código de tu profesor para unirte a una clase real.
      </Text>
    </View>
  )
}

function BottomNav() {
  return (
    <View className="absolute bottom-3 left-4 right-4 flex-row justify-around rounded-2xl border border-[#1A3155] bg-[#09162C] py-3">
      <Link href="/(student)/homeStudent" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="home-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Inicio</Text>
        </Pressable>
      </Link>

      <Pressable className="items-center">
        <Ionicons name="book" size={22} color="#B09BFF" />
        <Text className="mt-1 text-[11px] font-bold text-[#B09BFF]">Clases</Text>
      </Pressable>

      <Link href="/(student)/profile" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="person-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Perfil</Text>
        </Pressable>
      </Link>

      <Link href="/(student)/settings" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="settings-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Configuración</Text>
        </Pressable>
      </Link>
    </View>
  )
}
