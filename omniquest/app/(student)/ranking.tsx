import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentSidebar from '../../components/student/StudentSidebar'
import BrandLogo from '../../components/BrandLogo'
import NotificationBadge from '../../components/NotificationBadge'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentHeaderAvatar from '../../components/student/StudentHeaderAvatar'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
  role_id?: string | null
}

type RankingLeague = {
  name: string
  minPoints: number
  nextMinPoints: number | null
  color: string
  icon: keyof typeof Ionicons.glyphMap
}

type RankingScope = 'weekly' | 'global' | 'class'

type ClassOption = {
  id: number
  subjectId: number
  classroomId: number
  name: string
  classroomName: string
  classroomCode: string | null
  description: string | null
  icon: string | null
  theme_color: string | null
}

type WeeklyAttemptRow = {
  student_id: string | null
  earned_points?: number | null
  is_correct?: boolean | null
}

type RankingAttemptRow = {
  student_id: string | null
  earned_points?: number | null
  is_correct?: boolean | null
  created_at?: string | null
  attempted_at?: string | null
}

const rankingLeagues: RankingLeague[] = [
  { name: 'Bronce', minPoints: 0, nextMinPoints: 500, color: '#CD7F32', icon: 'shield-outline' },
  { name: 'Plata', minPoints: 500, nextMinPoints: 1500, color: '#CBD5E1', icon: 'shield-half-outline' },
  { name: 'Oro', minPoints: 1500, nextMinPoints: 3000, color: '#FBBF24', icon: 'medal-outline' },
  { name: 'Platino', minPoints: 3000, nextMinPoints: 6000, color: '#67E8F9', icon: 'diamond-outline' },
  { name: 'Diamante', minPoints: 6000, nextMinPoints: null, color: '#A78BFA', icon: 'diamond' },
]

