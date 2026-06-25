import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import TeacherSidebar from '../../components/TeacherSidebar';
import BrandLogo from '../../components/BrandLogo'
import NotificationBadge from '../../components/NotificationBadge';
import TeacherHeaderAvatar from '../../components/TeacherHeaderAvatar';

type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  theme_color: string | null
}

type SubjectAnalytics = {
  enrolledCount: number
  playedCount: number
  averageScore: number
  questionsCount: number
}

type QuestionSummary = {
  id: number
  subject_id: number | null
  text?: string | null
}

type RecentActivityItem = {
  id: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  title: string
  time: string
  timestamp: number
}

type EnrollmentActivityRow = {
  subject_id: number | null
  student_id: string | null
  joined_at?: string | null
}

type SubjectScoreRow = {
  subject_id: number | null
  student_id: string | null
  max_score: number | null
}

type AttemptActivityRow = {
  student_id: string | null
  is_correct: boolean | null
  question_id?: number | null
  attempted_at?: string | null
  questions?: { id?: number | null; subject_id: number | null; text?: string | null } | { id?: number | null; subject_id: number | null; text?: string | null }[] | null
}

type ProfileSummary = {
  id: string
  alias: string | null
}

type PendingActionItem = {
  id: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  title: string
  detail: string
  actionLabel: string
  href: string
}

