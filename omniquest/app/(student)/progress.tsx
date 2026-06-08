import React, { useCallback, useEffect, useState } from 'react'
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
  points: number | null
}

type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
}

type ScoreRow = {
  subject_id: number | null
  max_score: number | null
  played_at?: string | null
  played_days?: string[] | null
  correct_answers?: number | null
  subjects?: { name: string } | { name: string }[] | null
}

type SubjectProgress = {
  id: number
  name: string
  detail: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  averageScore: number | null
  bestScore: number | null
  scoreCount: number
  barPercent: number
}

type RecentScore = {
  label: string
  value: number
}

export default function ProgressScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subjectProgress, setSubjectProgress] = useState<SubjectProgress[]>([])
  const [recentScores, setRecentScores] = useState<RecentScore[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [weeklyCompleted, setWeeklyCompleted] = useState(0)
  const [weeklyRemainingText, setWeeklyRemainingText] = useState(() => getTimeUntilSundayLabel())
  const [loading, setLoading] = useState(true)

  const isDesktop = width >= 1024
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = Math.floor(points / 100) + 1
  const nextLevelProgress = points % 100
  const scoredSubjects = subjectProgress.filter((subject) => subject.averageScore !== null)
  const totalClasses = subjectProgress.length
  const completedClasses = scoredSubjects.length
  const savedScores = subjectProgress.reduce((total, subject) => total + subject.scoreCount, 0)
  const progressPercent = totalClasses > 0 ? Math.round((completedClasses / totalClasses) * 100) : 0
  const averageScore = scoredSubjects.length > 0
    ? Math.round(scoredSubjects.reduce((total, subject) => total + (subject.averageScore || 0), 0) / scoredSubjects.length)
    : null
  const badgeMetrics = getStudentBadgeMetrics({
    scores: scores as StudentBadgeScore[],
    totalPoints: points,
    subjectsCount: totalClasses,
  })
  const badges = buildStudentBadges(badgeMetrics)

  const fetchProgress = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) return

      const now = new Date()
      const weekStart = getStartOfWeekMonday(now)
      const weekStartIso = weekStart.toISOString()
      const nowIso = now.toISOString()

      const [profileResult, enrollmentsResult, scoresResult, weeklyAttemptsResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, points, avatar').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('subjects(id, name, description, icon, theme_color)')
          .eq('student_id', userId),
        supabase
          .from('subject_scores')
          .select('subject_id, max_score, played_at, played_days, correct_answers, subjects(name)')
          .eq('student_id', userId)
          .order('played_at', { ascending: false }),
        supabase
          .from('attempt_history')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', userId)
          .gte('attempted_at', weekStartIso)
          .lte('attempted_at', nowIso),
      ])

      if (profileResult.error) throw profileResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (scoresResult.error) throw scoresResult.error
      if (weeklyAttemptsResult.error) throw weeklyAttemptsResult.error

      setProfile(profileResult.data)
      const enrolledSubjects = (
        enrollmentsResult.data
          ?.map((enrollment: any) => enrollment.subjects)
          .filter(Boolean) || []
      )
      const scores = (scoresResult.data || []) as ScoreRow[]

      setSubjectProgress(buildSubjectRows(enrolledSubjects, scores))
      setRecentScores(buildRecentScores(scores))
      setScores(scores)
      setWeeklyCompleted(weeklyAttemptsResult.count || 0)
    } catch (error) {
      console.error('Error fetching progress:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const updateRemainingTime = () => setWeeklyRemainingText(getTimeUntilSundayLabel())
    updateRemainingTime()

    const timer = setInterval(updateRemainingTime, 60000)
    return () => clearInterval(timer)
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
            avatar={profile?.avatar}
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
                <Ionicons name="stats-chart" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Progreso</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Analiza tu aprendizaje y sigue mejorando cada día.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <NotificationBadge />
            </View>
          </View>

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <SummaryCard
              progressPercent={progressPercent}
              completedClasses={completedClasses}
              totalClasses={totalClasses}
              savedScores={savedScores}
              averageScore={averageScore}
              points={points}
            />
            <XpEvolution scores={recentScores} />
            <DistributionCard subjects={subjectProgress} />
          </View>

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <DashboardCard title="Progreso por asignatura" className={isDesktop ? 'flex-[1.55]' : ''}>
              <View style={{ gap: 10 }}>
                {subjectProgress.length > 0 ? (
                  subjectProgress.map((subject) => (
                    <SubjectProgressRow key={subject.id} subject={subject} />
                  ))
                ) : (
                  <EmptyProgress />
                )}
              </View>
              <CardLink label="Ver todas mis clases" onPress={() => showComingSoon('Todas tus clases')} />
            </DashboardCard>

            <View className={isDesktop ? 'flex-1 gap-5' : 'gap-5'}>
              <DashboardCard
                title="Logros recientes"
                actionLabel="Ver todos"
                onAction={() => router.push('/(student)/badges' as any)}
              >
                <View style={{ gap: 12 }}>
                  {badges.slice(0, 4).map((achievement) => (
                    <AchievementRow
                      key={achievement.title}
                      achievement={achievement}
                      onPress={() => router.push('/(student)/badges' as any)}
                    />
                  ))}
                </View>
              </DashboardCard>

              <WeeklyGoal completed={weeklyCompleted} remainingText={weeklyRemainingText} />
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
  savedScores,
  averageScore,
  points,
}: {
  progressPercent: number
  completedClasses: number
  totalClasses: number
  savedScores: number
  averageScore: number | null
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
          <SummaryStat icon="checkmark-done" color="#3B82F6" label="Materias con nota" value={`${completedClasses} / ${totalClasses}`} />
          <SummaryStat icon="trophy" color="#EC4899" label="Notas guardadas" value={String(savedScores)} />
          <SummaryStat icon="analytics" color="#F6A64A" label="Media general" value={averageScore === null ? 'Sin notas' : `${averageScore.toLocaleString()} XP`} />
          <SummaryStat icon="flash" color="#FBBF24" label="XP total acumulada" value={`${points.toLocaleString()} XP`} />
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

function XpEvolution({ scores }: { scores: RecentScore[] }) {
  const maxScore = Math.max(...scores.map((score) => score.value), 1)

  return (
    <View className="flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-5 flex-row items-center justify-between">
        <Text className="text-[15px] font-black text-white">Últimas notas</Text>
        <View className="flex-row items-center gap-2 rounded-lg border border-[#1A3155] bg-[#0D1D3B] px-3 py-2">
          <Text className="text-[12px] text-[#AFC2DB]">subject_scores</Text>
          <Ionicons name="chevron-down" size={13} color="#AFC2DB" />
        </View>
      </View>
      {scores.length > 0 ? (
        <>
          <View className="h-44 justify-end border-b border-l border-[#183052]">
            <View className="ml-5 flex-row items-end justify-between">
              {scores.map((score, index) => (
                <View key={`${score.label}-${index}`} className="items-center">
                  <Text className="mb-2 text-[11px] font-bold text-[#DDE7F4]">{score.value.toLocaleString()}</Text>
                  <View className="w-8 justify-end" style={{ height: 132 }}>
                    <View
                      className="w-full rounded-t-md bg-[#5D5FEF]"
                      style={{ height: Math.max(18, (score.value / maxScore) * 132), opacity: index === 0 ? 1 : 0.68 }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View className="ml-5 mt-2 flex-row justify-between">
            {scores.map((score, index) => (
              <Text key={`${score.label}-label-${index}`} className="max-w-[58px] text-[10px] text-[#8FA7C7]" numberOfLines={1}>
                {score.label}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <View className="h-44 items-center justify-center rounded-xl border border-dashed border-[#20375E] bg-[#0D1D3B]">
          <Ionicons name="analytics-outline" size={30} color="#60799C" />
          <Text className="mt-3 text-center text-[12px] text-[#AFC2DB]">Aún no hay notas guardadas.</Text>
        </View>
      )}
    </View>
  )
}

function DistributionCard({ subjects }: { subjects: SubjectProgress[] }) {
  return (
    <View className="flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <Text className="mb-5 text-[15px] font-black text-white">Distribución por asignatura</Text>
      {subjects.length > 0 ? (
        <View className="flex-row items-center gap-7">
          <View className="h-32 w-32 items-center justify-center rounded-full border-[24px] border-[#43D991] bg-[#061126]">
            <Text className="text-center text-[11px] font-bold text-[#AFC2DB]">Media real</Text>
          </View>
          <View className="min-w-0 flex-1" style={{ gap: 11 }}>
            {subjects.slice(0, 5).map((subject) => (
              <View key={subject.id} className="flex-row items-center gap-3">
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                <Text className="min-w-0 flex-1 text-[12px] font-semibold text-[#DDE7F4]" numberOfLines={1}>{subject.name}</Text>
                <Text className="text-[12px] text-[#AFC2DB]">
                  {subject.averageScore === null ? 'Sin nota' : `${subject.averageScore.toLocaleString()} XP`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <EmptyProgress />
      )}
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
  subject: SubjectProgress
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
        <View className="h-full rounded-full" style={{ width: `${subject.barPercent}%`, backgroundColor: subject.color }} />
      </View>
      <Text className="w-24 text-right text-[12px] text-[#AFC2DB]">
        {subject.averageScore === null ? 'Sin nota' : `${subject.averageScore.toLocaleString()} XP`}
      </Text>
      <View className="mx-4 hidden w-28 border-l border-[#172A4A] pl-4 lg:flex">
        <Text className="text-[10px] text-[#60799C]">Notas</Text>
        <Text className="text-[12px] font-bold text-[#DDE7F4]">{subject.scoreCount}</Text>
      </View>
      <View className="hidden w-16 lg:flex">
        <Text className="text-[10px] text-[#60799C]">Mejor</Text>
        <Text className="text-[12px] font-bold text-[#DDE7F4]">
          {subject.bestScore === null ? '-' : subject.bestScore.toLocaleString()}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={16} color="#7F91AD" />
    </View>
  )
}

function EmptyProgress() {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#20375E] bg-[#0D1D3B] px-4 py-6">
      <Ionicons name="stats-chart-outline" size={34} color="#60799C" />
      <Text className="mt-3 text-center font-bold text-white">Sin progreso real todavía</Text>
      <Text className="mt-1 text-center text-[12px] leading-5 text-[#8FA7C7]">
        Cuando completes una partida, se guardará tu nota en subject_scores.
      </Text>
    </View>
  )
}

function AchievementRow({ achievement, onPress }: { achievement: StudentBadge; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`flex-row items-center gap-4 rounded-xl bg-[#0D1D3B] p-3 ${achievement.unlocked ? '' : 'opacity-70'}`}>
      <View
        className="h-14 w-14 items-center justify-center rounded-2xl border-2"
        style={{ backgroundColor: `${achievement.color}20`, borderColor: achievement.color }}
      >
        <Ionicons name={achievement.unlocked ? achievement.icon : 'lock-closed'} size={26} color={achievement.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-black text-white">{achievement.title}</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]">{achievement.requirement}</Text>
      </View>
      <View className="items-end">
        <Text className="text-[11px] text-[#8FA7C7]">{achievement.statusLabel}</Text>
        <Text className="mt-1 text-[11px] font-bold text-[#9B6CFF]">{achievement.xp}</Text>
      </View>
    </Pressable>
  )
}

function WeeklyGoal({ completed, remainingText }: { completed: number; remainingText: string }) {
  const percent = Math.min(100, (completed / 10) * 100)

  return (
    <View className="overflow-hidden rounded-2xl border border-[#3E2A8E] bg-[#221052] p-5">
      <View className="absolute bottom-[-24px] right-[-10px] h-28 w-36 rounded-full bg-[#4F2BC0]/50" />
      <Text className="text-[15px] font-black text-white">Meta semanal</Text>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="font-bold text-white">Completa 10 preguntas esta semana</Text>
        <View className="flex-row items-center gap-2">
          <Ionicons name="time-outline" size={14} color="#C4B5FD" />
          <Text className="text-[12px] text-[#C4B5FD]">{remainingText}</Text>
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
      <Link href="/(student)/homeStudent" asChild>
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

      <Link href="/(student)/settings" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="settings-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Configuración</Text>
        </Pressable>
      </Link>
    </View>
  )
}

function buildSubjectRows(subjects: Subject[], scores: ScoreRow[]): SubjectProgress[] {
  const colors = ['#43D991', '#8B5CF6', '#3B82F6', '#F6A64A', '#718096']
  const icons: (keyof typeof Ionicons.glyphMap)[] = ['book', 'calculator', 'flask', 'business', 'ellipsis-horizontal']
  const scoresBySubject = scores.reduce<Record<number, number[]>>((acc, score) => {
    if (score.subject_id === null || score.max_score === null) return acc
    if (!acc[score.subject_id]) acc[score.subject_id] = []
    acc[score.subject_id].push(score.max_score)
    return acc
  }, {})

  const averages = subjects.map((subject) => {
    const subjectScores = scoresBySubject[subject.id] || []
    if (subjectScores.length === 0) return 0
    return Math.round(subjectScores.reduce((total, score) => total + score, 0) / subjectScores.length)
  })
  const maxAverage = Math.max(...averages, 1)

  return subjects.map((subject, index) => {
    const subjectScores = scoresBySubject[subject.id] || []
    const averageScore = subjectScores.length > 0
      ? Math.round(subjectScores.reduce((total, score) => total + score, 0) / subjectScores.length)
      : null
    const bestScore = subjectScores.length > 0 ? Math.max(...subjectScores) : null

    return {
      id: subject.id,
      name: subject.name,
      detail: subject.description || 'Preguntas y ejercicios disponibles',
      icon: icons[index] || 'book',
      color: subject.theme_color || colors[index] || '#43D991',
      averageScore,
      bestScore,
      scoreCount: subjectScores.length,
      barPercent: averageScore === null ? 0 : Math.max(8, Math.round((averageScore / maxAverage) * 100)),
    }
  })
}

function buildRecentScores(scores: ScoreRow[]): RecentScore[] {
  return scores
    .filter((score) => score.max_score !== null)
    .slice(0, 7)
    .map((score, index) => {
      const subjectData = score.subjects
      const subjectName = Array.isArray(subjectData) ? subjectData[0]?.name : subjectData?.name

      return {
        label: subjectName || `Nota ${index + 1}`,
        value: score.max_score || 0,
      }
    })
}

function getTimeUntilSundayLabel() {
  const now = new Date()
  const endOfSunday = new Date(now)
  const daysUntilSunday = (7 - now.getDay()) % 7
  endOfSunday.setDate(now.getDate() + daysUntilSunday)
  endOfSunday.setHours(23, 59, 59, 999)

  const diffMs = Math.max(0, endOfSunday.getTime() - now.getTime())
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  if (days <= 0) return `${hours}h restantes`
  return `${days}d ${hours}h restantes`
}

function getStartOfWeekMonday(date: Date) {
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}
