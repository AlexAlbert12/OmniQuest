import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
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
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { withAlpha } from '../../lib/color'
import OmniGuide from '../../components/OmniGuide'
import PaginationControls from '../../components/ui/PaginationControls'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
  role_id?: string | null
  visibility?: string | null
  rank?: number | null
  total_count?: number | null
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

type WeeklyRankingProfile = Profile & {
  weekly_points: number
}

type RankingPagePayload = {
  rows: Profile[]
  total: number
  current: Profile | null
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
  const [rankingCurrent, setRankingCurrent] = useState<Profile | null>(null)
  const [page, setPage] = useState(0)
  const [rankingTotal, setRankingTotal] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedScope, setSelectedScope] = useState<RankingScope>('weekly')
  const [selectedLeagueName, setSelectedLeagueName] = useState<string | null>(null)
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const { accentColor, colors } = useAppTheme()

  const isDesktop = width >= 1024
  const rankingPageSize = isDesktop ? 8 : 5
  const rankingRows = useMemo(() => profiles, [profiles])
  const selectedClass = classOptions.find((classOption) => classOption.id === selectedClassId) || null

  const points = currentProfile?.points ?? rankingRows.find((item) => item.id === currentUserId)?.points ?? 0
  const alias = currentProfile?.alias || 'Usuario'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const isGuest = currentProfile?.role_id === 'guest'
  const rankingPoints = selectedScope === 'global'
    ? points
    : rankingCurrent?.points ?? rankingRows.find((item) => item.id === currentUserId)?.points ?? 0
  const league = getRankingLeague(rankingPoints)
  const selectedLeague = rankingLeagues.find((item) => item.name === selectedLeagueName) || league
  const selectedLeagueRows = useMemo(
    () => rankingRows.filter((item) => getRankingLeague(item.points ?? 0).name === selectedLeague.name),
    [rankingRows, selectedLeague.name]
  )
  const selectedLeagueMaxPoints = Math.max(...selectedLeagueRows.map((item) => item.points ?? 0), 1)
  const selectedRankIndex = selectedLeagueRows.findIndex((item) => item.id === currentUserId)
  const selectedRank = !isGuest
    ? Number(rankingCurrent?.rank || (selectedRankIndex >= 0 ? selectedRankIndex + 1 : 0)) || null
    : null
  const previousRival = selectedRankIndex > 0 ? selectedLeagueRows[selectedRankIndex - 1] : null
  const nextRival = selectedRankIndex >= 0 && selectedRankIndex < selectedLeagueRows.length - 1
    ? selectedLeagueRows[selectedRankIndex + 1]
    : null
  const xpToPreviousRival = previousRival
    ? Math.max(0, (previousRival.points ?? 0) - rankingPoints + 1)
    : 0
  const currentLeagueRows = useMemo(
    () => rankingRows.filter((item) => getRankingLeague(item.points ?? 0).name === league.name),
    [rankingRows, league.name]
  )
  const currentRankIndex = currentLeagueRows.findIndex((item) => item.id === currentUserId)
  const currentRank = !isGuest
    ? Number(rankingCurrent?.rank || (currentRankIndex >= 0 ? currentRankIndex + 1 : 0)) || null
    : null
  const currentPreviousRival = currentRankIndex > 0 ? currentLeagueRows[currentRankIndex - 1] : null
  const currentNextRival = currentRankIndex >= 0 && currentRankIndex < currentLeagueRows.length - 1
    ? currentLeagueRows[currentRankIndex + 1]
    : null
  const currentXpToPreviousRival = currentPreviousRival
    ? Math.max(0, (currentPreviousRival.points ?? 0) - rankingPoints + 1)
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

      const leagueFilter = selectedLeagueName ? selectedLeague : null
      const rankingPage = selectedScope === 'class' && !effectiveSelectedClassId
        ? { rows: [], total: 0, current: null }
        : await fetchRankingPage({
            scope: selectedScope,
            classroomId: effectiveSelectedClassId,
            page,
            pageSize: rankingPageSize,
            minPoints: leagueFilter?.minPoints ?? null,
            maxPoints: leagueFilter?.nextMinPoints ?? null,
          })

      setProfiles(rankingPage.rows)
      setRankingTotal(rankingPage.total)
      setRankingCurrent(rankingPage.current)

      if (!selectedLeagueName && rankingPage.current) {
        const detectedLeague = getRankingLeague(Number(rankingPage.current.points || 0))
        setSelectedLeagueName(detectedLeague.name)
        setPage(0)
      }
    } catch (error) {
      console.error('Error fetching ranking:', error)
    } finally {
      setLoading(false)
    }
  }, [page, rankingPageSize, selectedClassId, selectedLeague.minPoints, selectedLeague.nextMinPoints, selectedLeagueName, selectedScope])

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
  }, [classOptions.length, selectedClass, selectedClassId, selectedScope])

  useFocusEffect(
    useCallback(() => {
      fetchRanking()
    }, [fetchRanking])
  )

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={accentColor} />
        <Text className="mt-4" style={{ color: colors.textMuted }}>Actualizando ranking...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
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
            paddingBottom: isDesktop ? 28 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          showsVerticalScrollIndicator={false}
        >
          <StudentPageHeader
            icon="trophy"
            isDesktop={isDesktop}
            subtitle="Compite, aprende y sube posiciones."
            title="Ranking"
          />

          {!isDesktop ? (
            <View className="gap-4">
              <PositionCard
                rank={currentRank}
                points={rankingPoints}
                isGuest={isGuest}
                totalRanked={rankingTotal}
                league={league}
                previousRival={currentPreviousRival}
                nextRival={currentNextRival}
                xpToPreviousRival={currentXpToPreviousRival}
              />

              <CurrentLeagueCard league={league} points={rankingPoints} />

              <RankingTabs
                activeScope={selectedScope}
                onSelect={(nextScope) => {
                  if (nextScope === 'class' && !selectedClassId && classOptions.length > 0) {
                    setSelectedClassId(classOptions[0].id)
                  }
                  setPage(0)
                  setSelectedLeagueName(null)
                  setSelectedScope(nextScope)
                }}
              />
              {selectedScope === 'class' ? (
                <ClassRankingSelector
                  classOptions={classOptions}
                  selectedClassId={selectedClassId}
                  onSelect={(classId) => { setPage(0); setSelectedLeagueName(null); setSelectedClassId(classId) }}
                />
              ) : null}

              <RankingListCard
                rows={selectedLeagueRows}
                selectedLeague={selectedLeague}
                selectedScope={selectedScope}
                selectedClass={selectedClass}
                currentUserId={currentUserId}
                maxPoints={selectedLeagueMaxPoints}
                rankingRows={rankingRows}
                rankingPoints={rankingPoints}
                emptyRankingMessage={emptyRankingMessage}
                orderedPodiumRows={page === 0 ? orderedPodiumRows : []}
                totalRows={rankingTotal}
                compact
              />

              <PaginationControls
                compact
                page={page}
                pageSize={rankingPageSize}
                total={rankingTotal}
                onPrevious={() => setPage((value) => Math.max(0, value - 1))}
                onNext={() => setPage((value) => value + 1)}
              />

              <LeagueProgressCard league={league} points={rankingPoints} />

              <LeagueCarousel
                leagues={rankingLeagues}
                currentLeague={league}
                selectedLeague={selectedLeague}
                points={rankingPoints}
                onSelect={(nextLeague) => { setPage(0); setSelectedLeagueName(nextLeague.name) }}
                compact
              />
            </View>
          ) : (
            <>
              <LeagueCarousel
                leagues={rankingLeagues}
                currentLeague={league}
                selectedLeague={selectedLeague}
                points={rankingPoints}
                onSelect={(nextLeague) => { setPage(0); setSelectedLeagueName(nextLeague.name) }}
              />

              <View className="flex-row gap-5">
                <View className="flex-[1.45]">
                  <RankingTabs
                    activeScope={selectedScope}
                    onSelect={(nextScope) => {
                      if (nextScope === 'class' && !selectedClassId && classOptions.length > 0) {
                        setSelectedClassId(classOptions[0].id)
                      }
                      setPage(0)
                      setSelectedLeagueName(null)
                      setSelectedScope(nextScope)
                    }}
                  />
                  {selectedScope === 'class' ? (
                    <ClassRankingSelector
                      classOptions={classOptions}
                      selectedClassId={selectedClassId}
                      onSelect={(classId) => { setPage(0); setSelectedLeagueName(null); setSelectedClassId(classId) }}
                    />
                  ) : null}

                  <RankingListCard
                    rows={selectedLeagueRows}
                    selectedLeague={selectedLeague}
                    selectedScope={selectedScope}
                    selectedClass={selectedClass}
                    currentUserId={currentUserId}
                    maxPoints={selectedLeagueMaxPoints}
                    rankingRows={rankingRows}
                    rankingPoints={rankingPoints}
                    emptyRankingMessage={emptyRankingMessage}
                    orderedPodiumRows={page === 0 ? orderedPodiumRows : []}
                    totalRows={rankingTotal}
                  />
                  <PaginationControls
                    page={page}
                    pageSize={rankingPageSize}
                    total={rankingTotal}
                    onPrevious={() => setPage((value) => Math.max(0, value - 1))}
                    onNext={() => setPage((value) => value + 1)}
                  />
                </View>

                <View className="flex-1 gap-5">
                  <PositionCard
                    rank={selectedRank}
                    points={rankingPoints}
                    isGuest={isGuest}
                    totalRanked={rankingTotal}
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
            </>
          )}
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="ranking" /> : null}
    </View>
  )
}

