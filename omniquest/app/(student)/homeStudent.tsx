import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, } from 'react-native'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { getWeeklyAttemptCount } from '../../lib/weeklyGoal'
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
  max_score: number | null
  played_at: string | null
  played_days: string[] | null
}

export default function StudentHome() {
  const { width } = useWindowDimensions()
  const [inviteCode, setInviteCode] = useState('')
  const [enrolledSubjects, setEnrolledSubjects] = useState<Subject[]>([])
  const [subjectScores, setSubjectScores] = useState<Record<number, number>>({});
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ranking, setRanking] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([])
  const [attemptCount, setAttemptCount] = useState(0)
  const [weeklyGoalCount, setWeeklyGoalCount] = useState(0)
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

  const topRanking = useMemo(() => {
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

      const [profileResult, enrollmentsResult, scoresResult, rankingResult, activityResult, attemptHistoryResult, weeklyGoalResult, progressResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, points, role_id').eq('id', userId).single(),
        supabase
          .from('enrollments')
          .select('*, subjects(*)')
          .eq('student_id', userId)
          .order('joined_at', { ascending: false }),
        supabase
          .from('subject_scores')
          .select('subject_id, max_score, played_at, played_days')
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
        getWeeklyAttemptCount(userId),
        fetchStudentProgressSummary(userId),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;
      if (rankingResult.error) throw rankingResult.error;
      if (activityResult.error) throw activityResult.error;
      if (attemptHistoryResult.error) throw attemptHistoryResult.error;

      setProfile(profileResult.data);
      setEnrolledSubjects(enrollmentsResult.data?.map(e => e.subjects).filter(Boolean) || []);
      setRanking(rankingResult.data || []);
      setAttemptCount(attemptHistoryResult.count ?? 0);

      setWeeklyGoalCount(weeklyGoalResult || 0);
      setProgressSummary(progressResult);

      const scoreRows = (scoresResult.data || []) as SubjectScore[];
      const scoreMap: Record<number, number> = {};
      scoreRows.forEach((score) => {
        if (score.subject_id !== null && score.max_score !== null) {
          scoreMap[score.subject_id] = score.max_score;
        }
      });
      setSubjectScores(scoreMap);
      const activities: ActivityItem[] = (activityResult.data || []).map((attempt: any) => {
        const timeAgo = getTimeAgo(attempt.attempted_at);
        const isCorrect = attempt.is_correct;
        const topicData = attempt.questions?.subject_topics;
        const topicTitle = Array.isArray(topicData) ? topicData[0]?.title : topicData?.title;

        return {
          id: String(attempt.id),
          icon: isCorrect ? 'checkmark' : 'close',
          color: isCorrect ? '#70E0A5' : '#FB7185',
          title: isCorrect ? 'Acertaste una pregunta' : 'Fallaste una pregunta',
          detail: topicTitle ? `Tema: ${topicTitle}` : 'Práctica',
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
      const { subjectName } = await joinClassByInviteCode(inviteCode)
      showAlert('¡Éxito!', `Te has unido a ${subjectName}`)
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
            <HeroCard isWide={isWide} firstSubject={enrolledSubjects[0]} />

            <View className={isWide ? 'flex-row gap-3' : 'gap-3'}>
              <StudentMetricCard
                title="Progreso general"
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
                title="Preguntas correctas"
                value={String(progressSummary?.correctAttempts ?? 0)}
                icon="checkmark-circle"
                color="#58B5FF"
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

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <StudentDashboardCard title="Continúa aprendiendo" className={isDesktop ? 'flex-[1.15]' : ''} compact>
              <View style={{ gap: 10 }}>
                {enrolledSubjects.length > 0 ? (
                  enrolledSubjects.slice(0, 3).map((subject, index) => (
                    <SubjectRow
                      key={subject.id}
                      subject={subject}
                      index={index}
                      score={subjectScores[subject.id]}
                      progress={progressSummary?.subjects.find((item) => item.id === subject.id)}
                    />
                  ))
                ) : (
                  <EmptyClasses />
                )}
              </View>

              <View className="mt-4 border-t border-[#172A4A] pt-4">
                <View className="flex-row gap-3">
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

            <StudentDashboardCard title="Actividad reciente" className={isDesktop ? 'flex-1' : ''} compact>
              <View style={{ gap: 16 }}>
                {activityItems.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </View>
              <CardLink label="Ver toda la actividad" onPress={() => router.push('/(student)/activity-log')}
              />
            </StudentDashboardCard>

            <StudentDashboardCard title="Top 5 del ranking" className={isDesktop ? 'flex-1' : ''} compact>
              <View style={{ gap: 7 }}>
                {topRanking.map((item, index) => (
                  <RankingRow
                    key={item.id}
                    item={item}
                    index={index}
                    isMe={item.id === currentUserId}
                  />
                ))}
              </View>
              <CardLink label="Ver ranking completo" onPress={() => router.push('/(student)/ranking' as any)} />
            </StudentDashboardCard>
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active="home" /> : null}
    </View>
  )
}

function HeroCard({ isWide, firstSubject }: { isWide: boolean; firstSubject?: Subject }) {
  const playHref = firstSubject
    ? {
      pathname: '/(student)/class/[id]',
      params: { id: String(firstSubject.id) },
    }
    : undefined
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
        <Text style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }} className="max-w-[400px] text-[24px] leading-10 text-white">Tu viaje de aprendizaje continúa</Text>
        <Text className="mt-3 max-w-[360px] text-[14px] leading-6 text-[#B4C4DA]">
          Sigue explorando, completando preguntas y superando tus límites cada día.
        </Text>

        {playHref ? (
          <Link href={playHref as any} asChild>
            <Pressable className="mt-5 w-[154px] flex-row items-center justify-center gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: accentColor }}>
              <Ionicons name="play" size={18} color="#FFFFFF" />
              <Text className="font-bold text-white">Elegir tema</Text>
            </Pressable>
          </Link>
        ) : (
          <View className="mt-5 w-[184px] rounded-xl px-4 py-3" style={{ backgroundColor: withAlpha(accentColor, '35') }}>
            <Text className="text-center font-bold text-[#B4C4DA]">Únete a una clase</Text>
          </View>
        )}
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
  const color = subject.theme_color || colors[index] || '#58B5FF'
  const { accentColor } = useAppTheme()

  return (
    <Link
      href={{
        pathname: '/(student)/class/[id]',
        params: { id: String(subject.id) },
      }}
      asChild
    >
      <Pressable className="flex-row items-center rounded-xl bg-[#0D1D3B] p-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}33` }}>
          {subject.icon ? (
            <Text className="text-[22px]">{subject.icon}</Text>
          ) : (
            <Ionicons name="book" size={24} color={color} />
          )}
        </View>
        <View className="ml-3 min-w-0 flex-1">
          <Text className="font-black text-white">{subject.name}</Text>
          <Text className="mt-1 text-[13px] text-[#8FA7C7]" numberOfLines={1}>
            {subject.description || 'Preguntas y ejercicios disponibles'}
          </Text>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <View className={`rounded-md px-2 py-1 ${hasScore ? 'bg-[#221B58]' : 'bg-[#122544]'}`}>
              <Text className={`text-[12px] font-bold ${hasScore ? 'text-[#B9A7FF]' : 'text-[#8FA7C7]'}`}>
                {hasScore ? `Mejor nota: ${score.toLocaleString()} XP` : 'Sin puntuación'}
              </Text>
            </View>
            {progress?.isCompleted ? (
              <View className="rounded-md bg-[#0F2F2B] px-2 py-1">
                <Text className="text-[12px] font-bold text-[#43D991]">Completada</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View className="mx-3 h-2 w-16 overflow-hidden rounded-full bg-[#182D50]">
          <View className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: color }} />
        </View>
        <Text className="mr-3 text-[13px] text-[#8FA7C7]">{progressPercent}%</Text>
        <View className="ml-2 flex-row items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: accentColor }}>
          <Ionicons name="albums" size={14} color="#FFFFFF" />
          <Text className="hidden text-[12px] font-bold text-white sm:flex">
            Temas
          </Text>
        </View>
      </Pressable>
    </Link>
  )
}

function EmptyClasses() {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#20375E] bg-[#091A35] px-4 py-6">
      <Ionicons name="school-outline" size={34} color="#60799C" />
      <Text className="mt-3 text-center font-bold text-white">Aún no tienes clases</Text>
      <Text className="mt-1 text-center text-[13px] leading-5 text-[#8FA7C7]">
        Introduce el código de tu profesor para empezar a responder preguntas.
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

function RankingRow({ item, index, isMe }: { item: Profile; index: number; isMe: boolean }) {
  const medalColors = ['#FBBF24', '#CBD5E1', '#F97316']
  const { accentColor } = useAppTheme()

  return (
    <View
      className={`flex-row items-center rounded-xl px-2 py-2 ${isMe ? 'border' : ''}`}
      style={isMe ? { borderColor: accentColor, backgroundColor: withAlpha(accentColor, '24') } : undefined}
    >
      <View className="w-8 items-center">
        {index < 3 ? (
          <Ionicons name="medal" size={18} color={medalColors[index]} />
        ) : (
          <Text className="font-bold text-[#AFC2DB]">{index + 1}</Text>
        )}
      </View>
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-[#17315E]">
        {item.avatar && item.avatar.startsWith('http') ? (
          <Image source={{ uri: item.avatar }} className="h-full w-full rounded-full" />
        ) : (
          <Text className="text-lg">🧑‍🎓</Text>
        )}
      </View>
      <Text className={`min-w-0 flex-1 text-[13px] font-bold ${isMe ? 'text-white' : 'text-[#DDE7F4]'}`} numberOfLines={1}>
        {item.alias}
      </Text>
      <Text className="text-[13px] text-[#AFC2DB]">{(item.points ?? 0).toLocaleString()} XP</Text>
    </View>
  )
}