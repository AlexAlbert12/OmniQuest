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
import { Link, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/StudentSidebar'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
}

type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
}

const fallbackSubjects = [
  { name: 'Inglés', detail: 'Unit 4: Daily Activities', icon: 'book', color: '#43D991', progress: 75, completed: '15 / 20', xp: '2,250' },
  { name: 'Matemáticas', detail: 'Ecuaciones de primer grado', icon: 'calculator', color: '#8B5CF6', progress: 60, completed: '12 / 20', xp: '1,800' },
  { name: 'Ciencias', detail: 'El sistema solar', icon: 'flask', color: '#3B82F6', progress: 45, completed: '9 / 20', xp: '1,350' },
  { name: 'Historia', detail: 'La Edad Media', icon: 'business', color: '#F6A64A', progress: 50, completed: '10 / 20', xp: '1,050' },
  { name: 'Otras asignaturas', detail: 'Arte, Tecnología, etc.', icon: 'ellipsis-horizontal', color: '#718096', progress: 30, completed: '6 / 20', xp: '500' },
] as const

const achievements = [
  { title: 'Maestro de retos', detail: 'Completa 50 retos', time: 'Hace 2 días', xp: '+200 XP', icon: 'trophy', color: '#8B5CF6' },
  { title: 'Científico curioso', detail: 'Completa 10 clases de Ciencias', time: 'Hace 5 días', xp: '+150 XP', icon: 'flask', color: '#34D399' },
  { title: 'Constante', detail: 'Mantén una racha de 7 días', time: 'Hoy', xp: '+100 XP', icon: 'star', color: '#F6A64A' },
  { title: 'Aprendiz dedicado', detail: 'Estudia 5 horas en total', time: 'Ayer', xp: '+120 XP', icon: 'radio-button-on', color: '#3B82F6' },
] as const

export default function ProgressScreen() {
  const { width } = useWindowDimensions()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const isDesktop = width >= 1024
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = Math.floor(points / 100) + 1
  const nextLevelProgress = points % 100
  const totalClasses = Math.max(subjects.length, 18)
  const completedClasses = Math.min(totalClasses, Math.max(subjects.length, 12))
  const completedChallenges = Math.max(18, Math.floor(points / 100) + subjects.length * 4)
  const progressPercent = Math.min(96, Math.max(38, 48 + subjects.length * 7 + Math.floor(points / 180)))
  const weeklyCompleted = Math.min(10, Math.max(3, Math.floor(points / 350) + subjects.length))

  const fetchProgress = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) return

      const [profileResult, enrollmentsResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, points, avatar').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('subjects(id, name, description, icon, theme_color)')
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
      console.error('Error fetching progress:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchProgress()
    }, [fetchProgress])
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#6574FF" />
        <Text className="mt-4 text-[#8FA7C7]">Analizando tu progreso...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection="progress"
            alias={alias}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={() => supabase.auth.signOut()}
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
                <Ionicons name="stats-chart" size={30} color="#8B5CF6" />
                <Text className="text-[30px] font-black text-white">Progreso</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Analiza tu aprendizaje y sigue mejorando cada día.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-3 rounded-2xl border border-[#162B50] bg-[#0B1933] px-4 py-3">
                <Ionicons name="flash" size={20} color="#FFD34D" />
                <View>
                  <Text className="text-[16px] font-black text-white">7</Text>
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
            <SummaryCard
              progressPercent={progressPercent}
              completedClasses={completedClasses}
              totalClasses={totalClasses}
              completedChallenges={completedChallenges}
              points={points}
            />
            <XpEvolution />
            <DistributionCard />
          </View>

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <DashboardCard title="Progreso por asignatura" className={isDesktop ? 'flex-[1.55]' : ''}>
              <View style={{ gap: 10 }}>
                {buildSubjectRows(subjects).map((subject) => (
                  <SubjectProgressRow key={subject.name} subject={subject} />
                ))}
              </View>
              <CardLink label="Ver todas mis clases" onPress={() => showComingSoon('Todas tus clases')} />
            </DashboardCard>

            <View className={isDesktop ? 'flex-1 gap-5' : 'gap-5'}>
              <DashboardCard
                title="Logros recientes"
                actionLabel="Ver todos"
                onAction={() => showComingSoon('Todos los logros')}
              >
                <View style={{ gap: 12 }}>
                  {achievements.map((achievement) => (
                    <AchievementRow key={achievement.title} achievement={achievement} />
                  ))}
                </View>
              </DashboardCard>

              <WeeklyGoal completed={weeklyCompleted} />
            </View>
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <BottomNav /> : null}
    </View>
  )
}

