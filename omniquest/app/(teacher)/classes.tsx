import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import TeacherSidebar from '../../components/TeacherSidebar';
import NotificationBadge from '../../components/NotificationBadge';
import TeacherHeaderAvatar from '../../components/TeacherHeaderAvatar';

type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  theme_color: string | null
  created_at?: string | null
}

type SubjectAnalytics = {
  enrolledCount: number
  activeStudentsCount: number
  playedCount: number
  answeredQuestionsCount: number
  availableQuestionsCount: number
  averageScore: number
  questionsCount: number
  topicsCount: number
  enrolledThisWeek: number
  activeStudentsThisWeek: number
  playedThisWeek: number
  questionsThisWeek: number
}

type Enrollment = {
  subject_id: number | null
  student_id: string | null
  joined_at?: string | null
}

type SubjectScore = {
  subject_id: number | null
  student_id: string | null
  max_score: number | null
  played_at?: string | null
}

type QuestionSummary = {
  id: number
  subject_id: number | null
  text?: string | null
  created_at?: string | null
}

type AttemptSummary = {
  student_id: string | null
  question_id: number | null
  attempted_at?: string | null
}

type TopicSummary = {
  subject_id: number | null
  title?: string | null
  created_at?: string | null
}

type ProfileSummary = {
  id: string
  alias: string | null
}

type ActivityPlanItem = {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  title: string
  detail: string
  label: string
}

type RecentActivityItem = {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  title: string
  detail: string
  time: string
  timestamp: number
}

type ClassStatus = 'unconfigured' | 'no_activity' | 'in_progress' | 'completed'
type ClassFilter = 'all' | ClassStatus
type ClassSort = 'recent' | 'name' | 'participation'

const teacherClassFilters: { id: ClassFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'Todas', icon: 'apps-outline' },
  { id: 'unconfigured', label: 'Sin configurar', icon: 'construct-outline' },
  { id: 'no_activity', label: 'Sin actividad', icon: 'pause-circle-outline' },
  { id: 'in_progress', label: 'En curso', icon: 'time-outline' },
  { id: 'completed', label: 'Completadas', icon: 'checkmark-done-outline' },
]

const teacherClassSorts: { id: ClassSort; label: string }[] = [
  { id: 'recent', label: 'Reciente' },
  { id: 'name', label: 'Nombre' },
  { id: 'participation', label: 'Participación' },
]

const emptySubjectAnalytics: SubjectAnalytics = {
  enrolledCount: 0,
  activeStudentsCount: 0,
  playedCount: 0,
  answeredQuestionsCount: 0,
  availableQuestionsCount: 0,
  averageScore: 0,
  questionsCount: 0,
  topicsCount: 0,
  enrolledThisWeek: 0,
  activeStudentsThisWeek: 0,
  playedThisWeek: 0,
  questionsThisWeek: 0,
}

