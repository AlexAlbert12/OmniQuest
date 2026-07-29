import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import {
  buildStudentBadges,
  calculateStreakDays,
  getStudentBadgeMetrics,
  type StudentBadge,
  type StudentBadgeScore,
} from '../../lib/studentBadges'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { formatLongDate } from '../../lib/dateFormat'
import {
  DEFAULT_AVATAR_FRAME,
  fetchAvatarCustomizationOptions,
  type AvatarCustomizationOptions,
  type ProfileCosmetics,
} from '../../lib/avatarCosmetics'
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

export type StudentProfileScore = {
  subject_id: number | null
  max_score: number | null
  played_at: string | null
  played_days: string[] | null
  correct_answers: number | null
  subjects?: { name: string } | { name: string }[] | null
}

type StudentProfileSubject = { id: number; name: string }
type StudentProfileEnrollment = { subjects: StudentProfileSubject | StudentProfileSubject[] | null }

type ProfileCacheSnapshot = {
  profile: StudentProfile
  email: string
  subjects: StudentProfileSubject[]
  scores: StudentProfileScore[]
  customizationOptions: AvatarCustomizationOptions | null
}

export type StudentProfileViewModel = {
  profile: StudentProfile | null
  email: string
  subjects: StudentProfileSubject[]
  scores: StudentProfileScore[]
  customizationOptions: AvatarCustomizationOptions | null
  cosmetics: ProfileCosmetics
  badges: StudentBadge[]
  unlockedBadges: StudentBadge[]
  latestBadges: StudentBadge[]
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

export function useStudentProfile(): StudentProfileViewModel {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [email, setEmail] = useState('')
  const [subjects, setSubjects] = useState<StudentProfileSubject[]>([])
  const [scores, setScores] = useState<StudentProfileScore[]>([])
  const [customizationOptions, setCustomizationOptions] = useState<AvatarCustomizationOptions | null>(null)
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
        resource: 'student:profile',
        fetcher: async () => {
          const [profileResult, enrollmentsResult, scoresResult, nextCustomizationOptions] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, alias, avatar, created_at, points, visibility')
              .eq('id', userId)
              .single(),
            supabase.from('enrollments').select('subjects(id, name)').eq('student_id', userId),
            supabase
              .from('subject_scores')
              .select('subject_id, max_score, played_at, played_days, correct_answers, subjects(name)')
              .eq('student_id', userId)
              .order('played_at', { ascending: false }),
            fetchAvatarCustomizationOptions().catch((error) => {
              console.warn('No se pudieron cargar los cosméticos del avatar:', error)
              return null
            }),
          ])
          if (profileResult.error) throw profileResult.error
          if (enrollmentsResult.error) throw enrollmentsResult.error
          if (scoresResult.error) throw scoresResult.error

          return {
            profile: profileResult.data as StudentProfile,
            email: nextEmail,
            subjects: ((enrollmentsResult.data || []) as StudentProfileEnrollment[]).flatMap((enrollment) => {
              if (Array.isArray(enrollment.subjects)) return enrollment.subjects
              return enrollment.subjects ? [enrollment.subjects] : []
            }),
            scores: (scoresResult.data || []) as StudentProfileScore[],
            customizationOptions: nextCustomizationOptions,
          }
        },
        onData: (snapshot) => {
          setProfile(snapshot.profile)
          setEmail(snapshot.email)
          setSubjects(snapshot.subjects)
          setScores(snapshot.scores)
          setCustomizationOptions(snapshot.customizationOptions)
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
    await updateOfflineCache<ProfileCacheSnapshot>(profile.id, 'student:profile', (snapshot) => ({
      ...snapshot,
      profile: { ...snapshot.profile, avatar },
    }))
  }, [profile])

  const applyCustomization = useCallback(async (options: AvatarCustomizationOptions) => {
    if (!profile) return
    setCustomizationOptions(options)
    await updateOfflineCache<ProfileCacheSnapshot>(profile.id, 'student:profile', (snapshot) => ({
      ...snapshot,
      customizationOptions: options,
    }))
  }, [profile])

  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Usuario'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const badgeMetrics = getStudentBadgeMetrics({
    scores: scores as StudentBadgeScore[],
    totalPoints: points,
    subjectsCount: subjects.length,
  })
  const badges = buildStudentBadges(badgeMetrics)
  const unlockedBadges = badges.filter((badge) => badge.unlocked)
  const latestBadges = unlockedBadges.slice(0, 3)
  const cosmetics = customizationOptions?.cosmetics || {
    frame: DEFAULT_AVATAR_FRAME,
    featuredBadgeId: null,
  }
  const streakDays = calculateStreakDays(scores.flatMap((score) => [
    ...(score.played_days || []),
    ...(score.played_at ? [score.played_at] : []),
  ]))

  return useMemo(() => ({
    profile,
    email,
    subjects,
    scores,
    customizationOptions,
    cosmetics,
    badges,
    unlockedBadges,
    latestBadges,
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
  }), [
    alias,
    applyAvatar,
    applyCustomization,
    badges,
    cosmetics,
    customizationOptions,
    email,
    latestBadges,
    level,
    loading,
    nextLevelProgress,
    points,
    profile,
    refresh,
    scores,
    streakDays,
    subjects,
    unlockedBadges,
  ])
}
