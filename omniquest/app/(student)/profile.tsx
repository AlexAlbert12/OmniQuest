import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  Image,
} from 'react-native'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/StudentSidebar'
import NotificationBadge from '../../components/NotificationBadge'
import {
  buildStudentBadges,
  getStudentBadgeMetrics,
  type StudentBadge,
  type StudentBadgeScore,
} from '../../lib/studentBadges'

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
  question_id: number
  answer_id: number | null
  is_correct: boolean
  time_taken_seconds: number | null
  attempted_at: string | null
  questions?: {
    text?: string | null
    type?: string | null
    subject_id?: number | null
    subjects?: { name: string } | { name: string }[] | null
  } | {
    text?: string | null
    type?: string | null
    subject_id?: number | null
    subjects?: { name: string } | { name: string }[] | null
  }[] | null
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
  const [activityAttempts, setActivityAttempts] = useState<ActivityAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const isDesktop = width >= 1024
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = Math.floor(points / 100) + 1
  const nextLevelProgress = points % 100
  const badgeMetrics = getStudentBadgeMetrics({
    scores: scores as StudentBadgeScore[],
    totalPoints: points,
    subjectsCount: subjects.length,
  })
  const { correctAnswers, completedClasses, streakDays } = badgeMetrics
  const statBars = buildStatBars(subjects, scores)
  const badges = buildStudentBadges(badgeMetrics)
  const unlockedBadges = badges.filter((badge) => badge.unlocked).length
  const activityItems = buildActivityItems(activityAttempts)
  const memberSince = formatProfileDate(profile?.created_at)

  const fetchProfile = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      setEmail(session.session?.user.email || 'alex@example.com')

      if (!userId) return

      const [profileResult, enrollmentsResult, scoresResult, attemptsResult] = await Promise.all([
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
          .select('id, question_id, answer_id, is_correct, time_taken_seconds, attempted_at, questions(text, type, subject_id, subjects(name))')
          .eq('student_id', userId)
          .order('attempted_at', { ascending: false })
          .limit(6),
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

      const { data: publicUrl } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar: publicUrl.publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setProfile({ ...profile, avatar: publicUrl.publicUrl })
      Alert.alert('Éxito', 'Foto de perfil actualizada.')
    } catch (error: any) {
      console.error('Error uploading image:', error)
      Alert.alert('Error', 'No se pudo subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

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
    router.replace('/(auth)/login' as any)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#6574FF" />
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
          <View className="mb-6 flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              {!isDesktop ? (
                <Text
                  className="mb-3 text-[#9FD6FF]"
                  style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}
                >
                  OmniQuest
                </Text>
              ) : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="person" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Perfil</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Gestiona tu información y revisa tus logros
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <NotificationBadge />
            </View>
          </View>

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
                title="Logros"
                value={String(unlockedBadges)}
                icon="star"
                color="#F6A64A"
                onPress={() => router.push('/(student)/badges' as any)}
              />
              <SummaryTile
                title="Preguntas correctas"
                value={String(correctAnswers)}
                icon="trophy"
                color="#8B5CF6"
                onPress={() => router.push('/(student)/ranking' as any)}
              />
              <SummaryTile
                title="Clases completadas"
                value={String(completedClasses)}
                icon="book"
                color="#3B82F6"
                onPress={() => router.push('/(student)/classes' as any)}
              />
              <SummaryTile
                title="Días de racha"
                value={String(streakDays)}
                icon="flame"
                color="#FF7B45"
                onPress={() => router.push('/(student)/progress' as any)}
              />
            </View>
          </View>

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <DashboardCard title="Información personal" className={isDesktop ? 'flex-1' : ''}>
              <InfoRow icon="mail-outline" label="Correo electrónico" value={email} />
              <InfoRow icon="calendar-outline" label="Miembro desde" value={memberSince} />
              <InfoRow icon="location-outline" label="País" value="España" />
              <Pressable
                onPress={() => showComingSoon('La edición de perfil')}
                className="mt-4 flex-row items-center gap-2 border-t border-[#172A4A] pt-4"
              >
                <Ionicons name="create-outline" size={18} color="#9B6CFF" />
                <Text className="font-bold text-[#9B6CFF]">Editar información</Text>
                <Ionicons name="arrow-forward" size={16} color="#9B6CFF" />
              </Pressable>
            </DashboardCard>

            <DashboardCard title="Mis estadísticas" className={isDesktop ? 'flex-[1.18]' : ''}>
              <View style={{ gap: 14 }}>
                {statBars.length > 0 ? (
                  statBars.map((item) => (
                    <StatBar key={item.label} item={item} />
                  ))
                ) : (
                  <EmptyState icon="analytics-outline" message="Juega una clase para ver tus estadísticas." />
                )}
              </View>
              <CardLink label="Ver estadísticas detalladas" onPress={() => showComingSoon('Las estadísticas detalladas')} />
            </DashboardCard>

            <DashboardCard
              title="Logros"
              actionLabel="Ver todas"
              onAction={() => router.push('/(student)/badges' as any)}
              className={isDesktop ? 'flex-[1.36]' : ''}
            >
              <View style={{ gap: 12 }}>
                {badges.map((badge) => (
                  <BadgeRow
                    key={badge.title}
                    badge={badge}
                    onPress={() => router.push('/(student)/badges' as any)}
                  />
                ))}
              </View>
            </DashboardCard>
          </View>

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <DashboardCard title="Historial de actividad" className={isDesktop ? 'flex-[1.55]' : ''}>
              <View style={{ gap: 14 }}>
                {activityItems.length > 0 ? (
                  activityItems.map((item) => (
                    <ActivityRow key={item.id} item={item} />
                  ))
                ) : (
                  <EmptyState icon="sparkles-outline" message="Completa una partida para llenar tu historial." />
                )}
              </View>
            </DashboardCard>
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <BottomNav /> : null}
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
          <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full bg-[#7C5CFF]">
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
          <View className="mt-3 w-[96px] flex-row items-center justify-center gap-1 rounded-md bg-[#6D4DDB] px-3 py-1.5">
            <Ionicons name="school" size={13} color="#FFFFFF" />
            <Text className="text-[12px] font-bold text-white">Nivel {level}</Text>
          </View>
          <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#27396B]">
            <View className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${nextLevelProgress}%` }} />
          </View>
          <Text className="mt-2 text-[12px] text-[#D4E2F6]">{points.toLocaleString()} / 2,000 XP</Text>
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
      <Text className="mt-3 text-center text-[12px] text-[#AFC2DB]">{title}</Text>
      <Text className="mt-2 text-[28px] font-black text-white">{value}</Text>
    </Container>
  )
}

function DashboardCard({
  title,
  actionLabel,
  onAction,
  className = '',
  children,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <View className={`rounded-2xl border border-[#1A3155] bg-[#09162C] p-5 ${className}`}>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-[15px] font-black text-white">{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} className="flex-row items-center gap-2">
            <Text className="text-[12px] font-bold text-[#9B6CFF]">{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={13} color="#9B6CFF" />
          </Pressable>
        ) : null}
      </View>
      {children}
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
        <Text className="text-[12px] text-[#8FA7C7]">{label}</Text>
        <Text className="mt-1 text-[13px] text-[#DDE7F4]" numberOfLines={1}>{value}</Text>
      </View>
    </View>
  )
}

