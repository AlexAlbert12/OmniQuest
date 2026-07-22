import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/student/StudentSidebar'
import {
  buildStudentBadges,
  calculateStreakDays,
  getStudentBadgeMetrics,
  type StudentBadge,
  type StudentBadgeScore,
} from '../../lib/studentBadges'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentDashboardCard from '../../components/student/StudentDashboardCard'
import StudentMetricCard from '../../components/student/StudentMetricCard'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import { formatLongDate } from '../../lib/dateFormat'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { withAlpha } from '../../lib/color'
import GamifiedAvatar from '../../components/gamification/GamifiedAvatar'
import AvatarCustomizationModal from '../../components/gamification/AvatarCustomizationModal'
import {
  DEFAULT_AVATAR_FRAME,
  equipProfileCosmetics,
  fetchAvatarCustomizationOptions,
  type AvatarCustomizationOptions,
  type ProfileCosmetics,
} from '../../lib/avatarCosmetics'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  created_at: string
  points: number | null
}

type Subject = {
  id: number
  name: string
}

type SubjectScore = {
  subject_id: number | null
  max_score: number | null
  played_at: string | null
  played_days: string[] | null
  correct_answers: number | null
  subjects?: { name: string } | { name: string }[] | null
}

const STUDENT_ROUTES = {
  activityLog: '/(student)/activity-log',
  badges: '/(student)/badges',
  classes: '/(student)/classes',
  login: '/(auth)/login',
  notifications: '/(student)/notifications',
  progress: '/(student)/progress',
  settings: '/(student)/settings',
  settingsProfile: '/(student)/settings?section=profile',
} satisfies Record<string, Href>

