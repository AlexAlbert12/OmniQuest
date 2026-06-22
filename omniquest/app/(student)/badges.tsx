import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/StudentSidebar'
import BrandLogo from '../../components/BrandLogo'
import NotificationBadge from '../../components/NotificationBadge'
import {
  buildStudentBadges,
  getStudentBadgeMetrics,
  syncStudentBadgeAwards,
  type StudentBadge,
  type StudentBadgeScore,
} from '../../lib/studentBadges'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentHeaderAvatar from '../../components/student/StudentHeaderAvatar'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
}

type BadgeFilter = 'all' | 'unlocked' | 'locked'

export default function BadgesScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [scores, setScores] = useState<StudentBadgeScore[]>([])
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [syncedBadges, setSyncedBadges] = useState<StudentBadge[]>([])
  const [activeFilter, setActiveFilter] = useState<BadgeFilter>('all')
  const [loading, setLoading] = useState(true)

  const isDesktop = width >= 1024
  const { accentColor } = useAppTheme()
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const metrics = getStudentBadgeMetrics({ scores, totalPoints: points, subjectsCount })
  const computedBadges = buildStudentBadges(metrics)
  const badges = syncedBadges.length > 0 ? syncedBadges : computedBadges
  const unlockedBadges = badges.filter((badge) => badge.unlocked)
  const lockedBadges = badges.filter((badge) => !badge.unlocked)
  const completionPercent = badges.length > 0 ? Math.round((unlockedBadges.length / badges.length) * 100) : 0

  const visibleBadges = useMemo(() => {
    if (activeFilter === 'unlocked') return unlockedBadges
    if (activeFilter === 'locked') return lockedBadges
    return badges
  }, [activeFilter, badges, lockedBadges, unlockedBadges])

  const fetchBadges = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) return

      const [profileResult, enrollmentsResult, scoresResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, points').eq('id', userId).single(),
        supabase.from('enrollments').select('subject_id').eq('student_id', userId),
        supabase
          .from('subject_scores')
          .select('max_score, played_at, played_days, correct_answers')
          .eq('student_id', userId),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (scoresResult.error) throw scoresResult.error

      setProfile(profileResult.data)
      setSubjectsCount(enrollmentsResult.data?.length || 0)
      const nextScores = (scoresResult.data || []) as StudentBadgeScore[]
      setScores(nextScores)

      const nextSubjectsCount = enrollmentsResult.data?.length || 0
      const nextPoints = profileResult.data?.points ?? 0
      const nextMetrics = getStudentBadgeMetrics({
        scores: nextScores,
        totalPoints: nextPoints,
        subjectsCount: nextSubjectsCount,
      })
      const nextBadges = buildStudentBadges(nextMetrics)

      try {
        const syncResult = await syncStudentBadgeAwards({
          userId,
          badges: nextBadges,
          currentPoints: nextPoints,
        })
        setSyncedBadges(syncResult.badges)

        if (syncResult.awardedXp > 0) {
          setProfile((current) =>
            current ? { ...current, points: (current.points ?? 0) + syncResult.awardedXp } : current
          )
          showAlert(
            '¡Logro desbloqueado!',
            `Has ganado ${syncResult.awardedXp.toLocaleString()} XP en recompensas.`
          )
        }
      } catch (error) {
        console.error('Error sincronizando logros:', error)
        setSyncedBadges(nextBadges)
      }
    } catch (error) {
      console.error('Error fetching badges:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchBadges()
    }, [fetchBadges])
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login' as any)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color={accentColor} />
        <Text className="mt-4 text-[#8FA7C7]">Preparando tus insignias...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection="badges"
            alias={alias}
            avatar={profile?.avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={handleSignOut}
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
                <Ionicons name="ribbon" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Logros</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Revisa las recompensas que ya ganaste y las próximas por desbloquear.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <NotificationBadge />
              <StudentHeaderAvatar />
            </View>
          </View>

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <View className="flex-[1.25] overflow-hidden rounded-2xl border border-[#2D3F78] bg-[#101D4A] p-6">
              <View className="absolute right-[-30px] top-[-32px] h-36 w-36 rounded-full" style={{ backgroundColor: withAlpha(accentColor, '25') }} />
              <View className="absolute bottom-[-34px] left-[-18px] h-28 w-44 rounded-full bg-[#0B3472]/45" />
              <View className="relative flex-row items-center gap-5">
                <View className="h-24 w-24 items-center justify-center rounded-2xl border border-[#9FD6FF]/40 bg-[#9FD6FF]/15">
                  <Ionicons name="ribbon" size={44} color="#9FD6FF" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[16px] font-bold text-[#C9E8FF]">Colección de logros</Text>
                  <Text className="mt-1 text-[36px] font-black text-white">
                    {unlockedBadges.length} / {badges.length}
                  </Text>
                  <Text className="mt-1 text-[13px] text-[#AFC2DB]">insignias conseguidas</Text>
                  <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#27396B]">
                    <View className="h-full rounded-full" style={{ width: `${completionPercent}%`, backgroundColor: accentColor }} />
                  </View>
                </View>
              </View>
            </View>

            <View className={isDesktop ? 'flex-1 flex-row gap-4' : 'flex-row gap-4'}>
              <MetricTile icon="checkmark-circle" color="#34D399" label="Conseguidas" value={String(unlockedBadges.length)} />
              <MetricTile icon="lock-closed" color="#F6A64A" label="Pendientes" value={String(lockedBadges.length)} />
              <MetricTile icon="flame" color="#FF7B45" label="Días de racha" value={String(metrics.streakDays)} />
            </View>
          </View>

          <View className="mt-5 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
            <View className={isDesktop ? 'flex-row items-center justify-between gap-4' : 'gap-4'}>
              <View>
                <Text className="text-[15px] font-black text-white">Todas las insignias</Text>
                <Text className="mt-1 text-[12px] text-[#8FA7C7]">
                  Las bloqueadas muestran cuánto te falta para conseguirlas.
                </Text>
              </View>
              <View className="flex-row rounded-xl border border-[#1A3155] bg-[#0D1D3B] p-1">
                <FilterButton label="Todas" active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
                <FilterButton label="Conseguidas" active={activeFilter === 'unlocked'} onPress={() => setActiveFilter('unlocked')} />
                <FilterButton label="Bloqueadas" active={activeFilter === 'locked'} onPress={() => setActiveFilter('locked')} />
              </View>
            </View>

            <View className={isDesktop ? 'mt-5 flex-row flex-wrap gap-4' : 'mt-5 gap-4'}>
              {visibleBadges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} isDesktop={isDesktop} />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="badges" /> : null}
    </View>
  )
}

