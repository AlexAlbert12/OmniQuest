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
} from 'react-native'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/StudentSidebar'

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

const statBars = [
  { label: 'Conocimiento general', value: 75, color: '#8B5CF6' },
  { label: 'Matemáticas', value: 60, color: '#3B82F6' },
  { label: 'Ciencias', value: 45, color: '#43D991' },
  { label: 'Inglés', value: 80, color: '#FBBF24' },
  { label: 'Historia', value: 50, color: '#FF7B45' },
] as const

const recentBadges = [
  {
    title: 'Maestro de retos',
    detail: 'Completa 50 retos',
    time: 'Hace 2 días',
    icon: 'trophy',
    color: '#8B5CF6',
  },
  {
    title: 'Científico curioso',
    detail: 'Completa 10 clases de Ciencias',
    time: 'Hace 5 días',
    icon: 'flask',
    color: '#34D399',
  },
  {
    title: 'Constante',
    detail: 'Mantén una racha de 7 días',
    time: 'Hoy',
    icon: 'star',
    color: '#F6A64A',
  },
] as const

const activityItems = [
  {
    icon: 'checkmark',
    color: '#70E0A5',
    title: 'Completaste el reto "Verbos en pasado"',
    detail: 'Inglés',
    time: 'Hace 2h',
    xp: '+100 XP',
  },
  {
    icon: 'trophy',
    color: '#8B5CF6',
    title: 'Subiste al puesto #4 en el ranking semanal',
    detail: 'Ranking',
    time: 'Ayer',
    xp: '+150 XP',
  },
  {
    icon: 'star',
    color: '#F6A64A',
    title: 'Completaste la clase "El sistema solar"',
    detail: 'Ciencias',
    time: '2 días atrás',
    xp: '+120 XP',
  },
] as const

