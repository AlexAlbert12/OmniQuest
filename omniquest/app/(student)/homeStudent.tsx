import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, } from 'react-native'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import { getStudentLevel, getNextLevelProgress } from '../../lib/studentLevel'
import { getTimeAgo } from '../../lib/time'
import StudentSidebar from '../../components/student/StudentSidebar'
import { fetchStudentProgressSummary, type StudentProgressSummary, type StudentProgressSubject } from '../../lib/studentProgress'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import StudentDashboardCard, { StudentCardLink as CardLink } from '../../components/student/StudentDashboardCard'
import StudentMetricCard from '../../components/student/StudentMetricCard'
import StudentActionBanner from '../../components/student/StudentActionBanner'
import StudentEmptyState from '../../components/student/StudentEmptyState'
import OmniGuide from '../../components/OmniGuide'
import { useAppTheme } from '../../lib/appTheme'
import { joinClassByInviteCode } from '../../lib/studentClassJoin'
import { calculateStreakDays } from '../../lib/studentBadges'
import { getStartOfWeekMonday, getTimeUntilSundayLabel } from '../../lib/weeklyGoal'
import { MobileEmptyState, MobileMetricCard, MobileScreen, MobileSectionHeader } from '../../components/ui/mobile'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'

type Subject = {
  id: number
  classroom_id: number | null
  classroom_name: string | null
  classroom_code: string | null
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
}

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
  role_id?: string | null
  visibility?: string | null
}

type ActivityItem = {
  id: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  title: string
  course: string
  detail: string
  time: string
}

type HomeHeroAction = {
  title: string
  description: string
  buttonLabel: string
  icon: keyof typeof Ionicons.glyphMap
  href: unknown
}

type OnboardingStep = {
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  done: boolean
  actionLabel: string
  onPress: () => void
}

type SubjectProgressRow = {
  subject: Subject
  progress?: StudentProgressSubject
}

function buildHomeHeroAction(
  subjects: Subject[],
  progressRows: StudentProgressSubject[],
  failedQuestions: number
): HomeHeroAction {
  const rows = getSubjectProgressRows(subjects, progressRows)
  const failedRow = rows.find((row) => (row.progress?.failedQuestions ?? 0) > 0)
  const pendingRow = rows.find((row) => (row.progress?.pendingQuestions ?? 0) > 0)

  if (failedRow && failedQuestions > 0) {
    return {
      title: `Resumen del día`,
      description: `Tienes ${failedQuestions} ${failedQuestions === 1 ? 'pregunta fallada' : 'fallos'} por repasar en ${failedRow.subject.name}.`,
      buttonLabel: 'Repasar fallos',
      icon: 'refresh-circle',
      href: buildClassHref(failedRow.subject),
    }
  }

  if (pendingRow?.progress) {
    const pending = pendingRow.progress.pendingQuestions
    return {
      title: `Resumen del día`,
      description: `Continúa con ${pendingRow.subject.name}. Te ${pending === 1 ? 'queda' : 'quedan'} ${pending} ${pending === 1 ? 'pregunta' : 'preguntas'} por practicar.`,
      buttonLabel: 'Continuar',
      icon: 'play-forward',
      href: buildClassHref(pendingRow.subject),
    }
  }

  if (subjects.length === 0) {
    return {
      title: 'Empieza tu primer reto',
      description: 'Únete a un curso con el código de tu profesor y empieza a practicar.',
      buttonLabel: 'Unirse a un curso',
      icon: 'add-circle',
      href: '/(student)/classes',
    }
  }

  return {
    title: 'Elige tu siguiente tema',
    description: 'Tienes cursos activos listos para repetir, practicar o explorar nuevos temas.',
    buttonLabel: 'Elegir tema',
    icon: 'albums',
    href: buildClassHref(subjects[0]),
  }
}

function getSubjectProgressRows(subjects: Subject[], progressRows: StudentProgressSubject[]): SubjectProgressRow[] {
  return subjects
    .map((subject) => ({
      subject,
      progress: progressRows.find((item) => getProgressRowKey(item) === getCourseRowKey(subject)),
    }))
    .sort((a, b) => {
      const failedDiff = (b.progress?.failedQuestions ?? 0) - (a.progress?.failedQuestions ?? 0)
      if (failedDiff !== 0) return failedDiff

      const pendingDiff = (b.progress?.pendingQuestions ?? 0) - (a.progress?.pendingQuestions ?? 0)
      if (pendingDiff !== 0) return pendingDiff

      return (b.progress?.percent ?? 0) - (a.progress?.percent ?? 0)
    })
}

