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
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/student/StudentSidebar'
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
import StudentEmptyState from '../../components/student/StudentEmptyState'
import StudentKpiCard from '../../components/student/StudentKpiCard'
import StudentListRow from '../../components/student/StudentListRow'
import StudentPrimaryLearningCTA from '../../components/student/StudentPrimaryLearningCTA'
import { formatShortDate } from '../../lib/dateFormat'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'

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
  const recommendedArea = reinforcementAreas[0] ?? null

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

  const handleReviewArea = useCallback((area: ReinforcementArea) => {
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
      return
    }

    router.push('/(student)/activity-log' as any)
  }, [router])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color={accentColor} />
        <Text className="mt-4 text-[#8FA7C7]">Analizando tu progreso...</Text>
      </View>
    )
  }

  if (!isDesktop) {
    return (
      <MobileStudentProgress
        level={level}
        points={points}
        nextLevelProgress={nextLevelProgress}
        progressPercent={safeProgressPercent}
        answeredQuestions={savedScores}
        weeklyAttemptsCount={weeklyAttemptsCount}
        accuracyPercent={safeAccuracyPercent}
        failedQuestions={failedQuestions}
        streakDays={badgeMetrics.streakDays}
        subjectProgress={subjectProgress}
        recentScores={recentScores}
        reinforcementAreas={reinforcementAreas}
        accentColor={accentColor}
      />
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
            paddingBottom: isDesktop ? 28 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-3">
                <Ionicons name="stats-chart" size={isDesktop ? 40 : 34} color="#9FD6FF" />
                <Text className={`${isDesktop ? 'text-[40px]' : 'text-[32px]'} flex-shrink font-black text-white`} numberOfLines={1}>Progreso</Text>
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
              title="Preguntas para practicar"
              value={String(failedQuestions)}
              detail={failedQuestions > 0 ? 'Plan recomendado' : 'Sin pendientes'}
              detailColor={failedQuestions > 0 ? '#FBBF24' : '#22C55E'}
              color="#FBBF24"
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

          <StudentPrimaryLearningCTA
            className="mt-5"
            icon={recommendedArea ? 'sparkles' : 'book'}
            title={recommendedArea ? `Repasa ${recommendedArea.title}` : 'Continúa tu ruta de aprendizaje'}
            subtitle={recommendedArea ? `${recommendedArea.failedCount} preguntas para practicar y subir tu precisión.` : 'Entra en tus cursos y completa la siguiente actividad disponible.'}
            meta={recommendedArea ? '+20 XP posibles' : `${subjectProgress.length} cursos activos`}
            ctaLabel={recommendedArea ? 'Repasar ahora' : 'Ver cursos'}
            color={recommendedArea?.color ?? accentColor}
            onPress={() => recommendedArea ? handleReviewArea(recommendedArea) : router.push('/(student)/classes' as any)}
          />

          <View className={isDesktop ? 'mt-5 flex-row flex-wrap items-stretch gap-5' : 'mt-5 gap-5'}>
            <ReinforcementCard
              className={isDesktop ? 'flex-[1.55] min-w-[360px]' : ''}
              areas={reinforcementAreas}
              onSeeAll={() => router.push('/(student)/activity-log' as any)}
              onReview={handleReviewArea}
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

function MobileStudentProgress({
  level,
  points,
  nextLevelProgress,
  progressPercent,
  answeredQuestions,
  weeklyAttemptsCount,
  accuracyPercent,
  failedQuestions,
  streakDays,
  subjectProgress,
  recentScores,
  reinforcementAreas,
  accentColor,
}: {
  level: number
  points: number
  nextLevelProgress: number
  progressPercent: number
  answeredQuestions: number
  weeklyAttemptsCount: number
  accuracyPercent: number
  failedQuestions: number
  streakDays: number
  subjectProgress: SubjectProgress[]
  recentScores: RecentScore[]
  reinforcementAreas: ReinforcementArea[]
  accentColor: string
}) {
  const router = useRouter()
  const xpToNextLevel = Math.max(0, 100 - nextLevelProgress)
  const recommendedArea = reinforcementAreas[0] ?? null

  const handleReviewArea = (area: ReinforcementArea) => {
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
      return
    }

    router.push('/(student)/activity-log' as any)
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: MOBILE_BOTTOM_NAV_SPACER }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <NotificationBadge />
            <StudentHeaderAvatar />
          </View>
        </View>

        <View className="mb-5 flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#7C3AED]">
            <Ionicons name="stats-chart" size={27} color="#FFFFFF" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[32px] font-black leading-[36px] text-white" numberOfLines={1}>Progreso</Text>
            <Text className="mt-1 text-[15px] leading-5 text-[#B7C4D7]" numberOfLines={2}>
              Sigue aprendiendo cada día.
            </Text>
          </View>
        </View>

        <MobileProgressHero
          level={level}
          points={points}
          nextLevelProgress={nextLevelProgress}
          progressPercent={progressPercent}
          xpToNextLevel={xpToNextLevel}
          accentColor={accentColor}
        />

        <StudentPrimaryLearningCTA
          className="mt-5"
          icon={recommendedArea ? 'sparkles' : 'book'}
          title={recommendedArea ? `Repasa ${recommendedArea.title}` : 'Continúa tu aprendizaje'}
          subtitle={recommendedArea ? `${recommendedArea.failedCount} preguntas para practicar y ganar XP.` : 'Entra en tus cursos y completa la siguiente actividad.'}
          meta={recommendedArea ? '+20 XP posibles' : `${subjectProgress.length} cursos activos`}
          ctaLabel={recommendedArea ? 'Repasar' : 'Ver cursos'}
          color={recommendedArea?.color ?? accentColor}
          onPress={() => recommendedArea ? handleReviewArea(recommendedArea) : router.push('/(student)/classes' as any)}
        />

        <View className="mt-5 flex-row flex-wrap gap-3">
          <MobileProgressStat icon="help-circle" label="Respondidas" value={String(answeredQuestions)} helper={weeklyAttemptsCount > 0 ? `+${weeklyAttemptsCount} semana` : 'Empieza'} color="#38BDF8" />
          <MobileProgressStat icon="speedometer" label="Precisión" value={`${accuracyPercent}%`} helper={accuracyPercent >= 80 ? '¡Excelente!' : 'A mejorar'} color="#22C55E" />
          <MobileProgressStat icon="refresh-circle" label="Para practicar" value={String(failedQuestions)} helper={failedQuestions > 0 ? 'Recomendado' : 'Limpio'} color="#FBBF24" />
          <MobileProgressStat icon="flame" label="Racha" value={String(streakDays)} helper="días" color="#FF7B45" />
        </View>

        <MobileSectionHeader
          icon="sparkles"
          title="Retos recomendados"
          actionLabel="Historial"
          onAction={() => router.push('/(student)/activity-log' as any)}
        />
        <View className="overflow-hidden rounded-[24px] border border-[#1C3156] bg-[#09162C]">
          {reinforcementAreas.length > 0 ? (
            reinforcementAreas.slice(0, 3).map((area, index) => (
              <MobileReinforcementRow
                key={area.id}
                area={area}
                isLast={index === Math.min(reinforcementAreas.length, 3) - 1}
                onPress={() => handleReviewArea(area)}
              />
            ))
          ) : (
            <MobileCompactEmpty icon="sparkles-outline" title="Sin retos pendientes" subtitle="Cuando practiques más, verás recomendaciones aquí." />
          )}
        </View>

        <View className="mt-6 gap-5">
          <MobileRecentScoresCard scores={recentScores} onSeeAll={() => router.push('/(student)/activity-log' as any)} />
          <MobileCourseProgressCard subjects={subjectProgress} onSeeAll={() => router.push('/(student)/classes' as any)} />
        </View>

        <MobileStreakCard streakDays={streakDays} />
      </ScrollView>

      <StudentBottomNav active="progress" />
    </View>
  )
}

