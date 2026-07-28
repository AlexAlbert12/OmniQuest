import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import TeacherSidebar from '../../components/teacher/TeacherSidebar';
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav';
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader';
import { withAlpha } from '../../lib/color';
import OmniGuide from '../../components/OmniGuide';
import TeacherScreenLayout from '../../components/layouts/TeacherScreenLayout';
import { useResponsiveLayout } from '../../lib/responsive';
import {
  TeacherPriorityOverview,
  TeacherTodayFocus,
} from '../../components/teacher/home/TeacherHomePriorities';

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
  classroomCount: number
}

type QuestionSummary = {
  id: number
  subject_id: number | null
  text?: string | null
}

type ClassroomSummary = {
  id: number
  subject_id: number | null
  name: string | null
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

type ProblematicQuestionItem = {
  id: string
  questionId: number
  subjectId: number
  subjectName: string
  text: string
  failures: number
  editHref: string
  reportHref: string
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
  const responsive = useResponsiveLayout();
  const router = useRouter();
  const [teacherAlias, setTeacherAlias] = useState('Profesor');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [analyticsBySubject, setAnalyticsBySubject] = useState<Record<number, SubjectAnalytics>>({});
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingActionItem[]>([]);
  const [problematicQuestions, setProblematicQuestions] = useState<ProblematicQuestionItem[]>([]);
  const [openReviewCount, setOpenReviewCount] = useState(0);
  const [weeklyActiveStudentCount, setWeeklyActiveStudentCount] = useState(0);
  const [uniqueStudentCount, setUniqueStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { isDesktop } = responsive;

  const totals = useMemo(() => {
    const analytics = Object.values(analyticsBySubject);
    const students = uniqueStudentCount;
    const questions = analytics.reduce((total, item) => total + item.questionsCount, 0);
    const attempts = analytics.reduce((total, item) => total + item.playedCount, 0);

    return {
      students,
      questions,
      attempts,
      classrooms: analytics.reduce((total, item) => total + item.classroomCount, 0),
    };
  }, [analyticsBySubject, uniqueStudentCount]);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('alias')
        .eq('id', session.session.user.id)
        .maybeSingle();

      setTeacherAlias(
        teacherProfile?.alias ||
        session.session.user.user_metadata?.alias ||
        session.session.user.email?.split('@')[0] ||
        'Profesor'
      );

      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, description, icon, code, theme_color')
        .eq('teacher_id', session.session.user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const nextSubjects = (data || []) as Subject[];
      setSubjects(nextSubjects);

      const pendingReviewsResult = await supabase.rpc('get_teacher_manual_review_queue', {
        p_subject_id: null,
        p_classroom_id: null,
        p_status: 'pending',
        p_search: null,
        p_limit: 1,
        p_offset: 0,
      });
      if (!pendingReviewsResult.error) {
        const pendingReviewsPayload =
          pendingReviewsResult.data &&
          typeof pendingReviewsResult.data === 'object' &&
          !Array.isArray(pendingReviewsResult.data)
            ? (pendingReviewsResult.data as { total?: number | null })
            : {};

        setOpenReviewCount(Number(pendingReviewsPayload.total || 0));
      }

      const subjectIds = nextSubjects.map((subject) => subject.id);
      if (subjectIds.length === 0) {
        setAnalyticsBySubject({});
        setRecentActivity([]);
        setPendingActions([]);
        setProblematicQuestions([]);
        setOpenReviewCount(0);
        setWeeklyActiveStudentCount(0);
        setUniqueStudentCount(0);
        return;
      }

      const [enrollmentsResult, scoresResult, questionsResult, attemptsResult, classroomsResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('subject_id, student_id, joined_at')
          .in('subject_id', subjectIds)
          .order('joined_at', { ascending: false }),
        supabase.from('subject_scores').select('subject_id, student_id, max_score').in('subject_id', subjectIds),
        supabase.from('questions').select('id, subject_id, text').in('subject_id', subjectIds),
        supabase
          .from('attempt_history')
          .select('student_id, is_correct, question_id, attempted_at, questions!inner(id, subject_id, text)')
          .in('questions.subject_id', subjectIds)
          .order('attempted_at', { ascending: false })
          .limit(500),
        supabase
          .from('classrooms')
          .select('id, subject_id, name')
          .in('subject_id', subjectIds)
          .neq('active', false),
      ]);

      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;
      if (questionsResult.error) throw questionsResult.error;
      if (attemptsResult.error) throw attemptsResult.error;
      if (classroomsResult.error && !isMissingSchemaError(classroomsResult.error.code)) throw classroomsResult.error;
      const enrollments = (enrollmentsResult.data || []) as EnrollmentActivityRow[];
      const scores = (scoresResult.data || []) as SubjectScoreRow[];
      const questions = (questionsResult.data || []) as QuestionSummary[];
      const attempts = (attemptsResult.data || []) as AttemptActivityRow[];
      const classrooms = (classroomsResult.error ? [] : classroomsResult.data || []) as ClassroomSummary[];
      setUniqueStudentCount(getUniqueStudentCount(enrollments));

      const nextAnalytics: Record<number, SubjectAnalytics> = {};
      subjectIds.forEach((subjectId) => {
        const subjectEnrollments = enrollments.filter((item) => item.subject_id === subjectId) || [];
        const subjectScores = scores.filter(
          (item) => item.subject_id === subjectId && typeof item.max_score === 'number'
        ) || [];
        const subjectQuestions = questions.filter((item) => item.subject_id === subjectId) || [];
        const subjectClassrooms = classrooms.filter((item) => item.subject_id === subjectId) || [];
        const totalScore = subjectScores.reduce((total, item) => total + (item.max_score ?? 0), 0);

        nextAnalytics[subjectId] = {
          enrolledCount: subjectEnrollments.length,
          playedCount: subjectScores.length,
          averageScore: subjectScores.length > 0 ? Math.round(totalScore / subjectScores.length) : 0,
          questionsCount: subjectQuestions.length,
          classroomCount: subjectClassrooms.length,
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
      setProblematicQuestions(buildProblematicQuestions({ subjects: nextSubjects, attempts }));
      setWeeklyActiveStudentCount(getWeeklyActiveStudentCount(attempts, new Set(subjectIds)));
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
      <View className="flex-1 items-center justify-center bg-background-primary">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-text-muted">Cargando inicio del profesor...</Text>
      </View>
    );
  }

  if (!isDesktop) {
    return (
      <MobileTeacherHome
        analyticsBySubject={analyticsBySubject}
        openReviewCount={openReviewCount}
        pendingActions={pendingActions}
        refreshing={refreshing}
        subjects={subjects}
        teacherAlias={teacherAlias}
        totals={totals}
        weeklyActiveStudentCount={weeklyActiveStudentCount}
        onCreateQuestion={() => router.push(subjects[0] ? `/(teacher)/subject/add-question?subjectId=${subjects[0].id}` as any : '/(teacher)/create-subject' as any)}
        onCreateSubject={() => router.push('/(teacher)/create-subject' as any)}
        onImportStudents={() => router.push(subjects[0] ? `/(teacher)/subject/${subjects[0].id}?tab=students` as any : '/(teacher)/students' as any)}
        onOpenAction={(item) => router.push(item.href as any)}
        onOpenClasses={() => router.push('/(teacher)/classes' as any)}
        onOpenReviews={() => router.push('/(teacher)/reviews' as any)}
        onOpenStudents={() => router.push('/(teacher)/students' as any)}
        onRefresh={onRefresh}
      />
    )
  }

  return (
    <TeacherScreenLayout
      contentLabel="Inicio del profesor"
      desktopSidebar={(
        <TeacherSidebar
          activeSection="home"
          subjectsCount={subjects.length}
          onSignOut={() => supabase.auth.signOut()}
        />
      )}
      isDesktop={isDesktop}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
    >
          <TeacherPageHeader
            icon="home"
            isDesktop={isDesktop}
            title={`¡Bienvenido de nuevo, ${teacherAlias}!`}
            mobileTitle="Inicio"
            subtitle="Aquí tienes el estado de tus cursos, clases y estudiantes."
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
          />
          <TeacherTodayFocus
            primaryLabel={openReviewCount > 0 ? 'Revisar pendientes' : subjects.length > 0 ? 'Crear pregunta' : 'Crear curso'}
            teacherAlias={teacherAlias}
            onPrimary={() => router.push(openReviewCount > 0
              ? '/(teacher)/reviews' as any
              : subjects[0]
                ? `/(teacher)/subject/add-question?subjectId=${subjects[0].id}` as any
                : '/(teacher)/create-subject' as any)}
          />

          <TeacherPriorityOverview
            attentionItems={pendingActions.filter((item) => item.id.startsWith('inactive-students-') || item.id.startsWith('no-students-'))}
            classroomsCount={totals.classrooms}
            coursesCount={subjects.length}
            isDesktop
            openReviewCount={openReviewCount}
            onOpenAttention={(item) => {
              const action = pendingActions.find((candidate) => candidate.id === item.id);
              if (action) router.push(action.href as any);
            }}
            onOpenClasses={() => router.push('/(teacher)/classes' as any)}
            onOpenReviews={() => router.push('/(teacher)/reviews' as any)}
            onOpenStudents={() => router.push('/(teacher)/students' as any)}
          />

          <View className={isDesktop ? 'mt-8 flex-row gap-6' : 'mt-8 gap-6'}>
            <View className={isDesktop ? 'flex-[1.6]' : ''}>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-[24px] font-black text-white">Cursos recientes</Text>
                <Link href="/(teacher)/classes" asChild>
                  <Pressable accessibilityRole="link" accessibilityLabel="Ver todos los cursos" accessibilityHint="Abre la gestión de cursos" className="flex-row items-center gap-2">
                    <Text className="font-bold text-brand-teacher">Ver todas</Text>
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
                    classroomCount: 0,
                  };

                  return <SubjectPreview key={subject.id} subject={subject} analytics={analytics} />;
                })}
              </View>

              {subjects.length === 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Crear el primer curso"
                  accessibilityHint="Abre el formulario de creación de curso"
                  onPress={() => router.push('/(teacher)/create-subject' as any)}
                  className="items-center justify-center rounded-2xl border border-dashed border-brand-student bg-surface-default p-8"
                >
                  <OmniGuide state="normal" autoBlink size={72} />
                  <Text className="mt-4 text-lg font-black text-white">Crea tu primer curso</Text>
                  <Text className="mt-2 text-center text-text-secondary">
                    Añade un curso para empezar a gestionar clases, alumnos y preguntas.
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
                    <View className="items-center rounded-xl border border-dashed border-border-default bg-surface-raised px-4 py-5">
                      <OmniGuide state="normal" autoBlink size={58} />
                      <Text className="mt-2 text-center text-[12px] text-text-muted">Aún no hay actividad reciente en tus cursos.</Text>
                    </View>
                  )}
                </View>
              </Panel>

              <Panel title="Preguntas a revisar" action="Ver informes" onAction={() => router.push('/(teacher)/classes' as any)}>
                <View style={{ gap: 10 }}>
                  {problematicQuestions.length > 0 ? (
                    problematicQuestions.map((item) => (
                      <ProblematicQuestionRow
                        key={item.id}
                        item={item}
                        onEdit={() => router.push(item.editHref as any)}
                        onReport={() => router.push(item.reportHref as any)}
                      />
                    ))
                  ) : (
                    <View className="items-center rounded-xl border border-dashed border-border-default bg-surface-raised px-4 py-5">
                      <OmniGuide state="thinking" size={58} />
                      <Text className="mt-2 text-center text-[12px] text-text-muted">Todavía no hay preguntas problemáticas detectadas.</Text>
                    </View>
                  )}
                </View>
              </Panel>
            </View>
          </View>
    </TeacherScreenLayout>
  );
}

