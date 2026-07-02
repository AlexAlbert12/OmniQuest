import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
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
  type StudentBadge,
  type StudentBadgeScore,
} from '../../lib/studentBadges'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { fetchStudentProgressSummary, type StudentProgressSubject } from '../../lib/studentProgress'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentHeaderAvatar from '../../components/student/StudentHeaderAvatar'
import StudentDashboardCard from '../../components/student/StudentDashboardCard'
import { formatShortDate } from '../../lib/dateFormat'
import { useAppTheme } from '../../lib/appTheme'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
}

type ScoreRow = {
  subject_id: number | null
  classroom_id?: number | null
  max_score: number | null
  played_at?: string | null
  played_days?: string[] | null
  correct_answers?: number | null
  subjects?: { name: string } | { name: string }[] | null
}

type SubjectProgress = {
  id: number
  classroomId?: number | null
  name: string
  detail: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  averageScore: number | null
  bestScore: number | null
  totalXp: number
  scoreCount: number
  totalQuestions: number
  failedQuestions: number
  pendingQuestions: number
  barPercent: number
}

type RecentScore = {
  label: string
  meta: string
  value: number
}

type ReinforcementQuestionRelation = {
  id: number
  text: string | null
  type: string | null
  subject_id: number | null
  topic_id: number | null
  subjects?: { name: string } | { name: string }[] | null
  subject_topics?: { title: string } | { title: string }[] | null
}

type ReinforcementAttemptRow = {
  id: number
  is_correct: boolean | null
  attempted_at: string | null
  questions?: ReinforcementQuestionRelation | ReinforcementQuestionRelation[] | null
}

type ReinforcementArea = {
  id: string
  title: string
  detail: string
  badge: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  failedCount: number
  accuracyPercent: number
  totalAttempts: number
  subjectId?: number
  topicId?: number | null
  topicName?: string
  actionLabel: string
}

