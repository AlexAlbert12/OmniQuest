import OmniLoadingScreen from '../../components/ui/OmniLoadingScreen'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import AppTabs from '../../components/ui/AppTabs'
import BadgeUnlockModal from '../../components/gamification/BadgeUnlockModal'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/student/StudentSidebar'
import {
  fetchStudentBadgeCatalog,
  type StudentBadge,
  type StudentBadgeCatalogPage,
  type StudentBadgeCatalogSummary,
  type StudentBadgeCategoryDefinition,
} from '../../lib/studentBadges'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import { useAppTheme } from '../../lib/appTheme'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { readThroughCache, updateOfflineCache } from '../../lib/offlineCache'
import { enqueueOfflineMutation } from '../../lib/offlineMutations'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { withAlpha } from '../../lib/color'
import { formatCount } from '../../lib/formatCount'
import { useNotifications } from '../../hooks/useNotifications'
import { LinearGradient } from 'expo-linear-gradient'
import OmniGuide from '@/components/OmniGuide'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
}

type BadgeFilter = 'all' | 'unlocked' | 'locked'
type BadgeCategoryFilter = 'all' | string
type BadgesCacheSnapshot = {
  profile: Profile
  catalog: StudentBadgeCatalogPage
}

const PAGE_SIZE = 50
const EMPTY_SUMMARY: StudentBadgeCatalogSummary = {
  total: 0,
  unlocked: 0,
  locked: 0,
  completionPercent: 0,
  streakDays: 0,
}