function MobileTeacherHome({
  analyticsBySubject,
  openReviewCount,
  pendingActions,
  refreshing,
  subjects,
  teacherAlias,
  totals,
  weeklyActiveStudentCount,
  onCreateSubject,
  onCreateQuestion,
  onOpenAction,
  onOpenClasses,
  onOpenReviews,
  onOpenStudents,
  onRefresh,
}: {
  analyticsBySubject: Record<number, SubjectAnalytics>
  openReviewCount: number
  pendingActions: PendingActionItem[]
  refreshing: boolean
  subjects: Subject[]
  teacherAlias: string
  totals: { students: number; questions: number; attempts: number; classrooms: number }
  weeklyActiveStudentCount: number
  onCreateQuestion: () => void
  onCreateSubject: () => void
  onImportStudents: () => void
  onOpenAction: (item: PendingActionItem) => void
  onOpenClasses: () => void
  onOpenReviews: () => void
  onOpenStudents: () => void
  onRefresh: () => void
}) {
  return (
    <TeacherScreenLayout
      contentLabel="Inicio del profesor"
      isDesktop={false}
      horizontalPadding={20}
      topPadding={24}
      mobileBottomNavigation={<TeacherBottomNav active="home" />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
    >
        <TeacherPageHeader
          icon="home"
          isDesktop={false}
          title="Inicio"
          subtitle="Decide qué necesita atención ahora."
          className="mb-6"
          actions={(
            <>
              <Link href="/(teacher)/create-subject" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="Crear curso" accessibilityHint="Abre el formulario de creación de curso" className="min-h-11 flex-row items-center gap-2 rounded-xl border border-border-default bg-surface-raised px-3">
                  <Ionicons name="add-circle-outline" size={19} color="#60A5FA" />
                  <Text className="text-[12px] font-black text-text-secondary">Crear</Text>
                </Pressable>
              </Link>
              <Link href="/(teacher)/reviews" asChild>
                <Pressable accessibilityRole="link" accessibilityLabel="Revisar respuestas pendientes" accessibilityHint="Abre la cola de revisión" className="min-h-11 flex-row items-center gap-2 rounded-xl border border-border-default bg-surface-raised px-3 py-2">
                  <Ionicons name="create-outline" size={19} color="#A78BFA" />
                  <Text className="text-[12px] font-black text-text-secondary">Revisar</Text>
                </Pressable>
              </Link>
            </>
          )}
        />

        <TeacherTodayFocus
          primaryLabel={openReviewCount > 0 ? 'Revisar pendientes' : subjects.length > 0 ? 'Crear pregunta' : 'Crear curso'}
          teacherAlias={teacherAlias}
          onPrimary={openReviewCount > 0 ? onOpenReviews : subjects.length > 0 ? onCreateQuestion : onCreateSubject}
        />

        <TeacherPriorityOverview
          attentionItems={pendingActions.filter((item) => item.id.startsWith('inactive-students-') || item.id.startsWith('no-students-'))}
          classroomsCount={totals.classrooms}
          coursesCount={subjects.length}
          isDesktop={false}
          openReviewCount={openReviewCount}
          onOpenAttention={(item) => {
            const action = pendingActions.find((candidate) => candidate.id === item.id);
            if (action) onOpenAction(action);
          }}
          onOpenClasses={onOpenClasses}
          onOpenReviews={onOpenReviews}
          onOpenStudents={onOpenStudents}
        />

        <MobileRecentCourses
          analyticsBySubject={analyticsBySubject}
          subjects={subjects}
          onCreateSubject={onCreateSubject}
          onViewAll={onOpenClasses}
        />
    </TeacherScreenLayout>
  )
}



function MobileRecentCourses({
  analyticsBySubject,
  subjects,
  onCreateSubject,
  onViewAll,
}: {
  analyticsBySubject: Record<number, SubjectAnalytics>
  subjects: Subject[]
  onCreateSubject: () => void
  onViewAll: () => void
}) {
  return (
    <View className="mt-5 rounded-2xl border border-border-default bg-surface-default p-4">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-[24px] font-black text-white">Cursos recientes</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Ver todos los cursos" accessibilityHint="Abre la lista completa de cursos" onPress={onViewAll} className="flex-row items-center gap-1">
          <Text className="text-[14px] font-black text-brand-admin">Ver todos</Text>
          <Ionicons name="arrow-forward" size={18} color="#A970FF" />
        </Pressable>
      </View>

      <View className="gap-3">
        {subjects.length > 0 ? (
          subjects.slice(0, 3).map((subject) => (
            <MobileSubjectPreview
              key={subject.id}
              analytics={analyticsBySubject[subject.id] || {
                enrolledCount: 0,
                playedCount: 0,
                averageScore: 0,
                questionsCount: 0,
                classroomCount: 0,
              }}
              subject={subject}
            />
          ))
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Crear el primer curso"
            accessibilityHint="Abre el formulario de creación de curso"
            onPress={onCreateSubject}
            className="items-center rounded-2xl border border-dashed border-brand-student bg-surface-raised px-5 py-8"
          >
            <OmniGuide state="normal" autoBlink size={66} />
            <Text className="mt-3 text-[18px] font-black text-white">Crea tu primer curso</Text>
            <Text className="mt-1 text-center text-[13px] leading-5 text-text-secondary">Empieza a organizar clases, alumnos y preguntas.</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function MobileSubjectPreview({ subject, analytics }: { subject: Subject; analytics: SubjectAnalytics }) {
  return (
    <View className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <View className="flex-row items-start gap-4">
        <View className="h-[74px] w-[74px] items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(subject.theme_color || '#8B5CF6', '28') }}>
          {subject.icon ? <Text className="text-[34px]">{subject.icon}</Text> : <Ionicons name="book-outline" size={34} color="#9B8CFF" />}
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="min-w-0 flex-1 text-[22px] font-black text-white" numberOfLines={2} maxFontSizeMultiplier={2}>{subject.name}</Text>
            <View className="rounded-lg bg-surface-selected px-2.5 py-1">
              <Text className="text-[12px] font-black text-brand-teacher">Activo</Text>
            </View>
          </View>
          <Text className="mt-2 text-[14px] leading-5 text-text-secondary" numberOfLines={2}>
            {analytics.classroomCount} {analytics.classroomCount === 1 ? 'clase' : 'clases'} · {analytics.enrolledCount} alumnos · {analytics.questionsCount} preguntas
          </Text>
          <Text className="mt-1 text-[13px] text-text-muted" numberOfLines={2} maxFontSizeMultiplier={2}>Código del curso: {subject.code}</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={23} color="#AFC2DB" />
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Link href={`/(teacher)/subject/${subject.id}`} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`Gestionar ${subject.name}`} accessibilityHint="Abre la configuración del curso" className="min-w-[120px] flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand-student px-3 py-3">
            <Ionicons name="settings-outline" size={16} color="#FFFFFF" />
            <Text className="font-black text-white">Gestionar</Text>
          </Pressable>
        </Link>
        <Link href={`/(teacher)/subject/add-question?subjectId=${subject.id}`} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`Crear pregunta en ${subject.name}`} accessibilityHint="Abre el formulario de nueva pregunta" className="min-w-[130px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-default px-3 py-3">
            <Ionicons name="add-circle-outline" size={16} color="#DDE7F4" />
            <Text className="font-black text-text-secondary">Crear pregunta</Text>
          </Pressable>
        </Link>
        <Link href={`/(teacher)/subject/${subject.id}?tab=students`} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`Importar alumnos en ${subject.name}`} accessibilityHint="Abre la gestión de alumnos del curso" className="min-w-[150px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-default px-3 py-3">
            <Ionicons name="person-add-outline" size={16} color="#DDE7F4" />
            <Text className="font-black text-text-secondary">Importar alumnos</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  )
}

function SubjectPreview({ subject, analytics }: { subject: Subject; analytics: SubjectAnalytics }) {
  return (
    <View className="rounded-2xl border border-border-default bg-surface-default p-4">
      <View className="flex-row items-start gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-xl bg-semantic-surface-info">
          {subject.icon ? <Text className="text-2xl">{subject.icon}</Text> : <Ionicons name="book-outline" size={26} color="#9B8CFF" />}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-lg font-black text-white" numberOfLines={2} maxFontSizeMultiplier={2}>{subject.name}</Text>
          <Text className="mt-1 text-[12px] text-text-secondary" numberOfLines={2} maxFontSizeMultiplier={2}>
            {analytics.classroomCount} {analytics.classroomCount === 1 ? 'clase' : 'clases'} · {analytics.enrolledCount} alumnos · {analytics.questionsCount} preguntas
          </Text>
          <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={2} maxFontSizeMultiplier={2}>Código del curso: {subject.code}</Text>
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Link href={`/(teacher)/subject/${subject.id}`} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`Gestionar ${subject.name}`} accessibilityHint="Abre la configuración del curso" className="flex-row items-center gap-2 rounded-xl bg-brand-teacher px-4 py-3">
            <Ionicons name="settings-outline" size={15} color="#FFFFFF" />
            <Text className="text-[12px] font-black text-white">Gestionar</Text>
          </Pressable>
        </Link>
        <Link href={`/(teacher)/subject/add-question?subjectId=${subject.id}`} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`Crear pregunta en ${subject.name}`} accessibilityHint="Abre el formulario de nueva pregunta" className="flex-row items-center gap-2 rounded-xl border border-border-default bg-surface-default px-4 py-3">
            <Ionicons name="help-circle-outline" size={15} color="#DDE7F4" />
            <Text className="text-[12px] font-black text-text-secondary">Crear pregunta</Text>
          </Pressable>
        </Link>
        <Link href={`/(teacher)/subject/${subject.id}?tab=students`} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`Importar alumnos en ${subject.name}`} accessibilityHint="Abre la gestión de alumnos del curso" className="flex-row items-center gap-2 rounded-xl border border-border-default bg-surface-default px-4 py-3">
            <Ionicons name="person-add-outline" size={15} color="#DDE7F4" />
            <Text className="text-[12px] font-black text-text-secondary">Importar alumnos</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function Panel({
  title,
  action,
  onAction,
  children,
}: {
  title: string
  action?: string
  onAction?: () => void
  children: React.ReactNode
}) {
  return (
    <View className="rounded-2xl border border-border-default bg-surface-default p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-black text-white">{title}</Text>
        {action && onAction ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} accessibilityHint="Abre la sección relacionada" onPress={onAction} className="flex-row items-center gap-1">
            <Text className="text-[12px] font-semibold text-brand-teacher">{action}</Text>
            <Ionicons name="arrow-forward" size={13} color="#B9A7FF" />
          </Pressable>
        ) : action ? (
          <Text className="text-[12px] font-semibold text-brand-teacher">{action}</Text>
        ) : null}
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
      <Text className="text-[11px] text-text-muted">{item.time}</Text>
    </View>
  );
}

