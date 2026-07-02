import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
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
import StudentSidebar from '../../components/student/StudentSidebar'
import BrandLogo from '../../components/BrandLogo'
import NotificationBadge from '../../components/NotificationBadge'
import {
  buildStudentBadges,
  getStudentBadgeMetrics,
  syncStudentBadgeAwards,
  type StudentBadge,
  type StudentBadgeAttempt,
} from '../../lib/studentBadges'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentHeaderAvatar from '../../components/student/StudentHeaderAvatar'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { useNotifications } from '../../hooks/useNotifications'

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
  const [attempts, setAttempts] = useState<StudentBadgeAttempt[]>([])
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [syncedBadges, setSyncedBadges] = useState<StudentBadge[]>([])
  const [activeFilter, setActiveFilter] = useState<BadgeFilter>('all')
  const [celebrationBadges, setCelebrationBadges] = useState<StudentBadge[]>([])
  const [loading, setLoading] = useState(true)

  const isDesktop = width >= 1024
  const { accentColor } = useAppTheme()
  const { refresh: refreshStudentNotifications } = useNotifications('student')
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const metrics = getStudentBadgeMetrics({ attempts, totalPoints: points, subjectsCount })
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
  const activeCelebrationBadge = celebrationBadges[0] ?? null

  const handleCloseCelebration = useCallback(() => {
    setCelebrationBadges((currentBadges) => currentBadges.slice(1))
  }, [])

  const fetchBadges = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) return

      const [profileResult, enrollmentsResult, attemptsResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, points').eq('id', userId).single(),
        supabase.from('enrollments').select('subject_id').eq('student_id', userId),
        supabase
          .from('attempt_history')
          .select(`
            id,
            is_correct,
            attempted_at,
            earned_points,
            questions (
              subject_id,
              classroom_id,
              type
            )
          `)
          .eq('student_id', userId)
          .order('attempted_at', { ascending: false }),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (attemptsResult.error) throw attemptsResult.error

      setProfile(profileResult.data)
      setSubjectsCount(enrollmentsResult.data?.length || 0)
      const nextAttempts = (attemptsResult.data || []) as StudentBadgeAttempt[]
      setAttempts(nextAttempts)

      const nextSubjectsCount = enrollmentsResult.data?.length || 0
      const nextPoints = profileResult.data?.points ?? 0
      const nextMetrics = getStudentBadgeMetrics({
        attempts: nextAttempts,
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
          void refreshStudentNotifications()

          setProfile((current) =>
            current ? { ...current, points: (current.points ?? 0) + syncResult.awardedXp } : current
          )

          if (syncResult.newlyAwardedBadges.length > 0) {
            setCelebrationBadges(syncResult.newlyAwardedBadges)
          } else {
            showAlert(
              '¡Logro desbloqueado!',
              `Has ganado ${syncResult.awardedXp.toLocaleString()} XP en recompensas.`
            )
          }
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
  }, [refreshStudentNotifications])

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
                Consulta tus logros globales: se desbloquean con actividad, constancia, precisión y exploración en cualquier curso o clase.
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
                  Son generales para todos los cursos y clases. Las bloqueadas muestran cuánto te falta para conseguirlas.
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

      <BadgeUnlockModal
        badge={activeCelebrationBadge}
        visible={Boolean(activeCelebrationBadge)}
        remainingCount={Math.max(0, celebrationBadges.length - 1)}
        onClose={handleCloseCelebration}
      />

      {!isDesktop ? <StudentBottomNav active="badges" /> : null}
    </View>
  )
}

function BadgeUnlockModal({
  badge,
  visible,
  remainingCount,
  onClose,
}: {
  badge: StudentBadge | null
  visible: boolean
  remainingCount: number
  onClose: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(0.84)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) {
      scaleAnim.setValue(0.84)
      opacityAnim.setValue(0)
      glowAnim.setValue(0)
      return
    }

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 95,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start()

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    )
    pulseAnimation.start()

    return () => pulseAnimation.stop()
  }, [glowAnim, opacityAnim, scaleAnim, visible])

  if (!badge) return null

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  })
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.52],
  })

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View
        className="flex-1 items-center justify-center px-5"
        style={{ backgroundColor: 'rgba(2, 6, 23, 0.88)' }}
      >
        <Pressable className="absolute inset-0" onPress={onClose} />
        <Animated.View
          className="w-full max-w-[440px] overflow-hidden rounded-3xl border p-0"
          style={{
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
            backgroundColor: '#08142E',
            borderColor: '#7C5CFF',
            boxShadow: '0 28px 80px rgba(0, 0, 0, 0.58)',
          } as any}
        >
          <View className="absolute right-[-50px] top-[-58px] h-40 w-40 rounded-full" style={{ backgroundColor: 'rgba(124, 92, 255, 0.26)' }} />
          <View className="absolute bottom-[-70px] left-[-52px] h-40 w-52 rounded-full" style={{ backgroundColor: 'rgba(88, 181, 255, 0.14)' }} />

          <View className="border-b border-[#263E7A] px-6 py-5" style={{ backgroundColor: '#111B45' }}>
            <View className="items-center">
              <View className="flex-row items-center gap-2 rounded-full border px-4 py-2" style={{ backgroundColor: '#2A1A5F', borderColor: '#8B5CF6' }}>
                <Ionicons name="sparkles" size={16} color="#FBBF24" />
                <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: '#FDE68A' }}>
                  Logro desbloqueado
                </Text>
              </View>
            </View>
          </View>

          <View className="items-center px-6 pb-6 pt-5">
            <View className="h-32 w-32 items-center justify-center">
              <Animated.View
                className="absolute h-32 w-32 rounded-full"
                style={{
                  backgroundColor: `${badge.color}44`,
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                }}
              />
              <View
                className="h-24 w-24 items-center justify-center rounded-3xl border-2"
                style={{ backgroundColor: `${badge.color}24`, borderColor: badge.color }}
              >
                <Ionicons name={badge.icon} size={44} color={badge.color} />
              </View>
            </View>

            <Text className="mt-4 text-center text-[29px] font-black text-white">
              {badge.title}
            </Text>
            <Text className="mt-2 text-center text-[14px] leading-6 text-[#D8E3F3]">
              {badge.requirement}
            </Text>

            <View className="mt-5 flex-row items-center gap-2 rounded-2xl border px-5 py-3" style={{ backgroundColor: 'rgba(251, 191, 36, 0.18)', borderColor: 'rgba(251, 191, 36, 0.45)' }}>
              <Ionicons name="flash" size={18} color="#FBBF24" />
              <Text className="font-black text-[#FDE68A]">Recompensa: {badge.xp}</Text>
            </View>

            {remainingCount > 0 ? (
              <Text className="mt-3 text-center text-[12px] text-[#AFC2DB]">
                Tienes {remainingCount} {remainingCount === 1 ? 'logro más' : 'logros más'} esperando.
              </Text>
            ) : null}

            <Pressable
              onPress={onClose}
              className="mt-6 w-full items-center justify-center rounded-2xl px-5 py-4"
              style={({ pressed }) => ({
                opacity: pressed ? 0.86 : 1,
                backgroundColor: '#7C5CFF',
              })}
            >
              <Text className="text-[15px] font-black text-white">
                {remainingCount > 0 ? 'Ver siguiente logro' : 'Genial'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
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