function SummaryCard({
  progressPercent,
  completedClasses,
  totalClasses,
  completedChallenges,
  points,
}: {
  progressPercent: number
  completedClasses: number
  totalClasses: number
  completedChallenges: number
  points: number
}) {
  return (
    <View className="flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <Text className="mb-5 text-[15px] font-black text-white">Resumen general</Text>
      <View className="flex-row items-center gap-6">
        <View className="h-40 w-40 items-center justify-center rounded-full border-[13px] border-[#8B5CF6] bg-[#13204B]">
          <Text className="text-[34px] font-black text-white">{progressPercent}%</Text>
          <Text className="mt-1 text-center text-[11px] text-[#AFC2DB]">Progreso general</Text>
        </View>
        <View className="min-w-0 flex-1" style={{ gap: 12 }}>
          <SummaryStat icon="checkmark-done" color="#3B82F6" label="Clases completadas" value={`${completedClasses} / ${totalClasses}`} />
          <SummaryStat icon="trophy" color="#EC4899" label="Retos completados" value={`${completedChallenges} / 72`} />
          <SummaryStat icon="timer" color="#F6A64A" label="Horas de estudio" value="24h 35m" />
          <SummaryStat icon="flash" color="#FBBF24" label="XP total acumulada" value={`${Math.max(points, 8450).toLocaleString()} XP`} />
        </View>
      </View>
      <Text className="mt-5 text-center text-[12px] text-[#AFC2DB]">¡Vas por muy buen camino! 🚀</Text>
    </View>
  )
}

function SummaryStat({
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
    <View className="flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View>
        <Text className="text-[12px] text-[#AFC2DB]">{label}</Text>
        <Text className="text-[13px] font-bold text-white">{value}</Text>
      </View>
    </View>
  )
}

function XpEvolution() {
  const points = [420, 620, 890, 650, 820, 1180, 1250]
  const labels = ['Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom', 'Hoy']

  return (
    <View className="flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-5 flex-row items-center justify-between">
        <Text className="text-[15px] font-black text-white">Evolución de XP</Text>
        <View className="flex-row items-center gap-2 rounded-lg border border-[#1A3155] bg-[#0D1D3B] px-3 py-2">
          <Text className="text-[12px] text-[#AFC2DB]">Últimos 7 días</Text>
          <Ionicons name="chevron-down" size={13} color="#AFC2DB" />
        </View>
      </View>
      <View className="h-44 justify-end border-b border-l border-[#183052]">
        <View className="absolute left-2 top-0">
          {['2k', '1.5k', '1k', '500', '0'].map((label) => (
            <Text key={label} className="mb-[18px] text-[11px] text-[#60799C]">{label}</Text>
          ))}
        </View>
        <View className="ml-12 flex-row items-end justify-between">
          {points.map((value, index) => (
            <View key={labels[index]} className="items-center">
              <View className="w-8 justify-end" style={{ height: 132 }}>
                <View
                  className="w-full rounded-t-md bg-[#5D5FEF]"
                  style={{ height: Math.max(18, value / 12), opacity: index === points.length - 1 ? 1 : 0.68 }}
                />
              </View>
              <View className="mt-2 h-3 w-3 rounded-full bg-[#8B5CF6]" />
            </View>
          ))}
        </View>
      </View>
      <View className="ml-12 mt-2 flex-row justify-between">
        {labels.map((label) => (
          <Text key={label} className="text-[11px] text-[#8FA7C7]">{label}</Text>
        ))}
      </View>
    </View>
  )
}