export default function TeacherHomeScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [analyticsBySubject, setAnalyticsBySubject] = useState<Record<number, SubjectAnalytics>>({});
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingActionItem[]>([]);
  const [uniqueStudentCount, setUniqueStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDesktop = width >= 1080;
  const isWide = width >= 860;

  const totals = useMemo(() => {
    const analytics = Object.values(analyticsBySubject);
    const students = uniqueStudentCount;
    const questions = analytics.reduce((total, item) => total + item.questionsCount, 0);
    const attempts = analytics.reduce((total, item) => total + item.playedCount, 0);
    const weightedScore = analytics.reduce((total, item) => total + item.averageScore * item.playedCount, 0);

    return {
      students,
      questions,
      attempts,
      averageScore: attempts > 0 ? Math.round(weightedScore / attempts) : 0,
    };
  }, [analyticsBySubject, uniqueStudentCount]);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, description, icon, code, theme_color')
        .eq('teacher_id', session.session.user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const nextSubjects = (data || []) as Subject[];
      setSubjects(nextSubjects);

      const subjectIds = nextSubjects.map((subject) => subject.id);
      if (subjectIds.length === 0) {
        setAnalyticsBySubject({});
        setRecentActivity([]);
        setPendingActions([]);
        setUniqueStudentCount(0);
        return;
      }

      const [enrollmentsResult, scoresResult, questionsResult, attemptsResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('subject_id, student_id, joined_at')
          .in('subject_id', subjectIds)
          .order('joined_at', { ascending: false }),
        supabase.from('subject_scores').select('subject_id, student_id, max_score').in('subject_id', subjectIds),
        supabase.from('questions').select('id, subject_id, text').in('subject_id', subjectIds),
        supabase
          .from('attempt_history')
          .select('student_id, is_correct, question_id, attempted_at, questions(id, subject_id, text)')
          .order('attempted_at', { ascending: false })
          .limit(500),
      ]);

      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;
      if (questionsResult.error) throw questionsResult.error;
      if (attemptsResult.error) throw attemptsResult.error;
      const enrollments = (enrollmentsResult.data || []) as EnrollmentActivityRow[];
      const scores = (scoresResult.data || []) as SubjectScoreRow[];
      const questions = (questionsResult.data || []) as QuestionSummary[];
      const attempts = (attemptsResult.data || []) as AttemptActivityRow[];
      setUniqueStudentCount(getUniqueStudentCount(enrollments));

      const nextAnalytics: Record<number, SubjectAnalytics> = {};
      subjectIds.forEach((subjectId) => {
        const subjectEnrollments = enrollments.filter((item) => item.subject_id === subjectId) || [];
        const subjectScores = scores.filter(
          (item) => item.subject_id === subjectId && typeof item.max_score === 'number'
        ) || [];
        const subjectQuestions = questions.filter((item) => item.subject_id === subjectId) || [];
        const totalScore = subjectScores.reduce((total, item) => total + (item.max_score ?? 0), 0);

        nextAnalytics[subjectId] = {
          enrolledCount: subjectEnrollments.length,
          playedCount: subjectScores.length,
          averageScore: subjectScores.length > 0 ? Math.round(totalScore / subjectScores.length) : 0,
          questionsCount: subjectQuestions.length,
        };
      });
      setAnalyticsBySubject(nextAnalytics);

      const studentIds = Array.from(
        new Set(
          [
            ...(enrollments).map((item) => item.student_id),
            ...attempts.map((item) => item.student_id),
          ].filter((value): value is string => Boolean(value))
        )
      );
      const profilesById = studentIds.length > 0 ? await fetchProfilesById(studentIds) : {};
      setPendingActions(
        buildPendingActions({
          subjects: nextSubjects,
          enrollments,
          questions,
          attempts,
          scores,
          profilesById,
        })
      );
      setRecentActivity(
        buildRecentActivity({
          subjects: nextSubjects,
          enrollments,
          attempts,
          profilesById,
        })
      );
    } catch (error: any) {
      console.error('Error cargando inicio del profesor:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando inicio del profesor...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar
            activeSection="home"
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
          <View className="mb-7 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[280px] flex-1">
              {!isDesktop ? (
                <BrandLogo size={30} style={{ marginBottom: 12 }} />
              ) : null}
              <Text className="text-[40px] font-black text-white">¡Bienvenido de nuevo, Profesor! 👋</Text>
              <Text className="mt-2 text-[14px] text-[#B7C4D7]">
                Aquí tienes un resumen de tus clases y estudiantes.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <NotificationBadge
                audience="teacher"
                onPress={() => router.push('/(teacher)/notifications' as any)}
              />
              <TeacherHeaderAvatar />
            </View>
          </View>

          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <MetricCard icon="school" title="Cursos activos" value={String(subjects.length)} color="#8B5CF6" />
            <MetricCard icon="people" title="Estudiantes" value={String(totals.students)} color="#43D991" />
            <MetricCard icon="clipboard" title="Preguntas creadas" value={String(totals.questions)} color="#3B82F6" />
            <MetricCard icon="trophy" title="Puntuación media" value={`${totals.averageScore} Puntos`} color="#F6A64A" />
          </View>

          <View className={isDesktop ? 'mt-8 flex-row gap-6' : 'mt-8 gap-6'}>
            <View className={isDesktop ? 'flex-[1.6]' : ''}>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-[24px] font-black text-white">Cursos recientes</Text>
                <Link href="/(teacher)/classes" asChild>
                  <Pressable className="flex-row items-center gap-2">
                    <Text className="font-bold text-[#B9A7FF]">Ver todas</Text>
                    <Ionicons name="arrow-forward" size={15} color="#B9A7FF" />
                  </Pressable>
                </Link>
              </View>

              <View style={{ gap: 14 }}>
                {subjects.slice(0, 3).map((subject) => {
                  const analytics = analyticsBySubject[subject.id] || {
                    enrolledCount: 0,
                    playedCount: 0,
                    averageScore: 0,
                    questionsCount: 0,
                  };

                  return <SubjectPreview key={subject.id} subject={subject} analytics={analytics} />;
                })}
              </View>

              {subjects.length === 0 ? (
                <Pressable
                  onPress={() => router.push('/(teacher)/create-subject' as any)}
                  className="items-center justify-center rounded-2xl border border-dashed border-[#5364F5] bg-[#07162E] p-8"
                >
                  <Ionicons name="add-circle-outline" size={52} color="#9B8CFF" />
                  <Text className="mt-4 text-lg font-black text-white">Crea tu primera clase</Text>
                  <Text className="mt-2 text-center text-[#B7C4D7]">
                    Añade una asignatura para empezar a gestionar alumnos y preguntas.
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View className={isDesktop ? 'flex-1 gap-5' : 'gap-5'}>
              <Panel title="Actividad reciente" action="Ver todo" onAction={() => router.push('/(teacher)/notifications' as any)}>
                <View style={{ gap: 14 }}>
                  {recentActivity.length > 0 ? (
                    recentActivity.map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))
                  ) : (
                    <View className="rounded-xl border border-dashed border-[#253C67] bg-[#0D1D3B] px-4 py-5">
                      <Text className="text-center text-[12px] text-[#8FA7C7]">
                        Aún no hay actividad reciente en tus clases.
                      </Text>
                    </View>
                  )}
                </View>
              </Panel>

              <Panel title="Acciones pendientes" action="Ver clases" onAction={() => router.push('/(teacher)/classes' as any)}>
                <View style={{ gap: 10 }}>
                  {pendingActions.length > 0 ? (
                    pendingActions.map((item) => (
                      <PendingActionRow
                        key={item.id}
                        item={item}
                        onPress={() => router.push(item.href as any)}
                      />
                    ))
                  ) : (
                    <View className="rounded-xl border border-dashed border-[#253C67] bg-[#0D1D3B] px-4 py-5">
                      <Text className="text-center text-[12px] text-[#8FA7C7]">
                        No hay acciones pendientes ahora mismo.
                      </Text>
                    </View>
                  )}
                </View>
              </Panel>
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
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  value: string
  color: string
}) {
  return (
    <View className="min-w-[190px] flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${color}30` }}>
        <Ionicons name={icon} size={27} color={color} />
      </View>
      <Text className="text-[13px] text-[#B7C4D7]">{title}</Text>
      <Text className="mt-2 text-[28px] font-black text-white">{value}</Text>
    </View>
  );
}

