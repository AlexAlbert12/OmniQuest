import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  Image,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/student/StudentSidebar'
import {
  buildStudentBadges,
  getStudentBadgeMetrics,
  type StudentBadge,
  type StudentBadgeScore,
} from '../../lib/studentBadges'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { fetchStudentProgressSummary, type StudentProgressSubject, type StudentProgressSummary } from '../../lib/studentProgress'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentDashboardCard, { StudentCardLink } from '../../components/student/StudentDashboardCard'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import { formatLongDate, formatRelativeDate } from '../../lib/dateFormat'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'

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

type ActivityAttempt = {
  id: number
  is_correct: boolean
  time_taken_seconds: number | null
  attempted_at: string | null
  questions?: {
    text?: string | null
    subject_topics?: { title?: string | null } | { title?: string | null }[] | null
  } | null
}

type StatBarItem = {
  label: string
  value: number
  color: string
}

type ActivityItem = {
  id: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  title: string
  detail: string
  time: string
  xp: string
}

export default function ProfileScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [scores, setScores] = useState<SubjectScore[]>([])
  const [progressSubjects, setProgressSubjects] = useState<StudentProgressSubject[]>([])
  const [progressSummary, setProgressSummary] = useState<StudentProgressSummary | null>(null)
  const [completedProgressClasses, setCompletedProgressClasses] = useState(0)
  const [activityAttempts, setActivityAttempts] = useState<ActivityAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const { accentColor } = useAppTheme()

  const isDesktop = width >= 1024
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const badgeMetrics = getStudentBadgeMetrics({
    scores: scores as StudentBadgeScore[],
    totalPoints: points,
    subjectsCount: subjects.length,
  })
  const answeredAttempts = progressSummary?.totalAttempts ?? 0
  const correctAttempts = progressSummary?.correctAttempts ?? 0
  const accuracyPercent = progressSummary?.accuracyPercent ?? 0
  const statBars = buildStatBars(progressSubjects)
  const badges = buildStudentBadges(badgeMetrics)
  const achievedBadges = badges.filter((badge) => badge.unlocked).slice(0, 3)
  const activityItems = buildActivityItems(activityAttempts)
  const memberSince = formatLongDate(profile?.created_at, '15 de marzo de 2008')

  const fetchProfile = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      setEmail(session.session?.user.email || 'alex@example.com')

      if (!userId) return

      const [profileResult, enrollmentsResult, scoresResult, attemptsResult, progressResult] = await Promise.all([
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
        supabase
          .from('attempt_history')
          .select(`
            id,
            is_correct,
            time_taken_seconds,
            attempted_at,
            questions (
              text,
              subject_topics ( title )
            )
          `)
          .eq('student_id', userId)
          .order('attempted_at', { ascending: false })
          .limit(6),
        fetchStudentProgressSummary(userId),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (scoresResult.error) throw scoresResult.error
      if (attemptsResult.error) throw attemptsResult.error

      setProfile(profileResult.data)
      setSubjects(
        enrollmentsResult.data
          ?.map((enrollment: any) => enrollment.subjects)
          .filter(Boolean) || []
      )
      setScores((scoresResult.data || []) as SubjectScore[])
      setProgressSubjects(progressResult.subjects)
      setProgressSummary(progressResult)
      setCompletedProgressClasses(progressResult.completedClasses)
      setActivityAttempts((attemptsResult.data || []) as ActivityAttempt[])
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color={accentColor} />
        <Text className="mt-4 text-[#8FA7C7]">Cargando perfil...</Text>
      </View>
    )
  }

  return (
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
          <StudentPageHeader
            icon="person"
            isDesktop={isDesktop}
            subtitle="Gestiona tu información y revisa tus logros"
            title="Perfil"
          />

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <ProfileHero
              alias={alias}
              level={level}
              points={points}
              nextLevelProgress={nextLevelProgress}
              profile={profile}
              uploading={uploading}
              onPickImage={pickImage}
            />

            <View className={isDesktop ? 'flex-[1.5] flex-row gap-4' : 'flex-row flex-wrap gap-4'}>
              <SummaryTile
                title="Preguntas respondidas"
                value={String(answeredAttempts)}
                icon="chatbubbles"
                color="#F6A64A"
                onPress={() => router.push('/(student)/progress' as any)}
              />
              <SummaryTile
                title="Preguntas correctas"
                value={String(correctAttempts)}
                icon="checkmark-circle"
                color={accentColor}
                onPress={() => router.push('/(student)/progress' as any)}
              />
              <SummaryTile
                title="Precisión"
                value={`${accuracyPercent}%`}
                icon="speedometer-outline"
                color="#43D991"
                onPress={() => router.push('/(student)/progress' as any)}
              />
              <SummaryTile
                title="Cursos completados"
                value={String(completedProgressClasses)}
                icon="book"
                color="#3B82F6"
                onPress={() => router.push('/(student)/classes' as any)}
              />
            </View>
          </View>

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <StudentDashboardCard title="Información personal" className={isDesktop ? 'flex-1' : ''}>
              <InfoRow icon="mail-outline" label="Correo electrónico" value={email} />
              <InfoRow icon="calendar-outline" label="Miembro desde" value={memberSince} />
              <Pressable
                onPress={() => router.push('/(student)/settings?section=profile' as any)}
                className="mt-4 flex-row items-center gap-2 border-t border-[#172A4A] pt-4"
              >
                <Ionicons name="create-outline" size={18} color={accentColor} />
                <Text className="font-bold" style={{ color: accentColor }}>Editar perfil</Text>
                <Ionicons name="arrow-forward" size={16} color={accentColor} />
              </Pressable>
            </StudentDashboardCard>

            <StudentDashboardCard title="Accesos del perfil" className={isDesktop ? 'flex-[1.05]' : ''}>
              <View className="gap-3">
                <ProfileShortcut
                  icon="stats-chart-outline"
                  label="Progreso"
                  description="Estadísticas, evolución y cursos"
                  color={accentColor}
                  onPress={() => router.push('/(student)/progress' as any)}
                />
                <ProfileShortcut
                  icon="ribbon-outline"
                  label="Logros"
                  description="Insignias conseguidas y pendientes"
                  color="#A855F7"
                  onPress={() => router.push('/(student)/badges' as any)}
                />
                <ProfileShortcut
                  icon="notifications-outline"
                  label="Notificaciones"
                  description="Avisos y novedades de tus cursos"
                  color="#38BDF8"
                  onPress={() => router.push('/(student)/notifications' as any)}
                />
                <ProfileShortcut
                  icon="settings-outline"
                  label="Configuración"
                  description="Preferencias, privacidad y seguridad"
                  color="#F6A64A"
                  onPress={() => router.push('/(student)/settings' as any)}
                />
              </View>
            </StudentDashboardCard>

            <StudentDashboardCard title="Mis estadísticas" className={isDesktop ? 'flex-[1.18]' : ''}>
              <View style={{ gap: 14 }}>
                {statBars.length > 0 ? (
                  statBars.map((item) => (
                    <StatBar key={item.label} item={item} />
                  ))
                ) : (
                  <EmptyState icon="analytics-outline" message="Juega una curso para ver tus estadísticas." />
                )}
              </View>
              <StudentCardLink label="Ver estadísticas detalladas" onPress={() => router.push('/(student)/progress' as any)} />
            </StudentDashboardCard>

            <StudentDashboardCard
              title="Logros"
              actionLabel="Ver todas"
              onAction={() => router.push('/(student)/badges' as any)}
              className={isDesktop ? 'flex-[1.36]' : ''}
            >
              <View style={{ gap: 12 }}>
                {achievedBadges.length > 0 ? (
                  achievedBadges.map((badge) => (
                    <BadgeRow
                      key={badge.title}
                      badge={badge}
                      onPress={() => router.push('/(student)/badges' as any)}
                    />
                  ))
                ) : (
                  <EmptyState icon="ribbon-outline" message="Todavía no has conseguido logros." />
                )}
              </View>
            </StudentDashboardCard>
          </View>

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <StudentDashboardCard
              title="Historial de actividad"
              actionLabel="Ver historial"
              onAction={() => router.push('/(student)/activity-log' as any)}
              className={isDesktop ? 'flex-[1.55]' : ''}
            >
              <View style={{ gap: 14 }}>
                {activityItems.length > 0 ? (
                  activityItems.map((item) => (
                    <ActivityRow key={item.id} item={item} />
                  ))
                ) : (
                  <EmptyState icon="sparkles-outline" message="Completa una partida para llenar tu historial." />
                )}
              </View>
              <StudentCardLink label="Ver toda la actividad" onPress={() => router.push('/(student)/activity-log' as any)} />
            </StudentDashboardCard>
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="profile" /> : null}
    </View>
  )
}