function DistributionCard() {
  const subjects = [
    { label: 'Inglés', value: 75, color: '#43D991' },
    { label: 'Matemáticas', value: 60, color: '#8B5CF6' },
    { label: 'Ciencias', value: 45, color: '#3B82F6' },
    { label: 'Historia', value: 50, color: '#F6A64A' },
    { label: 'Otras', value: 30, color: '#718096' },
  ]

  return (
    <View className="flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <Text className="mb-5 text-[15px] font-black text-white">Distribución por asignatura</Text>
      <View className="flex-row items-center gap-7">
        <View className="h-32 w-32 items-center justify-center rounded-full border-[24px] border-[#43D991] bg-[#061126]">
          <View className="h-12 w-12 rounded-full bg-[#09162C]" />
        </View>
        <View className="min-w-0 flex-1" style={{ gap: 11 }}>
          {subjects.map((subject) => (
            <View key={subject.label} className="flex-row items-center gap-3">
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
              <Text className="min-w-0 flex-1 text-[12px] font-semibold text-[#DDE7F4]">{subject.label}</Text>
              <Text className="text-[12px] text-[#AFC2DB]">{subject.value}%</Text>
            </View>
          ))}
        </View>
      </View>
      <CardLink label="Ver todas las estadísticas" onPress={() => undefined} />
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

function SubjectProgressRow({
  subject,
}: {
  subject: {
    name: string
    detail: string
    icon: keyof typeof Ionicons.glyphMap
    color: string
    progress: number
    completed: string
    xp: string
  }
}) {
  return (
    <View className="flex-row items-center rounded-xl bg-[#0D1D3B] p-3">
      <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${subject.color}24` }}>
        <Ionicons name={subject.icon} size={24} color={subject.color} />
      </View>
      <View className="ml-3 min-w-0 flex-1">
        <Text className="font-black text-white">{subject.name}</Text>
        <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={1}>{subject.detail}</Text>
      </View>
      <View className="mx-4 hidden h-2 flex-[0.9] overflow-hidden rounded-full bg-[#13294C] md:flex">
        <View className="h-full rounded-full" style={{ width: `${subject.progress}%`, backgroundColor: subject.color }} />
      </View>
      <Text className="w-10 text-right text-[12px] text-[#AFC2DB]">{subject.progress}%</Text>
      <View className="mx-4 hidden w-28 border-l border-[#172A4A] pl-4 lg:flex">
        <Text className="text-[10px] text-[#60799C]">Completadas</Text>
        <Text className="text-[12px] font-bold text-[#DDE7F4]">{subject.completed}</Text>
      </View>
      <View className="hidden w-16 lg:flex">
        <Text className="text-[10px] text-[#60799C]">XP</Text>
        <Text className="text-[12px] font-bold text-[#DDE7F4]">{subject.xp}</Text>
      </View>
      <Ionicons name="arrow-forward" size={16} color="#7F91AD" />
    </View>
  )
}

function AchievementRow({ achievement }: { achievement: (typeof achievements)[number] }) {
  return (
    <View className="flex-row items-center gap-4 rounded-xl bg-[#0D1D3B] p-3">
      <View
        className="h-14 w-14 items-center justify-center rounded-2xl border-2"
        style={{ backgroundColor: `${achievement.color}20`, borderColor: achievement.color }}
      >
        <Ionicons name={achievement.icon} size={26} color={achievement.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-black text-white">{achievement.title}</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]">{achievement.detail}</Text>
      </View>
      <View className="items-end">
        <Text className="text-[11px] text-[#8FA7C7]">{achievement.time}</Text>
        <Text className="mt-1 text-[11px] font-bold text-[#9B6CFF]">{achievement.xp}</Text>
      </View>
    </View>
  )
}

function WeeklyGoal({ completed }: { completed: number }) {
  const percent = Math.min(100, (completed / 10) * 100)

  return (
    <View className="overflow-hidden rounded-2xl border border-[#3E2A8E] bg-[#221052] p-5">
      <View className="absolute bottom-[-24px] right-[-10px] h-28 w-36 rounded-full bg-[#4F2BC0]/50" />
      <Text className="text-[15px] font-black text-white">Meta semanal</Text>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="font-bold text-white">Completa 10 retos esta semana</Text>
        <View className="flex-row items-center gap-2">
          <Ionicons name="time-outline" size={14} color="#C4B5FD" />
          <Text className="text-[12px] text-[#C4B5FD]">5d 12h restantes</Text>
        </View>
      </View>
      <View className="mt-5 flex-row items-center gap-4">
        <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#3B2A78]">
          <View className="h-full rounded-full bg-[#9B6CFF]" style={{ width: `${percent}%` }} />
        </View>
        <Text className="text-[13px] font-bold text-[#C4B5FD]">{completed} / 10</Text>
      </View>
      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-[12px] text-[#C4B5FD]">Recompensa</Text>
        <View className="flex-row items-center gap-3">
          <Text className="text-[20px] font-black text-[#C4B5FD]">250 XP</Text>
          <Text className="text-4xl">🎁</Text>
        </View>
      </View>
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
      <Link href="/(student)/home" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="home-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Inicio</Text>
        </Pressable>
      </Link>

      <Pressable className="items-center">
        <Ionicons name="stats-chart" size={22} color="#B09BFF" />
        <Text className="mt-1 text-[11px] font-bold text-[#B09BFF]">Progreso</Text>
      </Pressable>

      <Link href="/(student)/profile" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="person-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Perfil</Text>
        </Pressable>
      </Link>
    </View>
  )
}

function buildSubjectRows(subjects: Subject[]) {
  const colors = ['#43D991', '#8B5CF6', '#3B82F6', '#F6A64A', '#718096']
  const icons: (keyof typeof Ionicons.glyphMap)[] = ['book', 'calculator', 'flask', 'business', 'ellipsis-horizontal']

  if (subjects.length === 0) return fallbackSubjects

  return [
    ...subjects.slice(0, 5).map((subject, index) => ({
      name: subject.name,
      detail: subject.description || 'Retos y ejercicios disponibles',
      icon: icons[index] || 'book',
      color: subject.theme_color || colors[index] || '#43D991',
      progress: [75, 60, 45, 50, 30][index] || 35,
      completed: [`15 / 20`, `12 / 20`, `9 / 20`, `10 / 20`, `6 / 20`][index] || '7 / 20',
      xp: [`2,250`, `1,800`, `1,350`, `1,050`, `500`][index] || '650',
    })),
    ...fallbackSubjects.slice(subjects.length, 5),
  ]
}
