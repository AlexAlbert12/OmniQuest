import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAppTheme } from '../../lib/appTheme'
import { fetchProfileCosmeticsForUsers, type ProfileCosmetics } from '../../lib/avatarCosmetics'
import type { RankingTierKey } from '../../lib/designTokens'

export type RankingScope = 'weekly' | 'global' | 'class'

export type RankingProfile = {
  id: string
  alias: string
  avatar: string | null
  points: number
  visibility: string
  rank: number | null
  total_count: number | null
  correct_answers: number
  last_activity_at: string | null
  cosmetics?: ProfileCosmetics
}

export type RankingClassOption = {
  id: number
  subjectId: number
  classroomId: number
  name: string
  classroomName: string
  classroomCode: string | null
  description: string | null
  icon: string | null
  themeColor: string | null
}

export type RankingLeague = {
  name: string
  minPoints: number
  nextMinPoints: number | null
  nextName: string | null
  colorKey: RankingTierKey
  color: string
  icon: keyof typeof Ionicons.glyphMap
}

export type StudentRankingProfile = {
  id: string
  alias: string
  avatar: string | null
  points: number
  roleId: string | null
  visibility: string
  cosmetics?: ProfileCosmetics
}

type RankingPayload = {
  rows: RankingProfile[]
  total: number
  current: RankingProfile | null
  tieBreak: string
}

const LEAGUE_DEFINITIONS: Omit<RankingLeague, 'color'>[] = [
  { name: 'Bronce', minPoints: 0, nextMinPoints: 500, nextName: 'Plata', colorKey: 'bronze', icon: 'shield-outline' },
  { name: 'Plata', minPoints: 500, nextMinPoints: 1500, nextName: 'Oro', colorKey: 'silver', icon: 'shield-half-outline' },
  { name: 'Oro', minPoints: 1500, nextMinPoints: 3000, nextName: 'Platino', colorKey: 'gold', icon: 'medal-outline' },
  { name: 'Platino', minPoints: 3000, nextMinPoints: 6000, nextName: 'Diamante', colorKey: 'platinum', icon: 'diamond-outline' },
  { name: 'Diamante', minPoints: 6000, nextMinPoints: null, nextName: null, colorKey: 'diamond', icon: 'diamond' },
]

export function useStudentRanking(pageSize: number) {
  const { tokens } = useAppTheme()
  const leagues = useMemo<RankingLeague[]>(() => LEAGUE_DEFINITIONS.map((league) => ({
    ...league,
    color: tokens.gamification.rank[league.colorKey],
  })), [tokens])

  const [profile, setProfile] = useState<StudentRankingProfile | null>(null)
  const [rows, setRows] = useState<RankingProfile[]>([])
  const [current, setCurrent] = useState<RankingProfile | null>(null)
  const [total, setTotal] = useState(0)
  const [scope, setScopeState] = useState<RankingScope>('global')
  const [page, setPage] = useState(0)
  const [selectedLeagueName, setSelectedLeagueNameState] = useState<string | null>(null)
  const [classOptions, setClassOptions] = useState<RankingClassOption[]>([])
  const [selectedClassroomId, setSelectedClassroomIdState] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedLeague = selectedLeagueName
    ? leagues.find((league) => league.name === selectedLeagueName) || null
    : null

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('No hay una sesión activa.')

      const profileResult = await supabase
        .from('profiles')
        .select('id, alias, avatar, points, role_id, visibility')
        .eq('id', userId)
        .single()
      if (profileResult.error) throw profileResult.error
      if (!profileResult.data) throw new Error('No se pudo cargar el perfil del alumno.')

      const nextClassOptions = await fetchEnrolledClassOptions(userId)
      let effectiveClassroomId = selectedClassroomId
      if (scope === 'class') {
        const selectedExists = effectiveClassroomId !== null
          && nextClassOptions.some((option) => option.classroomId === effectiveClassroomId)
        if (!selectedExists) effectiveClassroomId = nextClassOptions[0]?.classroomId ?? null
      }

      const leagueFilter = selectedLeagueName
        ? leagues.find((league) => league.name === selectedLeagueName) || null
        : null

      const pageRequest = scope === 'class' && effectiveClassroomId === null
        ? Promise.resolve(emptyPayload())
        : fetchRankingPage({
            scope,
            classroomId: effectiveClassroomId,
            page,
            pageSize,
            minPoints: leagueFilter?.minPoints ?? null,
            maxPoints: leagueFilter?.nextMinPoints ?? null,
          })
      const currentRequest = leagueFilter
        ? fetchRankingPage({
            scope,
            classroomId: effectiveClassroomId,
            page: 0,
            pageSize: 1,
            minPoints: null,
            maxPoints: null,
          })
        : pageRequest

      const [pagePayload, currentPayload] = await Promise.all([pageRequest, currentRequest])
      const currentRow = currentPayload.current
      const cosmeticIds = Array.from(new Set([
        ...pagePayload.rows.map((row) => row.id),
        currentRow?.id,
        userId,
      ].filter((value): value is string => Boolean(value))))
      const cosmetics = await fetchProfileCosmeticsForUsers(cosmeticIds).catch(() => new Map<string, ProfileCosmetics>())

      setProfile({
        id: profileResult.data.id,
        alias: profileResult.data.alias,
        avatar: profileResult.data.avatar,
        points: Number(profileResult.data.points || 0),
        roleId: profileResult.data.role_id ?? null,
        visibility: profileResult.data.visibility || 'public',
        cosmetics: cosmetics.get(userId),
      })
      setRows(pagePayload.rows.map((row) => ({ ...row, cosmetics: cosmetics.get(row.id) })))
      setCurrent(currentRow ? { ...currentRow, cosmetics: cosmetics.get(currentRow.id) } : null)
      setTotal(pagePayload.total)
      setClassOptions(nextClassOptions)
      if (effectiveClassroomId !== selectedClassroomId) setSelectedClassroomIdState(effectiveClassroomId)
    } catch (cause) {
      console.error('Error fetching ranking:', cause)
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el ranking.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [leagues, page, pageSize, scope, selectedClassroomId, selectedLeagueName])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  useEffect(() => {
    if (scope !== 'class') return
    if (selectedClassroomId !== null) return
    if (classOptions.length === 0) return
    setSelectedClassroomIdState(classOptions[0].classroomId)
  }, [classOptions, scope, selectedClassroomId])

  const setScope = useCallback((nextScope: RankingScope) => {
    setPage(0)
    setSelectedLeagueNameState(null)
    setScopeState(nextScope)
    if (nextScope === 'class' && selectedClassroomId === null && classOptions[0]) {
      setSelectedClassroomIdState(classOptions[0].classroomId)
    }
  }, [classOptions, selectedClassroomId])

  const setSelectedLeagueName = useCallback((name: string | null) => {
    setPage(0)
    setSelectedLeagueNameState(name)
  }, [])

  const setSelectedClassroomId = useCallback((id: number | null) => {
    setPage(0)
    setSelectedLeagueNameState(null)
    setSelectedClassroomIdState(id)
  }, [])

  const currentPoints = current?.points ?? (scope === 'global' ? profile?.points ?? 0 : 0)
  const currentLeague = getRankingLeague(currentPoints, leagues)
  const currentRank = current?.rank ?? null
  const rankingTotal = current?.total_count ?? total
  const participates = profile?.visibility !== 'private'
  const isGuest = profile?.roleId === 'guest'

  return {
    profile,
    rows,
    current,
    total,
    scope,
    page,
    pageSize,
    selectedLeague,
    selectedLeagueName,
    classOptions,
    selectedClassroomId,
    leagues,
    currentLeague,
    currentRank,
    currentPoints,
    rankingTotal,
    participates,
    isGuest,
    loading,
    refreshing,
    error,
    setScope,
    setPage,
    setSelectedLeagueName,
    setSelectedClassroomId,
    reload: () => load(true),
  }
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
}): Promise<RankingPayload> {
  const { data, error } = await supabase.rpc('get_ranking_profiles_page', {
    p_scope: scope,
    p_classroom_id: scope === 'class' ? classroomId ?? undefined : undefined,
    p_min_points: minPoints ?? undefined,
    p_max_points: maxPoints ?? undefined,
    p_limit: pageSize,
    p_offset: Math.max(0, page) * pageSize,
  })
  if (error) throw error

  const payload = asRecord(data)
  return {
    rows: Array.isArray(payload.rows) ? payload.rows.map(normalizeRankingProfile).filter(isRankingProfile) : [],
    total: Math.max(0, Number(payload.total || 0)),
    current: payload.current ? normalizeRankingProfile(payload.current) : null,
    tieBreak: typeof payload.tie_break === 'string'
      ? payload.tie_break
      : 'Más XP; después más respuestas correctas; después haber alcanzado la puntuación antes.',
  }
}