function MobileProgressHero({
  level,
  points,
  nextLevelProgress,
  progressPercent,
  xpToNextLevel,
  accentColor,
}: {
  level: number
  points: number
  nextLevelProgress: number
  progressPercent: number
  xpToNextLevel: number
  accentColor: string
}) {
  return (
    <LinearGradient
      colors={['#251466', '#111A45', '#0A1733']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 28, borderWidth: 1, borderColor: '#4C2CA3', overflow: 'hidden' }}
    >
      <View className="relative min-h-[180px] flex-row items-center gap-5 p-5">
        <View className="absolute -right-8 -top-8 h-32 w-32 rounded-full" style={{ backgroundColor: '#7C3AED33' }} />

        <View
          className="h-[118px] w-[118px] items-center justify-center rounded-full bg-[#070F26]"
          style={{ borderColor: accentColor, borderWidth: 9 }}
        >
          <Text className="text-[32px] font-black text-white">{progressPercent}%</Text>
          <Text className="text-[11px] font-semibold text-[#B7C4D7]">Avance</Text>
        </View>

        <View className="min-w-0 flex-1 pr-12">
          <Text className="text-[28px] font-black text-white">{points.toLocaleString()} XP</Text>
          <Text className="mt-1 text-[13px] text-[#B7C4D7]">Nivel {level}</Text>
          <View className="mt-4 h-3 overflow-hidden rounded-full bg-[#17264D]">
            <View className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(6, nextLevelProgress))}%`, backgroundColor: accentColor }} />
          </View>
          <Text className="mt-2 text-[12px] font-semibold text-[#C9D7EA]">
            {xpToNextLevel} XP para subir
          </Text>
        </View>
      </View>
    </LinearGradient>
  )
}

function MobileProgressStat({
  icon,
  label,
  value,
  helper,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  helper: string
  color: string
}) {
  return (
    <View className="min-h-[122px] flex-1 basis-[47%] items-center justify-center rounded-[24px] border border-[#1A3155] bg-[#0A1830] px-3 py-4">
      <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text className="mt-3 text-[28px] font-black text-white" numberOfLines={1}>{value}</Text>
      <Text className="text-center text-[13px] font-bold leading-4 text-[#DDE7F4]" numberOfLines={2}>{label}</Text>
      <Text className="mt-1 text-center text-[11px] font-bold" style={{ color }} numberOfLines={1}>{helper}</Text>
    </View>
  )
}

function MobileSectionHeader({
  icon,
  title,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View className="mb-3 mt-7 flex-row items-center justify-between gap-3">
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <Ionicons name={icon} size={22} color="#A78BFA" />
        <Text className="text-[22px] font-black text-white" numberOfLines={1}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} className="flex-row items-center gap-1 px-1 py-2">
          <Text className="text-[13px] font-black text-[#A78BFA]">{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={15} color="#A78BFA" />
        </Pressable>
      ) : null}
    </View>
  )
}

function MobileReinforcementRow({
  area,
  isLast,
  onPress,
}: {
  area: ReinforcementArea
  isLast: boolean
  onPress: () => void
}) {
  const detail = splitReinforcementDetail(area.detail)
  const safeAccuracy = Math.min(100, Math.max(0, area.accuracyPercent))
  const title = area.title
  const context = detail.context || area.badge

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-4 p-4 ${isLast ? '' : 'border-b border-[#13294C]'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${area.color}24` }}>
        <Ionicons name={area.icon} size={25} color={area.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-black text-white" numberOfLines={2}>{title}</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>{context} · {area.failedCount} para practicar</Text>
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#17284B]">
          <View className="h-full rounded-full" style={{ width: `${safeAccuracy}%`, backgroundColor: area.color }} />
        </View>
      </View>
      <View className="items-end gap-2">
        <Text className="text-[12px] text-[#8FA7C7]">Precisión</Text>
        <Text className="text-[16px] font-black" style={{ color: area.color }}>{safeAccuracy}%</Text>
        <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: `${area.color}26` }}>
          <Text className="text-[11px] font-black" style={{ color: area.color }}>Repasar</Text>
        </View>
      </View>
    </Pressable>
  )
}