function StatBar({ item }: { item: StatBarItem }) {
  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[12px] text-[#AFC2DB]">{item.label}</Text>
        <Text className="text-[12px] text-[#AFC2DB]">{item.value}%</Text>
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
        <Text className="mt-1 text-[12px] text-[#AFC2DB]">{badge.requirement}</Text>
      </View>
      <Text className="text-[11px] text-[#8FA7C7]">{badge.statusLabel}</Text>
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
        <Text className="mt-1 text-[11px] text-[#8FA7C7]">{item.detail}</Text>
      </View>
      <Text className="text-[11px] text-[#8FA7C7]">{item.time}</Text>
      <View className="rounded-md bg-[#34235E] px-2 py-1">
        <Text className="text-[11px] font-bold text-[#BFAAFF]">{item.xp}</Text>
      </View>
    </View>
  )
}

function EmptyState({ icon, message }: { icon: keyof typeof Ionicons.glyphMap; message: string }) {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#1A3155] bg-[#0D1D3B] px-4 py-6">
      <Ionicons name={icon} size={24} color="#8FA7C7" />
      <Text className="mt-2 text-center text-[12px] text-[#8FA7C7]">{message}</Text>
    </View>
  )
}

function CardLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mt-4 flex-row items-center justify-center gap-2 border-t border-[#172A4A] pt-4">
      <Text className="text-[13px] font-bold text-[#9B6CFF]">{label}</Text>
      <Ionicons name="arrow-forward" size={14} color="#9B6CFF" />
    </Pressable>
  )
}