export default function BadgesScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [badges, setBadges] = useState<StudentBadge[]>([])
  const [categories, setCategories] = useState<StudentBadgeCategoryDefinition[]>([])
  const [summary, setSummary] = useState<StudentBadgeCatalogSummary>(EMPTY_SUMMARY)
  const [nextBadge, setNextBadge] = useState<StudentBadge | null>(null)
  const [activeFilter, setActiveFilter] = useState<BadgeFilter>('all')
  const [activeCategory, setActiveCategory] = useState<BadgeCategoryFilter>('all')
  const [celebrationBadges, setCelebrationBadges] = useState<StudentBadge[]>([])
  const [selectedBadge, setSelectedBadge] = useState<StudentBadge | null>(null)
  const [featuredBadgeId, setFeaturedBadgeId] = useState<string | null>(null)
  const [equippedFrameKey, setEquippedFrameKey] = useState('explorer')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [resultTotal, setResultTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [savingFeatured, setSavingFeatured] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isDesktop = width >= 1024
  const { accentColor } = useAppTheme()
  const feedback = useAppFeedback()
  const { refresh: refreshStudentNotifications } = useNotifications('student')
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Sin alias'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const badgeCategoryTabs = useMemo(() => [
    { key: 'all', label: 'Todos', icon: 'apps-outline' as const, badge: summary.total },
    ...categories.map((category) => ({
      key: category.key,
      label: category.name,
      icon: category.icon,
      badge: category.totalCount,
    })),
  ], [categories, summary.total])
  const activeCelebrationBadge = celebrationBadges[0] ?? null
  const currentCacheResource = getBadgesCacheResource(activeFilter, activeCategory, page)

  const handleCloseCelebration = useCallback(() => {
    setCelebrationBadges((currentBadges) => currentBadges.slice(1))
  }, [])

  const fetchBadges = useCallback(async (requestedPage = 0, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setErrorMessage(null)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) return

      await readThroughCache<BadgesCacheSnapshot>({
        userId,
        resource: getBadgesCacheResource(activeFilter, activeCategory, requestedPage),
        fetcher: async () => {
          const catalog = await fetchStudentBadgeCatalog({
            page: requestedPage,
            pageSize: PAGE_SIZE,
            category: activeCategory === 'all' ? null : activeCategory,
            status: activeFilter,
          })
          const profileResult = await supabase
            .from('profiles')
            .select('id, alias, avatar, points')
            .eq('id', userId)
            .single()
          if (profileResult.error) throw profileResult.error

          return { profile: profileResult.data, catalog }
        },
        onData: (snapshot, metadata) => {
          setProfile(snapshot.profile)
          setBadges((current) => append
            ? mergeBadgePages(current, snapshot.catalog.badges)
            : snapshot.catalog.badges)
          setCategories(snapshot.catalog.categories)
          setSummary(snapshot.catalog.summary)
          setNextBadge(snapshot.catalog.nextBadge)
          setFeaturedBadgeId(snapshot.catalog.featuredBadgeId)
          setEquippedFrameKey(snapshot.catalog.equippedFrameKey)
          setPage(snapshot.catalog.page)
          setHasMore(snapshot.catalog.hasMore)
          setResultTotal(snapshot.catalog.total)
          setLoading(false)
          setLoadingMore(false)
          if (metadata.source === 'network' && snapshot.catalog.awardedXp > 0) {
            void refreshStudentNotifications()
            if (snapshot.catalog.newlyAwardedBadges.length > 0) setCelebrationBadges(snapshot.catalog.newlyAwardedBadges)
            else feedback.success('¡Logro desbloqueado!', `Has ganado ${snapshot.catalog.awardedXp.toLocaleString()} XP en recompensas.`)
          }
        },
      })
    } catch (error) {
      console.error('Error fetching badges:', error)
      setErrorMessage('No se pudo actualizar la colección. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeCategory, activeFilter, feedback, refreshStudentNotifications])

  useFocusEffect(
    useCallback(() => {
      setBadges([])
      setPage(0)
      void fetchBadges(0, false)
    }, [fetchBadges])
  )

  const handleFeatureBadge = useCallback(async (badge: StudentBadge) => {
    if (!badge.unlocked) return
    setSavingFeatured(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) throw new Error('No hay sesión activa.')

      const nextFeaturedBadgeId = featuredBadgeId === badge.id ? null : badge.id
      await enqueueOfflineMutation({
        userId,
        kind: 'profile.cosmetics',
        entityKey: 'profile:cosmetics',
        conflictPolicy: 'client_wins',
        payload: { frameKey: equippedFrameKey, featuredBadgeId: nextFeaturedBadgeId },
      })
      setFeaturedBadgeId(nextFeaturedBadgeId)
      await updateOfflineCache<BadgesCacheSnapshot>(userId, currentCacheResource, (snapshot) => ({
        ...snapshot,
        catalog: { ...snapshot.catalog, featuredBadgeId: nextFeaturedBadgeId },
      }))
      feedback.success(
        nextFeaturedBadgeId ? 'Logro destacado' : 'Logro retirado',
        nextFeaturedBadgeId
          ? `${badge.title} aparecerá junto a tu avatar en el perfil.`
          : 'Tu perfil ya no muestra un logro destacado.'
      )
    } catch (error) {
      console.error('Error destacando logro:', error)
      feedback.error('No se pudo guardar', 'Inténtalo de nuevo. Si estás sin conexión, comprueba el almacenamiento local.')
    } finally {
      setSavingFeatured(false)
    }
  }, [currentCacheResource, equippedFrameKey, featuredBadgeId, feedback])

  const handleSignOut = async () => {
    await signOutCurrentDeviceSession()
    router.replace('/login' as Href)
  }

  if (loading) return <OmniLoadingScreen />

  return (
    <View className="flex-1 bg-background-primary">
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
            <View className="flex-[1.25] overflow-hidden rounded-2xl border border-border-default bg-surface-interactive p-6">
              <View className="absolute right-[-30px] top-[-32px] h-36 w-36 rounded-full" style={{ backgroundColor: withAlpha(accentColor, '25') }} />
              <View className="absolute bottom-[-34px] left-[-18px] h-28 w-44 rounded-full bg-surface-selected" />
              <View className="relative flex-row items-center gap-5">
                <View className="min-w-0 flex-1">
                  <Text className="text-[16px] font-bold text-text-secondary">Colección de logros</Text>
                  <Text className="mt-1 text-[36px] font-black text-white">
                    {summary.unlocked} / {summary.total}
                  </Text>
                  <Text className="mt-1 text-[13px] text-text-secondary">insignias conseguidas</Text>
                  <View className="mt-4 h-2 overflow-hidden rounded-full bg-surface-selected">
                    <View className="h-full rounded-full" style={{ width: `${summary.completionPercent}%`, backgroundColor: accentColor }} />
                  </View>
                </View>
              </View>
            </View>

            <View className={isDesktop ? 'flex-1 flex-row gap-4' : 'flex-row gap-3'}>
              <MetricTile icon="lock-closed" color="#F6A64A" label="Pendientes" value={String(summary.locked)} />
              <MetricTile icon="flame" color="#FF7B45" label="Racha" value={formatCount(summary.streakDays, 'día', 'días')} />
            </View>
          </View>

          {nextBadge ? (
            <NextBadgeCard badge={nextBadge} isDesktop={isDesktop} />
          ) : null}

          <View className="mt-5 rounded-2xl border border-border-default bg-surface-default p-5">
            <View className={isDesktop ? 'flex-row items-start justify-between gap-4' : 'gap-4'}>
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-black text-white">Colección por categorías</Text>
                <Text className="mt-1 text-[12px] leading-5 text-text-muted">
                  Explora tus insignias por categoría y abre cualquiera para consultar sus detalles y progreso.
                </Text>
              </View>
              <View className="flex-row rounded-xl border border-border-default bg-surface-raised p-1">
                <FilterButton label="Todas" active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
                <FilterButton label="Conseguidas" active={activeFilter === 'unlocked'} onPress={() => setActiveFilter('unlocked')} />
                <FilterButton label="Pendientes" active={activeFilter === 'locked'} onPress={() => setActiveFilter('locked')} />
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
              {badges.length > 0 ? badges.map((badge) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  featured={featuredBadgeId === badge.id}
                  isDesktop={isDesktop}
                  onSelect={setSelectedBadge}
                />
              )) : (
                <View className="w-full items-center rounded-2xl border border-dashed border-border-default bg-surface-raised px-5 py-10">
                  <OmniGuide state="thinking" size={72} />
                  <Text className="mt-3 text-[15px] font-black text-white">{errorMessage ? 'No se pudo cargar la colección' : 'No hay logros en este filtro'}</Text>
                  <Text className="mt-1 text-center text-[12px] text-text-muted">
                    {errorMessage || 'Prueba otra categoría o cambia el estado de las insignias.'}
                  </Text>
                  {errorMessage ? (
                    <Pressable
                      accessibilityRole="button"
                      className="mt-4 rounded-xl bg-brand-student px-4 py-2.5"
                      onPress={() => void fetchBadges(0, false)}
                    >
                      <Text className="text-[12px] font-black text-white">Reintentar</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>

            {hasMore ? (
              <View className="mt-5 items-center border-t border-border-subtle pt-5">
                <Pressable
                  accessibilityHint="Carga la página siguiente de logros"
                  accessibilityRole="button"
                  className="min-w-[190px] flex-row items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-raised px-5 py-3"
                  disabled={loadingMore}
                  onPress={() => void fetchBadges(page + 1, true)}
                  style={{ opacity: loadingMore ? 0.7 : 1 }}
                >
                  {loadingMore ? <ActivityIndicator size="small" color={accentColor} /> : <Ionicons name="add-circle-outline" size={18} color={accentColor} />}
                  <Text className="text-[13px] font-black text-white">{loadingMore ? 'Cargando...' : 'Cargar más logros'}</Text>
                </Pressable>
                <Text className="mt-2 text-[11px] text-text-muted">Mostrando {badges.length} de {resultTotal}</Text>
              </View>
            ) : badges.length > 0 ? (
              <Text className="mt-5 border-t border-border-subtle pt-4 text-center text-[11px] text-text-muted">
                {formatCount(resultTotal, 'logro', 'logros')} en esta selección
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </View>

      <BadgeUnlockModal
        badge={activeCelebrationBadge}
        visible={Boolean(activeCelebrationBadge)}
        remainingCount={Math.max(0, celebrationBadges.length - 1)}
        onClose={handleCloseCelebration}
      />

      <BadgeDetailModal
        badge={selectedBadge}
        busy={savingFeatured}
        featured={Boolean(selectedBadge && featuredBadgeId === selectedBadge.id)}
        onClose={() => setSelectedBadge(null)}
        onToggleFeatured={(badge) => void handleFeatureBadge(badge)}
      />

      {!isDesktop ? <StudentBottomNav active="badges" /> : null}
    </View>
  )
}

const NextBadgeCard = React.memo(function NextBadgeCard({ badge, isDesktop }: { badge: StudentBadge; isDesktop: boolean }) {
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
            <Text className="mt-1 text-[13px] leading-5 text-text-secondary" numberOfLines={2}>
              {remaining > 0 ? getRemainingBadgeMessage(badge, remaining) : 'Está listo para desbloquear.'}
            </Text>
          </View>
        </View>

        <View className={isDesktop ? 'min-w-[260px] flex-1' : ''}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-[12px] text-text-secondary">Progreso</Text>
            <Text className="text-[12px] font-black text-white">{badge.progressLabel}</Text>
          </View>
          <View className="h-2.5 overflow-hidden rounded-full bg-surface-interactive">
            <View className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: badge.color }} />
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] text-text-secondary">Recompensa</Text>
            <Text className="text-[13px] font-black" style={{ color: badge.color }}>{badge.xp}</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  )
})

function getRemainingBadgeMessage(badge: StudentBadge, remaining: number) {
  const amount = remaining.toLocaleString()
  const unit = remaining === 1 ? badge.unitSingular : badge.unitPlural
  return `Te faltan ${amount} ${unit || 'pasos'} para desbloquearlo.`
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
      <Text className={`text-[13px] font-bold ${active ? 'text-white' : 'text-text-secondary'}`}>{label}</Text>
    </Pressable>
  )
}