async function fetchRankingPage({
  scope,
  classroomId,
  page,
  pageSize,
  minPoints,
  maxPoints,
}: {
  scope: RankingScope
  classroomId: number | null
  page: number
  pageSize: number
  minPoints: number | null
  maxPoints: number | null
}): Promise<RankingPagePayload> {
  const { data, error } = await (supabase.rpc as any)('get_ranking_profiles_page', {
    p_scope: scope,
    p_classroom_id: scope === 'class' ? classroomId : null,
    p_min_points: minPoints,
    p_max_points: maxPoints,
    p_limit: pageSize,
    p_offset: Math.max(0, page) * pageSize,
  })

  if (error) throw error
  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? data as { rows?: unknown; total?: unknown; current?: unknown }
    : {}
  const rows = Array.isArray(payload.rows) ? payload.rows as Profile[] : []
  const current = payload.current && typeof payload.current === 'object' && !Array.isArray(payload.current)
    ? payload.current as Profile
    : null

  return {
    rows,
    total: Math.max(0, Number(payload.total || 0)),
    current,
  }
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

function RankingListCard({
  rows,
  selectedLeague,
  selectedScope,
  selectedClass,
  currentUserId,
  maxPoints,
  rankingRows,
  rankingPoints,
  emptyRankingMessage,
  orderedPodiumRows,
  totalRows,
  compact = false,
}: {
  rows: Profile[]
  selectedLeague: RankingLeague
  selectedScope: RankingScope
  selectedClass: ClassOption | null
  currentUserId: string | null
  maxPoints: number
  rankingRows: Profile[]
  rankingPoints: number
  emptyRankingMessage: string
  orderedPodiumRows: { item: Profile; position: number }[]
  totalRows: number
  compact?: boolean
}) {
  const visibleRows = rows

  return (
    <View className={`${compact ? '' : 'mt-4'} rounded-2xl border border-[#1A3155] bg-[#09162C] ${compact ? 'p-4' : 'p-5'}`}>
      <View className="mb-4 flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className={`${compact ? 'text-[18px]' : 'text-[16px]'} font-black text-white`} numberOfLines={compact ? 2 : 1}>
            {`Clasificación · Liga ${selectedLeague.name}`}
          </Text>
          <Text className="mt-1 text-[12px] leading-5 text-[#8FA7C7]">
            {selectedScope === 'class'
              ? `Dentro de ${selectedClass ? `${selectedClass.name} · ${selectedClass.classroomName}` : 'la clase seleccionada'}`
              : selectedScope === 'weekly'
                ? 'XP ganado durante los últimos 7 días.'
                : 'Compites con estudiantes de tu misma liga.'}
          </Text>
        </View>
        <View className="rounded-full border border-[#243D66] bg-[#0A1A34] px-3 py-2">
          <Text className="text-[12px] font-black text-[#AFC2DB]">
            {totalRows} {totalRows === 1 ? 'estudiante' : 'estudiantes'}
          </Text>
        </View>
      </View>

      {!compact && orderedPodiumRows.length === 3 ? (
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

      {!compact ? (
        <View className="mb-4 flex-row items-center border-b border-[#172A4A] pb-3">
          <Text className="w-24 text-[12px] font-bold uppercase text-[#8FA7C7]">Posición</Text>
          <Text className="min-w-0 flex-1 text-[12px] font-bold uppercase text-[#8FA7C7]">
            Estudiante
          </Text>
          <Text className="w-24 text-right text-[12px] font-bold uppercase text-[#8FA7C7]">
            {selectedScope === 'class' ? 'XP Clase' : 'XP'}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: compact ? 8 : 6 }}>
        {visibleRows.length > 0 ? (
          visibleRows.map((item, index) => (
            <RankingRow
              key={item.id}
              item={item}
              index={index}
              isMe={item.id === currentUserId}
              maxPoints={maxPoints}
              compact={compact}
            />
          ))
        ) : (
          <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] px-4 py-8">
            <OmniGuide state="normal" autoBlink size={compact ? 72 : 84} />
            <Text className="mt-2 text-center text-[13px] text-[#AFC2DB]">
              {rankingRows.length === 0
                ? emptyRankingMessage
                : `No hay estudiantes en Liga ${selectedLeague.name} para este ranking.`}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

function CurrentLeagueCard({
  league,
  points,
}: {
  league: RankingLeague
  points: number
}) {
  const nextLeague = getNextRankingLeague(league)
  const xpInsideLeague = Math.max(0, points - league.minPoints)
  const xpToNext = league.nextMinPoints === null ? 0 : Math.max(0, league.nextMinPoints - points)

  return (
    <View className="overflow-hidden rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
      <View className="absolute right-[-22px] top-[-22px] h-24 w-24 rounded-full opacity-20" style={{ backgroundColor: league.color }} />
      <View className="flex-row items-center gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(league.color, '24') }}>
          <Ionicons name={league.icon} size={24} color={league.color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] font-black uppercase tracking-[1px] text-[#8FA7C7]">Liga actual</Text>
          <Text className="mt-1 text-[22px] font-black text-white">Liga {league.name}</Text>
          <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>
            {league.nextMinPoints === null
              ? `${xpInsideLeague.toLocaleString()} XP acumulados en la élite`
              : `${xpToNext.toLocaleString()} XP para Liga ${nextLeague?.name || 'siguiente'}`}
          </Text>
        </View>
        <View className="rounded-full border px-3 py-2" style={{ borderColor: league.color, backgroundColor: withAlpha(league.color, '22') }}>
          <Text className="text-[12px] font-black" style={{ color: league.color }}>{points.toLocaleString()} XP</Text>
        </View>
      </View>
    </View>
  )
}

function LeagueProgressCard({
  league,
  points,
}: {
  league: RankingLeague
  points: number
}) {
  const nextLeague = getNextRankingLeague(league)
  const leagueProgress = getLeagueProgress(points, league)
  const progressLabel = league.nextMinPoints === null
    ? `${Math.max(0, points - league.minPoints).toLocaleString()} XP en la liga máxima`
    : `${Math.max(0, points - league.minPoints).toLocaleString()} / ${(league.nextMinPoints - league.minPoints).toLocaleString()} XP`

  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[18px] font-black text-white">Progreso a la siguiente liga</Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">
            {league.nextMinPoints === null ? 'Ya estás en la última liga.' : `Siguiente objetivo: Liga ${nextLeague?.name || 'siguiente'}`}
          </Text>
        </View>
        <Text className="text-[12px] font-black" style={{ color: league.color }}>{Math.round(leagueProgress)}%</Text>
      </View>
      <View className="h-3 overflow-hidden rounded-full bg-[#13294C]">
        <View className="h-full rounded-full" style={{ width: `${leagueProgress}%`, backgroundColor: league.color }} />
      </View>
      <Text className="mt-2 text-right text-[12px] text-[#AFC2DB]">{progressLabel}</Text>
    </View>
  )
}


function LeagueCarousel({
  leagues,
  currentLeague,
  selectedLeague,
  points,
  onSelect,
  compact = false,
}: {
  leagues: RankingLeague[]
  currentLeague: RankingLeague
  selectedLeague: RankingLeague
  points: number
  onSelect: (league: RankingLeague) => void
  compact?: boolean
}) {
  return (
    <View className={`${compact ? '' : 'mb-5'} rounded-2xl border border-[#1A3155] bg-[#09162C] p-4`}>
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className={`${compact ? 'text-[18px]' : 'text-[16px]'} font-black text-white`}>Ligas</Text>
          <Text className="mt-1 text-[12px] leading-5 text-[#8FA7C7]">
            {compact
              ? 'Consulta ligas bloqueadas y alcanzadas.'
              : 'Selecciona una liga para ver sus estudiantes y cuánto XP te falta para alcanzarla.'}
          </Text>
        </View>
        {!compact ? (
          <View className="flex-row items-center gap-2 rounded-full border px-3 py-2" style={{ borderColor: currentLeague.color, backgroundColor: withAlpha(currentLeague.color, '24') }}>
            <Ionicons name={currentLeague.icon} size={15} color={currentLeague.color} />
            <Text className="text-[12px] font-black" style={{ color: currentLeague.color }}>
              Tu liga: {currentLeague.name}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: compact ? 10 : 12, paddingRight: 4 }}>
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
              className={`${compact ? 'rounded-xl p-3' : 'rounded-2xl p-4'} border`}
              style={{ width: compact ? 156 : 232, borderColor, backgroundColor, opacity: isLocked ? 0.68 : 1 }}
            >
              <View className={`${compact ? 'mb-2' : 'mb-3'} flex-row items-center justify-between gap-2`}>
                <View
                  className={`${compact ? 'h-9 w-9' : 'h-11 w-11'} items-center justify-center rounded-xl`}
                  style={{ backgroundColor: isLocked ? '#13223B' : withAlpha(rankingLeague.color, '24') }}
                >
                  <Ionicons
                    name={isLocked ? 'lock-closed' : rankingLeague.icon}
                    size={compact ? 18 : 21}
                    color={isLocked ? '#64748B' : rankingLeague.color}
                  />
                </View>
                <View
                  className={`${compact ? 'px-2 py-1' : 'px-3 py-1'} rounded-full`}
                  style={{ backgroundColor: isLocked ? '#111C31' : withAlpha(rankingLeague.color, '22') }}
                >
                  <Text className={`${compact ? 'text-[10px]' : 'text-[12px]'} font-black`} style={{ color: isLocked ? '#AFC2DB' : rankingLeague.color }}>
                    {statusLabel}
                  </Text>
                </View>
              </View>

              <Text className={`${compact ? 'text-[15px]' : 'text-[18px]'} font-black`} style={{ color: isLocked ? '#94A3B8' : '#FFFFFF' }} numberOfLines={1}>
                Liga {rankingLeague.name}
              </Text>
              <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>
                {detailLabel}
              </Text>

              <View className={compact ? 'mt-3' : 'mt-4'}>
                {!compact ? (
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-[12px] text-[#AFC2DB]">
                      Desde {rankingLeague.minPoints.toLocaleString()} XP
                    </Text>
                    <Text className="text-[12px] text-[#AFC2DB]">
                      {rankingLeague.nextMinPoints === null ? 'Sin límite' : `${rankingLeague.nextMinPoints.toLocaleString()} XP`}
                    </Text>
                  </View>
                ) : null}
                <View className={`${compact ? 'h-1.5' : 'h-2'} overflow-hidden rounded-full bg-[#142A4A]`}>
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
  const { width } = useWindowDimensions()
  const isPhone = width < 640
  const tabs: { label: string; icon: keyof typeof Ionicons.glyphMap; scope: RankingScope }[] = [
    { label: 'Esta semana', icon: 'calendar-outline', scope: 'weekly' },
    { label: 'Todo el tiempo', icon: 'globe-outline', scope: 'global' },
    { label: 'Clase', icon: 'school-outline', scope: 'class' },
  ] as const

  const renderTab = (tab: (typeof tabs)[number]) => {
    const active = activeScope === tab.scope
    const compactLabel = tab.scope === 'weekly' ? 'Semana' : tab.scope === 'global' ? 'Global' : 'Clase'

    return (
      <Pressable
        key={tab.label}
        onPress={() => onSelect(tab.scope)}
        className="flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3"
        style={{
          minWidth: isPhone ? 112 : 168,
          borderColor: active ? accentColor : '#172A4A',
          backgroundColor: active ? accentColor : '#09162C',
        }}
      >
        <Ionicons name={tab.icon} size={18} color={active ? '#FFFFFF' : '#AFC2DB'} />
        <Text className={`font-bold ${active ? 'text-white' : 'text-[#AFC2DB]'}`} numberOfLines={1}>
          {isPhone ? compactLabel : tab.label}
        </Text>
      </Pressable>
    )
  }

  if (isPhone) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {tabs.map(renderTab)}
      </ScrollView>
    )
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {tabs.map(renderTab)}
    </View>
  )
}

function RankingRow({
  item,
  index,
  isMe,
  maxPoints,
  compact = false,
}: {
  item: Profile
  index: number
  isMe: boolean
  maxPoints: number
  compact?: boolean
}) {
  const points = item.points ?? 0
  const position = Math.max(1, Number(item.rank || index + 1))
  const level = getStudentLevel(points)
  const medalColors = ['#FBBF24', '#CBD5E1', '#F97316']
  const { accentColor } = useAppTheme()
  const { width } = useWindowDimensions()
  const isPhone = width < 640
  const progressColor = position === 1 ? '#FBBF24' : isMe ? accentColor : '#3B82F6'
  const progress = points <= 0
    ? 0
    : Math.max(6, Math.round((points / maxPoints) * 100))

  if (isPhone) {
    return (
      <View
        className={`${compact ? 'rounded-xl px-3 py-3' : 'rounded-2xl px-4 py-4'} ${isMe ? 'border' : 'border border-[#172A4A] bg-[#0A1A34]'}`}
        style={isMe ? { borderColor: accentColor, backgroundColor: withAlpha(accentColor, '24') } : undefined}
      >
        <View className="flex-row items-center gap-3">
          <View className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} items-center justify-center rounded-full`} style={{ backgroundColor: position <= 3 ? medalColors[position - 1] : '#1E3356' }}>
            <Text className="font-black text-white">{position}</Text>
          </View>
          <View className={`${compact ? 'h-10 w-10' : 'h-12 w-12'} items-center justify-center overflow-hidden rounded-full bg-[#17315E]`}>
            {item.avatar && item.avatar.startsWith('http') ? (
              <Image source={{ uri: item.avatar }} className="h-full w-full" />
            ) : (
              <Ionicons name="person" size={20} color="#9FD6FF" />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text className={`font-black ${isMe ? 'text-white' : 'text-[#DDE7F4]'}`} numberOfLines={1}>
              {item.alias}{isMe ? ' (Tú)' : ''}
            </Text>
            <Text className="mt-1 text-[12px] text-[#AFC2DB]">Nivel {level}</Text>
          </View>
          <Text className={`${compact ? 'text-[13px]' : 'text-[14px]'} text-right font-black text-white`}>{points.toLocaleString()} XP</Text>
        </View>
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13294C]">
          {progress > 0 ? <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: progressColor }} /> : null}
        </View>
      </View>
    )
  }

  return (
    <View
      className={`flex-row items-center rounded-xl px-3 py-3 ${isMe ? 'border' : ''}`}
      style={isMe ? { borderColor: accentColor, backgroundColor: withAlpha(accentColor, '24') } : undefined}
    >
      <View className="w-20 flex-row items-center justify-center">
        {position <= 3 ? (
          <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: medalColors[position - 1] }}>
            <Text className="font-black text-white">{position}</Text>
          </View>
        ) : (
          <Text className="text-[18px] font-bold text-[#B9C7DE]">{position}</Text>
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
        <Text className="mt-1 text-center text-[12px] font-bold text-[#AFC2DB]" numberOfLines={1}>
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
  const { width } = useWindowDimensions()
  const isPhone = width < 640
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
  const encouragement = isGuest
    ? 'Regístrate para competir con tu clase.'
    : previousRival
      ? `${xpToPreviousRival.toLocaleString()} XP para superar a ${previousRival.alias}`
      : hasRank
        ? nextRival
          ? `Vas primero. ${nextRival.alias} te sigue a ${nextRivalDistance.toLocaleString()} XP.`
          : 'Vas primero. ¡Defiende tu puesto!'
        : 'Completa actividades para entrar en el ranking.'

  if (isPhone) {
    return (
      <View className="overflow-hidden rounded-2xl border bg-[#09162C] p-5" style={{ borderColor: league.color }}>
        <View className="absolute right-[-24px] top-[-24px] h-24 w-24 rounded-full opacity-25" style={{ backgroundColor: league.color }} />
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-[12px] font-black uppercase tracking-[1px] text-[#8FA7C7]">Tu posición</Text>
            <Text className="mt-1 text-[22px] font-black text-white">
              {isGuest ? 'Modo invitado' : hasRank ? `${rank}º puesto` : 'Sin posición'}
            </Text>
          </View>
          <View className="flex-row items-center gap-2 rounded-full border px-3 py-2" style={{ borderColor: league.color, backgroundColor: withAlpha(league.color, '24') }}>
            <Ionicons name={league.icon} size={15} color={league.color} />
            <Text className="text-[11px] font-black uppercase" style={{ color: league.color }}>{league.name}</Text>
          </View>
        </View>

        <View className="mt-5 flex-row items-center gap-4">
          <View className="h-24 w-24 items-center justify-center rounded-[28px] border-[6px] bg-[#15235A]" style={{ borderColor: league.color }}>
            {isGuest || !hasRank ? <OmniGuide state="normal" autoBlink size={72} /> : <Text className="text-[40px] font-black text-white">{rank}</Text>}
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[17px] font-black text-white">
              {isGuest ? 'Crea tu cuenta' : hasRank ? '¡Sigue así!' : 'Empieza a competir'}
            </Text>
            <Text className="mt-1 text-[13px] leading-5 text-[#AFC2DB]">
              {isGuest
                ? 'Aparecerás en el ranking al registrarte.'
                : hasRank
                  ? `Top ${percentile}% de estudiantes`
                  : 'Gana XP para aparecer en la clasificación.'}
            </Text>
            <Text className="mt-2 text-[12px] leading-5 text-[#8FA7C7]" numberOfLines={2}>
              {encouragement}
            </Text>
          </View>
        </View>
      </View>
    )
  }

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
          {isGuest || !hasRank ? <OmniGuide state="normal" autoBlink size={104} /> : <Text className="text-[56px] font-black text-white">{rank}</Text>}
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
