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
import StudentSidebar from '../../components/StudentSidebar'
import NotificationBadge from '../../components/NotificationBadge'
import StudentBottomNav from '../../components/student/StudentBottomNav'

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

type RankingScope = 'global' | 'class'

type ClassOption = {
  id: number
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
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
  const [selectedScope, setSelectedScope] = useState<RankingScope>('global')
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const isDesktop = width >= 1024
  const rankingRows = useMemo(() => profiles, [profiles])
  const selectedClass = classOptions.find((classOption) => classOption.id === selectedClassId) || null

  const points = currentProfile?.points ?? rankingRows.find((item) => item.id === currentUserId)?.points ?? 0
  const alias = currentProfile?.alias || 'Usuario'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const isGuest = currentProfile?.role_id === 'guest'
  const currentRankIndex = rankingRows.findIndex((item) => item.id === currentUserId)
  const currentRank = !isGuest && currentRankIndex >= 0 ? currentRankIndex + 1 : null
  const maxPoints = Math.max(...rankingRows.map((item) => item.points ?? 0), 1)
  const rankingPoints = selectedScope === 'class'
    ? rankingRows.find((item) => item.id === currentUserId)?.points ?? 0
    : points
  const league = getRankingLeague(rankingPoints)
  const rankingPointsLabel = selectedScope === 'class' ? 'Tu XP en esta clase' : 'Tu XP actual'
  const bestPointsLabel = selectedScope === 'class' ? 'Mejor XP de clase' : 'Mejor XP del ranking'

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

      const hasSelectedClass = selectedClassId
        ? nextClassOptions.some((classOption) => classOption.id === selectedClassId)
        : false

      if (selectedClassId && !hasSelectedClass) {
        setSelectedClassId(null)
      }

      const nextProfiles = selectedScope === 'global'
        ? await fetchGlobalRanking()
        : selectedClassId && hasSelectedClass
          ? await fetchClassRanking(selectedClassId)
          : []

      setProfiles(nextProfiles)
    } catch (error) {
      console.error('Error fetching ranking:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedClassId, selectedScope])

  const emptyRankingMessage = useMemo(() => {
    if (selectedScope === 'global') {
      return 'Aún no hay estudiantes con puntuación en el ranking.'
    }

    if (classOptions.length === 0) {
      return 'Aún no perteneces a ninguna clase.'
    }

    if (!selectedClassId) {
      return 'Elige una clase para comparar tu XP con sus alumnos.'
    }

    return `Aún no hay alumnos con puntuación en ${selectedClass?.name || 'esta clase'}.`
  }, [classOptions.length, selectedClass?.name, selectedClassId, selectedScope])

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
        <ActivityIndicator size="large" color="#6574FF" />
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
                <Text
                  className="mb-3 text-[#9FD6FF]"
                  style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}
                >
                  OmniQuest
                </Text>
              ) : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="trophy" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Ranking</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Compite, aprende y sube posiciones 🚀
              </Text>
            </View>
            <NotificationBadge />
          </View>

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <View className={isDesktop ? 'flex-[1.45]' : ''}>
              <RankingTabs activeScope={selectedScope} onSelect={setSelectedScope} />
              {selectedScope === 'class' ? (
                <ClassRankingSelector
                  classOptions={classOptions}
                  selectedClassId={selectedClassId}
                  onSelect={setSelectedClassId}
                />
              ) : null}
              <View className="mt-4 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
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
                  {rankingRows.length > 0 ? (
                    rankingRows.slice(0, 8).map((item, index) => (
                      <RankingRow
                        key={item.id}
                        item={item}
                        index={index}
                        isMe={item.id === currentUserId}
                        maxPoints={maxPoints}
                      />
                    ))
                  ) : (
                    <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] px-4 py-8">
                      <Ionicons name="trophy-outline" size={34} color="#8FA7C7" />
                      <Text className="mt-2 text-center text-[13px] text-[#AFC2DB]">
                        {emptyRankingMessage}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View className={isDesktop ? 'flex-1 gap-5' : 'gap-5'}>
              <PositionCard rank={currentRank} points={rankingPoints} isGuest={isGuest} totalRanked={rankingRows.length} league={league} />
              <RankingSummaryCard
                points={rankingPoints}
                rankingRows={rankingRows}
                league={league}
                pointsLabel={rankingPointsLabel}
                bestPointsLabel={bestPointsLabel}
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
  const { data, error } = await supabase
    .from('profiles')
    .select('id, alias, points, avatar')
    .eq('role_id', 'student')
    .order('points', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data || []) as Profile[]
}