export default function ProfileScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [scores, setScores] = useState<SubjectScore[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [customizationVisible, setCustomizationVisible] = useState(false)
  const [customizationOptions, setCustomizationOptions] = useState<AvatarCustomizationOptions | null>(null)
  const [savingCosmetics, setSavingCosmetics] = useState(false)
  const { accentColor } = useAppTheme()

  const isDesktop = width >= 1024
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
  const achievedBadges = unlockedBadges.slice(0, 3)
  const cosmetics: ProfileCosmetics = customizationOptions?.cosmetics || {
    frame: DEFAULT_AVATAR_FRAME,
    featuredBadgeId: null,
  }
  const memberSince = formatLongDate(profile?.created_at, '15 de marzo de 2008')
  const streakDays = calculateStreakDays(scores.flatMap((score) => [
    ...(score.played_days || []),
    ...(score.played_at ? [score.played_at] : []),
  ]))

  const fetchProfile = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      setEmail(session.session?.user.email || 'alex@example.com')

      if (!userId) return

      const [profileResult, enrollmentsResult, scoresResult, nextCustomizationOptions] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, created_at, points').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('subjects(id, name)')
          .eq('student_id', userId),
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

      setProfile(profileResult.data)
      setSubjects(
        enrollmentsResult.data
          ?.map((enrollment: any) => enrollment.subjects)
          .filter(Boolean) || []
      )
      setScores((scoresResult.data || []) as SubjectScore[])
      if (nextCustomizationOptions) setCustomizationOptions(nextCustomizationOptions)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchProfile()
    }, [fetchProfile])
  )

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir fotos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled) {
      await uploadImage(result.assets[0].uri)
    }
  }

  const uploadImage = async (uri: string) => {
    if (!profile) return

    setUploading(true)
    try {
      const response = await fetch(uri)
      const blob = await response.blob()
      const fileName = `${profile.id}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true })

      if (uploadError) throw uploadError

      const { data, error: updateError } = await supabase.functions.invoke('profile-update-avatar', {
        body: { avatarPath: fileName },
      })

      if (updateError) throw updateError
      const result = (data || {}) as { avatar?: string | null; error?: string }
      if (result.error) throw new Error(result.error)

      setProfile({ ...profile, avatar: result.avatar || null })
      Alert.alert('Éxito', 'Foto de perfil actualizada.')
    } catch (error: any) {
      console.error('Error uploading image:', error)
      Alert.alert('Error', 'No se pudo subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  const openAvatarCustomization = async () => {
    setCustomizationVisible(true)
    try {
      setCustomizationOptions(await fetchAvatarCustomizationOptions())
    } catch (error) {
      console.warn('No se pudo actualizar la personalización del avatar:', error)
    }
  }

  const saveAvatarCustomization = async ({
    frameKey,
    featuredBadgeId,
  }: {
    frameKey: string | null
    featuredBadgeId: string | null
  }) => {
    setSavingCosmetics(true)
    try {
      const nextCosmetics = await equipProfileCosmetics({ frameKey, featuredBadgeId })
      setCustomizationOptions((current) => current
        ? { ...current, cosmetics: nextCosmetics }
        : {
            level,
            frames: [nextCosmetics.frame || DEFAULT_AVATAR_FRAME],
            awardedBadgeIds: unlockedBadges.map((badge) => badge.id),
            cosmetics: nextCosmetics,
          })
      setCustomizationVisible(false)
    } catch (error: any) {
      Alert.alert('No se pudo guardar', error?.message || 'Revisa los requisitos del marco e inténtalo de nuevo.')
    } finally {
      setSavingCosmetics(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace(STUDENT_ROUTES.login)
  }

  const avatarCustomizationModal = (
    <AvatarCustomizationModal
      alias={alias}
      avatarUrl={profile?.avatar}
      awardedBadgeIds={customizationOptions?.awardedBadgeIds || unlockedBadges.map((badge) => badge.id)}
      busy={savingCosmetics || uploading}
      cosmetics={cosmetics}
      frames={customizationOptions?.frames || [DEFAULT_AVATAR_FRAME]}
      level={customizationOptions?.level || level}
      onChangePhoto={() => void pickImage()}
      onClose={() => setCustomizationVisible(false)}
      onSave={saveAvatarCustomization}
      visible={customizationVisible}
    />
  )

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color={accentColor} />
        <Text className="mt-4 text-[#8FA7C7]">Cargando perfil...</Text>
      </View>
    )
  }

  if (!isDesktop) {
    return (
      <>
      <MobileStudentProfile
        achievedBadges={achievedBadges}
        activeCourses={subjects.length}
        alias={alias}
        badgesTotal={badges.length}
        badgesUnlocked={unlockedBadges.length}
        level={level}
        nextLevelProgress={nextLevelProgress}
        points={points}
        profile={profile}
        cosmetics={cosmetics}
        streakDays={streakDays}
        onCustomizeAvatar={() => void openAvatarCustomization()}
        onOpenActivity={() => router.push(STUDENT_ROUTES.activityLog)}
        onOpenBadges={() => router.push(STUDENT_ROUTES.badges)}
        onOpenClasses={() => router.push(STUDENT_ROUTES.classes)}
        onOpenProgress={() => router.push(STUDENT_ROUTES.progress)}
        onOpenSettings={() => router.push(STUDENT_ROUTES.settings)}
      />
      {avatarCustomizationModal}
      </>
    )
  }

  return (
    <>
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection="profile"
            alias={alias}
            avatar={profile?.avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            cosmetics={cosmetics}
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
            icon="person"
            isDesktop={isDesktop}
            subtitle="Gestiona tu información y revisa tus logros"
            title="Perfil"
          />

          <View className="flex-row gap-5">
            <ProfileHero
              alias={alias}
              level={level}
              nextLevelProgress={nextLevelProgress}
              profile={profile}
              cosmetics={cosmetics}
              onCustomizeAvatar={() => void openAvatarCustomization()}
            />

            <View className="flex-[1.35] flex-row flex-wrap gap-4">
              <StudentMetricCard
                title="Días de racha"
                value={String(streakDays)}
                icon="flame"
                color="#F97316"
                className="min-h-[150px] min-w-[190px]"
              />
              <StudentMetricCard
                title="XP acumulada"
                value={points.toLocaleString()}
                icon="flash"
                color="#FBBF24"
                onPress={() => router.push(STUDENT_ROUTES.progress)}
                className="min-h-[150px] min-w-[190px]"
              />
              <StudentMetricCard
                title="Logros"
                value={`${unlockedBadges.length}/${badges.length}`}
                icon="ribbon"
                color={accentColor}
                onPress={() => router.push(STUDENT_ROUTES.badges)}
                className="min-h-[150px] min-w-[190px]"
              />
              <StudentMetricCard
                title="Cursos activos"
                value={String(subjects.length)}
                icon="book"
                color="#38BDF8"
                onPress={() => router.push(STUDENT_ROUTES.classes)}
                className="min-h-[150px] min-w-[190px]"
              />
            </View>
          </View>

          <View className="mt-5 flex-row gap-5">
            <StudentDashboardCard title="Información personal" className="flex-1">
              <InfoRow icon="mail-outline" label="Correo electrónico" value={email} />
              <InfoRow icon="calendar-outline" label="Miembro desde" value={memberSince} />
              <Pressable
                onPress={() => router.push(STUDENT_ROUTES.settingsProfile)}
                className="mt-4 flex-row items-center gap-2 border-t border-[#172A4A] pt-4"
              >
                <Ionicons name="create-outline" size={18} color={accentColor} />
                <Text className="font-bold" style={{ color: accentColor }}>Editar perfil</Text>
                <Ionicons name="arrow-forward" size={16} color={accentColor} />
              </Pressable>
            </StudentDashboardCard>

            <StudentDashboardCard title="Accesos rápidos" className="flex-[1.08]">
              <View className="gap-3">
                <ProfileShortcut
                  icon="stats-chart-outline"
                  label="Progreso"
                  description="Evolución, cursos y estadísticas"
                  color={accentColor}
                  onPress={() => router.push(STUDENT_ROUTES.progress)}
                />
                <ProfileShortcut
                  icon="time-outline"
                  label="Actividad"
                  description="Historial completo de respuestas"
                  color="#38BDF8"
                  onPress={() => router.push(STUDENT_ROUTES.activityLog)}
                />
                <ProfileShortcut
                  icon="ribbon-outline"
                  label="Logros"
                  description="Insignias conseguidas y pendientes"
                  color="#A855F7"
                  onPress={() => router.push(STUDENT_ROUTES.badges)}
                />
                <ProfileShortcut
                  icon="settings-outline"
                  label="Configuración"
                  description="Preferencias, privacidad y seguridad"
                  color="#F6A64A"
                  onPress={() => router.push(STUDENT_ROUTES.settings)}
                />
              </View>
            </StudentDashboardCard>

            <StudentDashboardCard
              title="Últimos logros"
              actionLabel="Ver todos"
              onAction={() => router.push(STUDENT_ROUTES.badges)}
              className="flex-[1.28]"
            >
              <View style={{ gap: 12 }}>
                {achievedBadges.length > 0 ? (
                  achievedBadges.map((badge) => (
                    <BadgeRow
                      key={badge.title}
                      badge={badge}
                      onPress={() => router.push(STUDENT_ROUTES.badges)}
                    />
                  ))
                ) : (
                  <EmptyState icon="ribbon-outline" message="Todavía no has conseguido logros." />
                )}
              </View>
            </StudentDashboardCard>
          </View>

        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="profile" /> : null}
    </View>
    {avatarCustomizationModal}
    </>
  )
}

function MobileStudentProfile({
  achievedBadges,
  activeCourses,
  alias,
  badgesTotal,
  badgesUnlocked,
  level,
  nextLevelProgress,
  points,
  profile,
  cosmetics,
  streakDays,
  onCustomizeAvatar,
  onOpenActivity,
  onOpenBadges,
  onOpenClasses,
  onOpenProgress,
  onOpenSettings,
}: {
  achievedBadges: StudentBadge[]
  activeCourses: number
  alias: string
  badgesTotal: number
  badgesUnlocked: number
  level: number
  nextLevelProgress: number
  points: number
  profile: Profile | null
  cosmetics: ProfileCosmetics
  streakDays: number
  onCustomizeAvatar: () => void
  onOpenActivity: () => void
  onOpenBadges: () => void
  onOpenClasses: () => void
  onOpenProgress: () => void
  onOpenSettings: () => void
}) {
  const { accentColor } = useAppTheme()

  return (
    <View className="flex-1 bg-[#031022]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: MOBILE_BOTTOM_NAV_SPACER + 2 }}
        showsVerticalScrollIndicator={false}
      >
        <StudentPageHeader
          icon="person"
          isDesktop={false}
          subtitle="Tu identidad, nivel y logros en OmniQuest."
          title="Perfil"
        />

        <MobileProfileHero
          accentColor={accentColor}
          alias={alias}
          level={level}
          nextLevelProgress={nextLevelProgress}
          points={points}
          profile={profile}
          cosmetics={cosmetics}
          onCustomizeAvatar={onCustomizeAvatar}
        />

        <View className="mt-4 flex-row flex-wrap gap-3">
          <MobileStatTile icon="flame" label="Racha" value={String(streakDays)} helper={streakDays === 1 ? 'día' : 'días'} color="#F97316" />
          <MobileStatTile icon="flash" label="XP" value={points.toLocaleString()} helper="acumulada" color="#FBBF24" onPress={onOpenProgress} />
          <MobileStatTile icon="ribbon" label="Logros" value={`${badgesUnlocked}/${badgesTotal}`} helper="desbloqueados" color={accentColor} onPress={onOpenBadges} />
          <MobileStatTile icon="book" label="Cursos" value={String(activeCourses)} helper="activos" color="#38BDF8" onPress={onOpenClasses} />
        </View>

        <MobileSectionPanel title="Accesos rápidos">
          <View className="gap-3">
            <MobileQuickAction
              icon="stats-chart-outline"
              title="Progreso"
              subtitle="Consulta evolución, cursos y estadísticas."
              color={accentColor}
              onPress={onOpenProgress}
            />
            <MobileQuickAction
              icon="time-outline"
              title="Actividad"
              subtitle="Abre el historial completo de respuestas."
              color="#38BDF8"
              onPress={onOpenActivity}
            />
            <MobileQuickAction
              icon="ribbon-outline"
              title="Logros"
              subtitle="Revisa insignias conseguidas y pendientes."
              color="#A855F7"
              onPress={onOpenBadges}
            />
            <MobileQuickAction
              icon="settings-outline"
              title="Configuración"
              subtitle="Edita preferencias, privacidad y seguridad."
              color="#F6A64A"
              onPress={onOpenSettings}
            />
          </View>
        </MobileSectionPanel>

        <MobileSectionPanel title="Logros" actionLabel="Ver todos" onAction={onOpenBadges}>
          {achievedBadges.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-3"
              contentContainerStyle={{ paddingHorizontal: 12, gap: 14 }}
            >
              {achievedBadges.map((badge) => (
                <MobileBadgeCard key={badge.id} badge={badge} onPress={onOpenBadges} />
              ))}
            </ScrollView>
          ) : (
            <MobileCompactEmpty icon="ribbon-outline" title="Sin logros todavía" subtitle="Completa partidas para desbloquear insignias." />
          )}
        </MobileSectionPanel>
      </ScrollView>

      <StudentBottomNav active="profile" />
    </View>
  )
}

function MobileProfileHero({
  accentColor,
  alias,
  level,
  nextLevelProgress,
  points,
  profile,
  cosmetics,
  onCustomizeAvatar,
}: {
  accentColor: string
  alias: string
  level: number
  nextLevelProgress: number
  points: number
  profile: Profile | null
  cosmetics: ProfileCosmetics
  onCustomizeAvatar: () => void
}) {
  const xpToNextLevel = Math.max(0, 100 - nextLevelProgress)
  const progressWidth = Math.min(100, Math.max(nextLevelProgress > 0 ? 8 : 0, nextLevelProgress))

  return (
    <LinearGradient
      colors={['#25126D', '#121C4A', '#071934']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, borderWidth: 1, borderColor: '#263B72', overflow: 'hidden' }}
    >
      <View className="relative min-h-[226px] p-5">
        <View className="absolute -right-10 top-7 h-24 w-40 rounded-3xl bg-[#7C3AED]/20" style={{ transform: [{ rotate: '-28deg' }] }} />
        <View className="absolute bottom-4 right-3 h-28 w-44 rounded-3xl bg-[#2563EB]/10" style={{ transform: [{ rotate: '-20deg' }] }} />

        <View className="flex-row items-center gap-4 pr-[76px]">
          <GamifiedAvatar
            alias={alias}
            avatarUrl={profile?.avatar}
            cosmetics={cosmetics}
            editable
            level={level}
            onPress={onCustomizeAvatar}
            size={118}
          />

          <View className="min-w-0">
            <Text className="text-[29px] font-black leading-[34px] text-white">{alias}</Text>
            <View className="mt-4 self-start flex-row items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: withAlpha(accentColor, '38') }}>
              <Ionicons name="star" size={15} color="#C4B5FD" />
              <Text className="text-[14px] font-black text-white">Nivel {level}</Text>
            </View>
          </View>
        </View>

        <View className="mt-5">
          <View className="h-3 overflow-hidden rounded-full bg-[#172A55]">
            <LinearGradient
              colors={[accentColor, '#B86BFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: `${progressWidth}%`, height: '100%', borderRadius: 999 }}
            />
          </View>
          <Text className="mt-3 text-[14px] text-[#D4E2F6]">
            {xpToNextLevel} XP para Nivel {level + 1}
          </Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">{points.toLocaleString()} XP acumulados</Text>
        </View>
      </View>
    </LinearGradient>
  )
}

function MobileStatTile({
  color,
  helper,
  icon,
  label,
  value,
  onPress,
}: {
  color: string
  helper: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  onPress?: () => void
}) {
  return (
    <MobileMetricCard
      className="min-h-[126px]"
      color={color}
      compact
      detail={helper}
      icon={icon}
      label={label}
      onPress={onPress}
      value={value}
      style={{ width: '47.8%' }}
    />
  )
}

function MobileQuickAction({
  color,
  icon,
  onPress,
  subtitle,
  title,
}: {
  color: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  subtitle: string
  title: string
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-[#17345C] bg-[#091C3A] p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(color, '26') }}>
        <Ionicons name={icon} size={23} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-black text-white" numberOfLines={1}>{title}</Text>
        <Text className="mt-1 text-[13px] leading-5 text-[#B7C4D7]" numberOfLines={2}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color="#8FA7C7" />
    </Pressable>
  )
}

function MobileSectionPanel({
  actionLabel,
  children,
  onAction,
  title,
}: {
  actionLabel?: string
  children: React.ReactNode
  onAction?: () => void
  title: string
}) {
  return (
    <View className="mt-5 overflow-hidden rounded-2xl border border-[#142B4F] bg-[#071832] p-4">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="min-w-0 flex-1 text-[24px] font-black text-white" numberOfLines={1}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} className="flex-row items-center gap-1">
            <Text className="text-[15px] font-black text-[#A970FF]">{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={18} color="#A970FF" />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}

function MobileBadgeCard({ badge, onPress }: { badge: StudentBadge; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[132px] w-[252px] flex-row items-center gap-4 rounded-2xl border border-[#19345B] bg-[#091C3A] p-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View
        className="h-[76px] w-[76px] items-center justify-center rounded-2xl border-2"
        style={{ backgroundColor: withAlpha(badge.color, '18'), borderColor: badge.color }}
      >
        <Ionicons name={badge.icon} size={38} color={badge.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-black text-white" numberOfLines={2}>{badge.title}</Text>
        <Text className="mt-2 text-[13px] leading-5 text-[#C7D3E5]" numberOfLines={2}>{badge.requirement}</Text>
        <View className="mt-3 flex-row items-center gap-2">
          <Text className="text-[13px] font-bold text-[#22D3A5]">Completado</Text>
          <Ionicons name="checkmark-circle-outline" size={16} color="#22D3A5" />
        </View>
      </View>
    </Pressable>
  )
}

function MobileCompactEmpty({
  icon,
  subtitle,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap
  subtitle: string
  title: string
}) {
  return (
    <View className="items-center rounded-2xl border border-dashed border-[#1E3A63] bg-[#081B37] px-4 py-7">
      <Ionicons name={icon} size={28} color="#8FA7C7" />
      <Text className="mt-3 text-center text-[15px] font-black text-white">{title}</Text>
      <Text className="mt-1 text-center text-[13px] leading-5 text-[#8FA7C7]">{subtitle}</Text>
    </View>
  )
}

function ProfileHero({
  alias,
  level,
  nextLevelProgress,
  profile,
  cosmetics,
  onCustomizeAvatar,
}: {
  alias: string
  level: number
  nextLevelProgress: number
  profile: Profile | null
  cosmetics: ProfileCosmetics
  onCustomizeAvatar: () => void
}) {
  const { accentColor } = useAppTheme()

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-[#1C3762] bg-[#0B1B48] p-7">
      <View className="absolute inset-0 bg-[#0D1C55]" />
      <View className="absolute bottom-[-28px] left-0 h-28 w-44 rounded-full bg-[#061B43]" />
      <View className="absolute bottom-[-42px] right-7 h-32 w-44 rounded-full bg-[#081F55]" />
      <View className="absolute right-6 top-6 h-20 w-20 rounded-full bg-[#5135D8]/50" />
      <View className="absolute right-2 top-10 h-8 w-28 rounded-full border border-[#7B68FF]/45" style={{ transform: [{ rotate: '-18deg' }] }} />

      <View className="relative flex-row items-center gap-6">
        <GamifiedAvatar
          alias={alias}
          avatarUrl={profile?.avatar}
          cosmetics={cosmetics}
          editable
          level={level}
          onPress={onCustomizeAvatar}
          size={112}
        />

        <View className="min-w-0 flex-1">
          <Text className="text-[28px] font-black text-white">{alias}</Text>
          <Text className="mt-1 text-[14px] text-[#D4E2F6]">Estudiante aventurero</Text>
          <View className="mt-3 w-[96px] flex-row items-center justify-center gap-1 rounded-md px-3 py-1.5" style={{ backgroundColor: withAlpha(accentColor, 'CC') }}>
            <Ionicons name="school" size={13} color="#FFFFFF" />
            <Text className="text-[13px] font-bold text-white">Nivel {level}</Text>
          </View>
          <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#27396B]">
            <View className="h-full rounded-full" style={{ width: `${nextLevelProgress}%`, backgroundColor: accentColor }} />
          </View>
          <Text className="mt-2 text-[13px] text-[#D4E2F6]">
            {nextLevelProgress.toLocaleString()} / 100 XP para Nivel {level + 1}
          </Text>
        </View>
      </View>
    </View>
  )
}


function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  return (
    <View className="flex-row items-center gap-4 border-b border-[#172A4A] py-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#10213E]">
        <Ionicons name={icon} size={18} color="#9BAEC9" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] text-[#8FA7C7]">{label}</Text>
        <Text className="mt-1 text-[13px] text-[#DDE7F4]" numberOfLines={1}>{value}</Text>
      </View>
    </View>
  )
}

function ProfileShortcut({
  color,
  description,
  icon,
  label,
  onPress,
}: {
  color: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-[#172A4A] bg-[#0D1D3B] p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(color, '24') }}>
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-black text-white">{label}</Text>
        <Text className="mt-0.5 text-[12px] text-[#8FA7C7]">{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8FA7C7" />
    </Pressable>
  )
}

function BadgeRow({ badge, onPress }: { badge: StudentBadge; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`flex-row items-center gap-4 rounded-xl bg-[#0D1D3B] p-3 ${badge.unlocked ? '' : 'opacity-70'}`}>
      <View
        className="h-14 w-14 items-center justify-center rounded-2xl border-2"
        style={{ backgroundColor: `${badge.color}20`, borderColor: badge.color }}
      >
        <Ionicons name={badge.unlocked ? badge.icon : 'lock-closed'} size={26} color={badge.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-black text-white">{badge.title}</Text>
        <Text className="mt-1 text-[13px] text-[#AFC2DB]">{badge.requirement}</Text>
      </View>
      <Text className="text-[13px] text-[#8FA7C7]">{badge.statusLabel}</Text>
    </Pressable>
  )
}

function EmptyState({ icon, message }: { icon: keyof typeof Ionicons.glyphMap; message: string }) {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#1A3155] bg-[#0D1D3B] px-4 py-6">
      <Ionicons name={icon} size={24} color="#8FA7C7" />
      <Text className="mt-2 text-center text-[13px] text-[#8FA7C7]">{message}</Text>
    </View>
  )
}