function MetricTile({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  label: string
  value: string
}) {
  return (
    <View className="min-w-[112px] flex-1 items-center justify-center rounded-2xl border border-[#1A3155] bg-[#09162C] px-3 py-5">
      <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text className="mt-3 text-center text-[13px] text-[#AFC2DB]">{label}</Text>
      <Text className="mt-1 text-[26px] font-black text-white">{value}</Text>
    </View>
  )
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { accentColor } = useAppTheme()

  return (
    <Pressable
      onPress={onPress}
      className="rounded-lg px-3 py-2"
      style={{ backgroundColor: active ? accentColor : 'transparent' }}
    >
      <Text className={`text-[13px] font-bold ${active ? 'text-white' : 'text-[#AFC2DB]'}`}>{label}</Text>
    </Pressable>
  )
}

function BadgeCard({ badge, isDesktop }: { badge: StudentBadge; isDesktop: boolean }) {
  const progressPercent = Math.min(100, Math.round((badge.current / badge.target) * 100))

  return (
    <View
      className={`rounded-2xl border bg-[#0D1D3B] p-4 ${badge.unlocked ? 'border-[#2FBC7E]/50' : 'border-[#1A3155]'} ${isDesktop ? 'w-[31.8%]' : ''}`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View
          className="h-16 w-16 items-center justify-center rounded-2xl border-2"
          style={{ backgroundColor: `${badge.color}20`, borderColor: badge.color }}
        >
          <Ionicons name={badge.unlocked ? badge.icon : 'lock-closed'} size={30} color={badge.color} />
        </View>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: badge.unlocked ? 'rgba(52,211,153,0.16)' : 'rgba(143,167,199,0.14)' }}
        >
          <Text className={`text-[12px] font-black ${badge.unlocked ? 'text-[#70E0A5]' : 'text-[#AFC2DB]'}`}>
            {badge.statusLabel}
          </Text>
        </View>
      </View>

      <Text className="mt-4 text-[17px] font-black text-white">{badge.title}</Text>
      <Text className="mt-1 min-h-[36px] text-[13px] leading-5 text-[#AFC2DB]">{badge.requirement}</Text>

      <View className="mt-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-[13px] text-[#8FA7C7]">Progreso</Text>
          <Text className="text-[13px] font-bold text-[#DDE7F4]">{badge.progressLabel}</Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-[#172A4A]">
          <View className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: badge.color }} />
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between border-t border-[#172A4A] pt-3">
        <Text className="text-[13px] text-[#8FA7C7]">Recompensa</Text>
        <Text className="text-[13px] font-black text-[#BFAAFF]">{badge.xp}</Text>
      </View>
    </View>
  )
}