function ProfileHero({
  alias,
  level,
  points,
  nextLevelProgress,
  profile,
  uploading,
  onPickImage,
}: {
  alias: string
  level: number
  points: number
  nextLevelProgress: number
  profile: Profile | null
  uploading: boolean
  onPickImage: () => void
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
        <Pressable onPress={onPickImage} disabled={uploading} className="h-28 w-28 items-center justify-center rounded-full border-4 border-[#91B8FF] bg-[#D8E7FF]">
          {profile?.avatar && profile.avatar.startsWith('http') ? (
            <Image source={{ uri: profile.avatar }} className="h-full w-full rounded-full" />
          ) : (
            <Ionicons name="person" size={50} color="#9FD6FF" />
          )}
          <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: accentColor }}>
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="create" size={15} color="#FFFFFF" />
            )}
          </View>
        </Pressable>

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

function SummaryTile({
  title,
  value,
  icon,
  color,
  onPress,
}: {
  title: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  onPress?: () => void
}) {
  const Container = onPress ? Pressable : View

  return (
    <Container
      onPress={onPress}
      className="min-w-[135px] flex-1 items-center border-r border-[#172A4A] bg-[#09162C] px-3 py-5 first:rounded-l-2xl last:rounded-r-2xl"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text className="mt-3 text-center text-[13px] text-[#AFC2DB]">{title}</Text>
      <Text className="mt-2 text-[28px] font-black text-white">{value}</Text>
    </Container>
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

function StatBar({ item }: { item: StatBarItem }) {
  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[13px] text-[#AFC2DB]">{item.label}</Text>
        <Text className="text-[13px] text-[#AFC2DB]">{item.value}%</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-[#182D50]">
        <View className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
      </View>
    </View>
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

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${item.color}29` }}>
        <Ionicons name={item.icon} size={17} color={item.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-bold text-white">{item.title}</Text>
        <Text className="mt-1 text-[13px] text-[#8FA7C7]">{item.detail}</Text>
      </View>
      <Text className="text-[13px] text-[#8FA7C7]">{item.time}</Text>
      <View className="rounded-md bg-[#34235E] px-2 py-1">
        <Text className="text-[13px] font-bold text-[#BFAAFF]">{item.xp}</Text>
      </View>
    </View>
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

function buildStatBars(subjects: StudentProgressSubject[]): StatBarItem[] {
  const colors = ['#8B5CF6', '#3B82F6', '#43D991', '#FBBF24', '#FF7B45']

  return subjects
    .slice(0, 5)
    .map((subject, index) => {
      return {
        label: subject.name,
        value: subject.percent,
        color: colors[index % colors.length],
      }
    })
}

function buildActivityItems(attempts: ActivityAttempt[]): ActivityItem[] {
  return attempts
    .filter((attempt) => attempt.attempted_at)
    .slice(0, 6)
    .map((attempt) => {
      const question = Array.isArray(attempt.questions) ? attempt.questions[0] : attempt.questions
      const topicData = question?.subject_topics
      const topicTitle = Array.isArray(topicData) ? topicData[0]?.title : topicData?.title
      const elapsed = typeof attempt.time_taken_seconds === 'number'
        ? ` · ${attempt.time_taken_seconds}s`
        : ''

      return {
        id: String(attempt.id),
        icon: attempt.is_correct ? 'checkmark-circle' : 'close-circle',
        color: attempt.is_correct ? '#70E0A5' : '#FB7185',
        title: attempt.is_correct ? 'Respuesta correcta' : 'Respuesta incorrecta',
        detail: topicTitle ? `Tema: ${topicTitle}${elapsed}` : `${question?.text || 'Práctica libre'}${elapsed}`,
        time: formatRelativeDate(attempt.attempted_at),
        xp: attempt.is_correct ? '+10 XP' : '0 XP',
      }
    })
}