function MobileRecentScoresCard({ scores, onSeeAll }: { scores: RecentScore[]; onSeeAll: () => void }) {
  const maxScore = Math.max(...scores.map((score) => score.value), 1)

  return (
    <View className="rounded-[24px] border border-[#1C3156] bg-[#09162C] p-4">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="trophy" size={20} color="#8B5CF6" />
          <Text className="text-[18px] font-black text-white">Últimos XP</Text>
        </View>
        <Pressable onPress={onSeeAll} className="flex-row items-center gap-1">
          <Text className="text-[12px] font-black text-[#A78BFA]">Ver todo</Text>
          <Ionicons name="chevron-forward" size={14} color="#A78BFA" />
        </Pressable>
      </View>

      {scores.length > 0 ? (
        <View className="gap-3">
          {scores.slice(0, 3).map((score, index) => {
            const percent = score.value <= 0 ? 0 : Math.max(10, Math.round((score.value / maxScore) * 100))
            return (
              <View key={`${score.label}-${score.meta}-${index}`}>
                <View className="mb-2 flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#123154]">
                    <Ionicons name={index === 0 ? 'checkmark' : 'analytics'} size={20} color={index === 0 ? '#22C55E' : '#8B5CF6'} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[13px] font-black text-white" numberOfLines={1}>{score.label}</Text>
                    <Text className="mt-0.5 text-[11px] text-[#8FA7C7]" numberOfLines={1}>{score.meta}</Text>
                  </View>
                  <Text className="text-[13px] font-black text-white">{score.value.toLocaleString()} XP</Text>
                </View>
                <View className="ml-[56px] h-2 overflow-hidden rounded-full bg-[#17284B]">
                  <View className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${percent}%` }} />
                </View>
              </View>
            )
          })}
        </View>
      ) : (
        <MobileCompactEmpty icon="analytics-outline" title="Sin actividad todavía" subtitle="Completa una práctica para verla aquí." />
      )}
    </View>
  )
}

function MobileCourseProgressCard({ subjects, onSeeAll }: { subjects: SubjectProgress[]; onSeeAll: () => void }) {
  const router = useRouter()

  return (
    <View className="rounded-[24px] border border-[#1C3156] bg-[#09162C] p-4">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Ionicons name="book" size={20} color="#8B5CF6" />
          <Text className="text-[18px] font-black text-white" numberOfLines={1}>Progreso por curso</Text>
        </View>
        <Pressable onPress={onSeeAll} className="flex-row items-center gap-1">
          <Text className="text-[12px] font-black text-[#A78BFA]">Ver todos</Text>
          <Ionicons name="chevron-forward" size={14} color="#A78BFA" />
        </Pressable>
      </View>

      {subjects.length > 0 ? (
        <View className="gap-3">
          {subjects.slice(0, 3).map((subject) => {
            const safePercent = Math.min(100, Math.max(0, subject.barPercent))
            return (
              <Pressable
                key={`${subject.id}:${subject.classroomId ?? 'general'}`}
                onPress={() => router.push({
                  pathname: '/(student)/class/[id]',
                  params: {
                    id: String(subject.id),
                    ...(subject.classroomId ? { classroomId: String(subject.classroomId) } : {}),
                  },
                } as any)}
                className="flex-row items-center gap-4 rounded-2xl bg-[#0D1D3B] p-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
              >
                <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${subject.color}24` }}>
                  <Ionicons name={subject.icon} size={25} color={subject.color} />
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="min-w-0 flex-1 text-[15px] font-black text-white" numberOfLines={1}>{subject.name}</Text>
                    <Text className="text-[15px] font-black" style={{ color: subject.color }}>{safePercent}%</Text>
                  </View>
                  <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>{subject.scoreCount} / {subject.totalQuestions} preguntas</Text>
                  <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#17284B]">
                    <View className="h-full rounded-full" style={{ width: `${safePercent}%`, backgroundColor: subject.color }} />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8FA7C7" />
              </Pressable>
            )
          })}
        </View>
      ) : (
        <MobileCompactEmpty icon="book-outline" title="Sin cursos activos" subtitle="Únete a una clase para empezar." />
      )}
    </View>
  )
}