const BadgeCard = React.memo(function BadgeCard({
  badge,
  featured,
  isDesktop,
  onSelect,
}: {
  badge: StudentBadge
  featured: boolean
  isDesktop: boolean
  onSelect: (badge: StudentBadge) => void
}) {
  const progressPercent = Math.min(100, Math.round((badge.current / Math.max(badge.target, 1)) * 100))
  const handlePress = useCallback(() => onSelect(badge), [badge, onSelect])
  const { accentColor } = useAppTheme()

  return (
    <Pressable
      accessibilityHint="Abre el detalle completo del logro"
      accessibilityLabel={`${badge.title}, ${badge.statusLabel}`}
      accessibilityRole="button"
      className={`rounded-2xl border bg-surface-raised ${isDesktop ? 'p-4' : 'p-3'} ${badge.unlocked ? 'border-semantic-success' : 'border-border-default'}`}
      onPress={handlePress}
      style={{ width: isDesktop ? '31.8%' : '48%', minHeight: isDesktop ? 292 : 224 }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View
          className={isDesktop ? 'h-16 w-16 items-center justify-center rounded-2xl border-2' : 'h-14 w-14 items-center justify-center rounded-2xl border-2'}
          style={{ backgroundColor: `${badge.color}20`, borderColor: badge.color }}
        >
          <Ionicons name={badge.unlocked ? badge.icon : 'lock-closed'} size={isDesktop ? 30 : 25} color={badge.color} />
        </View>
        <View className="items-end gap-1.5">
          {featured ? (
            <View
              className="flex-row items-center gap-1 rounded-full border px-2 py-0.5"
              style={{ backgroundColor: withAlpha(accentColor, '14'), borderColor: withAlpha(accentColor, '55') }}
            >
              <Ionicons name="star" size={10} color={accentColor} />
              <Text className="text-[9px] font-black" style={{ color: accentColor }}>Destacado</Text>
            </View>
          ) : null}
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: badge.unlocked ? 'rgba(52,211,153,0.16)' : 'rgba(143,167,199,0.14)' }}
          >
            <Text className={`text-[11px] font-black ${badge.unlocked ? 'text-semantic-success' : 'text-text-secondary'}`} numberOfLines={1}>
              {badge.statusLabel}
            </Text>
          </View>
        </View>
      </View>

      <Text className={`${isDesktop ? 'mt-4 text-[17px]' : 'mt-3 text-[15px]'} font-black text-white`} numberOfLines={2}>{badge.title}</Text>
      <Text className="mt-1 text-[12px] leading-5 text-text-secondary" numberOfLines={isDesktop ? 3 : 2}>{badge.requirement}</Text>

      <View className="mt-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-[12px] text-text-muted">Progreso</Text>
          <Text className="text-[12px] font-bold text-text-secondary" numberOfLines={1}>{badge.progressLabel}</Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-surface-interactive">
          <View className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: badge.color }} />
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between border-t border-border-subtle pt-3">
        <View>
          <Text className="text-[12px] text-text-muted">Recompensa</Text>
          {badge.unlocked && badge.awardedAt ? (
            <Text className="mt-1 text-[10px] text-text-muted">{formatAwardedAt(badge.awardedAt)}</Text>
          ) : null}
        </View>
        <Text className="text-[12px] font-black text-brand-student">{badge.xp}</Text>
      </View>
    </Pressable>
  )
})

