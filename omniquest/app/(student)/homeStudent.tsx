import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, } from 'react-native'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { getStudentLevel, getNextLevelProgress } from '../../lib/studentLevel'
import { getTimeAgo } from '../../lib/time'
import StudentSidebar from '../../components/StudentSidebar'
import BrandLogo from '../../components/BrandLogo'
import NotificationBadge from '../../components/NotificationBadge'
import { fetchStudentProgressSummary, type StudentProgressSummary, type StudentProgressSubject } from '../../lib/studentProgress'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentHeaderAvatar from '../../components/student/StudentHeaderAvatar'
import StudentDashboardCard, { StudentCardLink as CardLink } from '../../components/student/StudentDashboardCard'
import StudentMetricCard from '../../components/student/StudentMetricCard'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { joinClassByInviteCode } from '../../lib/studentClassJoin'

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
}

type ActivityItem = {
  id: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  title: string
  detail: string
  time: string
}

type SubjectScore = {
  subject_id: number | null
  classroom_id?: number | null
  max_score: number | null
  played_at: string | null
  played_days: string[] | null
}

type HomeHeroAction = {
  title: string
  description: string
  buttonLabel: string
  icon: keyof typeof Ionicons.glyphMap
  href: unknown
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
      title: `Tienes ${failedQuestions} ${failedQuestions === 1 ? 'pregunta fallada' : 'preguntas falladas'} para repasar`,
      description: `Empieza por ${failedRow.subject.name} y refuerza lo que más te está costando.`,
      buttonLabel: 'Repasar fallos',
      icon: 'refresh-circle',
      href: buildClassHref(failedRow.subject),
    }
  }

  if (pendingRow?.progress) {
    const pending = pendingRow.progress.pendingQuestions
    return {
      title: `Continúa con ${pendingRow.subject.name}`,
      description: `Te ${pending === 1 ? 'queda' : 'quedan'} ${pending} ${pending === 1 ? 'pregunta' : 'preguntas'} por practicar.`,
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

function getRecommendedSubject(subjects: Subject[], progressRows: StudentProgressSubject[]): SubjectProgressRow | null {
  return getSubjectProgressRows(subjects, progressRows)[0] ?? null
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
  const [subjectScores, setSubjectScores] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ranking, setRanking] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([])
  const [attemptCount, setAttemptCount] = useState(0)
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
  const failedQuestions = progressSummary?.subjects.reduce(
    (sum, subject) => sum + subject.failedQuestions,
    0
  ) ?? 0
  const heroAction = useMemo(
    () => buildHomeHeroAction(enrolledSubjects, progressSummary?.subjects ?? [], failedQuestions),
    [enrolledSubjects, failedQuestions, progressSummary?.subjects]
  )

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

  const recommendedSubject = useMemo(
    () => getRecommendedSubject(enrolledSubjects, progressSummary?.subjects ?? []),
    [enrolledSubjects, progressSummary?.subjects]
  )

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
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      const [profileResult, enrollmentsResult, scoresResult, rankingResult, activityResult, attemptHistoryResult, progressResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, points, role_id').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('classroom_id, joined_at, subjects(*), classrooms(id, name, code)')
          .eq('student_id', userId)
          .order('joined_at', { ascending: false }),
        supabase
          .from('subject_scores')
          .select('subject_id, classroom_id, max_score, played_at, played_days')
          .eq('student_id', userId),
        supabase
          .from('profiles')
          .select('id, alias, avatar, points')
          .eq('role_id', 'student')
          .order('points', { ascending: false })
          .limit(5),
        supabase
          .from('attempt_history')
          .select(`
            id,
            is_correct,
            attempted_at,
            questions (
              text,
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
        fetchStudentProgressSummary(userId),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;
      if (rankingResult.error) throw rankingResult.error;
      if (activityResult.error) throw activityResult.error;
      if (attemptHistoryResult.error) throw attemptHistoryResult.error;

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

      setProgressSummary(progressResult);

      const scoreRows = (scoresResult.data || []) as SubjectScore[];
      const scoreMap: Record<string, number> = {};
      scoreRows.forEach((score) => {
        const key = getCourseRowKey({ id: Number(score.subject_id), classroom_id: score.classroom_id ?? null });
        if (score.subject_id !== null && score.max_score !== null) {
          scoreMap[key] = score.max_score;
        }
      });
      setSubjectScores(scoreMap);
      const activities: ActivityItem[] = (activityResult.data || []).map((attempt: any) => {
        const timeAgo = getTimeAgo(attempt.attempted_at);
        const isCorrect = attempt.is_correct;
        const topicData = attempt.questions?.subject_topics;
        const topicTitle = Array.isArray(topicData) ? topicData[0]?.title : topicData?.title;
        const questionText = attempt.questions?.text;

        return {
          id: String(attempt.id),
          icon: isCorrect ? 'checkmark' : 'close',
          color: isCorrect ? '#70E0A5' : '#FB7185',
          title: isCorrect ? 'Acertaste una pregunta' : 'Fallaste una pregunta',
          detail: questionText || (topicTitle ? `Tema: ${topicTitle}` : 'Práctica'),
          time: timeAgo,
        };
      });

      setActivityItems(activities.length > 0 ? activities : [{
        id: 'empty-activity',
        icon: 'rocket',
        color: '#3B82F6',
        title: '¡Tu aventura comienza aquí!',
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
        <ActivityIndicator size="large" color="#6574FF" />
        <Text className="mt-4 text-[#8FA7C7]">Preparando tu aventura...</Text>
      </View>
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
            paddingBottom: isDesktop ? 28 : 104,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row items-start justify-between gap-4">
            <View className="flex-1">
              {!isDesktop ? (
                <BrandLogo size={30} style={{ marginBottom: 12 }} />
              ) : null}
              <Text className="text-[40px] font-black text-white">¡Hola, {alias}! 👋</Text>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                ¿Listo para seguir aprendiendo y alcanzar tus metas?
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <NotificationBadge />
              <StudentHeaderAvatar />
            </View>
          </View>

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <HeroCard isWide={isWide} action={heroAction} />

            <View className={isWide ? 'flex-row gap-3' : 'gap-3'}>
              <StudentMetricCard
                title="Avance de cursos"
                value={`${progressPercent}%`}
                icon="analytics-outline"
                color="#43D991"
                onPress={() => router.push('/(student)/progress')}
              />
              <StudentMetricCard
                title="Preguntas completadas"
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

          {recommendedSubject ? (
            <RecommendedSubjectCard row={recommendedSubject} className="mt-5" />
          ) : null}

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <StudentDashboardCard title="Continúa aprendiendo" className={isDesktop ? 'flex-[1.15]' : ''} compact>
              <View style={{ gap: 10 }}>
                {enrolledSubjects.length > 0 ? (
                  enrolledSubjects.slice(0, 3).map((subject, index) => (
                    <SubjectRow
                      key={getCourseRowKey(subject)}
                      subject={subject}
                      index={index}
                      score={subjectScores[getCourseRowKey(subject)]}
                      progress={progressSummary?.subjects.find((item) => getProgressRowKey(item) === getCourseRowKey(subject))}
                    />
                  ))
                ) : (
                  <EmptyClasses />
                )}
              </View>
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

          <StudentDashboardCard title="¿Tienes un código de clase?" className="mt-5" compact>
            <View className={isWide ? 'flex-row items-center gap-3' : 'gap-3'}>
              <Text className="flex-1 text-[13px] leading-5 text-[#AFC2DB]">
                Únete a otro curso o clase con el código que te haya dado tu profesor.
              </Text>
              <View className={isWide ? 'min-w-[360px] flex-row gap-3' : 'flex-row gap-3'}>
                <TextInput
                  className="min-w-0 flex-1 rounded-xl border border-[#20375E] bg-[#091A35] px-4 py-3 text-center font-bold uppercase tracking-widest text-white"
                  placeholder="CÓDIGO"
                  placeholderTextColor="#60799C"
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  maxLength={6}
                  autoCapitalize="characters"
                />
                <Pressable
                  onPress={handleJoinClass}
                  disabled={joining}
                  className="items-center justify-center rounded-xl px-5"
                  style={({ pressed }) => ({ backgroundColor: accentColor, opacity: joining ? 0.7 : pressed ? 0.82 : 1 })}
                >
                  {joining ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="font-bold text-white">Unirse</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </StudentDashboardCard>
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="home" /> : null}
    </View>
  )
}

function HeroCard({ isWide, action }: { isWide: boolean; action: HomeHeroAction }) {
  const { accentColor } = useAppTheme()

  return (
    <View
      className="overflow-hidden rounded-2xl border border-[#1C3762] bg-[#0B1B48]"
      style={{ flex: isWide ? 1.55 : undefined, minHeight: 220 }}
    >
      <View className="absolute inset-0 bg-[#0D1C55]" />
      <View className="absolute right-5 top-5 h-28 w-28 rounded-full bg-[#5135D8]/50" />
      <View className="absolute right-11 top-12 h-12 w-36 rounded-full border border-[#7B68FF]/45" style={{ transform: [{ rotate: '-18deg' }] }} />
      <View className="absolute bottom-[-34px] right-12 h-36 w-36 rounded-full bg-[#051337]" />
      <View className="absolute bottom-[-54px] right-28 h-28 w-40 rounded-full bg-[#071C50]" />
      <View className="absolute bottom-12 right-28 h-3 w-3 rounded-full bg-[#7B68FF]" />
      <Ionicons
        name="rocket"
        size={72}
        color="#58B5FF"
        style={{ position: 'absolute', bottom: 42, right: 68, transform: [{ rotate: '34deg' }] }}
      />

      <View className="relative flex-1 justify-center p-8">
        <Text style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }} className="max-w-[420px] text-[24px] leading-10 text-white">{action.title}</Text>
        <Text className="mt-3 max-w-[360px] text-[14px] leading-6 text-[#B4C4DA]">
          {action.description}
        </Text>

        <Link href={action.href as any} asChild>
          <Pressable className="mt-5 w-[184px] flex-row items-center justify-center gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: accentColor }}>
            <Ionicons name={action.icon} size={18} color="#FFFFFF" />
            <Text className="font-bold text-white">{action.buttonLabel}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  )
}

function SubjectRow({
  subject,
  index,
  score,
  progress,
}: {
  subject: Subject
  index: number
  score?: number
  progress?: StudentProgressSubject
}) {
  const colors = ['#4ADE80', '#8B5CF6', '#3B82F6']
  const hasScore = typeof score === 'number'
  const progressPercent = progress?.percent ?? 0
  const status = getClassProgressStatus(progress)
  const action = getSubjectAction(progress)
  const color = subject.theme_color || colors[index] || '#58B5FF'
  const { accentColor } = useAppTheme()

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
          <Text className="mt-1 text-[12px] font-bold" style={{ color: action.color }}>
            {getSubjectActionDetail(progress, hasScore ? score : undefined, status.label)}
          </Text>
        </View>
        <View
          className="min-w-[96px] flex-row items-center justify-center gap-2 rounded-lg px-3 py-2"
          style={{ backgroundColor: action.isPrimary ? accentColor : withAlpha(action.color, '28') }}
        >
          <Ionicons name={action.icon} size={14} color="#FFFFFF" />
          <Text className="hidden text-[12px] font-bold text-white sm:flex">
            {action.label}
          </Text>
        </View>
      </Pressable>
    </Link>
  )
}

function RecommendedSubjectCard({ row, className = '' }: { row: SubjectProgressRow; className?: string }) {
  const { accentColor } = useAppTheme()
  const action = getSubjectAction(row.progress)
  const detail = getSubjectActionDetail(row.progress, undefined, getClassProgressStatus(row.progress).label)

  return (
    <StudentDashboardCard title="Recomendado para ti" className={className} compact>
      <Link href={buildClassHref(row.subject) as any} asChild>
        <Pressable className="flex-row flex-wrap items-center gap-4 rounded-xl border border-[#20375E] bg-[#0D1D3B] p-4">
          <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(action.color, '28') }}>
            <Ionicons name={action.icon} size={24} color={action.color} />
          </View>
          <View className="min-w-[220px] flex-1">
            <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: action.color }}>
              Recomendado
            </Text>
            <Text className="mt-1 text-[18px] font-black text-white">{row.subject.name}</Text>
            <Text className="mt-1 text-[13px] text-[#AFC2DB]" numberOfLines={1}>
              {detail}{row.subject.classroom_name ? ` · ${row.subject.classroom_name}` : ''}
            </Text>
          </View>
          <View className="flex-row items-center gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: action.isPrimary ? accentColor : withAlpha(action.color, '30') }}>
            <Ionicons name={action.icon} size={16} color="#FFFFFF" />
            <Text className="font-black text-white">
              {action.label === 'Repasar' ? 'Repasar ahora' : action.label}
            </Text>
          </View>
        </Pressable>
      </Link>
    </StudentDashboardCard>
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
  }
}) {
  return (
    <View className="rounded-xl border border-[#20375E] bg-[#0D1D3B] p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#241B62]">
          <Ionicons name="trophy" size={24} color="#B9A7FF" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[24px] font-black text-white">{summary.position}º · {summary.points.toLocaleString()} XP</Text>
          <Text className="mt-1 text-[13px] text-[#AFC2DB]">
            {summary.aheadAlias
              ? `${summary.aheadAlias} está a ${summary.gapToAhead.toLocaleString()} XP`
              : 'Vas en cabeza entre los datos visibles'}
          </Text>
        </View>
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

  return {
    position,
    points,
    aheadAlias: ahead?.alias,
    gapToAhead: ahead ? Math.max(0, (ahead.points ?? 0) - points) : 0,
  }
}

function buildClassHref(subject: Subject) {
  return {
    pathname: '/(student)/class/[id]',
    params: { id: String(subject.id), ...(subject.classroom_id ? { classroomId: String(subject.classroom_id) } : {}) },
  }
}

function getSubjectAction(progress?: StudentProgressSubject): {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  isPrimary: boolean
} {
  if (progress?.failedQuestions && progress.failedQuestions > 0) {
    return { label: 'Repasar', icon: 'refresh-circle', color: '#FB7185', isPrimary: false }
  }

  if (progress?.pendingQuestions && progress.pendingQuestions > 0) {
    return progress.answeredQuestions > 0
      ? { label: 'Continuar', icon: 'play-forward', color: '#8B5CF6', isPrimary: true }
      : { label: 'Empezar', icon: 'play', color: '#43D991', isPrimary: true }
  }

  return { label: 'Ver temas', icon: 'albums', color: '#58B5FF', isPrimary: false }
}

function getSubjectActionDetail(progress: StudentProgressSubject | undefined, score: number | undefined, statusLabel: string) {
  if (!progress) {
    return score !== undefined ? `Mejor puntuación: ${score.toLocaleString()} XP` : statusLabel
  }

  if (progress.failedQuestions > 0) {
    return `${progress.failedQuestions} ${progress.failedQuestions === 1 ? 'pregunta fallada' : 'preguntas falladas'}`
  }

  if (progress.pendingQuestions > 0) {
    return `${progress.pendingQuestions} ${progress.pendingQuestions === 1 ? 'pendiente' : 'pendientes'} por practicar`
  }

  return score !== undefined ? `Mejor puntuación: ${score.toLocaleString()} XP` : statusLabel
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

function getClassProgressStatus(progress?: StudentProgressSubject) {
  const percent = progress?.percent ?? 0
  const failed = progress?.failedQuestions ?? 0

  if (percent >= 100 && failed > 0) {
    return { label: 'Repasar fallos', color: '#FB7185', backgroundColor: '#2A1420' }
  }

  if (progress?.isCompleted || percent >= 100) {
    return { label: 'Completada', color: '#43D991', backgroundColor: '#0F2F2B' }
  }

  if (percent > 0) {
    return { label: 'En progreso', color: '#FBBF24', backgroundColor: '#2A210F' }
  }

  return { label: 'Sin empezar', color: '#AFC2DB', backgroundColor: '#122544' }
}

function EmptyClasses() {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#20375E] bg-[#091A35] px-4 py-6">
      <Ionicons name="school-outline" size={34} color="#60799C" />
      <Text className="mt-3 text-center font-bold text-white">Aún no tienes cursos</Text>
      <Text className="mt-1 text-center text-[13px] leading-5 text-[#8FA7C7]">
        Introduce el código de tu profesor para unirte a un curso o clase.
      </Text>
    </View>
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
        <Text className="mt-1 text-[13px] text-[#8FA7C7]">{item.detail}</Text>
      </View>
      <Text className="text-[13px] text-[#8FA7C7]">{item.time}</Text>
    </View>
  )
}