function ProblematicQuestionRow({
  item,
  onEdit,
  onReport,
}: {
  item: ProblematicQuestionItem
  onEdit: () => void
  onReport: () => void
}) {
  return (
    <View className="rounded-xl border border-border-default bg-background-primary px-4 py-3">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-semantic-danger">
          <Ionicons name="warning-outline" size={18} color="#F43F5E" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-white" numberOfLines={2}>{item.text}</Text>
          <Text className="mt-1 text-[11px] text-semantic-danger">{item.failures} fallos · {item.subjectName}</Text>
        </View>
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Pressable accessibilityRole="button" accessibilityLabel={`Editar pregunta ${item.text}`} accessibilityHint="Abre el editor de la pregunta" onPress={onEdit} className="rounded-lg bg-semantic-surface-danger px-3 py-2">
          <Text className="text-[11px] font-black text-white">Editar pregunta</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver intentos de ${item.text}`} accessibilityHint="Abre el informe de respuestas" onPress={onReport} className="rounded-lg border border-semantic-danger bg-semantic-surface-danger px-3 py-2">
          <Text className="text-[11px] font-black text-semantic-danger">Ver intentos</Text>
        </Pressable>
      </View>
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
        title: 'Curso sin preguntas',
        detail: `${subject.name} todavía no tiene contenido.`,
        actionLabel: 'Añadir pregunta',
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
        title: 'Curso sin alumnos',
        detail: `${subject.name} no tiene estudiantes inscritos.`,
        actionLabel: 'Invitar',
        href: `/(teacher)/subject/${subject.id}?tab=students`,
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
        href: `/(teacher)/question-report/${item.questionId}`,
      });
    });

  return actions.slice(0, 5);
}

function buildProblematicQuestions({
  subjects,
  attempts,
}: {
  subjects: Subject[]
  attempts: AttemptActivityRow[]
}): ProblematicQuestionItem[] {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const teacherSubjectIds = new Set(subjects.map((subject) => subject.id));
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

  return Array.from(failedQuestions.entries())
    .map(([questionId, item]) => {
      const subject = subjectsById.get(item.subjectId);
      return {
        id: `problematic-${questionId}`,
        questionId,
        subjectId: item.subjectId,
        subjectName: subject?.name || 'Curso',
        text: item.text,
        failures: item.failures,
        editHref: `/(teacher)/subject/edit-question?subjectId=${item.subjectId}&questionId=${questionId}`,
        reportHref: `/(teacher)/question-report/${questionId}`,
      } satisfies ProblematicQuestionItem;
    })
    .filter((item) => item.failures >= 3)
    .sort((left, right) => right.failures - left.failures)
    .slice(0, 4);
}

function getWeeklyActiveStudentCount(attempts: AttemptActivityRow[], teacherSubjectIds: Set<number>) {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const activeStudentIds = new Set<string>();

  attempts.forEach((attempt) => {
    const question = normalizeQuestionRelation(attempt.questions);
    const subjectId = question?.subject_id ?? null;
    const timestamp = toTimestamp(attempt.attempted_at);

    if (attempt.student_id && subjectId && teacherSubjectIds.has(subjectId) && timestamp >= weekAgo) {
      activeStudentIds.add(attempt.student_id);
    }
  });

  return activeStudentIds.size;
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
  const items: RecentActivityItem[] = [];
  const enrollmentGroups = new Map<string, { subjectName: string; count: number; timestamp: number; date: string | null }>();

  enrollments
    .filter((enrollment) => enrollment.subject_id && enrollment.student_id && enrollment.joined_at)
    .forEach((enrollment) => {
      const subject = enrollment.subject_id ? subjectsById.get(enrollment.subject_id) : null;
      const dateKey = getDateKey(enrollment.joined_at);
      const key = `${enrollment.subject_id}-${dateKey}`;
      const previous = enrollmentGroups.get(key) || {
        subjectName: subject?.name || 'un curso',
        count: 0,
        timestamp: 0,
        date: enrollment.joined_at || null,
      };
      const timestamp = toTimestamp(enrollment.joined_at);
      enrollmentGroups.set(key, {
        ...previous,
        count: previous.count + 1,
        timestamp: Math.max(previous.timestamp, timestamp),
        date: timestamp >= previous.timestamp ? enrollment.joined_at || null : previous.date,
      });
    });

  Array.from(enrollmentGroups.entries()).forEach(([key, group]) => {
    items.push({
      id: `enrollment-group-${key}`,
      icon: 'person-add-outline',
      color: '#8B5CF6',
      title: `${group.count} alumno${group.count === 1 ? '' : 's'} se ${group.count === 1 ? 'unió' : 'unieron'} a ${group.subjectName}`,
      time: formatRelativeDate(group.date),
      timestamp: group.timestamp,
    });
  });

  const attemptGroups = new Map<string, { subjectName: string; count: number; timestamp: number; date: string | null }>();
  const failedAttemptItems: RecentActivityItem[] = [];

  attempts.forEach((attempt) => {
    const question = normalizeQuestionRelation(attempt.questions);
    const subjectId = question?.subject_id ?? null;
    if (!subjectId || !teacherSubjectIds.has(subjectId) || !attempt.attempted_at) return;

    const subject = subjectsById.get(subjectId);
    const timestamp = toTimestamp(attempt.attempted_at);
    const dateKey = getDateKey(attempt.attempted_at);
    const key = `${subjectId}-${dateKey}`;
    const previous = attemptGroups.get(key) || {
      subjectName: subject?.name || 'un curso',
      count: 0,
      timestamp: 0,
      date: attempt.attempted_at || null,
    };

    attemptGroups.set(key, {
      ...previous,
      count: previous.count + 1,
      timestamp: Math.max(previous.timestamp, timestamp),
      date: timestamp >= previous.timestamp ? attempt.attempted_at || null : previous.date,
    });

    if (attempt.is_correct === false) {
      const studentName = getStudentName(attempt.student_id, profilesById);
      failedAttemptItems.push({
        id: `failed-attempt-${attempt.question_id}-${attempt.student_id}-${timestamp}`,
        icon: 'close-circle-outline',
        color: '#F97316',
        title: `${studentName} falló “${truncateText(question?.text || 'Pregunta sin texto', 34)}”`,
        time: formatRelativeDate(attempt.attempted_at),
        timestamp,
      });
    }
  });

  Array.from(attemptGroups.entries()).forEach(([key, group]) => {
    items.push({
      id: `attempt-group-${key}`,
      icon: 'checkmark-circle-outline',
      color: '#34D399',
      title: `${group.count} respuesta${group.count === 1 ? '' : 's'} registrada${group.count === 1 ? '' : 's'} en ${group.subjectName}`,
      time: formatRelativeDate(group.date),
      timestamp: group.timestamp,
    });
  });

  return [...items, ...failedAttemptItems]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 5);
}

function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204';
}

function getDateKey(value: string | null | undefined) {
  const timestamp = toTimestamp(value);
  if (timestamp === 0) return 'unknown';
  return new Date(timestamp).toISOString().slice(0, 10);
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
