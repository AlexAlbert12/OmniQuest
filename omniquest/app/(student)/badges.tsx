import React, { useCallback, useMemo, useState } from 'react'
import {
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
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import AppTabs from '../../components/ui/AppTabs'
import BadgeUnlockModal from '../../components/gamification/BadgeUnlockModal'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/student/StudentSidebar'
import {
  buildStudentBadges,
  getStudentBadgeMetrics,
  syncStudentBadgeAwards,
  type StudentBadge,
  type StudentBadgeAttempt,
  type StudentBadgeCategory,
} from '../../lib/studentBadges'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import { useAppTheme } from '../../lib/appTheme'
import { readThroughCache } from '../../lib/offlineCache'
import { enqueueOfflineMutation, isRetriableOfflineError } from '../../lib/offlineMutations'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { withAlpha } from '../../lib/color'
import { useNotifications } from '../../hooks/useNotifications'
import { LinearGradient } from 'expo-linear-gradient'
import { fetchStudentAttemptHistory } from '../../lib/studentSecureData'
import OmniGuide from '@/components/OmniGuide'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
}

type BadgeFilter = 'all' | 'unlocked' | 'locked'
type BadgeCategoryFilter = 'all' | StudentBadgeCategory
type BadgesCacheSnapshot = {
  profile: Profile
  attempts: StudentBadgeAttempt[]
  subjectsCount: number
  badges: StudentBadge[]
  awardedXp: number
  newlyAwardedBadges: StudentBadge[]
}

const badgeCategoryTabs: { key: BadgeCategoryFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todos', icon: 'apps-outline' },
  { key: 'xp', label: 'XP', icon: 'flash-outline' },
  { key: 'streak', label: 'Racha', icon: 'flame-outline' },
  { key: 'accuracy', label: 'Precisión', icon: 'speedometer-outline' },
  { key: 'courses', label: 'Cursos', icon: 'book-outline' },
  { key: 'challenges', label: 'Retos', icon: 'flag-outline' },
]