export default function ProgressScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subjectProgress, setSubjectProgress] = useState<SubjectProgress[]>([])
  const [recentScores, setRecentScores] = useState<RecentScore[]>([])
  const [weeklyAttemptsCount, setWeeklyAttemptsCount] = useState(0)
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [reinforcementAreas, setReinforcementAreas] = useState<ReinforcementArea[]>([])
  const [loading, setLoading] = useState(true)
  const { accentColor } = useAppTheme()

  const isDesktop = width >= 1024
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const totalClasses = subjectProgress.length
  const savedScores = subjectProgress.reduce((total, subject) => total + subject.scoreCount, 0)
  const totalQuestions = subjectProgress.reduce((total, subject) => total + subject.totalQuestions, 0)
  const progressPercent = totalQuestions > 0 ? Math.round((savedScores / totalQuestions) * 100) : 0
  const failedQuestions = subjectProgress.reduce((total, subject) => total + subject.failedQuestions, 0)
  const accuracyPercent = scores.length > 0
    ? Math.round(
        (scores.reduce((total, score) => total + (score.correct_answers ?? 0), 0) / Math.max(savedScores, 1)) * 100
      )
    : 0
  const safeProgressPercent = Math.min(100, Math.max(0, progressPercent))
  const safeAccuracyPercent = Math.min(100, Math.max(0, accuracyPercent))
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

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoIso = thirtyDaysAgo.toISOString()

      const [profileResult, scoresResult, weeklyAttemptsResult, progressResult, reinforcementResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, points, avatar').eq('id', userId).single(),
        supabase
          .from('subject_scores')
          .select('subject_id, classroom_id, max_score, played_at, played_days, correct_answers, subjects(name)')
          .eq('student_id', userId)
          .order('played_at', { ascending: false }),
        supabase
          .from('attempt_history')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', userId)
          .gte('attempted_at', weekStartIso)
          .lte('attempted_at', nowIso),
        fetchStudentProgressSummary(userId),
        supabase
          .from('attempt_history')
          .select(`
          id,
          is_correct,
          attempted_at,
          questions (
            id,
            text,
            type,
            subject_id,
            topic_id,
            subjects ( name ),
            subject_topics ( title )
          )
        `)
          .eq('student_id', userId)
          .gte('attempted_at', thirtyDaysAgoIso)
          .order('attempted_at', { ascending: false }),
      ])

      if (profileResult.error) throw profileResult.error
      if (scoresResult.error) throw scoresResult.error
      if (weeklyAttemptsResult.error) throw weeklyAttemptsResult.error
      if (reinforcementResult.error) throw reinforcementResult.error

      setProfile(profileResult.data)
      setWeeklyAttemptsCount(weeklyAttemptsResult.count || 0)
      const scores = (scoresResult.data || []) as ScoreRow[]

      setSubjectProgress(buildSubjectRows(progressResult.subjects, scores))
      setRecentScores(buildRecentScores(scores))
      setScores(scores)
      setReinforcementAreas(buildReinforcementAreas((reinforcementResult.data || []) as ReinforcementAttemptRow[]))
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color={accentColor} />
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
                <Ionicons name="stats-chart" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Progreso</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Analiza tu aprendizaje y sigue mejorando cada día.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <NotificationBadge />
              <StudentHeaderAvatar />
            </View>
          </View>

          <View className={isDesktop ? 'flex-row flex-wrap items-stretch justify-between gap-4' : 'gap-4'}>
            <ProgressOverviewCard
              progressPercent={safeProgressPercent}
              accentColor={accentColor}
              className={isDesktop ? 'flex-[1] min-w-[250px] max-w-[270px]' : ''}
            />
            <ProgressMetricCard
              icon="help-circle"
              title="Preguntas respondidas"
              value={String(savedScores)}
              detail={weeklyAttemptsCount > 0 ? `Esta semana: ${weeklyAttemptsCount}` : 'Empieza tu primera práctica'}
              color="#58B5FF"
              className={isDesktop ? 'flex-1 min-w-[200px] max-w-[220px]' : ''}
            />
            <ProgressMetricCard
              icon="speedometer"
              title="Precisión global"
              value={`${safeAccuracyPercent}%`}
              detail={safeAccuracyPercent >= 80 ? '¡Excelente!' : failedQuestions > 0 ? 'Mejora repasando' : 'Buen ritmo'}
              detailColor={safeAccuracyPercent >= 70 ? '#22C55E' : '#FBBF24'}
              color="#F6A64A"
              className={isDesktop ? 'flex-1 min-w-[200px] max-w-[220px]' : ''}
            />
            <ProgressMetricCard
              icon="refresh-circle"
              title="Fallos para repasar"
              value={String(failedQuestions)}
              detail={failedQuestions > 0 ? 'Prioridad alta' : 'Sin pendientes'}
              detailColor={failedQuestions > 0 ? '#FB7185' : '#22C55E'}
              color="#FB7185"
              className={isDesktop ? 'flex-1 min-w-[200px] max-w-[220px]' : ''}
            />
            <ProgressMetricCard
              icon="flash"
              title="XP total acumulada"
              value={`${points.toLocaleString()} XP`}
              detail={points > 0 ? 'Sigue así' : 'Aún sin XP'}
              color="#FBBF24"
              className={isDesktop ? 'flex-1 min-w-[200px] max-w-[220px]' : ''}
            />
          </View>

          <View className={isDesktop ? 'mt-5 flex-row flex-wrap items-stretch gap-5' : 'mt-5 gap-5'}>
            <ReinforcementCard
              className={isDesktop ? 'flex-[1.55] min-w-[360px]' : ''}
              areas={reinforcementAreas}
              onSeeAll={() => router.push('/(student)/activity-log' as any)}
              onReview={(area) => {
                if (area.subjectId) {
                  router.push({
                    pathname: '/(student)/play/[id]',
                    params: {
                      id: String(area.subjectId),
                      topicId: area.topicId === null || area.topicId === undefined ? 'general' : String(area.topicId),
                      topicName: area.topicName || area.title,
                      review: 'failed',
                    },
                  } as any)
                } else {
                  router.push('/(student)/activity-log' as any)
                }
              }}
            />

            <XpEvolution
              scores={recentScores}
              className={isDesktop ? 'flex-1 min-w-[320px]' : ''}
              onSeeAll={() => router.push('/(student)/activity-log' as any)}
            />
          </View>

          <View className={isDesktop ? 'mt-5 flex-row flex-wrap items-stretch gap-5' : 'mt-5 gap-5'}>
            <StudentDashboardCard
              title="Progreso por curso"
              actionLabel="Ver todos mis cursos"
              onAction={() => router.push('/(student)/classes' as any)}
              className={isDesktop ? 'flex-[1.55] min-w-[360px]' : ''}
            >
              <View style={{ gap: 10 }}>
                {subjectProgress.length > 0 ? (
                  subjectProgress.map((subject) => (
                    <SubjectProgressRow
                      key={`${subject.id}:${subject.classroomId ?? 'general'}`}
                      subject={subject}
                      onPress={() =>
                        router.push({
                          pathname: '/(student)/class/[id]',
                          params: {
                            id: String(subject.id),
                            ...(subject.classroomId ? { classroomId: String(subject.classroomId) } : {}),
                          },
                        } as any)
                      }
                    />
                  ))
                ) : (
                  <EmptyProgress />
                )}
              </View>
            </StudentDashboardCard>

            <StudentDashboardCard
              title="Logros recientes"
              actionLabel="Ver todos"
              onAction={() => router.push('/(student)/badges' as any)}
              className={isDesktop ? 'flex-1 min-w-[320px]' : ''}
            >
              <View style={{ gap: 10 }}>
                {badges.slice(0, 4).map((achievement) => (
                  <AchievementRow
                    key={achievement.title}
                    achievement={achievement}
                    onPress={() => router.push('/(student)/badges' as any)}
                  />
                ))}
              </View>
            </StudentDashboardCard>
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="progress" /> : null}
    </View>
  )
}