export default function StudentHome() {
  const { width } = useWindowDimensions()
  const [inviteCode, setInviteCode] = useState('')
  const [enrolledSubjects, setEnrolledSubjects] = useState<Subject[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ranking, setRanking] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([])
  const [attemptCount, setAttemptCount] = useState(0)
  const [weeklyAttemptCount, setWeeklyAttemptCount] = useState(0)
  const [streakDays, setStreakDays] = useState(0)
  const [progressSummary, setProgressSummary] = useState<StudentProgressSummary | null>(null)
  const router = useRouter()
  const { accentColor } = useAppTheme()

  const isDesktop = width >= 1024
  const isWide = width >= 760
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = getStudentLevel(points)
  const progressPercent = progressSummary?.overallPercent ?? 0
  const nextLevelProgress = getNextLevelProgress(points)
  const weeklyGoalTarget = 20
  const weeklyGoalPercent = Math.min(100, Math.round((weeklyAttemptCount / weeklyGoalTarget) * 100))
  const failedQuestions = progressSummary?.subjects.reduce(
    (sum, subject) => sum + subject.failedQuestions,
    0
  ) ?? 0

  const heroAction = useMemo(
    () => buildHomeHeroAction(enrolledSubjects, progressSummary?.subjects ?? [], failedQuestions),
    [enrolledSubjects, failedQuestions, progressSummary?.subjects]
  )

  const subjectProgressRows = useMemo(
    () => getSubjectProgressRows(enrolledSubjects, progressSummary?.subjects ?? []),
    [enrolledSubjects, progressSummary?.subjects]
  )
  const hasCourses = enrolledSubjects.length > 0
  const hasPlayedFirstQuestion = attemptCount > 0
  const showGuidedOnboarding = !hasCourses || !hasPlayedFirstQuestion
  const onboardingSteps = useMemo<OnboardingStep[]>(() => {
    const firstSubject = subjectProgressRows[0]?.subject || enrolledSubjects[0]
    return [
      {
        title: 'Únete a un curso',
        description: hasCourses ? 'Ya tienes un curso activo para empezar.' : 'Introduce el código que te ha dado tu profesor.',
        icon: 'key-outline',
        done: hasCourses,
        actionLabel: hasCourses ? 'Completado' : 'Unirme',
        onPress: () => router.push('/(student)/classes' as any),
      },
      {
        title: 'Haz tu primera pregunta',
        description: hasPlayedFirstQuestion ? 'Ya hay actividad guardada en tu historial.' : 'Elige un tema y responde tu primera pregunta.',
        icon: 'play-circle-outline',
        done: hasPlayedFirstQuestion,
        actionLabel: hasPlayedFirstQuestion ? 'Completado' : 'Empezar',
        onPress: () => {
          if (firstSubject) {
            router.push(buildClassHref(firstSubject) as any)
            return
          }
          router.push('/(student)/classes' as any)
        },
      },
      {
        title: 'Revisa tu progreso',
        description: hasPlayedFirstQuestion ? 'Mira fallos, precisión y XP para saber qué repasar.' : 'Después de jugar verás tus métricas aquí.',
        icon: 'bar-chart-outline',
        done: hasPlayedFirstQuestion,
        actionLabel: 'Ver progreso',
        onPress: () => router.push('/(student)/progress' as any),
      },
    ]
  }, [enrolledSubjects, hasCourses, hasPlayedFirstQuestion, router, subjectProgressRows])

  const displayedRanking = useMemo(() => {
    if (ranking.length > 0) return ranking.slice(0, 5)
    const isGuest = profile?.role_id === 'guest'

    return [
      { id: 'demo-1', alias: 'Sofia_R', avatar: null, points: 4250 },
      { id: 'demo-2', alias: 'Mateo09', avatar: null, points: 3890 },
      isGuest
        ? { id: 'demo-3', alias: 'CamilaStar', avatar: null, points: 3450 }
        : { id: currentUserId || 'demo-me', alias, avatar: null, points: Math.max(points, 3210) },
      { id: 'demo-4', alias: 'Lucho94', avatar: null, points: 2980 },
    ]
  }, [alias, currentUserId, points, profile?.role_id, ranking])

  const rankingSummary = useMemo(
    () => getRankingSummary(displayedRanking, currentUserId, points),
    [currentUserId, displayedRanking, points]
  )

  const fetchMySubjectsAndScores = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      const userId = session.session.user.id;

      setCurrentUserId(userId);

      const now = new Date();
      const startOfWeek = getStartOfWeekMonday(now);
      const startOfWeekIso = startOfWeek.toISOString();

      const [profileResult, enrollmentsResult, rankingResult, activityResult, attemptHistoryResult, weeklyAttemptsResult, streakAttemptsResult, progressResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, points, role_id').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('classroom_id, joined_at, subjects(*), classrooms(id, name, code)')
          .eq('student_id', userId)
          .order('joined_at', { ascending: false }),
        supabase.rpc('get_ranking_profiles', { p_limit: 5 }),
        supabase
          .from('attempt_history')
          .select(`
            id,
            is_correct,
            attempted_at,
            questions (
              text,
              subjects ( name ),
              subject_topics ( title )
            )
          `)
          .eq('student_id', userId)
          .order('attempted_at', { ascending: false })
          .limit(3),
        supabase
          .from('attempt_history')
          .select('id', { head: true, count: 'exact' })
          .eq('student_id', userId),
        supabase
          .from('attempt_history')
          .select('id', { head: true, count: 'exact' })
          .eq('student_id', userId)
          .gte('attempted_at', startOfWeekIso),
        supabase
          .from('attempt_history')
          .select('attempted_at')
          .eq('student_id', userId)
          .order('attempted_at', { ascending: false })
          .limit(120),
        fetchStudentProgressSummary(userId),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (rankingResult.error) throw rankingResult.error;
      if (activityResult.error) throw activityResult.error;
      if (attemptHistoryResult.error) throw attemptHistoryResult.error;
      if (weeklyAttemptsResult.error) throw weeklyAttemptsResult.error;
      if (streakAttemptsResult.error) throw streakAttemptsResult.error;

      setProfile(profileResult.data);
      setEnrolledSubjects(
        enrollmentsResult.data
          ?.map((enrollment: any) => {
            const subject = normalizeRelation(enrollment.subjects)
            const classroom = normalizeRelation(enrollment.classrooms)
            return subject
              ? {
                ...subject,
                classroom_id: Number(enrollment.classroom_id ?? classroom?.id ?? 0) || null,
                classroom_name: classroom?.name ?? null,
                classroom_code: classroom?.code ?? null,
              }
              : null
          })
          .filter(Boolean) || []
      );
      setRanking(rankingResult.data || []);
      setAttemptCount(attemptHistoryResult.count ?? 0);
      setWeeklyAttemptCount(weeklyAttemptsResult.count ?? 0);
      setStreakDays(calculateStreakDays(((streakAttemptsResult.data || []) as { attempted_at: string | null }[]).map((attempt) => attempt.attempted_at).filter((value): value is string => Boolean(value))));

      setProgressSummary(progressResult);
      const activities: ActivityItem[] = (activityResult.data || []).map((attempt: any) => {
        const timeAgo = getTimeAgo(attempt.attempted_at);
        const isCorrect = attempt.is_correct;
        const topicData = attempt.questions?.subject_topics;
        const topicTitle = Array.isArray(topicData) ? topicData[0]?.title : topicData?.title;
        const questionText = attempt.questions?.text;
        const subjectData = attempt.questions?.subjects;
        const courseName = Array.isArray(subjectData) ? subjectData[0]?.name : subjectData?.name;

        return {
          id: String(attempt.id),
          icon: isCorrect ? 'checkmark' : 'close',
          color: isCorrect ? '#70E0A5' : '#FB7185',
          title: isCorrect ? 'Acertaste una pregunta' : 'Fallaste una pregunta',
          course: courseName || topicTitle || 'Práctica',
          detail: questionText || (topicTitle ? `Tema: ${topicTitle}` : 'Sin pregunta registrada'),
          time: timeAgo,
        };
      });

      setActivityItems(activities.length > 0 ? activities : [{
        id: 'empty-activity',
        icon: 'rocket',
        color: '#3B82F6',
        title: '¡Tu aventura comienza aquí!',
        course: 'OmniQuest',
        detail: 'Juega tu primera partida para ver tu historial.',
        time: 'Ahora'
      }]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMySubjectsAndScores();
    }, [])
  );

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  const handleJoinClass = async () => {
    setJoining(true)
    try {
      const { subjectName, classroomName } = await joinClassByInviteCode(inviteCode)
      showAlert('¡Éxito!', `Te has unido a ${subjectName}${classroomName ? ` · ${classroomName}` : ''}`)
      setInviteCode('')
      fetchMySubjectsAndScores()
    } catch (error: any) {
      showAlert('Error', error.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <OmniGuide state="blink" size={116} />
        <Text className="mt-4 text-[#8FA7C7]">Omni está preparando tu aventura...</Text>
      </View>
    )
  }

  if (!isDesktop) {
    return (
      <MobileStudentHome
        alias={alias}
        level={level}
        points={points}
        nextLevelProgress={nextLevelProgress}
        heroAction={heroAction}
        failedQuestions={failedQuestions}
        accuracyPercent={progressSummary?.accuracyPercent ?? 0}
        weeklyAttemptCount={weeklyAttemptCount}
        weeklyGoalTarget={weeklyGoalTarget}
        weeklyGoalPercent={weeklyGoalPercent}
        streakDays={streakDays}
        subjectProgressRows={subjectProgressRows}
        inviteCode={inviteCode}
        setInviteCode={setInviteCode}
        joining={joining}
        onJoinClass={handleJoinClass}
      />
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection="home"
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
            paddingHorizontal: isDesktop ? 34 : 18,
            paddingTop: isDesktop ? 22 : 18,
            paddingBottom: isDesktop ? 28 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          showsVerticalScrollIndicator={false}
        >
          <StudentPageHeader
            icon="home"
            isDesktop={isDesktop}
            title={`¡Hola, ${alias}!`}
            subtitle="¿Listo para seguir aprendiendo y alcanzar tus metas?"
          />

          {showGuidedOnboarding ? (
            <StudentMobileOnboardingCard steps={onboardingSteps} className="mb-5" />
          ) : null}

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <HeroCard isWide={isWide} action={heroAction} />

            <View className={isWide ? 'flex-row gap-3' : 'gap-3'}>
              <StudentMetricCard
                title="Contenido visto"
                value={`${progressPercent}%`}
                icon="analytics-outline"
                color="#43D991"
                onPress={() => router.push('/(student)/progress')}
              />
              <StudentMetricCard
                title="Preguntas hechas"
                value={attemptCount.toString()}
                icon="trophy"
                color={accentColor}
                onPress={() => router.push('/(student)/progress')}
              />
              <StudentMetricCard
                title="Fallos para repasar"
                value={String(failedQuestions)}
                icon="refresh-circle"
                color="#FB7185"
                onPress={() => router.push('/(student)/progress')}
              />
              <StudentMetricCard
                title="Precisión"
                value={`${progressSummary?.accuracyPercent ?? 0}%`}
                icon="speedometer-outline"
                color="#FF7B45"
                onPress={() => router.push('/(student)/progress')}
              />
            </View>
          </View>

          <WeeklyGoalCard
            count={weeklyAttemptCount}
            target={weeklyGoalTarget}
            percent={weeklyGoalPercent}
            streakDays={streakDays}
            className="mt-5"
          />

          <View className={isDesktop ? 'mt-5 flex-row items-start gap-5' : 'mt-5 gap-5'}>
            <StudentDashboardCard title="Continúa aprendiendo" className={isDesktop ? 'flex-1' : ''} compact>
              <View style={{ gap: 10 }}>
                {enrolledSubjects.length > 0 ? (
                  subjectProgressRows.slice(0, 3).map((row, index) => (
                    <SubjectRow
                      key={getCourseRowKey(row.subject)}
                      subject={row.subject}
                      index={index}
                      progress={row.progress}
                    />
                  ))
                ) : (
                  <EmptyClasses />
                )}
              </View>
              <CardLink label="Ver todos mis cursos" onPress={() => router.push('/(student)/classes' as any)} />
            </StudentDashboardCard>

            <StudentDashboardCard title="Actividad reciente" className={isDesktop ? 'flex-1' : ''} compact>
              <View style={{ gap: 16 }}>
                {activityItems.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </View>
              <CardLink label="Ver toda la actividad" onPress={() => router.push('/(student)/activity-log')}
              />
            </StudentDashboardCard>

            <StudentDashboardCard title="Tu posición" className={isDesktop ? 'flex-1' : ''} compact>
              <RankingSummaryCard summary={rankingSummary} />
              <CardLink label="Ver ranking" onPress={() => router.push('/(student)/ranking' as any)} />
            </StudentDashboardCard>
          </View>

          <View className="mt-5 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
            <View className={isWide ? 'flex-row items-center gap-5' : 'gap-3'}>
              <View className="min-w-[220px] flex-1">
                <Text className="text-[16px] font-black text-white">Unirse a un curso</Text>
                <Text className="mt-1 text-[13px] text-[#AFC2DB]">Introduce el código que te haya dado tu profesor.</Text>
              </View>
              <View className={isWide ? 'min-w-[420px] flex-row gap-0 overflow-hidden rounded-xl border border-[#20375E] bg-[#091A35]' : 'flex-row gap-0 overflow-hidden rounded-xl border border-[#20375E] bg-[#091A35]'}>
                <View className="items-center justify-center px-4">
                  <Ionicons name="keypad-outline" size={20} color="#8FA7C7" />
                </View>
                <TextInput
                  className="min-w-0 flex-1 px-4 py-3 text-white"
                  placeholder="Introduce el código"
                  placeholderTextColor="#60799C"
                  value={inviteCode}
                  onChangeText={(value) => setInviteCode(value.trim().toUpperCase())}
                  maxLength={6}
                  autoCapitalize="characters"
                />
                <Pressable
                  onPress={handleJoinClass}
                  disabled={joining}
                  className="items-center justify-center px-6"
                  style={({ pressed }) => ({ backgroundColor: accentColor, opacity: joining ? 0.7 : pressed ? 0.82 : 1 })}
                >
                  {joining ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View className="flex-row items-center gap-2">
                      <Text className="font-bold text-white">Unirse</Text>
                      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              </View>
              {isWide ? (
                <View className="hidden min-w-[230px] border-l border-[#172A4A] pl-5 lg:flex">
                  <Text className="text-[13px] font-bold text-[#DDE7F4]">¿No tienes un código?</Text>
                  <Text className="mt-1 text-[12px] leading-5 text-[#8FA7C7]">Pide a tu profesor uno nuevo.</Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="home" /> : null}
    </View>
  )
}


type MobileStudentHomeProps = {
  alias: string
  level: number
  points: number
  nextLevelProgress: number
  heroAction: HomeHeroAction
  failedQuestions: number
  accuracyPercent: number
  weeklyAttemptCount: number
  weeklyGoalTarget: number
  weeklyGoalPercent: number
  streakDays: number
  subjectProgressRows: SubjectProgressRow[]
  inviteCode: string
  setInviteCode: (value: string) => void
  joining: boolean
  onJoinClass: () => void
}

function MobileStudentHome({
  alias,
  level,
  points,
  nextLevelProgress,
  heroAction,
  failedQuestions,
  accuracyPercent,
  weeklyAttemptCount,
  weeklyGoalTarget,
  weeklyGoalPercent,
  streakDays,
  subjectProgressRows,
  inviteCode,
  setInviteCode,
  joining,
  onJoinClass,
}: MobileStudentHomeProps) {
  return (
    <MobileScreen
      backgroundColor="#061126"
      horizontalPadding={20}
      bottomPadding={152}
      bottomNav={<StudentBottomNav active="home" />}
    >
      <StudentPageHeader
        icon="home"
        isDesktop={false}
        title={`¡Hola, ${alias}!`}
        subtitle="Tu siguiente paso está listo."
      />

      <MobileLevelCard
        level={level}
        points={points}
        nextLevelProgress={nextLevelProgress}
      />

      <MobileReviewCard action={heroAction} failedQuestions={failedQuestions} className="mt-5" />

      <MobileMetricGrid
        failedQuestions={failedQuestions}
        accuracyPercent={accuracyPercent}
        streakDays={streakDays}
        className="mt-5"
      />

      <MobileCoursesSection rows={subjectProgressRows} className="mt-7" />

      <MobileWeeklyGoalCard
        count={weeklyAttemptCount}
        target={weeklyGoalTarget}
        percent={weeklyGoalPercent}
        streakDays={streakDays}
        className="mt-6"
      />

      <MobileJoinClassCard
        inviteCode={inviteCode}
        setInviteCode={setInviteCode}
        joining={joining}
        onJoinClass={onJoinClass}
        className="mt-5"
      />
    </MobileScreen>
  )
}

function MobileLevelCard({
  level,
  points,
  nextLevelProgress,
  className = '',
}: {
  level: number
  points: number
  nextLevelProgress: number
  className?: string
}) {
  const percent = Math.max(4, Math.min(100, nextLevelProgress))
  const remaining = Math.max(0, 100 - nextLevelProgress)

  return (
    <View className={`overflow-hidden rounded-[24px] border border-[#243869] p-5 ${className}`}>
      <LinearGradient
        colors={['#131A4A', '#0B1734']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#5A46D8]/20" />
      <View className="absolute top-2 right-7">
        <OmniGuide state="normal" autoBlink size={88} />
      </View>

      <View className="relative flex-row items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-[18px] bg-[#7C5CFF]">
          <Text className="text-[30px] font-black text-white">{level}</Text>
        </View>
        <View className="min-w-0 flex-1 pr-16">
          <Text className="text-[22px] font-black text-white">Nivel {level}</Text>
          <Text className="mt-1 text-[16px] text-[#B9C7DA]">Estudiante</Text>
        </View>
      </View>

      <View className="relative mt-5 h-3 overflow-hidden rounded-full bg-[#1D2B4E]">
        <View className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${percent}%` }} />
      </View>

      <View className="relative mt-4 flex-row items-center justify-between">
        <Text className="text-[16px] text-[#C6D4E8]">{points.toLocaleString()} XP</Text>
        <Text className="text-[16px] text-[#C6D4E8]">{remaining} XP más</Text>
      </View>
    </View>
  )
}

function MobileReviewCard({
  action,
  failedQuestions,
  className = '',
}: {
  action: HomeHeroAction
  failedQuestions: number
  className?: string
}) {
  const showFailures = failedQuestions > 0
  const title = showFailures
    ? 'Repasar fallos'
    : action.buttonLabel === 'Continuar'
      ? 'Continúa tu reto'
      : action.title
  const subtitle = showFailures
    ? `${failedQuestions} ${failedQuestions === 1 ? 'pregunta necesita' : 'preguntas necesitan'} atención. Empieza por lo que más te cuesta.`
    : 'Un paso más hacia tu meta.'

  return (
    <Link href={action.href as any} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        <View className={`overflow-hidden rounded-[26px] border border-[#5B3FDA] p-5 ${className}`}>
          <LinearGradient
            colors={['#35168D', '#141D55']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View className="absolute -left-10 top-5 h-32 w-32 rounded-full bg-[#8B5CF6]/18" />
          <View className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#FFFFFF]/8" />

          <View className="relative">
            <View className="flex-row items-start gap-4">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-[#5B33D6]">
                <Ionicons name={showFailures ? 'locate' : action.icon} size={32} color="#F8FAFC" />
              </View>

              <View className="min-w-0 flex-1">
                <Text className="text-[26px] font-black leading-8 text-white" numberOfLines={2}>{title}</Text>
                <Text className="mt-2 text-[14px] leading-5 text-[#D7DFF0]">{subtitle}</Text>
              </View>
            </View>

            <View className="mt-5 flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1 rounded-2xl bg-[#FFFFFF]/10 px-4 py-3">
                <Text className="text-[12px] font-bold text-[#CABDFF]">Siguiente paso</Text>
                <Text className="mt-1 text-[13px] font-semibold text-white" numberOfLines={1}>
                  {showFailures ? 'Reforzar preguntas falladas' : action.buttonLabel}
                </Text>
              </View>
              <View className="min-w-[132px] flex-row items-center justify-center gap-2 rounded-2xl bg-[#8B5CF6] px-4 py-4">
                <Text className="text-[15px] font-black text-white">{showFailures ? 'Repasar ahora' : action.buttonLabel}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  )
}

function MobileMetricGrid({
  failedQuestions,
  accuracyPercent,
  streakDays,
  className = '',
}: {
  failedQuestions: number
  accuracyPercent: number
  streakDays: number
  className?: string
}) {
  return (
    <View className={`flex-row gap-3 ${className}`}>
      <MobileMetricTile icon="locate" value={failedQuestions.toString()} label="Fallos" color="#FB7185" />
      <MobileMetricTile icon="speedometer-outline" value={`${accuracyPercent}%`} label="Precisión" color="#F97316" />
      <MobileMetricTile icon="flame" value={streakDays.toString()} label="Racha" color="#FDBA74" />
    </View>
  )
}

function MobileMetricTile({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  value: string
  label: string
  color: string
}) {
  return (
    <View className="min-w-0 flex-1">
      <MobileMetricCard icon={icon} value={value} label={label} color={color} compact />
    </View>
  )
}

function MobileWeeklyGoalCard({
  count,
  target,
  percent,
  streakDays,
  className = '',
}: {
  count: number
  target: number
  percent: number
  streakDays: number
  className?: string
}) {
  return (
    <View className={`overflow-hidden rounded-[24px] border border-[#293D71] p-5 ${className}`}>
      <LinearGradient
        colors={['#141C4F', '#0B1734']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#8B5CF6]/14" />
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] font-black uppercase tracking-[0.08em] text-[#B9A7FF]">Meta semanal</Text>
          <Text className="mt-2 text-[16px] font-semibold leading-5 text-[#D7DFF0]">
            Completa preguntas esta semana y mantén el ritmo.
          </Text>
        </View>
        <View className="flex-row items-center gap-2 rounded-2xl bg-[#24165D] px-3 py-2">
          <Ionicons name="calendar" size={16} color="#B9A7FF" />
          <Text className="text-[12px] font-black text-[#B9A7FF]" numberOfLines={1}>{getTimeUntilSundayLabel()}</Text>
        </View>
      </View>

      <View className="mt-5 flex-row items-end justify-between gap-4">
        <View className="flex-row items-end gap-2">
          <Text className="text-[34px] font-black leading-[38px] text-white">{count}</Text>
          <Text className="pb-1 text-[18px] font-black text-[#B9C7DA]">/ {target}</Text>
        </View>
        <Text className="pb-1 text-[14px] font-bold text-[#AFC2DB]">preguntas</Text>
      </View>

      <View className="mt-4 h-3 overflow-hidden rounded-full bg-[#1D2B4E]">
        <View className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${Math.max(4, percent)}%` }} />
      </View>

      {streakDays > 0 ? (
        <View className="mt-4 self-start rounded-full bg-[#F97316]/15 px-3 py-1.5">
          <Text className="text-[12px] font-black text-[#FDBA74]">🔥 {streakDays} día{streakDays === 1 ? '' : 's'} de racha</Text>
        </View>
      ) : null}
    </View>
  )
}

function MobileCoursesSection({ rows, className = '' }: { rows: SubjectProgressRow[]; className?: string }) {
  const router = useRouter()

  return (
    <View className={className}>
      <MobileSectionHeader
        title="Cursos recientes"
        actionLabel="Ver todo"
        onAction={() => router.push('/(student)/classes' as any)}
        className="mb-4"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 4 }}>
        {rows.length > 0 ? (
          rows.slice(0, 4).map((row, index) => (
            <MobileCourseCard key={getCourseRowKey(row.subject)} row={row} index={index} />
          ))
        ) : (
          <MobileEmptyCourseCard />
        )}
        <Link href="/(student)/classes" asChild>
          <Pressable className="w-[150px] justify-center rounded-[22px] border border-[#1B2E56] bg-[#0B1930] p-4">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFFFFF]/8">
              <Ionicons name="add" size={30} color="#C6D4E8" />
            </View>
            <Text className="mt-4 text-[17px] font-bold text-[#D7DFF0]">Añadir curso</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </View>
  )
}

function MobileCourseCard({ row, index }: { row: SubjectProgressRow; index: number }) {
  const palette = ['#8B5CF6', '#F97316', '#34D399', '#3B82F6']
  const color = row.subject.theme_color || palette[index] || '#8B5CF6'
  const percent = row.progress?.percent ?? 0

  return (
    <Link href={buildClassHref(row.subject) as any} asChild>
      <Pressable className="w-[162px] overflow-hidden rounded-[22px] border border-[#1B2E56] bg-[#0B1930] p-4" style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}>
        <View className="absolute -right-8 -top-8 h-24 w-24 rounded-full" style={{ backgroundColor: `${color}20` }} />
        <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}26` }}>
          {row.subject.icon ? (
            <Text className="text-[28px]">{row.subject.icon}</Text>
          ) : (
            <Ionicons name="book" size={28} color={color} />
          )}
        </View>
        <Text className="mt-4 text-[17px] font-black text-white" numberOfLines={1}>{row.subject.name}</Text>
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#1D2B4E]">
          <View className="h-full rounded-full" style={{ width: `${Math.max(5, percent)}%`, backgroundColor: color }} />
        </View>
        <Text className="mt-2 text-[13px] font-bold" style={{ color }}>{percent}%</Text>
      </Pressable>
    </Link>
  )
}

function MobileEmptyCourseCard() {
  return (
    <View className="w-[190px]">
      <MobileEmptyState
        icon="school-outline"
        omniState="thinking"
        omniSize={78}
        title="Tu primer curso"
        description="Introduce un código y Omni te acompaña."
        color="#9FD6FF"
        className="h-full px-4 py-5"
      />
    </View>
  )
}

function MobileJoinClassCard({
  inviteCode,
  setInviteCode,
  joining,
  onJoinClass,
  className = '',
}: {
  inviteCode: string
  setInviteCode: (value: string) => void
  joining: boolean
  onJoinClass: () => void
  className?: string
}) {
  return (
    <View className={`rounded-[22px] border border-[#1B2E56] bg-[#07162E] p-4 ${className}`}>
      <Text className="text-[16px] font-black text-white">¿Tienes un código?</Text>
      <View className="mt-3 flex-row overflow-hidden rounded-2xl border border-[#20375E] bg-[#0B1930]">
        <View className="items-center justify-center px-4">
          <Ionicons name="keypad-outline" size={20} color="#8FA7C7" />
        </View>
        <TextInput
          className="min-w-0 flex-1 py-4 pr-3 text-white"
          placeholder="Código de clase"
          placeholderTextColor="#60799C"
          value={inviteCode}
          onChangeText={(value) => setInviteCode(value.trim().toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
        />
        <Pressable
          onPress={onJoinClass}
          disabled={joining}
          className="items-center justify-center px-5"
          style={({ pressed }) => ({ backgroundColor: '#8B5CF6', opacity: joining ? 0.7 : pressed ? 0.82 : 1 })}
        >
          {joining ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </View>
  )
}


function StudentMobileOnboardingCard({
  steps,
  className = '',
}: {
  steps: OnboardingStep[]
  className?: string
}) {
  const completed = steps.filter((step) => step.done).length
  const progressPercent = Math.round((completed / Math.max(steps.length, 1)) * 100)

  return (
    <View className={`overflow-hidden rounded-2xl border border-[#2B3F7A] bg-[#101D4A] p-4 ${className}`}>
      <View className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#7C5CFF]/20" />
      <View className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-[#58B5FF]/10" />
      <View className="relative">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-[12px] font-black uppercase tracking-[0.08em] text-[#9FD6FF]">
              Empieza con Omni
            </Text>
            <View className="mt-2 flex-row items-center gap-2">
              <OmniGuide state="happy" size={72} />
              <View className="min-w-0 flex-1">
                <Text className="mt-2 text-[20px] font-black text-white">Tu primera aventura</Text>
                <Text className="mt-1 text-[13px] leading-5 text-[#D8E3F3]">
                  ¡Hola, soy Omni! Te guiaré para unirte a un curso, responder tu primera pregunta y revisar tu progreso.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full bg-[#7C5CFF]" style={{ width: `${progressPercent}%` }} />
        </View>
        <Text className="mt-2 text-[12px] font-bold text-[#AFC2DB]">
          {completed} de {steps.length} pasos completados
        </Text>

        <View className="mt-4 gap-3">
          {steps.map((step, index) => (
            <View key={step.title} className="rounded-xl border border-[#1A3155] bg-[#0D1D3B] p-3">
              <View className="flex-row items-center gap-3">
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: step.done ? '#123D35' : '#142A51' }}
                >
                  <Ionicons
                    name={step.done ? 'checkmark-circle' : step.icon}
                    size={21}
                    color={step.done ? '#43D991' : '#9FD6FF'}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[13px] font-black text-white">
                    {index + 1}. {step.title}
                  </Text>
                  <Text className="mt-1 text-[12px] leading-5 text-[#AFC2DB]">{step.description}</Text>
                </View>
                <Pressable
                  onPress={step.onPress}
                  className="rounded-xl px-3 py-2"
                  style={({ pressed }) => ({
                    backgroundColor: step.done ? '#102846' : '#5A46D8',
                    opacity: pressed ? 0.82 : 1,
                  })}
                >
                  <Text className="text-[12px] font-black text-white">{step.actionLabel}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

function WeeklyGoalCard({
  count,
  target,
  percent,
  streakDays,
  className = '',
}: {
  count: number
  target: number
  percent: number
  streakDays: number
  className?: string
}) {
  const completed = count >= target
  const remaining = Math.max(0, target - count)

  return (
    <StudentActionBanner
      className={className}
      color={completed ? '#43D991' : '#8B5CF6'}
      icon={completed ? 'checkmark-done' : 'flag'}
      kicker="Objetivo semanal"
      title={`${count} / ${target} preguntas`}
      detail={completed
        ? `Has completado ${count} preguntas esta semana. Objetivo superado.`
        : `Te faltan ${remaining} para cumplir tu meta. Racha: ${streakDays} día${streakDays === 1 ? '' : 's'}.`}
    >
      <View className="flex-row items-center gap-3">
        <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full bg-[#7C5CFF]" style={{ width: `${percent}%` }} />
        </View>
        <View className="rounded-full bg-[#13284A] px-3 py-1">
          <Text className="text-[11px] font-black text-[#9FD6FF]">{getTimeUntilSundayLabel()}</Text>
        </View>
      </View>
    </StudentActionBanner>
  )
}

function HeroCard({ isWide, action }: { isWide: boolean; action: HomeHeroAction }) {
  const { accentColor } = useAppTheme()

  return (
    <View
      className="overflow-hidden rounded-2xl border border-[#1C3762] bg-[#0B1B48] flex-row items-center justify-between p-6"
      style={{ flex: isWide ? 1.55 : undefined, minHeight: 100 }}
    >
      <View className="absolute inset-0 bg-[#0D1C55]" />
      <View className="relative flex-1 justify-center">
        <Text style={{ fontFamily: 'Pacifico_400Regular', fontSize: 32 }} className="max-w-[420px] text-[24px] leading-10 text-white">{action.title}</Text>
        <Text className="mt-3 max-w-[300px] text-[14px] leading-6 text-[#B4C4DA]">
          {action.description}
        </Text>
        <Link href={action.href as any} asChild>
          <Pressable className="mt-5 w-[184px] flex-row items-center justify-center gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: accentColor }}>
            <Ionicons name={action.icon} size={18} color="#FFFFFF" />
            <Text className="font-bold text-white">{action.buttonLabel}</Text>
          </Pressable>
        </Link>
      </View>
      <OmniGuide state={action.icon === 'refresh-circle' ? 'thinking' : 'normal'} autoBlink={action.icon !== 'refresh-circle'} size={132} />

    </View>
  )
}

function SubjectRow({
  subject,
  index,
  progress,
}: {
  subject: Subject
  index: number
  progress?: StudentProgressSubject
}) {
  const colors = ['#4ADE80', '#8B5CF6', '#3B82F6']
  const progressPercent = progress?.percent ?? 0
  const color = subject.theme_color || colors[index] || '#58B5FF'

  return (
    <Link
      href={{
        pathname: '/(student)/class/[id]',
        params: { id: String(subject.id), ...(subject.classroom_id ? { classroomId: String(subject.classroom_id) } : {}) },
      }}
      asChild
    >
      <Pressable className="flex-row flex-wrap items-center gap-3 rounded-xl bg-[#0D1D3B] p-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}33` }}>
          {subject.icon ? (
            <Text className="text-[22px]">{subject.icon}</Text>
          ) : (
            <Ionicons name="book" size={24} color={color} />
          )}
        </View>
        <View className="min-w-[210px] flex-1">
          <Text className="font-black text-white">{subject.name}</Text>
          <Text className="mt-1 text-[13px] text-[#AFC2DB]" numberOfLines={1}>
            {subject.classroom_name ? `${subject.classroom_name} · ` : ''}
            {progress ? `${progressPercent}% completado` : 'Sin progreso registrado'}
          </Text>

        </View>
      </Pressable>
    </Link>
  )
}

function RankingSummaryCard({
  summary,
}: {
  summary: {
    position: number
    points: number
    aheadAlias?: string
    gapToAhead: number
    rivalAlias?: string
    rivalGap: number
  }
}) {
  return (
    <View className="rounded-xl border border-[#4F46E5]/70 bg-[#1A1450] p-4">
      <View className="flex-row items-center gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-xl bg-[#2B1D73]">
          <Ionicons name="trophy" size={30} color="#B9A7FF" />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[24px] font-black text-white">{summary.position}º · {summary.points.toLocaleString()} XP</Text>
            <View className="rounded-full bg-[#2D256B] px-2 py-1">
              <Text className="text-[11px] font-bold text-[#B9A7FF]">Global</Text>
            </View>
          </View>
          <Text className="mt-1 text-[13px] text-[#AFC2DB]">Tu posición actual en el ranking</Text>
        </View>
      </View>
      <View className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-[#263E61] bg-[#0D1D3B] px-3 py-3">
        <Ionicons name="trending-up" size={18} color="#43D991" />
        <Text className="text-[13px] font-bold text-[#DDE7F4]">
          {summary.rivalAlias
            ? `${summary.rivalAlias} está a ${summary.rivalGap.toLocaleString()} XP`
            : 'Vas primero en el ranking'}
        </Text>
      </View>
    </View>
  )
}


function getRankingSummary(rankingRows: Profile[], currentUserId: string | null, points: number) {
  const sortedRows = [...rankingRows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
  const currentIndex = sortedRows.findIndex((item) => item.id === currentUserId)
  const position = currentIndex >= 0
    ? currentIndex + 1
    : sortedRows.filter((item) => (item.points ?? 0) > points).length + 1
  const ahead = sortedRows
    .filter((item) => item.id !== currentUserId && (item.points ?? 0) > points)
    .sort((a, b) => (a.points ?? 0) - (b.points ?? 0))[0]
  const behind = sortedRows
    .filter((item) => item.id !== currentUserId && (item.points ?? 0) <= points)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0]
  const rival = ahead || behind
  const rivalGap = ahead
    ? Math.max(0, (ahead.points ?? 0) - points)
    : behind
      ? Math.max(0, points - (behind.points ?? 0))
      : 0

  return {
    position,
    points,
    aheadAlias: ahead?.alias,
    gapToAhead: ahead ? Math.max(0, (ahead.points ?? 0) - points) : 0,
    rivalAlias: rival?.alias,
    rivalGap,
  }
}

function buildClassHref(subject: Subject) {
  return {
    pathname: '/(student)/class/[id]',
    params: { id: String(subject.id), ...(subject.classroom_id ? { classroomId: String(subject.classroom_id) } : {}) },
  }
}

function getCourseRowKey(subject: { id: number; classroom_id?: number | null }) {
  return `${subject.id}:${subject.classroom_id ?? 'general'}`
}

function getProgressRowKey(subject: StudentProgressSubject) {
  return `${subject.id}:${subject.classroomId ?? 'general'}`
}

function normalizeRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function EmptyClasses() {
  return (
    <StudentEmptyState
      icon="school-outline"
      omniState="thinking"
      omniSize={92}
      title="Aún no tienes cursos"
      message="Introduce el código de tu profesor para unirte a un curso o clase."
    />
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${item.color}29` }}>
        <Ionicons name={item.icon} size={18} color={item.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-bold text-white">{item.title}</Text>
        <Text className="mt-1 text-[13px] text-[#AFC2DB]" numberOfLines={2}>
          {item.course} · {item.detail}
        </Text>
      </View>
      <Text className="text-[13px] text-[#8FA7C7]">{item.time}</Text>
    </View>
  )
}