export default function BadgesScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [attempts, setAttempts] = useState<StudentBadgeAttempt[]>([])
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [syncedBadges, setSyncedBadges] = useState<StudentBadge[]>([])
  const [activeFilter, setActiveFilter] = useState<BadgeFilter>('all')
  const [activeCategory, setActiveCategory] = useState<BadgeCategoryFilter>('all')
  const [celebrationBadges, setCelebrationBadges] = useState<StudentBadge[]>([])
  const [loading, setLoading] = useState(true)

  const isDesktop = width >= 1024
  const { accentColor } = useAppTheme()
  const { refresh: refreshStudentNotifications } = useNotifications('student')
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Sin alias'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const metrics = getStudentBadgeMetrics({ attempts, totalPoints: points, subjectsCount })
  const computedBadges = buildStudentBadges(metrics)
  const badges = syncedBadges.length > 0 ? syncedBadges : computedBadges
  const unlockedBadges = badges.filter((badge) => badge.unlocked)
  const lockedBadges = badges.filter((badge) => !badge.unlocked)
  const completionPercent = badges.length > 0 ? Math.round((unlockedBadges.length / badges.length) * 100) : 0
  const nextBadge = [...lockedBadges].sort((a, b) => (b.current / Math.max(b.target, 1)) - (a.current / Math.max(a.target, 1)))[0] ?? null

  const visibleBadges = useMemo(() => {
    const categoryBadges = activeCategory === 'all'
      ? badges
      : badges.filter((badge) => badge.category === activeCategory)

    if (activeFilter === 'unlocked') return categoryBadges.filter((badge) => badge.unlocked)
    if (activeFilter === 'locked') return categoryBadges.filter((badge) => !badge.unlocked)
    return categoryBadges
  }, [activeCategory, activeFilter, badges])
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

      await readThroughCache<BadgesCacheSnapshot>({
        userId,
        resource: 'student:badges',
        fetcher: async () => {
          const [profileResult, enrollmentsResult, attemptsResult] = await Promise.all([
            supabase.from('profiles').select('id, alias, avatar, points').eq('id', userId).single(),
            supabase.from('enrollments').select('subject_id').eq('student_id', userId),
            fetchStudentAttemptHistory({ limit: 5000 }),
          ])
          if (profileResult.error) throw profileResult.error
          if (enrollmentsResult.error) throw enrollmentsResult.error

          const nextAttempts = (attemptsResult || []) as StudentBadgeAttempt[]
          const nextSubjectsCount = enrollmentsResult.data?.length || 0
          const nextPoints = profileResult.data?.points ?? 0
          const nextBadges = buildStudentBadges(getStudentBadgeMetrics({
            attempts: nextAttempts,
            totalPoints: nextPoints,
            subjectsCount: nextSubjectsCount,
          }))

          try {
            const syncResult = await syncStudentBadgeAwards({ userId, badges: nextBadges, currentPoints: nextPoints })
            return {
              profile: { ...profileResult.data, points: nextPoints + syncResult.awardedXp },
              attempts: nextAttempts,
              subjectsCount: nextSubjectsCount,
              badges: syncResult.badges,
              awardedXp: syncResult.awardedXp,
              newlyAwardedBadges: syncResult.newlyAwardedBadges,
            }
          } catch (error) {
            if (isRetriableOfflineError(error)) {
              await enqueueOfflineMutation({
                userId,
                kind: 'badges.sync',
                entityKey: 'badges:sync',
                conflictPolicy: 'server_wins',
                payload: {},
              })
            }
            console.error('Error sincronizando logros:', error)
            return {
              profile: profileResult.data,
              attempts: nextAttempts,
              subjectsCount: nextSubjectsCount,
              badges: nextBadges,
              awardedXp: 0,
              newlyAwardedBadges: [],
            }
          }
        },
        onData: (snapshot, metadata) => {
          setProfile(snapshot.profile)
          setSubjectsCount(snapshot.subjectsCount)
          setAttempts(snapshot.attempts)
          setSyncedBadges(snapshot.badges)
          setLoading(false)
          if (metadata.source === 'network' && snapshot.awardedXp > 0) {
            void refreshStudentNotifications()
            if (snapshot.newlyAwardedBadges.length > 0) setCelebrationBadges(snapshot.newlyAwardedBadges)
            else showAlert('¡Logro desbloqueado!', `Has ganado ${snapshot.awardedXp.toLocaleString()} XP en recompensas.`)
          }
        },
      })
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
        <OmniGuide state="blink" size={112} />
        <Text className="mt-4 text-[#8FA7C7]">Omni está preparando tus insignias...</Text>
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
            paddingBottom: isDesktop ? 28 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          showsVerticalScrollIndicator={false}
        >
          <StudentPageHeader
            icon="ribbon"
            isDesktop={isDesktop}
            title="Logros"
            subtitle={isDesktop
              ? 'Consulta tus logros globales: se desbloquean con actividad, constancia, precisión y exploración.'
              : 'Desbloquea insignias y sigue tu próxima recompensa.'}
          />

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

            <View className={isDesktop ? 'flex-1 flex-row gap-4' : 'flex-row gap-3'}>
              <MetricTile icon="checkmark-circle" color="#34D399" label="Conseguidas" value={String(unlockedBadges.length)} />
              <MetricTile icon="lock-closed" color="#F6A64A" label="Pendientes" value={String(lockedBadges.length)} />
              <MetricTile icon="flame" color="#FF7B45" label="Días de racha" value={String(metrics.streakDays)} />
            </View>
          </View>

          {nextBadge ? (
            <NextBadgeCard badge={nextBadge} isDesktop={isDesktop} />
          ) : null}

          <View className="mt-5 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
            <View className={isDesktop ? 'flex-row items-start justify-between gap-4' : 'gap-4'}>
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-black text-white">Colección por categorías</Text>
                <Text className="mt-1 text-[12px] leading-5 text-[#8FA7C7]">
                  Explora logros de XP, racha, precisión, cursos y retos. Las insignias bloqueadas muestran tu avance real.
                </Text>
              </View>
              <View className="flex-row rounded-xl border border-[#1A3155] bg-[#0D1D3B] p-1">
                <FilterButton label="Todas" active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
                <FilterButton label="Conseguidas" active={activeFilter === 'unlocked'} onPress={() => setActiveFilter('unlocked')} />
                <FilterButton label="Bloqueadas" active={activeFilter === 'locked'} onPress={() => setActiveFilter('locked')} />
              </View>
            </View>

            <View className="mt-4">
              <AppTabs<BadgeCategoryFilter>
                accessibilityLabel="Filtrar logros por categoría"
                compact
                role="student"
                value={activeCategory}
                onChange={setActiveCategory}
                items={badgeCategoryTabs}
              />
            </View>

            <View className={isDesktop ? 'mt-5 flex-row flex-wrap gap-4' : 'mt-5 flex-row flex-wrap gap-3'}>
              {visibleBadges.length > 0 ? visibleBadges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} isDesktop={isDesktop} />
              )) : (
                <View className="w-full items-center rounded-2xl border border-dashed border-[#29466F] bg-[#0D1D3B] px-5 py-10">
                  <OmniGuide state="thinking" size={72} />
                  <Text className="mt-3 text-[15px] font-black text-white">No hay logros en este filtro</Text>
                  <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">Prueba otra categoría o cambia el estado de las insignias.</Text>
                </View>
              )}
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

