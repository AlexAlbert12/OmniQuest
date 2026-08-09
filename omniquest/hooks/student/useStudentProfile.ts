import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { fetchStudentBadgeCatalog, type StudentBadge, type StudentBadgeCatalogPage } from '../../lib/studentBadges'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { formatLongDate } from '../../lib/dateFormat'
import { DEFAULT_AVATAR_FRAME, fetchAvatarCustomizationOptions, type AvatarCustomizationOptions, type ProfileCosmetics } from '../../lib/avatarCosmetics'
import { readThroughCache, updateOfflineCache } from '../../lib/offlineCache'
import { useOfflineSync } from '../useOfflineSync'

export type StudentProfile = {
  id: string
  alias: string
  avatar: string | null
  created_at: string
  points: number | null
  visibility: 'public' | 'private' | string | null
}

type ProfileCacheSnapshot = {
  profile: StudentProfile
  email: string
  customizationOptions: AvatarCustomizationOptions | null
  badgeCatalog?: StudentBadgeCatalogPage | null
}

export type StudentProfileViewModel = {
  profile: StudentProfile | null
  email: string
  customizationOptions: AvatarCustomizationOptions | null
  cosmetics: ProfileCosmetics
  badges: StudentBadge[]
  unlockedBadges: StudentBadge[]
  latestBadges: StudentBadge[]
  achievementsCount: number
  achievementsTotal: number
  loading: boolean
  alias: string
  points: number
  level: number
  nextLevelProgress: number
  streakDays: number
  memberSince: string
  rankingVisible: boolean
  refresh: () => Promise<void>
  applyAvatar: (avatar: string | null) => Promise<void>
  applyCustomization: (options: AvatarCustomizationOptions) => Promise<void>
}

const PROFILE_CACHE_RESOURCE = 'student:profile'

export function useStudentProfile(): StudentProfileViewModel {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [email, setEmail] = useState('')
  const [customizationOptions, setCustomizationOptions] = useState<AvatarCustomizationOptions | null>(null)
  const [badgeCatalog, setBadgeCatalog] = useState<StudentBadgeCatalogPage | null>(null)
  const [loading, setLoading] = useState(true)
  const { lastSyncedAt } = useOfflineSync()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) return
      const nextEmail = session.session?.user.email || ''

      await readThroughCache<ProfileCacheSnapshot>({
        userId,
        resource: PROFILE_CACHE_RESOURCE,
        fetcher: async () => {
          // Perfil y Logros consumen el mismo catálogo canónico. El RPC sincroniza premios antes
          // de devolver el resumen; por eso el perfil se consulta después para recoger el XP final.
          const [nextBadgeCatalog, nextCustomizationOptions] = await Promise.all([
            fetchStudentBadgeCatalog({ page: 0, pageSize: 50, status: 'all' }),
            fetchAvatarCustomizationOptions().catch((error) => {
              console.warn('No se pudieron cargar los cosméticos del avatar:', error)
              return null
            }),
          ])
          const profileResult = await supabase.from('profiles').select('id, alias, avatar, created_at, points, visibility').eq('id', userId).single()
          if (profileResult.error) throw profileResult.error

          return { profile: profileResult.data as StudentProfile, email: nextEmail, customizationOptions: nextCustomizationOptions, badgeCatalog: nextBadgeCatalog }
        },
        onData: (snapshot) => {
          setProfile(snapshot.profile)
          setEmail(snapshot.email)
          setCustomizationOptions(snapshot.customizationOptions)
          setBadgeCatalog(snapshot.badgeCatalog ?? null)
          setLoading(false)
        },
      })
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void refresh() }, [refresh]))

  useEffect(() => {
    if (lastSyncedAt) void refresh()
  }, [lastSyncedAt, refresh])

  const applyAvatar = useCallback(async (avatar: string | null) => {
    if (!profile) return
    setProfile((current) => current ? { ...current, avatar } : current)
    await updateOfflineCache<ProfileCacheSnapshot>(profile.id, PROFILE_CACHE_RESOURCE, (snapshot) => ({ ...snapshot, profile: { ...snapshot.profile, avatar } }))
  }, [profile])

  const applyCustomization = useCallback(async (options: AvatarCustomizationOptions) => {
    if (!profile) return
    setCustomizationOptions(options)
    await updateOfflineCache<ProfileCacheSnapshot>(profile.id, PROFILE_CACHE_RESOURCE, (snapshot) => ({ ...snapshot, customizationOptions: options }))
  }, [profile])

  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Usuario'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const badges = badgeCatalog?.badges ?? []
  const unlockedBadges = badges.filter((badge) => badge.unlocked)
  const latestBadges = [...unlockedBadges].sort((left, right) => badgeAwardTimestamp(right) - badgeAwardTimestamp(left)).slice(0, 3)
  const cosmetics = customizationOptions?.cosmetics || { frame: DEFAULT_AVATAR_FRAME, featuredBadgeId: null }
  const streakDays = badgeCatalog?.summary.streakDays ?? 0
  const achievementsCount = badgeCatalog?.summary.unlocked ?? unlockedBadges.length
  const achievementsTotal = badgeCatalog?.summary.total ?? badges.length

  return useMemo(() => ({
    profile,
    email,
    customizationOptions,
    cosmetics,
    badges,
    unlockedBadges,
    latestBadges,
    achievementsCount,
    achievementsTotal,
    loading,
    alias,
    points,
    level,
    nextLevelProgress,
    streakDays,
    memberSince: formatLongDate(profile?.created_at, 'Sin fecha disponible'),
    rankingVisible: profile?.visibility !== 'private',
    refresh,
    applyAvatar,
    applyCustomization,
  }), [achievementsCount, achievementsTotal, alias, applyAvatar, applyCustomization, badges, cosmetics, customizationOptions, email, latestBadges, level, loading, nextLevelProgress, points, profile, refresh, streakDays, unlockedBadges])
}

function badgeAwardTimestamp(badge: StudentBadge) {
  if (!badge.awardedAt) return 0
  const parsed = Date.parse(badge.awardedAt)
  return Number.isFinite(parsed) ? parsed : 0
}