function ProgressOverviewCard({
  progressPercent,
  accentColor,
  className = '',
}: {
  progressPercent: number
  accentColor: string
  className?: string
}) {
  return (
    <View className={`min-w-[210px] rounded-2xl border border-[#1A3155] bg-[#09162C] p-4 ${className}`}>
      <View className="flex-row items-center gap-4">
        <View className="relative h-24 w-24 items-center justify-center rounded-full bg-[#101B43]">
          <View className="absolute inset-0 rounded-full border border-white/20" style={{ borderColor: accentColor }} />
          <Text className="text-[24px] font-black text-white">{progressPercent}%</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-black text-[#DDE7F4]">Avance de cursos</Text>
        </View>
      </View>
    </View>
  )
}

function ProgressMetricCard({
  icon,
  title,
  value,
  detail,
  color,
  detailColor = '#8FA7C7',
  className = '',
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  value: string
  detail: string
  color: string
  detailColor?: string
  className?: string
}) {
  return (
    <View className={`min-w-[175px] rounded-2xl border border-[#1A3155] bg-[#09162C] p-5 ${className}`}>
      <View className="flex-row items-start gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
          <Ionicons name={icon} size={23} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-bold leading-5 text-[#AFC2DB]" numberOfLines={2}>
            {title}
          </Text>
          <Text className="mt-2 text-[26px] font-black text-white" numberOfLines={1}>
            {value}
          </Text>
          <Text className="mt-1 text-[12px] font-bold" style={{ color: detailColor }} numberOfLines={1}>
            {detail}
          </Text>
        </View>
      </View>
    </View>
  )
}

function XpEvolution({
  scores,
  className = '',
  onSeeAll,
}: {
  scores: RecentScore[]
  className?: string
  onSeeAll?: () => void
}) {
  const maxScore = Math.max(...scores.map((score) => score.value), 1)
  const { accentColor } = useAppTheme()

  return (
    <StudentDashboardCard
      title="Últimos resultados"
      actionLabel={onSeeAll ? 'Ver todas' : undefined}
      onAction={onSeeAll}
      className={className}
    >
      {scores.length > 0 ? (
        <View style={{ gap: 16 }}>
          {scores.slice(0, 3).map((score, index) => {
            const percent = score.value <= 0 ? 0 : Math.max(8, Math.round((score.value / maxScore) * 100))

            return (
              <View key={`${score.label}-${score.meta}-${index}`}>
                <View className="mb-2 flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1 flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#13284A]">
                      <Ionicons name={index === 0 ? 'sparkles' : 'analytics'} size={18} color={index === 0 ? '#FBBF24' : '#43D991'} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[13px] font-black text-[#DDE7F4]" numberOfLines={1}>
                        {score.label}
                      </Text>
                      <Text className="mt-1 text-[11px] text-[#60799C]" numberOfLines={1}>{score.meta}</Text>
                    </View>
                  </View>
                  <Text className="text-[13px] font-black text-white">{score.value.toLocaleString()} XP</Text>
                </View>
                <View className="ml-[52px] h-2.5 overflow-hidden rounded-full bg-[#13294C]">
                  {percent > 0 ? (
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${percent}%`, opacity: index === 0 ? 1 : 0.72, backgroundColor: accentColor }}
                    />
                  ) : null}
                </View>
              </View>
            )
          })}
        </View>
      ) : (
        <View className="h-44 items-center justify-center rounded-xl border border-dashed border-[#20375E] bg-[#0D1D3B]">
          <Ionicons name="analytics-outline" size={30} color="#60799C" />
          <Text className="mt-3 text-center text-[13px] text-[#AFC2DB]">Aún no hay puntuaciones guardadas.</Text>
        </View>
      )}
    </StudentDashboardCard>
  )
}

function splitReinforcementDetail(detail: string) {
  const parts = detail.split(' · ')
  if (parts.length >= 2) {
    return { main: parts.slice(0, -1).join(' · '), context: parts[parts.length - 1] }
  }
  return { main: '', context: detail }
}

function ReinforcementCard({
  areas,
  onReview,
  onSeeAll,
  className = '',
}: {
  areas: ReinforcementArea[]
  onReview: (area: ReinforcementArea) => void
  onSeeAll?: () => void
  className?: string
}) {
  return (
    <StudentDashboardCard
      title="Áreas a reforzar"
      actionLabel={onSeeAll ? 'Ver todas' : undefined}
      onAction={onSeeAll}
      className={className}
    >
      {areas.length > 0 ? (
        <View style={{ gap: 10 }}>
          {areas.slice(0, 3).map((area) => {
            const safeAccuracy = Math.min(100, Math.max(0, area.accuracyPercent))
            const detail = splitReinforcementDetail(area.detail)

            return (
              <Pressable
                key={area.id}
                onPress={() => onReview(area)}
                className="flex-row items-center gap-4 rounded-xl border border-[#1A3155] bg-[#0D1D3B] p-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${area.color}24` }}
                >
                  <Ionicons name={area.icon} size={24} color={area.color} />
                </View>

                <View className="min-w-0 flex-[1.25]">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-[15px] font-black text-white" numberOfLines={1}>
                      {area.title}
                    </Text>
                    {detail.main ? (
                      <Text className="text-[13px] font-bold text-[#AFC2DB]" numberOfLines={1}>
                        · {detail.main}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={1}>
                    {detail.context}
                  </Text>
                </View>

                <View className="hidden min-w-[180px] flex-[0.65] flex-row items-center gap-3 md:flex">
                  <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#13294C]">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${safeAccuracy}%`, backgroundColor: area.color }}
                    />
                  </View>
                  <Text className="w-12 text-right text-[18px] font-black" style={{ color: area.color }}>
                    {safeAccuracy}%
                  </Text>
                </View>

                <Ionicons name="arrow-forward" size={18} color="#8B5CF6" />
              </Pressable>
            )
          })}
        </View>
      ) : (
        <View className="items-center rounded-xl border border-dashed border-[#20375E] bg-[#0D1D3B] px-4 py-6">
          <Ionicons name="sparkles-outline" size={34} color="#43D991" />
          <Text className="mt-3 text-center font-black text-white">Sin áreas críticas ahora mismo</Text>
          <Text className="mt-1 max-w-[560px] text-center text-[13px] leading-5 text-[#8FA7C7]">
            Cuando acumules varios intentos, OmniQuest detectará automáticamente los temas y tipos de pregunta que más necesitas repasar.
          </Text>
        </View>
      )}
    </StudentDashboardCard>
  )
}

function SubjectProgressRow({
  onPress,
  subject,
}: {
  onPress: () => void
  subject: SubjectProgress
}) {
  const safePercent = Math.min(100, Math.max(0, subject.barPercent))

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${subject.color}24` }}>
        <Ionicons name={subject.icon} size={24} color={subject.color} />
      </View>

      <View className="min-w-0 flex-[1.45]">
        <View className="flex-row items-center gap-2">
          <Text className="min-w-0 flex-shrink text-[15px] font-black text-white" numberOfLines={1}>
            {subject.name}
          </Text>
          {subject.classroomId ? (
            <View className="hidden rounded-full bg-[#123154] px-2 py-1 md:flex">
              <Text className="text-[10px] font-black text-[#9FD6FF]">Clase principal</Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>
          {subject.detail}
        </Text>
        <View className="mt-2 h-2 overflow-hidden rounded-full bg-[#13294C] md:hidden">
          <View className="h-full rounded-full" style={{ width: `${safePercent}%`, backgroundColor: subject.color }} />
        </View>
      </View>

      <View className="hidden min-w-[130px] flex-[0.55] items-end md:flex">
        <Text className="text-[18px] font-black text-white">{safePercent}%</Text>
        <Text className="text-[11px] text-[#8FA7C7]">completado</Text>
        <View className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full" style={{ width: `${safePercent}%`, backgroundColor: subject.color }} />
        </View>
      </View>

      <View className="hidden w-24 border-l border-[#172A4A] pl-4 lg:flex">
        <Text className="text-[12px] text-[#60799C]">Respondidas</Text>
        <Text className="text-[13px] font-bold text-[#DDE7F4]">{subject.scoreCount} / {subject.totalQuestions}</Text>
      </View>
      <View className="hidden w-20 border-l border-[#172A4A] pl-4 lg:flex">
        <Text className="text-[12px] text-[#60799C]">Fallos</Text>
        <Text
          className="text-[13px] font-bold"
          style={{ color: subject.failedQuestions > 0 ? '#FB7185' : '#43D991' }}
        >
          {subject.failedQuestions}
        </Text>
      </View>
      <View className="hidden w-24 border-l border-[#172A4A] pl-4 xl:flex">
        <Text className="text-[12px] text-[#60799C]">Pendientes</Text>
        <Text className="text-[13px] font-bold text-[#DDE7F4]">{subject.pendingQuestions}</Text>
      </View>
      <View className="hidden w-16 xl:flex">
        <Text className="text-[12px] text-[#60799C]">Mejor</Text>
        <Text className="text-[12px] font-bold text-[#DDE7F4]">
          {subject.bestScore === null ? '-' : `${subject.bestScore.toLocaleString()} XP`}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={16} color="#7F91AD" />
    </Pressable>
  )
}

function EmptyProgress() {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#20375E] bg-[#0D1D3B] px-4 py-6">
      <Ionicons name="stats-chart-outline" size={34} color="#60799C" />
      <Text className="mt-3 text-center font-bold text-white">Sin progreso real todavía</Text>
      <Text className="mt-1 text-center text-[13px] leading-5 text-[#8FA7C7]">
        Cuando completes una partida, se guardará tu puntuación y se actualizará tu avance.
      </Text>
    </View>
  )
}

function AchievementRow({ achievement, onPress }: { achievement: StudentBadge; onPress: () => void }) {
  const { accentColor } = useAppTheme()

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
        <Text className="mt-1 text-[13px] text-[#AFC2DB]">{achievement.requirement}</Text>
      </View>
      <View className="items-end">
        <Text className="text-[13px] text-[#8FA7C7]">{achievement.statusLabel}</Text>
        <Text className="mt-1 text-[13px] font-bold" style={{ color: accentColor }}>{achievement.xp}</Text>
      </View>
    </Pressable>
  )
}

function buildSubjectRows(subjects: StudentProgressSubject[], scores: ScoreRow[]): SubjectProgress[] {
  const colors = ['#43D991', '#8B5CF6', '#3B82F6', '#F6A64A', '#718096']
  const icons: (keyof typeof Ionicons.glyphMap)[] = ['book', 'calculator', 'flask', 'business', 'ellipsis-horizontal']
  const scoresBySubject = scores.reduce<Record<string, number[]>>((acc, score) => {
    if (score.subject_id === null || score.max_score === null) return acc
    const key = `${score.subject_id}:${score.classroom_id ?? 'general'}`
    if (!acc[key]) acc[key] = []
    acc[key].push(score.max_score)
    return acc
  }, {})

  return subjects.map((subject, index) => {
    const subjectScores = scoresBySubject[`${subject.id}:${subject.classroomId ?? 'general'}`] || []
    const averageScore = subjectScores.length > 0
      ? Math.round(subjectScores.reduce((total, score) => total + score, 0) / subjectScores.length)
      : null
    const bestScore = subjectScores.length > 0 ? Math.max(...subjectScores) : null

    const classroomLabel = subject.classroomName || 'Clase principal'
    const questionsLabel = `${subject.totalQuestions} ${subject.totalQuestions === 1 ? 'pregunta' : 'preguntas'}`
    const topicsLabel = `${Math.max(1, subject.totalTopics)} ${Math.max(1, subject.totalTopics) === 1 ? 'tema' : 'temas'}`

    return {
      id: subject.id,
      classroomId: subject.classroomId ?? null,
      name: subject.name,
      detail: `${classroomLabel} · ${topicsLabel} · ${questionsLabel}`,
      icon: icons[index] || 'book',
      color: subject.theme_color || colors[index] || '#43D991',
      averageScore,
      bestScore,
      totalXp: subjectScores.reduce((total, score) => total + score, 0),
      scoreCount: subject.answeredQuestions,
      totalQuestions: subject.totalQuestions,
      failedQuestions: subject.failedQuestions,
      pendingQuestions: subject.pendingQuestions,
      barPercent: subject.percent,
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
        meta: formatShortDate(score.played_at),
        value: score.max_score || 0,
      }
    })
}

function getStartOfWeekMonday(date: Date) {
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function buildReinforcementAreas(rows: ReinforcementAttemptRow[]): ReinforcementArea[] {
  type TopicStats = {
    subjectId: number
    topicId: number | null
    topicName: string
    subjectName: string
    totalAttempts: number
    correctAttempts: number
    failedCount: number
    lastAttemptAt: string
  }

  type TypeStats = {
    type: string
    totalAttempts: number
    correctAttempts: number
    failedCount: number
  }

  const topicStats = new Map<string, TopicStats>()
  const typeStats = new Map<string, TypeStats>()

  rows.forEach((row) => {
    const question = normalizeSingleRelation(row.questions)
    if (!question || question.subject_id === null) return

    const isCorrect = row.is_correct === true
    const topic = normalizeSingleRelation(question.subject_topics)
    const subject = normalizeSingleRelation(question.subjects)

    const topicId = question.topic_id ?? null
    const topicName = topic?.title || 'Tema general'
    const subjectName = subject?.name || 'Curso'
    const topicKey = `${question.subject_id}:${topicId ?? 'general'}`

    const currentTopic = topicStats.get(topicKey) || {
      subjectId: question.subject_id,
      topicId,
      topicName,
      subjectName,
      totalAttempts: 0,
      correctAttempts: 0,
      failedCount: 0,
      lastAttemptAt: row.attempted_at || '',
    }

    currentTopic.totalAttempts += 1
    currentTopic.correctAttempts += isCorrect ? 1 : 0
    currentTopic.failedCount += isCorrect ? 0 : 1

    if ((row.attempted_at || '') > currentTopic.lastAttemptAt) {
      currentTopic.lastAttemptAt = row.attempted_at || ''
    }

    topicStats.set(topicKey, currentTopic)

    const questionType = question.type || 'unknown'
    const currentType = typeStats.get(questionType) || {
      type: questionType,
      totalAttempts: 0,
      correctAttempts: 0,
      failedCount: 0,
    }

    currentType.totalAttempts += 1
    currentType.correctAttempts += isCorrect ? 1 : 0
    currentType.failedCount += isCorrect ? 0 : 1

    typeStats.set(questionType, currentType)
  })

  const topicAreas: ReinforcementArea[] = Array.from(topicStats.values())
    .filter((item) => item.failedCount > 0)
    .map((item) => {
      const accuracyPercent = Math.round((item.correctAttempts / Math.max(item.totalAttempts, 1)) * 100)

      return {
        id: `topic-${item.subjectId}-${item.topicId ?? 'general'}`,
        title: item.topicName,
        detail: `${item.failedCount} ${item.failedCount === 1 ? 'error reciente' : 'errores recientes'} · ${item.subjectName}`,
        badge: 'Tema',
        icon: 'alert-circle',
        color: '#FB7185',
        failedCount: item.failedCount,
        accuracyPercent,
        totalAttempts: item.totalAttempts,
        subjectId: item.subjectId,
        topicId: item.topicId,
        topicName: item.topicName,
        actionLabel: 'Repasar',
      } satisfies ReinforcementArea
    })
    .sort((a, b) => {
      if (b.failedCount !== a.failedCount) return b.failedCount - a.failedCount
      return a.accuracyPercent - b.accuracyPercent
    })
    .slice(0, 3)

  const typeAreas: ReinforcementArea[] = Array.from(typeStats.values())
    .filter((item) => item.totalAttempts >= 3 && item.failedCount > 0)
    .map((item) => {
      const accuracyPercent = Math.round((item.correctAttempts / Math.max(item.totalAttempts, 1)) * 100)

      return {
        id: `type-${item.type}`,
        title: getQuestionTypeLabel(item.type),
        detail: `${item.failedCount} fallos en ${item.totalAttempts} intentos`,
        badge: 'Tipo de pregunta',
        icon: getQuestionTypeIcon(item.type),
        color: '#F6A64A',
        failedCount: item.failedCount,
        accuracyPercent,
        totalAttempts: item.totalAttempts,
        actionLabel: 'Ver historial',
      } satisfies ReinforcementArea
    })
    .filter((item) => item.accuracyPercent <= 60)
    .sort((a, b) => {
      if (a.accuracyPercent !== b.accuracyPercent) return a.accuracyPercent - b.accuracyPercent
      return b.failedCount - a.failedCount
    })
    .slice(0, 2)

  return [...topicAreas, ...typeAreas].slice(0, 4)
}

function normalizeSingleRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation ?? null
}

function getQuestionTypeLabel(type: string) {
  switch (type) {
    case 'multiple_choice':
      return 'Preguntas tipo test'
    case 'true_false':
      return 'Verdadero o falso'
    case 'open_answer':
      return 'Preguntas abiertas'
    case 'fill_blank':
      return 'Rellenar huecos'
    case 'ordering':
      return 'Ordenar elementos'
    case 'match_pairs':
      return 'Unir parejas'
    case 'drag_drop':
      return 'Asignar elementos'
    default:
      return 'Tipo de pregunta'
  }
}

function getQuestionTypeIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'multiple_choice':
      return 'list-circle'
    case 'true_false':
      return 'checkmark-circle'
    case 'open_answer':
      return 'chatbubble-ellipses'
    case 'fill_blank':
      return 'create'
    case 'ordering':
      return 'reorder-three'
    case 'match_pairs':
      return 'git-compare'
    case 'drag_drop':
      return 'move'
    default:
      return 'help-circle'
  }
}