function NextBadgeCard({ badge, isDesktop }: { badge: StudentBadge; isDesktop: boolean }) {
  const progressPercent = Math.min(100, Math.round((badge.current / Math.max(badge.target, 1)) * 100))
  const remaining = Math.max(0, badge.target - badge.current)

  return (
    <LinearGradient
      colors={['#2B176F', '#171B50', '#0A1A35']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ marginTop: 20, borderRadius: 24, borderWidth: 1, borderColor: `${badge.color}80`, overflow: 'hidden' }}
    >
      <View className={isDesktop ? 'flex-row items-center gap-5 p-5' : 'gap-4 p-4'}>
        <View className={isDesktop ? 'flex-row items-center gap-4' : 'flex-row items-center gap-4'}>
          <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: `${badge.color}24` }}>
            <Ionicons name={badge.icon} size={32} color={badge.color} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: badge.color }}>Siguiente logro</Text>
            <Text className="mt-1 text-[19px] font-black text-white" numberOfLines={2}>{badge.title}</Text>
            <Text className="mt-1 text-[13px] leading-5 text-[#DDE7F4]" numberOfLines={2}>
              {remaining > 0 ? getRemainingBadgeMessage(badge, remaining) : 'Está listo para desbloquear.'}
            </Text>
          </View>
        </View>

        <View className={isDesktop ? 'min-w-[260px] flex-1' : ''}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-[12px] text-[#AFC2DB]">Progreso</Text>
            <Text className="text-[12px] font-black text-white">{badge.progressLabel}</Text>
          </View>
          <View className="h-2.5 overflow-hidden rounded-full bg-[#172A4A]">
            <View className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: badge.color }} />
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] text-[#AFC2DB]">Recompensa</Text>
            <Text className="text-[13px] font-black" style={{ color: badge.color }}>{badge.xp}</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  )
}

function getRemainingBadgeMessage(badge: StudentBadge, remaining: number) {
  const amount = remaining.toLocaleString()
  switch (badge.category) {
    case 'xp':
      return `Te faltan ${amount} XP para desbloquearlo.`
    case 'streak':
      return `Te faltan ${amount} día${remaining === 1 ? '' : 's'} de racha.`
    case 'courses':
      return `Te faltan ${amount} curso${remaining === 1 ? '' : 's'} o clase${remaining === 1 ? '' : 's'} por explorar.`
    case 'accuracy':
      return badge.id === 'accuracy-80'
        ? `Te faltan ${amount} puntos de precisión.`
        : `Te faltan ${amount} respuestas correctas.`
    default:
      return `Te faltan ${amount} pregunta${remaining === 1 ? '' : 's'}.`
  }
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
    <MobileMetricCard
      className="min-w-0 flex-1"
      color={color}
      compact
      icon={icon}
      label={label}
      value={value}
    />
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
  const progressPercent = Math.min(100, Math.round((badge.current / Math.max(badge.target, 1)) * 100))

  return (
    <View
      className={`rounded-2xl border bg-[#0D1D3B] ${isDesktop ? 'p-4' : 'p-3'} ${badge.unlocked ? 'border-[#2FBC7E]/50' : 'border-[#1A3155]'}`}
      style={{ width: isDesktop ? '31.8%' : '48%', minHeight: isDesktop ? 292 : 224 }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View
          className={isDesktop ? 'h-16 w-16 items-center justify-center rounded-2xl border-2' : 'h-14 w-14 items-center justify-center rounded-2xl border-2'}
          style={{ backgroundColor: `${badge.color}20`, borderColor: badge.color }}
        >
          <Ionicons name={badge.unlocked ? badge.icon : 'lock-closed'} size={isDesktop ? 30 : 25} color={badge.color} />
        </View>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: badge.unlocked ? 'rgba(52,211,153,0.16)' : 'rgba(143,167,199,0.14)' }}
        >
          <Text className={`text-[11px] font-black ${badge.unlocked ? 'text-[#70E0A5]' : 'text-[#AFC2DB]'}`} numberOfLines={1}>
            {badge.statusLabel}
          </Text>
        </View>
      </View>

      <Text className={`${isDesktop ? 'mt-4 text-[17px]' : 'mt-3 text-[15px]'} font-black text-white`} numberOfLines={2}>{badge.title}</Text>
      <Text className="mt-1 text-[12px] leading-5 text-[#AFC2DB]" numberOfLines={isDesktop ? 3 : 2}>{badge.requirement}</Text>

      <View className="mt-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-[12px] text-[#8FA7C7]">Progreso</Text>
          <Text className="text-[12px] font-bold text-[#DDE7F4]" numberOfLines={1}>{badge.progressLabel}</Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-[#172A4A]">
          <View className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: badge.color }} />
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between border-t border-[#172A4A] pt-3">
        <Text className="text-[12px] text-[#8FA7C7]">Recompensa</Text>
        <Text className="text-[12px] font-black text-[#BFAAFF]">{badge.xp}</Text>
      </View>
    </View>
  )
}