export default function TeacherClassesScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [analyticsBySubject, setAnalyticsBySubject] = useState<Record<number, SubjectAnalytics>>({});
  const [activityPlan, setActivityPlan] = useState<ActivityPlanItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<ClassFilter>('all');
  const [selectedSort, setSelectedSort] = useState<ClassSort>('recent');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentStats, setStudentStats] = useState({
    uniqueStudents: 0,
    uniqueStudentsThisWeek: 0,
    uniqueActiveStudents: 0,
  });

  const isDesktop = width >= 1080;
  const isWide = width >= 860;

  const filteredSubjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    let rows = subjects;

    if (selectedFilter !== 'all') {
      rows = rows.filter((subject) => {
        const analytics = analyticsBySubject[subject.id] || emptySubjectAnalytics;

        return getClassStatus(analytics) === selectedFilter;
      });
    }

    if (normalizedSearch) {
      rows = rows.filter((subject) =>
        `${subject.name} ${subject.description || ''} ${subject.code}`.toLowerCase().includes(normalizedSearch)
      );
    }

    return [...rows].sort((left, right) => {
      if (selectedSort === 'name') {
        return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' });
      }

      if (selectedSort === 'participation') {
        const rightAnalytics = analyticsBySubject[right.id] || emptySubjectAnalytics;
        const leftAnalytics = analyticsBySubject[left.id] || emptySubjectAnalytics;
        return getParticipationRate(rightAnalytics) - getParticipationRate(leftAnalytics)
          || rightAnalytics.playedCount - leftAnalytics.playedCount
          || left.name.localeCompare(right.name, 'es', { sensitivity: 'base' });
      }

      return toTimestamp(right.created_at) - toTimestamp(left.created_at);
    });
  }, [analyticsBySubject, search, selectedFilter, selectedSort, subjects]);

  const totals = useMemo(() => {
    const analytics = Object.values(analyticsBySubject);

    const totalStudents = analytics.reduce((total, item) => total + item.enrolledCount, 0);
    const totalActiveStudents = analytics.reduce((total, item) => total + item.activeStudentsCount, 0);
    const totalQuestions = analytics.reduce((total, item) => total + item.questionsCount, 0);
    const totalPlayed = analytics.reduce((total, item) => total + item.playedCount, 0);
    const totalAnsweredQuestions = analytics.reduce((total, item) => total + item.answeredQuestionsCount, 0);
    const totalAvailableQuestions = analytics.reduce((total, item) => total + item.availableQuestionsCount, 0);
    const weightedScore = analytics.reduce((total, item) => total + item.averageScore * item.playedCount, 0);
    const enrolledThisWeek = analytics.reduce((total, item) => total + item.enrolledThisWeek, 0);
    const activeStudentsThisWeek = analytics.reduce((total, item) => total + item.activeStudentsThisWeek, 0);
    const playedThisWeek = analytics.reduce((total, item) => total + item.playedThisWeek, 0);
    const questionsThisWeek = analytics.reduce((total, item) => total + item.questionsThisWeek, 0);

    return {
      students: totalStudents,
      activeStudents: totalActiveStudents,
      questions: totalQuestions,
      participation: totalStudents > 0
        ? Math.round((totalActiveStudents / totalStudents) * 100)
        : 0,
      progress: totalAvailableQuestions > 0
        ? Math.round((totalAnsweredQuestions / totalAvailableQuestions) * 100)
        : 0,
      averageScore: totalPlayed > 0 ? Math.round(weightedScore / totalPlayed) : 0,
      enrolledThisWeek,
      activeStudentsThisWeek,
      playedThisWeek,
      questionsThisWeek,
    };
  }, [analyticsBySubject]);

  const fetchSubjects = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, description, icon, code, theme_color, created_at')
        .eq('teacher_id', session.session.user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const nextSubjects = (data || []) as Subject[];
      setSubjects(nextSubjects);

      const subjectIds = nextSubjects.map((subject) => subject.id);
      if (subjectIds.length === 0) {
        setAnalyticsBySubject({});
        setActivityPlan([]);
        setRecentActivity([]);
        setStudentStats({
          uniqueStudents: 0,
          uniqueStudentsThisWeek: 0,
          uniqueActiveStudents: 0,
        });
        return;
      }

      const [enrollmentsResult, scoresResult, questionsResult, topicsResult] = await Promise.all([
        supabase.from('enrollments').select('subject_id, student_id, joined_at').in('subject_id', subjectIds),
        supabase.from('subject_scores').select('subject_id, student_id, max_score, played_at').in('subject_id', subjectIds),
        supabase.from('questions').select('id, subject_id, text, created_at').in('subject_id', subjectIds),
        supabase.from('subject_topics').select('subject_id, title, created_at').in('subject_id', subjectIds).eq('active', true),
      ]);

      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;
      if (questionsResult.error) throw questionsResult.error;
      if (topicsResult.error) throw topicsResult.error;

      const enrollments = (enrollmentsResult.data || []) as Enrollment[];
      const scores = (scoresResult.data || []) as SubjectScore[];
      const questions = (questionsResult.data || []) as QuestionSummary[];
      const topics = (topicsResult.data || []) as TopicSummary[];
      const weekStart = getRecentThresholdDate(7);
      const questionIds = questions
        .map((question) => question.id)
        .filter((id): id is number => typeof id === 'number');

      let attempts: AttemptSummary[] = [];

      if (questionIds.length > 0) {
        const { data: attemptsData, error: attemptsError } = await supabase
          .from('attempt_history')
          .select('student_id, question_id, attempted_at')
          .in('question_id', questionIds);

        if (attemptsError) throw attemptsError;

        attempts = (attemptsData || []) as AttemptSummary[];
      }
      const uniqueStudentIds = getUniqueStudentIds(enrollments);

      const uniqueStudentIdsThisWeek = getUniqueStudentIds(
        enrollments.filter((item) => isAfterDate(item.joined_at, weekStart))
      );

      const uniqueActiveStudentIds = getUniqueStudentIds(
        scores.filter((item) => typeof item.max_score === 'number' && (item.max_score ?? 0) > 0)
      );

      setStudentStats({
        uniqueStudents: uniqueStudentIds.length,
        uniqueStudentsThisWeek: uniqueStudentIdsThisWeek.length,
        uniqueActiveStudents: uniqueActiveStudentIds.length,
      });

      const studentIds = Array.from(
        new Set(
          [...enrollments.map((item) => item.student_id), ...scores.map((item) => item.student_id)]
            .filter((value): value is string => Boolean(value))
        )
      );
      const profilesById = studentIds.length > 0 ? await fetchProfilesById(studentIds) : {};

      const nextAnalytics: Record<number, SubjectAnalytics> = {};

      subjectIds.forEach((subjectId) => {
        const subjectEnrollments = enrollments.filter((item) => item.subject_id === subjectId);

        const enrolledStudentIds = getUniqueIds(
          subjectEnrollments.map((item) => item.student_id)
        );

        const enrolledStudentIdSet = new Set(enrolledStudentIds);

        const subjectScores = scores.filter(
          (item) =>
            item.subject_id === subjectId &&
            typeof item.max_score === 'number' &&
            item.student_id &&
            enrolledStudentIdSet.has(item.student_id)
        );

        const subjectQuestions = questions.filter((item) => item.subject_id === subjectId);
        const subjectQuestionIds = new Set(subjectQuestions.map((question) => question.id));

        const subjectAttempts = attempts.filter(
          (attempt) =>
            attempt.question_id &&
            subjectQuestionIds.has(attempt.question_id) &&
            attempt.student_id &&
            enrolledStudentIdSet.has(attempt.student_id)
        );

        const answeredPairs = getUniqueAnswerPairs(subjectAttempts);
        const activeStudentIds = getUniqueIds(subjectAttempts.map((attempt) => attempt.student_id));

        const activeStudentsThisWeek = getUniqueIds(
          subjectAttempts
            .filter((attempt) => isAfterDate(attempt.attempted_at, weekStart))
            .map((attempt) => attempt.student_id)
        ).length;

        const subjectTopics = topics.filter((item) => item.subject_id === subjectId);
        const totalScore = subjectScores.reduce((total, item) => total + (item.max_score ?? 0), 0);

        const availableQuestionsCount = enrolledStudentIds.length * subjectQuestions.length;

        nextAnalytics[subjectId] = {
          enrolledCount: enrolledStudentIds.length,
          activeStudentsCount: activeStudentIds.length,
          playedCount: subjectScores.length,
          answeredQuestionsCount: answeredPairs.length,
          availableQuestionsCount,
          averageScore: subjectScores.length > 0 ? Math.round(totalScore / subjectScores.length) : 0,
          questionsCount: subjectQuestions.length,
          topicsCount: subjectTopics.length,
          enrolledThisWeek: getUniqueIds(
            subjectEnrollments
              .filter((item) => isAfterDate(item.joined_at, weekStart))
              .map((item) => item.student_id)
          ).length,
          activeStudentsThisWeek,
          playedThisWeek: subjectAttempts.filter((item) => isAfterDate(item.attempted_at, weekStart)).length,
          questionsThisWeek: subjectQuestions.filter((item) => isAfterDate(item.created_at, weekStart)).length,
        };
      });
      setAnalyticsBySubject(nextAnalytics);
      setActivityPlan(buildActivityPlan(nextSubjects, nextAnalytics));
      setRecentActivity(buildRecentActivity({ enrollments, scores, questions, subjects: nextSubjects, profilesById }));
    } catch (error: any) {
      console.error('Error cargando clases:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSubjects();
    }, [fetchSubjects])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubjects();
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const showComingSoon = (feature: string) => {
    showAlert('Próximamente', `${feature} estará disponible en una próxima iteración.`);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando tus clases...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar
            activeSection="classes"
            subjectsCount={subjects.length}
            onSignOut={() => supabase.auth.signOut()}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 28 : 18,
            paddingBottom: 32,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[260px] flex-1">
              {!isDesktop ? (
                <Text className="mb-3 text-[#9FD6FF]" style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}>
                  OmniQuest
                </Text>
              ) : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="book" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Mis Clases</Text>
              </View>
              <Text className="mt-2 text-[14px] text-[#B7C4D7]">
                Gestiona tus asignaturas, estudiantes y actividades.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => router.push('/(teacher)/create-subject' as any)}
                className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-5 py-3"
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text className="font-bold text-white">Crear clase</Text>
              </Pressable>
              <NotificationBadge
                audience="teacher"
                onPress={() => router.push('/(teacher)/notifications' as any)}
              />
              <TeacherHeaderAvatar />
            </View>
          </View>

          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <MetricCard icon="school" title="Clases activas" value={String(subjects.length)} trend={formatWeeklyTrend(subjects.filter((subject) => isAfterDate(subject.created_at, getRecentThresholdDate(7))).length, 'clase nueva', 'clases nuevas')} color="#8B5CF6" />
            <MetricCard icon="people" title="Estudiantes" value={String(totals.students)} trend={formatWeeklyTrend(totals.enrolledThisWeek, 'estudiante nuevo', 'estudiantes nuevos')} color="#43D991" />
            <MetricCard icon="clipboard" title="Preguntas" value={String(totals.questions)} trend={formatWeeklyTrend(totals.questionsThisWeek, 'pregunta nueva', 'preguntas nuevas')} color="#3B82F6" />
            <MetricCard icon="people-circle" title="Participación media" value={`${totals.participation}%`} trend={formatWeeklyTrend(totals.activeStudentsThisWeek, 'alumno activo', 'alumnos activos')} color="#F6A64A" />
          </View>

          <View className={isDesktop ? 'mt-6 flex-row gap-5' : 'mt-6 gap-5'}>
            <View className={isDesktop ? 'flex-[1.55]' : ''}>
              <View className="mb-4 flex-row flex-wrap items-center gap-3">
                <View className="h-12 min-w-[260px] flex-1 flex-row items-center rounded-xl border border-[#20375E] bg-[#09162C] px-4">
                  <TextInput
                    className="min-w-0 flex-1 text-white"
                    placeholder="Buscar clase..."
                    placeholderTextColor="#8FA7C7"
                    value={search}
                    onChangeText={setSearch}
                  />
                  <Ionicons name="search-outline" size={20} color="#AFC2DB" />
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {teacherClassFilters.map((filter) => {
                    const active = selectedFilter === filter.id;
                    return (
                      <Pressable
                        key={filter.id}
                        onPress={() => setSelectedFilter(filter.id)}
                        className={`h-12 flex-row items-center gap-2 rounded-xl border px-4 ${active ? 'border-[#5D64FF] bg-[#4F46E5]' : 'border-[#20375E] bg-[#09162C]'
                          }`}
                      >
                        <Ionicons name={filter.icon} size={16} color={active ? '#FFFFFF' : '#B9A7FF'} />
                        <Text className={`font-semibold ${active ? 'text-white' : 'text-[#DDE7F4]'}`}>{filter.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  onPress={() => setSelectedSort((current) => getNextClassSort(current))}
                  className="h-12 flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4"
                >
                  <Text className="font-semibold text-[#DDE7F4]">Ordenar por: {getClassSortLabel(selectedSort)}</Text>
                  <Ionicons name="swap-vertical-outline" size={16} color="#AFC2DB" />
                </Pressable>
              </View>

              <View style={{ gap: 16 }}>
                {filteredSubjects.map((subject, index) => (
                  <ClassCard
                    key={subject.id}
                    subject={subject}
                    index={index}
                    analytics={analyticsBySubject[subject.id] || emptySubjectAnalytics}
                    onComingSoon={showComingSoon}
                  />
                ))}
              </View>

              {filteredSubjects.length === 0 ? <EmptyClasses hasAnyClasses={subjects.length > 0} /> : null}

              <Pressable
                onPress={() => router.push('/(teacher)/create-subject' as any)}
                className="mt-5 flex-row items-center justify-center gap-6 rounded-2xl border border-dashed border-[#5364F5] bg-[#07162E] px-6 py-10"
                style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
              >
                <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-[#4F46E5] bg-[#251F63]">
                  <Ionicons name="add" size={34} color="#9B8CFF" />
                </View>
                <View className="min-w-0">
                  <Text className="text-[20px] font-black text-white">Crear nueva clase</Text>
                  <Text className="mt-2 text-[#B7C4D7]">Añade una nueva asignatura y comienza a gestionar a tus alumnos.</Text>
                </View>
              </Pressable>
            </View>

            <View className={isDesktop ? 'flex-1 gap-4' : 'gap-4'}>
              <SidePanel title="Siguientes acciones" action="Ver todas">
                <View style={{ gap: 10 }}>
                  {activityPlan.length > 0 ? (
                    activityPlan.map((item) => <ActivityPlanRow key={`${item.title}-${item.detail}`} item={item} />)
                  ) : (
                    <EmptyPanelRow icon="checkmark-done-outline" text="Tus clases no tienen acciones pendientes." />
                  )}
                </View>
              </SidePanel>

              <SidePanel title="Participación por clase" action="Ver informe">
                <View style={{ gap: 14 }}>
                  {subjects.slice(0, 3).map((subject) => {
                    const analytics = analyticsBySubject[subject.id] || emptySubjectAnalytics;
                    const participation = getParticipationPercent(analytics);
                    return <ProgressRow key={subject.id} label={subject.name} value={participation} color={subject.theme_color || '#8B5CF6'} />;
                  })}
                </View>
              </SidePanel>

              <SidePanel title="Actividad reciente en clases" action="Ver todo">
                <View style={{ gap: 13 }}>
                  {recentActivity.length > 0 ? (
                    recentActivity.map((item) => <RecentActivityRow key={`${item.title}-${item.timestamp}`} item={item} />)
                  ) : (
                    <EmptyPanelRow icon="time-outline" text="Todavía no hay actividad registrada." />
                  )}
                </View>
              </SidePanel>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function MetricCard({
  icon,
  title,
  value,
  trend,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  value: string
  trend: string
  color: string
}) {
  const hasGrowth = !trend.toLowerCase().startsWith('sin');
  const trendColor = hasGrowth ? '#58E28B' : '#8FA7C7';

  return (
    <View className="min-w-[190px] flex-1 overflow-hidden rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="flex-row items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${color}30` }}>
          <Ionicons name={icon} size={30} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] text-[#B7C4D7]">{title}</Text>
          <Text className="mt-1 text-[26px] font-black text-white">{value}</Text>
        </View>
      </View>
      <View className="mt-4 flex-row items-center gap-2">
        <Ionicons name={hasGrowth ? 'arrow-up' : 'remove'} size={13} color={trendColor} />
        <Text className="text-[12px] font-semibold" style={{ color: trendColor }}>{trend}</Text>
      </View>
    </View>
  );
}

function ClassCard({
  subject,
  index,
  analytics,
  onComingSoon,
}: {
  subject: Subject
  index: number
  analytics: SubjectAnalytics
  onComingSoon: (feature: string) => void
}) {
  const fallbackColors = ['#8B5CF6', '#3B82F6', '#34D399', '#F6A64A'];
  const color = subject.theme_color || fallbackColors[index % fallbackColors.length];
  const participation = getParticipationPercent(analytics);
  const progress = getProgressPercent(analytics);
  const status = getClassStatusMeta(getClassStatus(analytics));

  return (
    <View className={`overflow-hidden rounded-2xl border bg-[#09162C] ${index === 0 ? 'border-[#6D5AF6]' : 'border-[#1A3155]'}`}>
      <Link href={`/(teacher)/subject/${subject.id}`} asChild>
        <Pressable className="flex-row flex-wrap items-center gap-5 p-5" style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}>
          <View
            className="h-20 w-20 items-center justify-center rounded-xl border"
            style={{ backgroundColor: `${color}28`, borderColor: `${color}66` }}
          >
            {subject.icon ? (
              <Text className="text-[34px]">{subject.icon}</Text>
            ) : (
              <Ionicons name={index % 2 === 0 ? 'book-outline' : 'calculator-outline'} size={36} color={color} />
            )}
          </View>

          <View className="min-w-[220px] flex-1">
            <Text className="text-[22px] font-black text-white">{subject.name}</Text>
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <Text className="text-[12px] text-[#B7C4D7]">{subject.description || '2º Bachillerato A'}</Text>
              <Text className="text-[12px] text-[#60799C]">•</Text>
              <Text className="text-[12px] text-[#B7C4D7]">Código:</Text>
              <Text className="rounded-full bg-[#111E3C] px-2 py-1 font-mono text-[12px] font-bold text-[#9B8CFF]">{subject.code}</Text>
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <SmallPill icon={status.icon} label={status.label} color={status.color} />
              <SmallPill icon="albums-outline" label={`${analytics.topicsCount} temas`} color="#F6A64A" />
              <SmallPill icon="people-outline" label={`${analytics.enrolledCount} alumnos`} color="#38bdf8" />
              <SmallPill icon="trophy-outline" label={`${analytics.averageScore} Puntuación media`} color="#B9A7FF" />
              <SmallPill icon="people-circle-outline" label={`${participation}% participación`} color="#58E28B" />
              <SmallPill icon="checkmark-circle-outline" label={`${analytics.answeredQuestionsCount} respondidas`} color="#43D991" />            </View>
          </View>

          <View className="ml-auto items-center gap-2">
            <ProgressRing progress={progress} color={color} />
            <Text className="text-[12px] text-[#B7C4D7]">Progreso</Text>
          </View>
        </Pressable>
      </Link>

      <View className="flex-row flex-wrap border-t border-[#172A4A] bg-[#07162E]">
        <ClassAction href={`/(teacher)/subject/${subject.id}`} icon="eye-outline" label="Ver clase" />
        <ClassAction href={`/(teacher)/subject/students?subjectId=${subject.id}`} icon="people-outline" label="Estudiantes" />
        <ClassAction href={`/(teacher)/subject/${subject.id}?tab=reports`} icon="analytics-outline" label="Informes" />
        <ClassAction href={`/(teacher)/edit-subject?id=${subject.id}`} icon="create-outline" label="Editar" />
      </View>
    </View>
  );
}

function ClassAction({
  href,
  icon,
  label,
  onPress,
}: {
  href?: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
}) {
  const content = (
    <View className="min-w-[120px] flex-1 flex-row items-center justify-center gap-2 px-4 py-3">
      <Ionicons name={icon} size={15} color="#AFC2DB" />
      <Text className="text-[12px] font-semibold text-[#DDE7F4]">{label}</Text>
    </View>
  );

  if (href) {
    return (
      <Link href={href as any} asChild>
        <Pressable className="flex-1">{content}</Pressable>
      </Link>
    );
  }

  return <Pressable onPress={onPress} className="flex-1">{content}</Pressable>;
}

function SmallPill({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-[#20375E] bg-[#07162E] px-3 py-2">
      <Ionicons name={icon} size={14} color={color} />
      <Text className="text-[12px] font-semibold text-[#DDE7F4]">{label}</Text>
    </View>
  );
}

function ProgressRing({ progress, color }: { progress: number; color: string }) {
  return (
    <View className="h-20 w-20 items-center justify-center rounded-full border-[6px] bg-[#07162E]" style={{ borderColor: progress > 0 ? color : '#1A3155' }}>
      <Text className="text-[19px] font-black text-white">{progress}%</Text>
    </View>
  );
}

function EmptyClasses({ hasAnyClasses }: { hasAnyClasses: boolean }) {
  return (
    <View className="items-center justify-center rounded-2xl border border-dashed border-[#20375E] bg-[#09162C] p-8">
      <Ionicons name="school-outline" size={58} color="#60799C" />
      <Text className="mt-4 text-center text-lg font-bold text-white">
        {hasAnyClasses ? 'No hay clases que coincidan' : 'Aún no tienes clases'}
      </Text>
      <Text className="mt-2 text-center text-sm text-[#8FA7C7]">
        {hasAnyClasses
          ? 'Cambia el filtro o la búsqueda para ver más clases.'
          : 'Crea tu primera asignatura para empezar a gestionar alumnos.'}
      </Text>
    </View>
  );
}

function SidePanel({ title, action, children }: { title: string; action: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-black text-white">{title}</Text>
        <Pressable>
          <Text className="text-[12px] font-semibold text-[#B9A7FF]">{action}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function ActivityPlanRow({ item }: { item: ActivityPlanItem }) {
  return (
    <View className="flex-row items-center gap-4 rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-3">
      <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${item.color}33` }}>
        <Ionicons name={item.icon} size={20} color={item.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-black text-white" numberOfLines={1}>{item.title}</Text>
        <Text className="mt-1 text-[12px] text-[#B7C4D7]" numberOfLines={1}>{item.detail}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Ionicons name="flag-outline" size={15} color="#AFC2DB" />
        <Text className="text-[12px] font-semibold text-white">{item.label}</Text>
      </View>
    </View>
  );
}

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[12px] font-semibold text-white">{label}</Text>
        <Text className="text-[12px] text-[#DDE7F4]">{value}%</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
        <View className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function RecentActivityRow({ item }: { item: RecentActivityItem }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${item.color}33` }}>
        <Ionicons name={item.icon} size={17} color={item.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-bold text-white" numberOfLines={1}>{item.title}</Text>
        <Text className="mt-1 text-[11px] text-[#B7C4D7]" numberOfLines={1}>{item.detail}</Text>
      </View>
      <Text className="text-[11px] text-[#8FA7C7]">{item.time}</Text>
    </View>
  );
}

function EmptyPanelRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="items-center justify-center rounded-xl border border-dashed border-[#20375E] bg-[#0D1D3B] p-4">
      <Ionicons name={icon} size={24} color="#8FA7C7" />
      <Text className="mt-2 text-center text-[12px] text-[#8FA7C7]">{text}</Text>
    </View>
  );
}

async function fetchProfilesById(studentIds: string[]) {
  const { data, error } = await supabase.from('profiles').select('id, alias').in('id', studentIds);
  if (error) throw error;

  return ((data || []) as ProfileSummary[]).reduce<Record<string, ProfileSummary>>((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {});
}

function buildActivityPlan(subjects: Subject[], analyticsBySubject: Record<number, SubjectAnalytics>): ActivityPlanItem[] {
  const actionItems = subjects.flatMap((subject) => {
    const analytics = analyticsBySubject[subject.id] || emptySubjectAnalytics;
    const color = subject.theme_color || '#8B5CF6';
    const items: ActivityPlanItem[] = [];

    if (analytics.questionsCount === 0) {
      items.push({
        icon: 'clipboard-outline',
        color,
        title: 'Añadir primeras preguntas',
        detail: subject.name,
        label: 'Contenido',
      });
    }

    if (analytics.enrolledCount === 0) {
      items.push({
        icon: 'person-add-outline',
        color: '#38BDF8',
        title: 'Invitar estudiantes',
        detail: subject.name,
        label: 'Clase vacía',
      });
    }

    if (analytics.enrolledCount > 0 && analytics.activeStudentsCount === 0) {
      items.push({
        icon: 'flash-outline',
        color: '#F6A64A',
        title: 'Impulsar primera partida',
        detail: subject.name,
        label: 'Sin actividad',
      });
    }

    if (analytics.enrolledCount > 0 && analytics.activeStudentsCount > 0) {
      const participation = getParticipationPercent(analytics);
      if (participation < 60) {
        items.push({
          icon: 'analytics-outline',
          color: '#EC4899',
          title: 'Revisar participación',
          detail: `${subject.name} · ${participation}%`,
          label: 'Seguimiento',
        });
      }
    }

    return items;
  });

  return actionItems.slice(0, 3);
}

function buildRecentActivity({
  enrollments,
  scores,
  questions,
  subjects,
  profilesById,
}: {
  enrollments: Enrollment[]
  scores: SubjectScore[]
  questions: QuestionSummary[]
  subjects: Subject[]
  profilesById: Record<string, ProfileSummary>
}) {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));

  const scoreItems: RecentActivityItem[] = scores
    .filter((score) => score.played_at)
    .map((score) => {
      const subject = score.subject_id ? subjectsById.get(score.subject_id) : null;
      const studentName = getStudentName(score.student_id, profilesById);
      const timestamp = toTimestamp(score.played_at);

      return {
        icon: 'trophy',
        color: '#F6A64A',
        title: `${studentName} completó una partida`,
        detail: `${score.max_score ?? 0} puntos en ${subject?.name || 'una clase'}`,
        time: formatRelativeDate(score.played_at),
        timestamp,
      };
    });

  const enrollmentItems: RecentActivityItem[] = enrollments
    .filter((enrollment) => enrollment.joined_at)
    .map((enrollment) => {
      const subject = enrollment.subject_id ? subjectsById.get(enrollment.subject_id) : null;
      const studentName = getStudentName(enrollment.student_id, profilesById);
      const timestamp = toTimestamp(enrollment.joined_at);

      return {
        icon: 'person-add',
        color: '#3B82F6',
        title: `Nueva inscripción en ${subject?.name || 'una clase'}`,
        detail: studentName,
        time: formatRelativeDate(enrollment.joined_at),
        timestamp,
      };
    });

  const questionItems: RecentActivityItem[] = questions
    .filter((question) => question.created_at)
    .map((question) => {
      const subject = question.subject_id ? subjectsById.get(question.subject_id) : null;
      const timestamp = toTimestamp(question.created_at);

      return {
        icon: 'checkmark',
        color: '#34D399',
        title: `Pregunta creada en ${subject?.name || 'una clase'}`,
        detail: question.text ? truncateText(question.text, 52) : 'Nueva pregunta disponible',
        time: formatRelativeDate(question.created_at),
        timestamp,
      };
    });

  return [...scoreItems, ...enrollmentItems, ...questionItems]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 4);
}

function getStudentName(studentId: string | null, profilesById: Record<string, ProfileSummary>) {
  if (!studentId) return 'Alumno';
  return profilesById[studentId]?.alias || 'Alumno';
}

function getNextClassSort(current: ClassSort) {
  const currentIndex = teacherClassSorts.findIndex((sort) => sort.id === current);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % teacherClassSorts.length : 0;
  return teacherClassSorts[nextIndex].id;
}

function getClassSortLabel(current: ClassSort) {
  return teacherClassSorts.find((sort) => sort.id === current)?.label || 'Reciente';
}

function getParticipationRate(analytics: SubjectAnalytics) {
  if (analytics.enrolledCount <= 0) return 0;

  return analytics.activeStudentsCount / analytics.enrolledCount;
}

function getParticipationPercent(analytics: SubjectAnalytics) {
  return Math.round(getParticipationRate(analytics) * 100);
}

function getProgressPercent(analytics: SubjectAnalytics) {
  if (analytics.availableQuestionsCount <= 0) return 0;

  return Math.min(
    100,
    Math.round((analytics.answeredQuestionsCount / analytics.availableQuestionsCount) * 100)
  );
}

function getClassStatus(analytics: SubjectAnalytics): ClassStatus {
  if (analytics.questionsCount === 0 || analytics.enrolledCount === 0) {
    return 'unconfigured';
  }

  if (analytics.answeredQuestionsCount <= 0) {
    return 'no_activity';
  }

  if (analytics.availableQuestionsCount > 0 && analytics.answeredQuestionsCount >= analytics.availableQuestionsCount) {
    return 'completed';
  }

  return 'in_progress';
}

function getClassStatusMeta(status: ClassStatus): {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
} {
  if (status === 'unconfigured') {
    return { label: 'Sin configurar', icon: 'construct-outline', color: '#F6A64A' };
  }

  if (status === 'no_activity') {
    return { label: 'Sin actividad', icon: 'pause-circle-outline', color: '#8FA7C7' };
  }

  if (status === 'completed') {
    return { label: 'Completada', icon: 'checkmark-done-outline', color: '#34D399' };
  }

  return { label: 'En curso', icon: 'time-outline', color: '#3B82F6' };
}

function getUniqueIds(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(
      values.filter((value): value is string => Boolean(value))
    )
  );
}

function getUniqueAnswerPairs(attempts: AttemptSummary[]) {
  return Array.from(
    new Set(
      attempts
        .filter((attempt) => attempt.student_id && attempt.question_id)
        .map((attempt) => `${attempt.student_id}:${attempt.question_id}`)
    )
  );
}

function getRecentThresholdDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function isAfterDate(value: string | null | undefined, threshold: Date) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= threshold;
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatWeeklyTrend(count: number, singular: string, plural: string) {
  if (count <= 0) return 'Sin cambios esta semana';
  return `+${count} ${count === 1 ? singular : plural} esta semana`;
}

function formatRelativeDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha';

  const timestamp = toTimestamp(value);
  if (!timestamp) return 'Sin fecha';

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return 'Ahora';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(timestamp));
}

function truncateText(value: string, maxLength: number) {
  const cleanValue = value.trim();
  if (cleanValue.length <= maxLength) return cleanValue;
  return `${cleanValue.slice(0, maxLength - 3)}...`;
}

function getUniqueStudentIds(rows: { student_id: string | null | undefined }[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => row.student_id)
        .filter((value): value is string => Boolean(value))
    )
  );
}