async function fetchEnrolledClassOptions(userId: string): Promise<RankingClassOption[]> {
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

  const options = (data || []).flatMap((enrollment: any): RankingClassOption[] => {
    const subject = normalizeRelation(enrollment.subjects)
    const classroom = normalizeRelation(enrollment.classrooms)
    const classroomId = Number(enrollment.classroom_id ?? classroom?.id)
    if (!subject?.id || !Number.isFinite(classroomId)) return []
    return [{
      id: classroomId,
      subjectId: Number(subject.id),
      classroomId,
      name: subject.name || 'Curso',
      classroomName: classroom?.name || 'Clase principal',
      classroomCode: classroom?.code || null,
      description: subject.description || null,
      icon: subject.icon || null,
      themeColor: subject.theme_color || null,
    }]
  })

  return Array.from(new Map(options.map((option) => [option.classroomId, option])).values())
}

function normalizeRankingProfile(value: unknown): RankingProfile | null {
  const row = asRecord(value)
  if (typeof row.id !== 'string') return null
  return {
    id: row.id,
    alias: typeof row.alias === 'string' ? row.alias : 'Alumno',
    avatar: typeof row.avatar === 'string' ? row.avatar : null,
    points: Math.max(0, Number(row.points || 0)),
    visibility: typeof row.visibility === 'string' ? row.visibility : 'public',
    rank: Number.isFinite(Number(row.rank)) ? Number(row.rank) : null,
    total_count: Number.isFinite(Number(row.total_count)) ? Number(row.total_count) : null,
    correct_answers: Math.max(0, Number(row.correct_answers || 0)),
    last_activity_at: typeof row.last_activity_at === 'string' ? row.last_activity_at : null,
  }
}

function isRankingProfile(profile: RankingProfile | null): profile is RankingProfile {
  return Boolean(profile)
}

function emptyPayload(): RankingPayload {
  return {
    rows: [],
    total: 0,
    current: null,
    tieBreak: 'Más XP; después más respuestas correctas; después haber alcanzado la puntuación antes.',
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function normalizeRelation<T>(relation: T | T[] | null | undefined): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation ?? null
}

export function getRankingLeague(points: number, leagues: RankingLeague[]) {
  return [...leagues].reverse().find((league) => points >= league.minPoints) || leagues[0]
}

export function getLeagueProgress(points: number, league: RankingLeague) {
  if (league.nextMinPoints === null) return 100
  const size = league.nextMinPoints - league.minPoints
  return Math.min(100, Math.max(0, Math.round(((Math.max(0, points - league.minPoints)) / size) * 100)))
}