function BadgeDetailModal({
  badge,
  busy,
  featured,
  onClose,
  onToggleFeatured,
}: {
  badge: StudentBadge | null
  busy: boolean
  featured: boolean
  onClose: () => void
  onToggleFeatured: (badge: StudentBadge) => void
}) {
  if (!badge) return null

  const progressPercent = Math.min(100, Math.round((badge.current / Math.max(badge.target, 1)) * 100))

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <Pressable className="omni-no-hover-lift flex-1 items-center justify-center bg-black/70 px-5 py-10" onPress={onClose}>
        <Pressable
          accessibilityViewIsModal
          className="omni-no-hover-lift w-full max-w-[560px] max-h-[90%] overflow-hidden rounded-3xl border border-border-default bg-surface-default"
          onPress={(event) => event.stopPropagation()}
        >
          <LinearGradient colors={[`${badge.color}35`, '#101D36', '#0A1427']} style={{ maxHeight: '100%', flexShrink: 1 }}>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
              <View className="flex-row items-start justify-between gap-4">
                <View className="h-20 w-20 items-center justify-center rounded-3xl border-2" style={{ borderColor: badge.color, backgroundColor: `${badge.color}22` }}>
                  <Ionicons name={badge.unlocked ? badge.icon : 'lock-closed'} size={38} color={badge.color} />
                </View>
                <Pressable accessibilityLabel="Cerrar detalle" accessibilityRole="button" className="h-10 w-10 items-center justify-center rounded-full bg-surface-raised" onPress={onClose}>
                  <Ionicons name="close" size={22} color="#DCEBFF" />
                </Pressable>
              </View>

              <View className="mt-5 flex-row items-center gap-2">
                <Ionicons name={badge.categoryIcon || 'ribbon-outline'} size={15} color={badge.categoryColor || badge.color} />
                <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: badge.categoryColor || badge.color }}>
                  {badge.categoryName || badge.category}
                </Text>
              </View>
              <Text className="mt-2 text-[26px] font-black text-white">{badge.title}</Text>
              <Text className="mt-3 text-[14px] leading-6 text-text-secondary">{badge.detail}</Text>

              <View className="mt-5 rounded-2xl border border-border-default bg-surface-raised p-4">
                <Text className="text-[11px] font-black uppercase tracking-[0.08em] text-text-muted">Cómo conseguirlo</Text>
                <Text className="mt-2 text-[14px] font-bold leading-5 text-white">{badge.requirement}</Text>
                <View className="mt-4 flex-row items-center justify-between">
                  <Text className="text-[12px] text-text-muted">Progreso</Text>
                  <Text className="text-[12px] font-black text-white">{badge.progressLabel}</Text>
                </View>
                <View className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-interactive">
                  <View className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: badge.color }} />
                </View>
              </View>

              <View className="mt-4 flex-row gap-3">
                <DetailFact icon="gift-outline" label="Recompensa" value={badge.xp} color={badge.color} />
                <DetailFact
                  icon="calendar-outline"
                  label={badge.unlocked ? 'Conseguido el' : 'Estado'}
                  value={badge.unlocked && badge.awardedAt ? formatAwardedAt(badge.awardedAt) : badge.statusLabel}
                  color={badge.unlocked ? '#34D399' : '#8FA7C7'}
                />
              </View>

              {badge.unlocked ? (
                <Pressable
                  accessibilityHint="Muestra u oculta esta insignia junto a tu avatar"
                  accessibilityRole="button"
                  className="mt-5 flex-row items-center justify-center gap-2 rounded-xl bg-brand-student px-5 py-3.5"
                  disabled={busy}
                  onPress={() => onToggleFeatured(badge)}
                  style={{ opacity: busy ? 0.7 : 1 }}
                >
                  {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name={featured ? 'star-outline' : 'star'} size={18} color="#FFFFFF" />}
                  <Text className="text-[13px] font-bold text-white">
                    {busy ? 'Guardando...' : featured ? 'Quitar del perfil' : 'Destacar en mi perfil'}
                  </Text>
                </Pressable>
              ) : (
                <View className="mt-5 flex-row items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-raised px-5 py-3.5">
                  <Ionicons name="lock-closed" size={17} color="#8FA7C7" />
                  <Text className="text-[12px] font-bold text-text-secondary">Desbloquéalo para destacarlo en tu perfil</Text>
                </View>
              )}
            </ScrollView>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function DetailFact({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  color: string
}) {
  return (
    <View className="min-w-0 flex-1 rounded-2xl border border-border-default bg-surface-raised p-4">
      <Ionicons name={icon} size={18} color={color} />
      <Text className="mt-2 text-[10px] font-black uppercase tracking-[0.07em] text-text-muted">{label}</Text>
      <Text className="mt-1 text-[12px] font-black text-white" numberOfLines={2}>{value}</Text>
    </View>
  )
}

function getBadgesCacheResource(filter: BadgeFilter, category: BadgeCategoryFilter, page: number) {
  return `student:badges:${filter}:${category}:page:${page}`
}

function mergeBadgePages(current: StudentBadge[], nextPage: StudentBadge[]) {
  const badgesById = new Map(current.map((badge) => [badge.id, badge]))
  nextPage.forEach((badge) => badgesById.set(badge.id, badge))
  return Array.from(badgesById.values())
}

function formatAwardedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