function SubjectPreview({ subject, analytics }: { subject: Subject; analytics: SubjectAnalytics }) {
  return (
    <Link href={`/(teacher)/subject/${subject.id}`} asChild>
      <Pressable className="flex-row items-center gap-4 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
        <View className="h-14 w-14 items-center justify-center rounded-xl bg-[#172554]">
          {subject.icon ? <Text className="text-2xl">{subject.icon}</Text> : <Ionicons name="book-outline" size={26} color="#9B8CFF" />}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-lg font-black text-white" numberOfLines={1}>{subject.name}</Text>
          <Text className="mt-1 text-[12px] text-[#B7C4D7]" numberOfLines={1}>Código: {subject.code}</Text>
        </View>
        <View className="items-end">
          <Text className="font-black text-[#B9A7FF]">{analytics.averageScore} Puntos</Text>
          <Text className="text-[11px] text-[#8FA7C7]">{analytics.enrolledCount} alumnos</Text>
        </View>
      </Pressable>
    </Link>
  );
}

function Panel({
  title,
  action,
  onAction,
  children,
}: {
  title: string
  action: string
  onAction?: () => void
  children: React.ReactNode
}) {
  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-black text-white">{title}</Text>
        {onAction ? (
          <Pressable onPress={onAction} className="flex-row items-center gap-1">
            <Text className="text-[12px] font-semibold text-[#B9A7FF]">{action}</Text>
            <Ionicons name="arrow-forward" size={13} color="#B9A7FF" />
          </Pressable>
        ) : (
          <Text className="text-[12px] font-semibold text-[#B9A7FF]">{action}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

function ActivityRow({ item }: { item: RecentActivityItem }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${item.color}33` }}>
        <Ionicons name={item.icon} size={18} color={item.color} />
      </View>
      <Text className="min-w-0 flex-1 text-[13px] font-bold text-white">{item.title}</Text>
      <Text className="text-[11px] text-[#8FA7C7]">{item.time}</Text>
    </View>
  );
}

function PendingActionRow({ item, onPress }: { item: PendingActionItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-[#172A4A] bg-[#0D1D3B] px-4 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${item.color}29` }}>
        <Ionicons name={item.icon} size={18} color={item.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white" numberOfLines={1}>{item.title}</Text>
        <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={1}>{item.detail}</Text>
      </View>
      <Text className="text-[11px] font-bold text-[#B9A7FF]">{item.actionLabel}</Text>
    </Pressable>
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

function buildPendingActions({
  subjects,
  enrollments,
  questions,
  attempts,
  scores,
  profilesById,
}: {
  subjects: Subject[]
  enrollments: EnrollmentActivityRow[]
  questions: QuestionSummary[]
  attempts: AttemptActivityRow[]
  scores: SubjectScoreRow[]
  profilesById: Record<string, ProfileSummary>
}): PendingActionItem[] {
  const teacherSubjectIds = new Set(subjects.map((subject) => subject.id));
  const questionsBySubject = groupBySubjectId(questions);
  const enrollmentsBySubject = groupBySubjectId(enrollments);
  const actions: PendingActionItem[] = [];

  subjects
    .filter((subject) => (questionsBySubject.get(subject.id)?.length || 0) === 0)
    .slice(0, 2)
    .forEach((subject) => {
      actions.push({
        id: `no-questions-${subject.id}`,
        icon: 'help-circle-outline',
        color: '#38BDF8',
        title: 'Clase sin preguntas',
        detail: `${subject.name} todavía no tiene contenido.`,
        actionLabel: 'Añadir',
        href: `/(teacher)/subject/add-question?subjectId=${subject.id}`,
      });
    });

  subjects
    .filter((subject) => (enrollmentsBySubject.get(subject.id)?.length || 0) === 0)
    .slice(0, 2)
    .forEach((subject) => {
      actions.push({
        id: `no-students-${subject.id}`,
        icon: 'person-add-outline',
        color: '#F6A64A',
        title: 'Clase sin alumnos',
        detail: `${subject.name} no tiene estudiantes inscritos.`,
        actionLabel: 'Invitar',
        href: `/(teacher)/subject/students?subjectId=${subject.id}`,
      });
    });

  const activeStudentSubjectPairs = new Set<string>();

  scores.forEach((score) => {
    if (score.subject_id && score.student_id && typeof score.max_score === 'number' && score.max_score > 0) {
      activeStudentSubjectPairs.add(`${score.subject_id}:${score.student_id}`);
    }
  });

  attempts.forEach((attempt) => {
    const question = normalizeQuestionRelation(attempt.questions);
    const subjectId = question?.subject_id ?? null;

    if (subjectId && teacherSubjectIds.has(subjectId) && attempt.student_id) {
      activeStudentSubjectPairs.add(`${subjectId}:${attempt.student_id}`);
    }
  });

  subjects
    .map((subject) => {
      const inactiveStudents = (enrollmentsBySubject.get(subject.id) || [])
        .filter((enrollment) => enrollment.student_id && !activeStudentSubjectPairs.has(`${subject.id}:${enrollment.student_id}`));

      return { subject, inactiveStudents };
    })
    .filter((item) => item.inactiveStudents.length > 0)
    .sort((left, right) => right.inactiveStudents.length - left.inactiveStudents.length)
    .slice(0, 2)
    .forEach(({ subject, inactiveStudents }) => {
      const firstStudent = getStudentName(inactiveStudents[0]?.student_id, profilesById);
      const remaining = inactiveStudents.length - 1;

      actions.push({
        id: `inactive-students-${subject.id}`,
        icon: 'flash-outline',
        color: '#EC4899',
        title: 'Alumnos sin actividad',
        detail: remaining > 0
          ? `${firstStudent} y ${remaining} más en ${subject.name}.`
          : `${firstStudent} todavía no ha jugado en ${subject.name}.`,
        actionLabel: 'Revisar',
        href: '/(teacher)/students',
      });
    });

  const failedQuestions = new Map<number, { subjectId: number; text: string; failures: number }>();

  attempts.forEach((attempt) => {
    if (attempt.is_correct !== false) return;

    const question = normalizeQuestionRelation(attempt.questions);
    const questionId = attempt.question_id ?? question?.id ?? null;
    const subjectId = question?.subject_id ?? null;

    if (!questionId || !subjectId || !teacherSubjectIds.has(subjectId)) return;

    const current = failedQuestions.get(questionId) || {
      subjectId,
      text: question?.text || 'Pregunta sin texto',
      failures: 0,
    };

    current.failures += 1;
    failedQuestions.set(questionId, current);
  });

  Array.from(failedQuestions.entries())
    .map(([questionId, item]) => ({ questionId, ...item }))
    .filter((item) => item.failures >= 3)
    .sort((left, right) => right.failures - left.failures)
    .slice(0, 2)
    .forEach((item) => {
      actions.push({
        id: `failed-question-${item.questionId}`,
        icon: 'warning-outline',
        color: '#F43F5E',
        title: 'Pregunta con muchos fallos',
        detail: `${item.failures} fallos · ${truncateText(item.text, 42)}`,
        actionLabel: 'Informe',
        href: `/(teacher)/subject/${item.subjectId}?tab=reports`,
      });
    });

  return actions.slice(0, 5);
}

function buildRecentActivity({
  subjects,
  enrollments,
  attempts,
  profilesById,
}: {
  subjects: Subject[]
  enrollments: EnrollmentActivityRow[]
  attempts: AttemptActivityRow[]
  profilesById: Record<string, ProfileSummary>
}) {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const teacherSubjectIds = new Set(subjects.map((subject) => subject.id));

  const enrollmentItems: RecentActivityItem[] = enrollments
    .filter((enrollment) => enrollment.subject_id && enrollment.student_id && enrollment.joined_at)
    .map((enrollment) => {
      const subject = enrollment.subject_id ? subjectsById.get(enrollment.subject_id) : null;
      const studentName = getStudentName(enrollment.student_id, profilesById);
      const timestamp = toTimestamp(enrollment.joined_at);

      return {
        id: `enrollment-${enrollment.subject_id}-${enrollment.student_id}-${timestamp}`,
        icon: 'person-add-outline',
        color: '#8B5CF6',
        title: `${studentName} se unió a ${subject?.name || 'una clase'}`,
        time: formatRelativeDate(enrollment.joined_at),
        timestamp,
      };
    });

  const attemptItems: RecentActivityItem[] = attempts
    .map((attempt) => {
      const question = normalizeQuestionRelation(attempt.questions);
      const subjectId = question?.subject_id ?? null;
      if (!subjectId || !teacherSubjectIds.has(subjectId) || !attempt.attempted_at) return null;

      const subject = subjectsById.get(subjectId);
      const studentName = getStudentName(attempt.student_id, profilesById);
      const timestamp = toTimestamp(attempt.attempted_at);
      const wasCorrect = Boolean(attempt.is_correct);

      return {
        id: `attempt-${subjectId}-${attempt.student_id}-${timestamp}-${wasCorrect ? 'ok' : 'ko'}`,
        icon: wasCorrect ? 'checkmark-circle-outline' : 'close-circle-outline',
        color: wasCorrect ? '#34D399' : '#F97316',
        title: `${studentName} respondió ${wasCorrect ? 'correctamente' : 'un reto'} en ${subject?.name || 'una clase'}`,
        time: formatRelativeDate(attempt.attempted_at),
        timestamp,
      };
    })
    .filter((item): item is RecentActivityItem => Boolean(item));

  return [...enrollmentItems, ...attemptItems]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 5);
}

function normalizeQuestionRelation(value: AttemptActivityRow['questions']) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function groupBySubjectId<T extends { subject_id: number | null }>(rows: T[]) {
  return rows.reduce<Map<number, T[]>>((map, row) => {
    if (typeof row.subject_id !== 'number') {
      return map;
    }

    const group = map.get(row.subject_id) || [];
    group.push(row);
    map.set(row.subject_id, group);
    return map;
  }, new Map());
}

function getStudentName(studentId: string | null | undefined, profilesById: Record<string, ProfileSummary>) {
  if (!studentId) return 'Un alumno';
  return profilesById[studentId]?.alias || 'Un alumno';
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatRelativeDate(value: string | null | undefined) {
  const timestamp = toTimestamp(value);
  if (timestamp === 0) return 'Sin fecha';

  const diffDays = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `${diffDays} días`;

  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(timestamp));
}

function truncateText(value: string, maxLength: number) {
  const cleanValue = value.trim();
  if (cleanValue.length <= maxLength) return cleanValue;
  return `${cleanValue.slice(0, maxLength - 3)}...`;
}

function getUniqueStudentCount(rows: { student_id: string | null | undefined }[]) {
  return new Set(
    rows
      .map((row) => row.student_id)
      .filter((value): value is string => Boolean(value))
  ).size;
}