export default function ProfileScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const isDesktop = width >= 1024
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = Math.floor(points / 100) + 1
  const nextLevelProgress = points % 100
  const challengesCompleted = Math.max(8, Math.floor(points / 100) + subjects.length * 4)
  const completedClasses = Math.max(subjects.length, 12)
  const streakDays = 7
  const memberSince = formatProfileDate(profile?.created_at)

  const fetchProfile = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      setEmail(session.session?.user.email || 'alex@example.com')

      if (!userId) return

      const [profileResult, enrollmentsResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, created_at, points').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('subjects(id, name)')
          .eq('student_id', userId),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error

      setProfile(profileResult.data)
      setSubjects(
        enrollmentsResult.data
          ?.map((enrollment: any) => enrollment.subjects)
          .filter(Boolean) || []
      )
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
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={handleSignOut}
            onComingSoon={showComingSoon}
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
                <Ionicons name="person-outline" size={30} color="#8B5CF6" />
                <Text className="text-[30px] font-black text-white">Perfil</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Gestiona tu información y revisa tus logros
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-3 rounded-2xl border border-[#162B50] bg-[#0B1933] px-4 py-3">
                <Ionicons name="flash" size={20} color="#FFD34D" />
                <View>
                  <Text className="text-[16px] font-black text-white">{streakDays}</Text>
                  <Text className="text-[11px] text-[#8FA7C7]">Días de racha</Text>
                </View>
              </View>
              <Pressable
                onPress={() => showComingSoon('Las notificaciones')}
                className="rounded-2xl border border-[#162B50] bg-[#0B1933] p-3"
              >
                <Ionicons name="notifications-outline" size={22} color="#AFC2DB" />
                <View className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-[#FF5D6C]" />
              </Pressable>
            </View>
          </View>

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <ProfileHero
              alias={alias}
              level={level}
              points={points}
              nextLevelProgress={nextLevelProgress}
            />

            <View className={isDesktop ? 'flex-[1.5] flex-row gap-4' : 'flex-row flex-wrap gap-4'}>
              <SummaryTile title="Logros" value="18" icon="star" color="#F6A64A" link="Ver todos" />
              <SummaryTile
                title="Retos completados"
                value={String(challengesCompleted)}
                icon="trophy"
                color="#8B5CF6"
                link="Ver retos"
              />
              <SummaryTile
                title="Clases completadas"
                value={String(completedClasses)}
                icon="radio-button-on"
                color="#3B82F6"
                link="Ver clases"
              />
              <SummaryTile
                title="Días de racha"
                value={String(streakDays)}
                icon="flame"
                color="#FF7B45"
                link="¡Sigue así!"
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
                {statBars.map((item) => (
                  <StatBar key={item.label} item={item} />
                ))}
              </View>
              <CardLink label="Ver estadísticas detalladas" onPress={() => showComingSoon('Las estadísticas detalladas')} />
            </DashboardCard>

            <DashboardCard
              title="Insignias recientes"
              actionLabel="Ver todas"
              onAction={() => showComingSoon('Todas las insignias')}
              className={isDesktop ? 'flex-[1.36]' : ''}
            >
              <View style={{ gap: 12 }}>
                {recentBadges.map((badge) => (
                  <BadgeRow key={badge.title} badge={badge} />
                ))}
              </View>
            </DashboardCard>
          </View>

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <DashboardCard title="Historial de actividad" className={isDesktop ? 'flex-[1.55]' : ''}>
              <View style={{ gap: 14 }}>
                {activityItems.map((item) => (
                  <ActivityRow key={item.title} item={item} />
                ))}
              </View>
            </DashboardCard>

            <DashboardCard title="Personaliza tu experiencia" className={isDesktop ? 'flex-1' : ''}>
              <SettingsRow icon="moon-outline" label="Tema de la aplicación" value="Oscuro" />
              <SettingsRow icon="notifications-outline" label="Notificaciones" value="Activadas" />
              <SettingsRow icon="lock-closed-outline" label="Privacidad" value="Gestionar" />
              <Pressable onPress={handleSignOut} className="mt-4 flex-row items-center gap-3">
                <Ionicons name="log-out-outline" size={18} color="#F87171" />
                <Text className="font-bold text-[#F87171]">Cerrar sesión</Text>
              </Pressable>
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
}: {
  alias: string
  level: number
  points: number
  nextLevelProgress: number
}) {
  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-[#1C3762] bg-[#0B1B48] p-7">
      <View className="absolute inset-0 bg-[#0D1C55]" />
      <View className="absolute bottom-[-28px] left-0 h-28 w-44 rounded-full bg-[#061B43]" />
      <View className="absolute bottom-[-42px] right-7 h-32 w-44 rounded-full bg-[#081F55]" />
      <View className="absolute right-6 top-6 h-20 w-20 rounded-full bg-[#5135D8]/50" />
      <View className="absolute right-2 top-10 h-8 w-28 rounded-full border border-[#7B68FF]/45" style={{ transform: [{ rotate: '-18deg' }] }} />

      <View className="relative flex-row items-center gap-6">
        <View className="h-28 w-28 items-center justify-center rounded-full border-4 border-[#91B8FF] bg-[#D8E7FF]">
          <Text className="text-6xl">🧑‍🎓</Text>
          <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full bg-[#7C5CFF]">
            <Ionicons name="create" size={15} color="#FFFFFF" />
          </View>
        </View>

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
  link,
}: {
  title: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  link: string
}) {
  return (
    <View className="min-w-[135px] flex-1 items-center border-r border-[#172A4A] bg-[#09162C] px-3 py-5 first:rounded-l-2xl last:rounded-r-2xl">
      <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text className="mt-3 text-center text-[12px] text-[#AFC2DB]">{title}</Text>
      <Text className="mt-2 text-[28px] font-black text-white">{value}</Text>
      <View className="mt-3 flex-row items-center gap-2">
        <Text className="text-[12px] font-bold text-[#9B6CFF]">{link}</Text>
        <Ionicons name="arrow-forward" size={13} color="#9B6CFF" />
      </View>
    </View>
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

function StatBar({ item }: { item: (typeof statBars)[number] }) {
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

function BadgeRow({ badge }: { badge: (typeof recentBadges)[number] }) {
  return (
    <View className="flex-row items-center gap-4 rounded-xl bg-[#0D1D3B] p-3">
      <View
        className="h-14 w-14 items-center justify-center rounded-2xl border-2"
        style={{ backgroundColor: `${badge.color}20`, borderColor: badge.color }}
      >
        <Ionicons name={badge.icon} size={26} color={badge.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-black text-white">{badge.title}</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]">{badge.detail}</Text>
      </View>
      <Text className="text-[11px] text-[#8FA7C7]">{badge.time}</Text>
    </View>
  )
}

function ActivityRow({ item }: { item: (typeof activityItems)[number] }) {
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

function SettingsRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  return (
    <Pressable className="flex-row items-center gap-3 rounded-xl bg-[#0D1D3B] px-4 py-3">
      <Ionicons name={icon} size={18} color="#AFC2DB" />
      <Text className="min-w-0 flex-1 font-semibold text-[#DDE7F4]">{label}</Text>
      <Text className="text-[12px] text-[#AFC2DB]">{value}</Text>
      <Ionicons name="chevron-forward" size={15} color="#AFC2DB" />
    </Pressable>
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
      <Link href="/(student)/home" asChild>
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