function MobileStreakCard({ streakDays }: { streakDays: number }) {
  return (
    <LinearGradient
      colors={['#32136C', '#1B1555', '#0B1B35']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ marginTop: 24, borderRadius: 24, borderWidth: 1, borderColor: '#4C2CA3' }}
    >
      <View className="flex-row items-center gap-4 p-4">
        <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: '#F59E0B24' }}>
          <Ionicons name="trophy" size={34} color="#FBBF24" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[20px] font-black text-white">¡Sigue así!</Text>
          <Text className="mt-1 text-[13px] text-[#C9D7EA]">Cada paso te acerca a tu meta.</Text>
        </View>
        <View className="h-16 w-20 items-center justify-center rounded-2xl border border-[#5B3BB6] bg-[#151543]">
          <Text className="text-[24px] font-black text-white">{streakDays}</Text>
          <Text className="text-[11px] text-[#C9D7EA]">días</Text>
        </View>
      </View>
    </LinearGradient>
  )
}

function MobileCompactEmpty({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  return (
    <View className="items-center justify-center rounded-2xl bg-[#0D1D3B] p-6">
      <Ionicons name={icon} size={28} color="#8FA7C7" />
      <Text className="mt-3 text-center text-[15px] font-black text-white">{title}</Text>
      <Text className="mt-1 text-center text-[12px] leading-5 text-[#8FA7C7]">{subtitle}</Text>
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
    <StudentKpiCard
      className={className}
      color={color}
      detail={detail}
      detailColor={detailColor}
      icon={icon}
      label={title}
      value={value}
    />
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
                      <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>{score.meta}</Text>
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
          <Ionicons name="analytics-outline" size={30} color="#8FA7C7" />
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
      title="Retos recomendados"
      actionLabel={onSeeAll ? 'Ver historial' : undefined}
      onAction={onSeeAll}
      className={className}
    >
      {areas.length > 0 ? (
        <View style={{ gap: 10 }}>
          {areas.slice(0, 3).map((area) => {
            const safeAccuracy = Math.min(100, Math.max(0, area.accuracyPercent))
            const detail = splitReinforcementDetail(area.detail)

            return (
              <StudentListRow
                key={area.id}
                onPress={() => onReview(area)}
                icon={area.icon}
                color={area.color}
                title={area.title}
                subtitle={detail.context}
                actionLabel="Repasar ahora"
                meta={[
                  { label: 'Precisión', value: `${safeAccuracy}%`, color: area.color },
                ]}
              >
                {detail.main ? (
                  <Text className="mt-1 text-[12px] font-bold text-[#AFC2DB]" numberOfLines={1}>
                    {detail.main || `${area.failedCount} preguntas para practicar`}
                  </Text>
                ) : null}
                <View className="mt-2 flex-row items-center gap-3">
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
              </StudentListRow>
            )
          })}
        </View>
      ) : (
        <StudentEmptyState
          icon="sparkles-outline"
          title="Sin retos pendientes"
          message="Cuando acumules más práctica, OmniQuest te recomendará repasos concretos para subir precisión y ganar XP."
        />
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
    <StudentListRow
      onPress={onPress}
      icon={subject.icon}
      color={subject.color}
      title={subject.name}
      subtitle={subject.detail}
      actionLabel="Ver curso"
      meta={[
        { label: 'Progreso', value: `${safePercent}%` },
        { label: 'Respondidas', value: `${subject.scoreCount} / ${subject.totalQuestions}` },
        { label: 'Fallos', value: String(subject.failedQuestions), color: subject.failedQuestions > 0 ? '#FB7185' : '#43D991' },
        { label: 'Pendientes', value: String(subject.pendingQuestions) },
        { label: 'Mejor', value: subject.bestScore === null ? '-' : `${subject.bestScore.toLocaleString()} XP` },
      ]}
    >
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-[#13294C]">
        <View className="h-full rounded-full" style={{ width: `${safePercent}%`, backgroundColor: subject.color }} />
      </View>
    </StudentListRow>
  )
}

function EmptyProgress() {
  return (
    <StudentEmptyState
      icon="stats-chart-outline"
      title="Sin progreso real todavía"
      message="Cuando completes una partida, se guardará tu puntuación y se actualizará tu avance."
    />
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
        detail: `${item.failedCount} ${item.failedCount === 1 ? 'pregunta para practicar' : 'preguntas para practicar'} · ${item.subjectName}`,
        badge: 'Tema',
        icon: 'alert-circle',
        color: '#FBBF24',
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
        detail: `${item.failedCount} preguntas para practicar`,
        badge: 'Tipo de pregunta',
        icon: getQuestionTypeIcon(item.type),
        color: '#A78BFA',
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