function BottomNav() {
  return (
    <View className="absolute bottom-3 left-4 right-4 flex-row justify-around rounded-2xl border border-[#1A3155] bg-[#09162C] py-3">
      <Link href="/(student)/homeStudent" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="home-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Inicio</Text>
        </Pressable>
      </Link>

      <Link href="/(student)/ranking" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="trophy-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Ranking</Text>
        </Pressable>
      </Link>

      <Pressable className="items-center">
        <Ionicons name="person" size={22} color="#B09BFF" />
        <Text className="mt-1 text-[11px] font-bold text-[#B09BFF]">Perfil</Text>
      </Pressable>

      <Link href="/(student)/settings" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="settings-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Configuración</Text>
        </Pressable>
      </Link>
    </View>
  )
}

function formatProfileDate(date?: string) {
  if (!date) return '15 de marzo de 2008'

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

function buildStatBars(subjects: Subject[], scores: SubjectScore[]): StatBarItem[] {
  const colors = ['#8B5CF6', '#3B82F6', '#43D991', '#FBBF24', '#FF7B45']
  const scoresBySubject = new Map(scores.map((score) => [score.subject_id, score]))

  return subjects
    .slice(0, 5)
    .map((subject, index) => {
      const score = scoresBySubject.get(subject.id)
      const value = Math.min(100, Math.round(((score?.max_score ?? 0) / 1000) * 100))

      return {
        label: subject.name,
        value,
        color: colors[index % colors.length],
      }
    })
    .filter((item) => item.value > 0)
}

function buildActivityItems(attempts: ActivityAttempt[]): ActivityItem[] {
  return attempts
    .filter((attempt) => attempt.attempted_at)
    .slice(0, 6)
    .map((attempt) => {
      const question = Array.isArray(attempt.questions) ? attempt.questions[0] : attempt.questions
      const subject = Array.isArray(question?.subjects) ? question?.subjects[0] : question?.subjects
      const elapsed = typeof attempt.time_taken_seconds === 'number'
        ? ` · ${attempt.time_taken_seconds}s`
        : ''

      return {
        id: String(attempt.id),
        icon: attempt.is_correct ? 'checkmark-circle' : 'refresh-circle',
        color: attempt.is_correct ? '#70E0A5' : '#F6A64A',
        title: attempt.is_correct ? 'Respondió correctamente' : 'Pregunta para repasar',
        detail: `${subject?.name || 'Clase'} · ${question?.text || 'Pregunta'}${elapsed}`,
        time: formatRelativeDate(attempt.attempted_at),
        xp: attempt.is_correct ? 'Correcta' : 'Repasar',
      }
    })
}

function formatRelativeDate(date?: string | null) {
  if (!date) return 'Sin fecha'

  const target = startOfLocalDay(new Date(date))
  const today = startOfLocalDay(new Date())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)

  if (diffDays <= 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  return `${diffDays} días atrás`
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