async function fetchEnrolledClassOptions(userId: string) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('joined_at, subjects(id, name, description, icon, theme_color)')
    .eq('student_id', userId)
    .order('joined_at', { ascending: false })

  if (error) throw error

  const classOptions = (data || [])
    .map((enrollment: any) => enrollment.subjects)
    .filter((subject: any): subject is ClassOption => Boolean(subject?.id))

  return Array.from(
    new Map(classOptions.map((classOption) => [classOption.id, classOption])).values()
  )
}

async function fetchClassRanking(classId: number) {
  const { data: classEnrollments, error: classEnrollmentsError } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('subject_id', classId)

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
      .eq('subject_id', classId)
      .in('student_id', studentIds),
  ])

  if (profilesResult.error) throw profilesResult.error
  if (scoresResult.error) throw scoresResult.error

  const scoresByStudent = new Map<string, number>()
  ;(scoresResult.data || []).forEach((score: { student_id: string | null; max_score: number | null }) => {
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

function ClassRankingSelector({
  classOptions,
  selectedClassId,
  onSelect,
}: {
  classOptions: ClassOption[]
  selectedClassId: number | null
  onSelect: (classId: number) => void
}) {
  return (
    <View className="mt-3">
      {classOptions.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {classOptions.map((classOption) => {
            const active = selectedClassId === classOption.id
            const color = classOption.theme_color || '#6574FF'

            return (
              <Pressable
                key={classOption.id}
                onPress={() => onSelect(classOption.id)}
                className={`min-w-[180px] flex-1 flex-row items-center gap-3 rounded-xl border px-4 py-3 ${
                  active ? 'bg-[#172457]' : 'bg-[#09162C]'
                }`}
                style={{ borderColor: active ? color : '#172A4A' }}
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}28` }}>
                  <Ionicons name={(classOption.icon as keyof typeof Ionicons.glyphMap) || 'school-outline'} size={17} color={color} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className={`font-black ${active ? 'text-white' : 'text-[#DDE7F4]'}`} numberOfLines={1}>
                    {classOption.name}
                  </Text>
                  <Text className="text-[11px] text-[#8FA7C7]" numberOfLines={1}>
                    {active ? 'Ranking activo' : 'Ver ranking de clase'}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : (
        <View className="rounded-xl border border-dashed border-[#29466F] bg-[#09162C] px-4 py-3">
          <Text className="text-center text-[12px] text-[#AFC2DB]">
            Únete a una clase para activar este ranking.
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
  const tabs: { label: string; icon: keyof typeof Ionicons.glyphMap; scope: RankingScope }[] = [
    { label: 'Global', icon: 'globe-outline', scope: 'global' },
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
          className={`min-w-[150px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-4 ${active ? 'border-[#5D64FF] bg-[#4F46E5]' : 'border-[#172A4A] bg-[#09162C]'
            }`}
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
  const progressColor = index === 0 ? '#FBBF24' : isMe ? '#3B82F6' : '#8B5CF6'
  const progress = Math.max(20, Math.round((points / maxPoints) * 100))

  return (
    <View
      className={`flex-row items-center rounded-xl px-3 py-3 ${isMe ? 'border border-[#5364F5] bg-[#1D2B68]' : ''
        }`}
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
        <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: progressColor }} />
      </View>

      <Text className="w-24 text-right text-[14px] font-semibold text-[#DDE7F4]">{points.toLocaleString()} XP</Text>
    </View>
  )
}

function PositionCard({
  rank,
  points,
  isGuest,
  totalRanked,
  league,
}: {
  rank: number | null
  points: number
  isGuest: boolean
  totalRanked: number
  league: RankingLeague
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
}: {
  points: number
  rankingRows: Profile[]
  league: RankingLeague
  pointsLabel: string
  bestPointsLabel: string
}) {
  const totalStudents = rankingRows.length
  const bestPoints = rankingRows.length > 0 ? Math.max(...rankingRows.map((item) => item.points ?? 0)) : 0
  const averagePoints =
    rankingRows.length > 0
      ? Math.round(rankingRows.reduce((sum, item) => sum + (item.points ?? 0), 0) / rankingRows.length)
      : 0

  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-6">
      <Text className="text-[16px] font-black text-white">Resumen real del ranking</Text>
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
          <Text className="text-[13px] text-[#AFC2DB]">Media del ranking</Text>
          <Text className="text-[14px] font-black text-white">{averagePoints.toLocaleString()} XP</Text>
        </View>
      </View>
    </View>
  )
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