export default function RankingScreen() {
  const { width } = useWindowDimensions()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedScope, setSelectedScope] = useState<RankingScope>('weekly')
  const [selectedLeagueName, setSelectedLeagueName] = useState<string | null>(null)
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const { accentColor } = useAppTheme()

  const isDesktop = width >= 1024
  const rankingRows = useMemo(() => profiles, [profiles])
  const selectedClass = classOptions.find((classOption) => classOption.id === selectedClassId) || null

  const points = currentProfile?.points ?? rankingRows.find((item) => item.id === currentUserId)?.points ?? 0
  const alias = currentProfile?.alias || 'Usuario'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const isGuest = currentProfile?.role_id === 'guest'
  const rankingPoints = selectedScope === 'global'
    ? points
    : rankingRows.find((item) => item.id === currentUserId)?.points ?? 0
  const league = getRankingLeague(rankingPoints)
  const selectedLeague = rankingLeagues.find((item) => item.name === selectedLeagueName) || league
  const selectedLeagueRows = useMemo(
    () => rankingRows.filter((item) => getRankingLeague(item.points ?? 0).name === selectedLeague.name),
    [rankingRows, selectedLeague.name]
  )
  const selectedLeagueMaxPoints = Math.max(...selectedLeagueRows.map((item) => item.points ?? 0), 1)
  const selectedRankIndex = selectedLeagueRows.findIndex((item) => item.id === currentUserId)
  const selectedRank = !isGuest && selectedRankIndex >= 0 ? selectedRankIndex + 1 : null
  const previousRival = selectedRankIndex > 0 ? selectedLeagueRows[selectedRankIndex - 1] : null
  const nextRival = selectedRankIndex >= 0 && selectedRankIndex < selectedLeagueRows.length - 1
    ? selectedLeagueRows[selectedRankIndex + 1]
    : null
  const xpToPreviousRival = previousRival
    ? Math.max(0, (previousRival.points ?? 0) - rankingPoints + 1)
    : 0
  const podiumRows = useMemo(
    () => selectedLeagueRows.filter((item) => (item.points ?? 0) > 0).slice(0, 3),
    [selectedLeagueRows]
  )
  const orderedPodiumRows = useMemo(() => {
    const first = podiumRows[0]
    const second = podiumRows[1]
    const third = podiumRows[2]

    if (!first || !second || !third) return []

    return [
      { item: second, position: 2 },
      { item: first, position: 1 },
      { item: third, position: 3 },
    ]
  }, [podiumRows])
  const rankingPointsLabel = selectedScope === 'class'
    ? 'Tu XP en esta clase'
    : selectedScope === 'weekly'
      ? 'Tu XP esta semana'
      : 'Tu XP en esta liga'
  const bestPointsLabel = selectedScope === 'class'
    ? 'Mejor XP de clase'
    : selectedScope === 'weekly'
      ? 'Mejor XP semanal'
      : 'Mejor XP del ranking'

  const fetchRanking = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id || null
      setCurrentUserId(userId)

      if (userId) {
        const profileResult = await supabase
          .from('profiles')
          .select('id, alias, points, avatar, role_id')
          .eq('id', userId)
          .single()

        if (profileResult.error) throw profileResult.error

        setCurrentProfile(profileResult.data || null)
      }

      const nextClassOptions = userId ? await fetchEnrolledClassOptions(userId) : []
      setClassOptions(nextClassOptions)

      let effectiveSelectedClassId = selectedClassId
      const hasSelectedClass = effectiveSelectedClassId
        ? nextClassOptions.some((classOption) => classOption.id === selectedClassId)
        : false

      if (selectedScope === 'class' && !hasSelectedClass) {
        effectiveSelectedClassId = nextClassOptions[0]?.id ?? null
        if (effectiveSelectedClassId !== selectedClassId) {
          setSelectedClassId(effectiveSelectedClassId)
        }
      } else if (selectedScope !== 'class' && selectedClassId && !hasSelectedClass) {
        effectiveSelectedClassId = null
        setSelectedClassId(null)
      }

      const nextProfiles = selectedScope === 'global'
        ? await fetchGlobalRanking()
        : selectedScope === 'weekly'
          ? await fetchWeeklyRanking()
          : effectiveSelectedClassId
            ? await fetchClassRanking(effectiveSelectedClassId)
            : []

      setProfiles(nextProfiles)
    } catch (error) {
      console.error('Error fetching ranking:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedClassId, selectedScope])

  const emptyRankingMessage = useMemo(() => {
    if (selectedScope === 'weekly') {
      return 'Aún no hay XP ganado esta semana.'
    }

    if (selectedScope === 'global') {
      return 'Aún no hay estudiantes con puntuación en el ranking.'
    }

    if (classOptions.length === 0) {
      return 'Aún no perteneces a ningún curso.'
    }

    if (!selectedClassId) {
      return 'Elige una clase del curso para comparar tu XP con sus alumnos.'
    }

    return `Aún no hay alumnos con puntuación en ${selectedClass ? `${selectedClass.name} · ${selectedClass.classroomName}` : 'esta clase'}.`
  }, [classOptions.length, selectedClass?.classroomName, selectedClass?.name, selectedClassId, selectedScope])

  useFocusEffect(
    useCallback(() => {
      fetchRanking()
    }, [fetchRanking])
  )

  useEffect(() => {
    let isMounted = true
    let subscription: any = null

    const setupSubscription = async () => {
      try {
        subscription = supabase
          .channel('public:profiles')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles' },
            (payload) => {
              if (!isMounted) return

              setProfiles((currentProfiles) => {
                const updated = currentProfiles.map((profile) =>
                  profile.id === payload.new.id
                    ? {
                      ...profile,
                      alias: payload.new.alias ?? profile.alias,
                      avatar: payload.new.avatar ?? profile.avatar,
                      points: selectedScope === 'global' ? payload.new.points : profile.points,
                    }
                    : profile
                )
                return updated.sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
              })

              if (payload.new.id === currentUserId) {
                setCurrentProfile((profile) => (profile ? { ...profile, ...payload.new } : profile))
              }
            }
          )
          .subscribe()
      } catch (error) {
        console.error('Error setting up Realtime subscription:', error)
      }
    }

    setupSubscription()

    return () => {
      isMounted = false
      if (subscription) {
        supabase.removeChannel(subscription)
      }
    }
  }, [currentUserId, selectedScope])

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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color={accentColor} />
        <Text className="mt-4 text-[#8FA7C7]">Actualizando ranking...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection="ranking"
            alias={alias}
            avatar={currentProfile?.avatar}
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
                <Ionicons name="trophy" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Ranking</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Compite, aprende y sube posiciones 🚀
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <NotificationBadge />
              <StudentHeaderAvatar />
            </View>
          </View>

          <LeagueCarousel
            leagues={rankingLeagues}
            currentLeague={league}
            selectedLeague={selectedLeague}
            points={rankingPoints}
            onSelect={(nextLeague) => setSelectedLeagueName(nextLeague.name)}
          />

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <View className={isDesktop ? 'flex-[1.45]' : ''}>
              <RankingTabs
                activeScope={selectedScope}
                onSelect={(nextScope) => {
                  if (nextScope === 'class' && !selectedClassId && classOptions.length > 0) {
                    setSelectedClassId(classOptions[0].id)
                  }
                  setSelectedScope(nextScope)
                }}
              />
              {selectedScope === 'class' ? (
                <ClassRankingSelector
                  classOptions={classOptions}
                  selectedClassId={selectedClassId}
                  onSelect={setSelectedClassId}
                />
              ) : null}
              <View className="mt-4 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
                <View className="mb-4 flex-row flex-wrap items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[16px] font-black text-white">Ranking de Liga {selectedLeague.name}</Text>
                    <Text className="mt-1 text-[12px] text-[#8FA7C7]">
                      {selectedScope === 'class'
                        ? `Dentro de ${selectedClass ? `${selectedClass.name} · ${selectedClass.classroomName}` : 'la clase seleccionada'}`
                        : selectedScope === 'weekly'
                          ? 'XP ganado durante los últimos 7 días.'
                          : 'Compites con estudiantes de tu misma liga.'}
                    </Text>
                  </View>
                  <View className="rounded-full border border-[#243D66] bg-[#0A1A34] px-3 py-2">
                    <Text className="text-[12px] font-black text-[#AFC2DB]">
                      {selectedLeagueRows.length} {selectedLeagueRows.length === 1 ? 'estudiante' : 'estudiantes'}
                    </Text>
                  </View>
                </View>

                {orderedPodiumRows.length === 3 ? (
                  <View className="mb-4 rounded-2xl border border-[#1A3155] bg-[#0A1A34] p-4">
                    <Text className="mb-3 text-[15px] font-black text-white">Podio de la liga</Text>
                    <View className="flex-row items-end justify-center gap-3">
                      {orderedPodiumRows.map(({ item, position }) => (
                        <PodiumCard
                          key={item.id}
                          item={item}
                          position={position}
                          isMe={item.id === currentUserId}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                <View className="mb-4 flex-row items-center border-b border-[#172A4A] pb-3">
                  <Text className="w-24 text-[12px] font-bold uppercase text-[#8FA7C7]">Posición</Text>
                  <Text className="min-w-0 flex-1 text-[12px] font-bold uppercase text-[#8FA7C7]">
                    Estudiante
                  </Text>
                  <Text className="w-24 text-right text-[12px] font-bold uppercase text-[#8FA7C7]">
                    {selectedScope === 'class' ? 'XP Clase' : 'XP'}
                  </Text>
                </View>

                <View style={{ gap: 6 }}>
                  {selectedLeagueRows.length > 0 ? (
                    selectedLeagueRows.slice(0, 8).map((item, index) => (
                      <RankingRow
                        key={item.id}
                        item={item}
                        index={index}
                        isMe={item.id === currentUserId}
                        maxPoints={selectedLeagueMaxPoints}
                      />
                    ))
                  ) : (
                    <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] px-4 py-8">
                      <Ionicons name={selectedLeague.minPoints > rankingPoints ? 'lock-closed-outline' : 'trophy-outline'} size={34} color="#8FA7C7" />
                      <Text className="mt-2 text-center text-[13px] text-[#AFC2DB]">
                        {rankingRows.length === 0
                          ? emptyRankingMessage
                          : `No hay estudiantes en Liga ${selectedLeague.name} para este ranking.`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View className={isDesktop ? 'flex-1 gap-5' : 'gap-5'}>
              <PositionCard
                rank={selectedRank}
                points={rankingPoints}
                isGuest={isGuest}
                totalRanked={selectedLeagueRows.length}
                league={selectedLeague}
                previousRival={previousRival}
                nextRival={nextRival}
                xpToPreviousRival={xpToPreviousRival}
              />
              <RankingSummaryCard
                points={rankingPoints}
                rankingRows={selectedLeagueRows}
                league={selectedLeague}
                pointsLabel={rankingPointsLabel}
                bestPointsLabel={bestPointsLabel}
                selectedScope={selectedScope}
              />
            </View>
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="ranking" /> : null}
    </View>
  )
}

async function fetchGlobalRanking() {
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, alias, points, avatar')
    .eq('role_id', 'student')
    .limit(80)

  if (profilesError) throw profilesError

  const profiles = (profilesData || []) as Profile[]
  if (profiles.length === 0) return []

  const studentIds = profiles.map((profile) => profile.id)
  const allTimePointsByStudent = await fetchAttemptPointsByStudent({
    studentIds,
    limit: 10000,
  })

  return profiles
    .map((profile) => {
      const profilePoints = profile.points ?? 0
      const attemptsPoints = allTimePointsByStudent.get(profile.id) ?? 0

      return {
        ...profile,
        points: Math.max(profilePoints, attemptsPoints),
      }
    })
    .sort((left, right) => (right.points ?? 0) - (left.points ?? 0))
    .slice(0, 50)
}

async function fetchWeeklyRanking(): Promise<Profile[]> {
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, alias, points, avatar')
    .eq('role_id', 'student')
    .limit(80)

  if (profilesError) throw profilesError

  const profiles = (profilesData || []) as Profile[]
  if (profiles.length === 0) return []

  const studentIds = profiles.map((profile) => profile.id)
  const weeklyPointsByStudent = await fetchAttemptPointsByStudent({
    studentIds,
    from: getCurrentWeekStart().toISOString(),
    limit: 5000,
  })

  return profiles
    .map((profile) => ({
      ...profile,
      points: weeklyPointsByStudent.get(profile.id) ?? 0,
    }))
    .filter((profile) => (profile.points ?? 0) > 0)
    .sort((left, right) => (right.points ?? 0) - (left.points ?? 0))
    .slice(0, 50)
}

async function fetchAttemptPointsByStudent({
  studentIds,
  from,
  limit,
}: {
  studentIds: string[]
  from?: string
  limit: number
}) {
  if (studentIds.length === 0) return new Map<string, number>()

  let query = (supabase.from('attempt_history') as any)
    .select('student_id, earned_points, is_correct, created_at, attempted_at')
    .in('student_id', studentIds)
    .limit(limit)

  if (from) {
    query = query.gte('created_at', from)
  }

  let attemptsResult = await query

  if (attemptsResult.error && isMissingSchemaError(attemptsResult.error.code)) {
    let fallbackQuery = (supabase.from('attempt_history') as any)
      .select('student_id, is_correct, created_at')
      .in('student_id', studentIds)
      .limit(limit)

    if (from) {
      fallbackQuery = fallbackQuery.gte('created_at', from)
    }

    attemptsResult = await fallbackQuery
  }

  if (attemptsResult.error) {
    if (isMissingSchemaError(attemptsResult.error.code)) {
      return new Map<string, number>()
    }
    throw attemptsResult.error
  }

  const pointsByStudent = new Map<string, number>()
    ; ((attemptsResult.data || []) as RankingAttemptRow[]).forEach((attempt) => {
      if (!attempt.student_id) return

      const attemptDate = attempt.attempted_at || attempt.created_at || null
      if (from && attemptDate && getTimeValue(attemptDate) < getTimeValue(from)) return

      const earnedPoints = typeof attempt.earned_points === 'number'
        ? attempt.earned_points
        : attempt.is_correct
          ? 10
          : 0

      pointsByStudent.set(attempt.student_id, (pointsByStudent.get(attempt.student_id) || 0) + earnedPoints)
    })

  return pointsByStudent
}

function getCurrentWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  const start = new Date(now)
  start.setDate(now.getDate() - daysFromMonday)
  start.setHours(0, 0, 0, 0)
  return start
}

async function fetchEnrolledClassOptions(userId: string): Promise<ClassOption[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      classroom_id,
      joined_at,
      subjects(id, name, description, icon, theme_color),
      classrooms(id, name, code)
    `)
    .eq('student_id', userId)
    .order('joined_at', { ascending: false })

  if (error) throw error

  const classOptions: ClassOption[] = (data || [])
    .map((enrollment: any) => {
      const subject = normalizeRelation(enrollment.subjects)
      const classroom = normalizeRelation(enrollment.classrooms)
      const classroomId = Number(enrollment.classroom_id ?? classroom?.id)

      if (!subject?.id || !Number.isFinite(classroomId)) return null

      return {
        id: classroomId,
        subjectId: Number(subject.id),
        classroomId,
        name: subject.name || 'Curso',
        classroomName: classroom?.name || 'Clase principal',
        classroomCode: classroom?.code || null,
        description: subject.description || null,
        icon: subject.icon || null,
        theme_color: subject.theme_color || null,
      } satisfies ClassOption
    })
    .filter((classOption: ClassOption | null): classOption is ClassOption => Boolean(classOption))

  return Array.from(
    new Map<number, ClassOption>(classOptions.map((classOption) => [classOption.classroomId, classOption])).values()
  )
}

async function fetchClassRanking(classroomId: number): Promise<Profile[]> {
  const { data: classEnrollments, error: classEnrollmentsError } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('classroom_id', classroomId)

  if (classEnrollmentsError) throw classEnrollmentsError

  const studentIds = Array.from(
    new Set(
      (classEnrollments || [])
        .map((enrollment: { student_id: string | null }) => enrollment.student_id)
        .filter((value): value is string => Boolean(value))
    )
  )

  if (studentIds.length === 0) {
    return []
  }

  const [profilesResult, scoresResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, alias, points, avatar')
      .eq('role_id', 'student')
      .in('id', studentIds)
      .limit(50),
    supabase
      .from('subject_scores')
      .select('student_id, max_score')
      .eq('classroom_id', classroomId)
      .in('student_id', studentIds),
  ])

  if (profilesResult.error) throw profilesResult.error
  if (scoresResult.error) throw scoresResult.error

  const scoresByStudent = new Map<string, number>()
    ; (scoresResult.data || []).forEach((score: { student_id: string | null; max_score: number | null }) => {
      if (!score.student_id) return
      scoresByStudent.set(score.student_id, Math.max(scoresByStudent.get(score.student_id) ?? 0, score.max_score ?? 0))
    })

  return ((profilesResult.data || []) as Profile[])
    .map((profile) => ({
      ...profile,
      points: scoresByStudent.get(profile.id) ?? 0,
    }))
    .sort((left, right) => (right.points ?? 0) - (left.points ?? 0))
}


function LeagueCarousel({
  leagues,
  currentLeague,
  selectedLeague,
  points,
  onSelect,
}: {
  leagues: RankingLeague[]
  currentLeague: RankingLeague
  selectedLeague: RankingLeague
  points: number
  onSelect: (league: RankingLeague) => void
}) {
  return (
    <View className="mb-5 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black text-white">Ligas</Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">
            Selecciona una liga para ver sus estudiantes y cuánto XP te falta para alcanzarla.
          </Text>
        </View>
        <View className="flex-row items-center gap-2 rounded-full border px-3 py-2" style={{ borderColor: currentLeague.color, backgroundColor: withAlpha(currentLeague.color, '24') }}>
          <Ionicons name={currentLeague.icon} size={15} color={currentLeague.color} />
          <Text className="text-[12px] font-black" style={{ color: currentLeague.color }}>
            Tu liga: {currentLeague.name}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
        {leagues.map((rankingLeague) => {
          const isSelected = selectedLeague.name === rankingLeague.name
          const isCurrent = currentLeague.name === rankingLeague.name
          const isLocked = points < rankingLeague.minPoints
          const nextLeague = getNextRankingLeague(rankingLeague)
          const xpToReach = Math.max(0, rankingLeague.minPoints - points)
          const xpToNext = rankingLeague.nextMinPoints === null ? 0 : Math.max(0, rankingLeague.nextMinPoints - points)
          const progress = getLeagueCardProgress(points, rankingLeague)
          const borderColor = isSelected ? rankingLeague.color : isLocked ? '#2A3548' : withAlpha(rankingLeague.color, '88')
          const backgroundColor = isLocked
            ? '#0A1224'
            : isSelected
              ? withAlpha(rankingLeague.color, '22')
              : '#0A1A34'
          const statusLabel = isCurrent ? 'Tu liga' : isLocked ? 'Bloqueada' : 'Alcanzada'
          const detailLabel = isLocked
            ? `Te faltan ${xpToReach.toLocaleString()} XP`
            : isCurrent
              ? rankingLeague.nextMinPoints === null
                ? 'Liga máxima alcanzada'
                : `${xpToNext.toLocaleString()} XP para ${nextLeague?.name || 'la siguiente liga'}`
              : 'Ya puedes competir aquí'

          return (
            <Pressable
              key={rankingLeague.name}
              onPress={() => onSelect(rankingLeague)}
              className="rounded-2xl border p-4"
              style={{ width: 232, borderColor, backgroundColor, opacity: isLocked ? 0.68 : 1 }}
            >
              <View className="mb-3 flex-row items-center justify-between gap-3">
                <View
                  className="h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: isLocked ? '#13223B' : withAlpha(rankingLeague.color, '24') }}
                >
                  <Ionicons
                    name={isLocked ? 'lock-closed' : rankingLeague.icon}
                    size={21}
                    color={isLocked ? '#64748B' : rankingLeague.color}
                  />
                </View>
                <View
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: isLocked ? '#111C31' : withAlpha(rankingLeague.color, '22') }}
                >
                  <Text className="text-[11px] font-black" style={{ color: isLocked ? '#8FA7C7' : rankingLeague.color }}>
                    {statusLabel}
                  </Text>
                </View>
              </View>

              <Text className="text-[18px] font-black" style={{ color: isLocked ? '#94A3B8' : '#FFFFFF' }}>
                Liga {rankingLeague.name}
              </Text>
              <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>
                {detailLabel}
              </Text>

              <View className="mt-4">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-[11px] text-[#8FA7C7]">
                    Desde {rankingLeague.minPoints.toLocaleString()} XP
                  </Text>
                  <Text className="text-[11px] text-[#8FA7C7]">
                    {rankingLeague.nextMinPoints === null ? 'Sin límite' : `${rankingLeague.nextMinPoints.toLocaleString()} XP`}
                  </Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-[#142A4A]">
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${progress}%`, backgroundColor: isLocked ? '#475569' : rankingLeague.color }}
                  />
                </View>
              </View>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

function ClassRankingSelector({
  classOptions,
  selectedClassId,
  onSelect,
}: {
  classOptions: ClassOption[]
  selectedClassId: number | null
  onSelect: (classId: number) => void
}) {
  const { accentColor } = useAppTheme()

  return (
    <View className="mt-3">
      {classOptions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 4 }}
        >
          {classOptions.map((classOption) => {
            const active = selectedClassId === classOption.id
            const color = classOption.theme_color || accentColor
            const classIcon = getClassOptionIcon(classOption)

            return (
              <Pressable
                key={classOption.id}
                onPress={() => onSelect(classOption.id)}
                className="flex-row items-center gap-2 rounded-full border px-4 py-3"
                style={{
                  borderColor: active ? color : '#172A4A',
                  backgroundColor: active ? withAlpha(color, '24') : '#09162C',
                }}
              >
                {classIcon ? (
                  <Ionicons
                    name={classIcon}
                    size={15}
                    color={active ? color : '#AFC2DB'}
                  />
                ) : null}
                <Text
                  className="font-black"
                  style={{ color: active ? '#FFFFFF' : '#AFC2DB' }}
                  numberOfLines={1}
                >
                  {classOption.name} · {classOption.classroomName}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : (
        <View className="rounded-xl border border-dashed border-[#29466F] bg-[#09162C] px-4 py-3">
          <Text className="text-center text-[12px] text-[#AFC2DB]">
            Únete a un curso y selecciona una clase para activar este ranking.
          </Text>
        </View>
      )}
    </View>
  )
}

function RankingTabs({
  activeScope,
  onSelect,
}: {
  activeScope: RankingScope
  onSelect: (scope: RankingScope) => void
}) {
  const { accentColor } = useAppTheme()
  const tabs: { label: string; icon: keyof typeof Ionicons.glyphMap; scope: RankingScope }[] = [
    { label: 'Esta semana', icon: 'calendar-outline', scope: 'weekly' },
    { label: 'Todo el tiempo', icon: 'globe-outline', scope: 'global' },
    { label: 'Clase', icon: 'school-outline', scope: 'class' },
  ] as const

  return (
    <View className="flex-row flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = activeScope === tab.scope
        return (
          <Pressable
            key={tab.label}
            onPress={() => onSelect(tab.scope)}
            className="min-w-[150px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-4"
            style={{
              borderColor: active ? accentColor : '#172A4A',
              backgroundColor: active ? accentColor : '#09162C',
            }}
          >
            <Ionicons name={tab.icon} size={18} color={active ? '#FFFFFF' : '#AFC2DB'} />
            <Text className={`font-bold ${active ? 'text-white' : 'text-[#AFC2DB]'}`}>{tab.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function RankingRow({
  item,
  index,
  isMe,
  maxPoints,
}: {
  item: Profile
  index: number
  isMe: boolean
  maxPoints: number
}) {
  const points = item.points ?? 0
  const level = getStudentLevel(points)
  const medalColors = ['#FBBF24', '#CBD5E1', '#F97316']
  const { accentColor } = useAppTheme()
  const progressColor = index === 0 ? '#FBBF24' : isMe ? accentColor : '#3B82F6'
  const progress = points <= 0
    ? 0
    : Math.max(6, Math.round((points / maxPoints) * 100))

  return (
    <View
      className={`flex-row items-center rounded-xl px-3 py-3 ${isMe ? 'border' : ''}`}
      style={isMe ? { borderColor: accentColor, backgroundColor: withAlpha(accentColor, '24') } : undefined}
    >
      <View className="w-20 flex-row items-center justify-center">
        {index < 3 ? (
          <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: medalColors[index] }}>
            <Text className="font-black text-white">{index + 1}</Text>
          </View>
        ) : (
          <Text className="text-[18px] font-bold text-[#B9C7DE]">{index + 1}</Text>
        )}
      </View>

      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#17315E]">
        {item.avatar && item.avatar.startsWith('http') ? (
          <Image source={{ uri: item.avatar }} className="h-full w-full" />
        ) : (
          <Ionicons name="person" size={20} color="#9FD6FF" />
        )}
      </View>

      <View className="ml-4 min-w-0 flex-1">
        <Text className={`font-black ${isMe ? 'text-white' : 'text-[#DDE7F4]'}`} numberOfLines={1}>
          {item.alias}{isMe ? ' (Tú)' : ''}
        </Text>
        <View className="mt-1 flex-row items-center gap-1">
          <View className="h-4 w-4 items-center justify-center rounded bg-[#6D4DDB]">
            <Ionicons name="star" size={10} color="#FFFFFF" />
          </View>
          <Text className="text-[12px] text-[#AFC2DB]">Nivel {level}</Text>
        </View>
      </View>

      <View className="mx-4 hidden h-2 flex-[0.8] overflow-hidden rounded-full bg-[#13294C] md:flex">
        {progress > 0 ? (
          <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: progressColor }} />
        ) : null}
      </View>

      <Text className="w-24 text-right text-[14px] font-semibold text-[#DDE7F4]">{points.toLocaleString()} XP</Text>
    </View>
  )
}

function PodiumCard({
  item,
  position,
  isMe,
}: {
  item: Profile
  position: number
  isMe: boolean
}) {
  const points = item.points ?? 0
  const medalColors = ['#FBBF24', '#CBD5E1', '#F97316']
  const podiumColor = medalColors[position - 1] || '#8B5CF6'
  const height = position === 1 ? 112 : position === 2 ? 92 : 82

  return (
    <View className="min-w-[92px] flex-1 items-center">
      <View
        className="mb-2 h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 bg-[#17315E]"
        style={{ borderColor: podiumColor }}
      >
        {item.avatar && item.avatar.startsWith('http') ? (
          <Image source={{ uri: item.avatar }} className="h-full w-full" />
        ) : (
          <Ionicons name="person" size={20} color="#9FD6FF" />
        )}
      </View>

      <View
        className="w-full items-center justify-end rounded-2xl border px-3 py-3"
        style={{
          minHeight: height,
          borderColor: podiumColor,
          backgroundColor: withAlpha(podiumColor, isMe ? '30' : '18'),
        }}
      >
        <Text className="text-[20px] font-black" style={{ color: podiumColor }}>
          {position}º
        </Text>
        <Text className="mt-1 text-center text-[12px] font-black text-white" numberOfLines={1}>
          {item.alias}{isMe ? ' (Tú)' : ''}
        </Text>
        <Text className="mt-1 text-center text-[11px] font-bold text-[#AFC2DB]" numberOfLines={1}>
          {points.toLocaleString()} XP
        </Text>
      </View>
    </View>
  )
}

function PositionCard({
  rank,
  points,
  isGuest,
  totalRanked,
  league,
  previousRival,
  nextRival,
  xpToPreviousRival,
}: {
  rank: number | null
  points: number
  isGuest: boolean
  totalRanked: number
  league: RankingLeague
  previousRival: Profile | null
  nextRival: Profile | null
  xpToPreviousRival: number
}) {
  const hasRank = typeof rank === 'number'
  const percentile = hasRank && totalRanked > 0 ? Math.max(1, Math.ceil((rank / totalRanked) * 100)) : null
  const nextLeagueName = league.nextMinPoints === null
    ? null
    : getRankingLeague(league.nextMinPoints).name
  const leagueProgress = getLeagueProgress(points, league)
  const leagueProgressText = league.nextMinPoints === null
    ? `${Math.max(0, points - league.minPoints).toLocaleString()} XP en la élite`
    : `${Math.max(0, points - league.minPoints).toLocaleString()} / ${(league.nextMinPoints - league.minPoints).toLocaleString()} XP`
  const leagueSubtitle = league.nextMinPoints === null
    ? 'Liga máxima alcanzada'
    : `Siguiente liga: ${nextLeagueName}`
  const nextRivalDistance = nextRival
    ? Math.max(0, points - (nextRival.points ?? 0))
    : 0

  return (
    <View className="overflow-hidden rounded-2xl border bg-[#09162C] p-6" style={{ borderColor: league.color }}>
      <View className="absolute right-[-28px] top-[-26px] h-28 w-28 rounded-full opacity-30" style={{ backgroundColor: league.color }} />
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[16px] font-black text-white">Tu posición</Text>
        <View className="flex-row items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: league.color, backgroundColor: `${league.color}24` }}>
          <Ionicons name={league.icon} size={16} color={league.color} />
          <Text className="text-[12px] font-black uppercase" style={{ color: league.color }}>Liga {league.name}</Text>
        </View>
      </View>
      <View className="items-center py-5">
        <View className="h-36 w-36 items-center justify-center rounded-[38px] border-[8px] bg-[#15235A]" style={{ borderColor: league.color }}>
          <Text className="text-[56px] font-black text-white">{isGuest || !hasRank ? '-' : rank}</Text>
        </View>
        <Text className="mt-4 text-[16px] font-black text-white">
          {isGuest ? 'Modo invitado' : hasRank ? '¡Sigue así!' : 'Sin posición todavía'}
        </Text>
        <Text className="mt-1 text-center text-[13px] text-[#AFC2DB]">
          {isGuest
            ? 'Crea una cuenta para aparecer en el ranking.'
            : hasRank
              ? `Estás en el top ${percentile}% de estudiantes`
              : 'Completa actividades para entrar en el ranking.'}
        </Text>
        <Text className="mt-2 text-center text-[13px] text-[#AFC2DB]">
          {isGuest
            ? 'Regístrate para competir con tu clase.'
            : previousRival
              ? `Te faltan ${xpToPreviousRival.toLocaleString()} XP para superar a ${previousRival.alias}.`
              : hasRank
                ? nextRival
                  ? `Vas primero en esta liga. ${nextRival.alias} te sigue a ${nextRivalDistance.toLocaleString()} XP.`
                  : 'Vas primero en esta liga. ¡Defiende tu puesto!'
                : 'Completa actividades para entrar en el ranking.'}
        </Text>
      </View>
      <View className="rounded-xl border border-[#172A4A] bg-[#0A1A34] p-4">
        <View className="mb-2 flex-row justify-between">
          <Text className="text-[12px] text-[#8FA7C7]">{leagueSubtitle}</Text>
          <Text className="text-[12px] text-[#AFC2DB]">{leagueProgressText}</Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full" style={{ width: `${leagueProgress}%`, backgroundColor: league.color }} />
        </View>
      </View>
    </View>
  )
}

function RankingSummaryCard({
  points,
  rankingRows,
  league,
  pointsLabel,
  bestPointsLabel,
  selectedScope,
}: {
  points: number
  rankingRows: Profile[]
  league: RankingLeague
  pointsLabel: string
  bestPointsLabel: string
  selectedScope: RankingScope
}) {
  const totalStudents = rankingRows.length
  const bestPoints = rankingRows.length > 0 ? Math.max(...rankingRows.map((item) => item.points ?? 0)) : 0
  const averagePoints =
    rankingRows.length > 0
      ? Math.round(rankingRows.reduce((sum, item) => sum + (item.points ?? 0), 0) / rankingRows.length)
      : 0

  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-6">
      <Text className="text-[16px] font-black text-white">{selectedScope === 'class' ? 'Resumen de la clase' : 'Resumen de tu liga'}</Text>
      <View className="mt-5 gap-3">
        <View className="flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3">
          <Text className="text-[13px] text-[#AFC2DB]">Estudiantes en ranking</Text>
          <Text className="text-[14px] font-black text-white">{totalStudents.toLocaleString()}</Text>
        </View>
        <View className="flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3">
          <Text className="text-[13px] text-[#AFC2DB]">{pointsLabel}</Text>
          <Text className="text-[14px] font-black text-white">{points.toLocaleString()} XP</Text>
        </View>
        <View className="flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3">
          <Text className="text-[13px] text-[#AFC2DB]">Tu liga actual</Text>
          <View className="flex-row items-center gap-2">
            <Ionicons name={league.icon} size={15} color={league.color} />
            <Text className="text-[14px] font-black" style={{ color: league.color }}>{league.name}</Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3">
          <Text className="text-[13px] text-[#AFC2DB]">{bestPointsLabel}</Text>
          <Text className="text-[14px] font-black text-white">{bestPoints.toLocaleString()} XP</Text>
        </View>
        <View className="flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3">
          <Text className="text-[13px] text-[#AFC2DB]">XP medio</Text>
          <Text className="text-[14px] font-black text-white">{averagePoints.toLocaleString()} XP</Text>
        </View>
      </View>
    </View>
  )
}



function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204'
}

function normalizeRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation ?? null
}

function getNextRankingLeague(league: RankingLeague) {
  const index = rankingLeagues.findIndex((item) => item.name === league.name)
  return index >= 0 ? rankingLeagues[index + 1] || null : null
}

function getLeagueCardProgress(points: number, league: RankingLeague) {
  if (points < league.minPoints) return 0
  return getLeagueProgress(points, league)
}

function getClassOptionIcon(classOption: ClassOption): keyof typeof Ionicons.glyphMap | null {
  if (classOption.icon && classOption.icon in Ionicons.glyphMap) {
    return classOption.icon as keyof typeof Ionicons.glyphMap
  }

  return null
}

function getTimeValue(value: string | null | undefined) {
  if (!value) return 0
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function getRankingLeague(points: number) {
  return [...rankingLeagues]
    .reverse()
    .find((league) => points >= league.minPoints) || rankingLeagues[0]
}

function getLeagueProgress(points: number, league: RankingLeague) {
  if (league.nextMinPoints === null) return 100

  const pointsInLeague = Math.max(0, points - league.minPoints)
  const leagueSize = league.nextMinPoints - league.minPoints
  return Math.min(100, Math.max(0, Math.round((pointsInLeague / leagueSize) * 100)))
}
