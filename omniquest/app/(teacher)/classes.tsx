import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import TeacherSidebar from '../../components/teacher/TeacherSidebar';
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav';
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader';
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout';
import AppButton from '../../components/ui/AppButton';
import AppTabs from '../../components/ui/AppTabs';
import PaginationControls from '../../components/ui/PaginationControls';
import TeacherCoursesList from '../../components/teacher/classes/TeacherCoursesList';
import TeacherClassroomsList from '../../components/teacher/classes/TeacherClassroomsList';
import CreateCourseCTA from '../../components/teacher/classes/CreateCourseCTA';
import {
  emptyTeacherCourseAnalytics,
  type TeacherClassroom,
  type TeacherClassroomAnalytics,
  type TeacherCourse as Subject,
  type TeacherCourseAnalytics as SubjectAnalytics,
} from '../../components/teacher/classes/types';

type Enrollment = {
  subject_id: number | null
  classroom_id?: number | null
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
  classroom_id?: number | null
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
  classroom_id?: number | null
  title?: string | null
  created_at?: string | null
}

type ClassStatus = 'unconfigured' | 'no_activity' | 'in_progress' | 'completed'
type ClassFilter = 'all' | ClassStatus
type ClassSort = 'recent' | 'name' | 'participation'
type CatalogTab = 'courses' | 'classrooms'

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

const emptySubjectAnalytics = emptyTeacherCourseAnalytics

export default function TeacherClassesScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<TeacherClassroom[]>([]);
  const [analyticsBySubject, setAnalyticsBySubject] = useState<Record<number, SubjectAnalytics>>({});
  const [analyticsByClassroom, setAnalyticsByClassroom] = useState<Record<number, TeacherClassroomAnalytics>>({});
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('courses');
  const [page, setPage] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<ClassFilter>('all');
  const [selectedSort, setSelectedSort] = useState<ClassSort>('recent');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDesktop = width >= 1080;
  const pageSize = isDesktop ? 12 : 6;

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

  const coursesById = useMemo(
    () => subjects.reduce<Record<number, Subject>>((rows, subject) => {
      rows[subject.id] = subject;
      return rows;
    }, {}),
    [subjects]
  );

  const filteredClassrooms = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return classrooms;

    return classrooms.filter((classroom) => {
      const subjectName = classroom.subject_id ? coursesById[classroom.subject_id]?.name || '' : '';
      return `${classroom.name} ${classroom.code || ''} ${classroom.academic_year || ''} ${subjectName}`
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [classrooms, coursesById, search]);

  const visibleTotal = catalogTab === 'courses' ? filteredSubjects.length : filteredClassrooms.length;
  const safePage = Math.min(page, Math.max(0, Math.ceil(visibleTotal / pageSize) - 1));
  const pagedSubjects = filteredSubjects.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const pagedClassrooms = filteredClassrooms.slice(safePage * pageSize, (safePage + 1) * pageSize);

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
        setClassrooms([]);
        setAnalyticsBySubject({});
        setAnalyticsByClassroom({});
        return;
      }

      const [enrollmentsResult, scoresResult, questionsResult, topicsResult, classroomsResult] = await Promise.all([
        supabase.from('enrollments').select('subject_id, classroom_id, student_id, joined_at').in('subject_id', subjectIds),
        supabase.from('subject_scores').select('subject_id, student_id, max_score, played_at').in('subject_id', subjectIds),
        supabase.from('questions').select('id, subject_id, classroom_id, text, created_at').in('subject_id', subjectIds),
        supabase.from('subject_topics').select('subject_id, classroom_id, title, created_at').in('subject_id', subjectIds).eq('active', true),
        supabase.from('classrooms').select('id, subject_id, name, code, academic_year, created_at, active').in('subject_id', subjectIds).neq('active', false).order('created_at', { ascending: false }),
      ]);

      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;
      if (questionsResult.error) throw questionsResult.error;
      if (topicsResult.error) throw topicsResult.error;
      if (classroomsResult.error) throw classroomsResult.error;

      const enrollments = (enrollmentsResult.data || []) as Enrollment[];
      const scores = (scoresResult.data || []) as SubjectScore[];
      const questions = (questionsResult.data || []) as QuestionSummary[];
      const topics = (topicsResult.data || []) as TopicSummary[];
      const nextClassrooms = (classroomsResult.data || []) as TeacherClassroom[];
      setClassrooms(nextClassrooms);
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
      setAnalyticsByClassroom(
        nextClassrooms.reduce<Record<number, TeacherClassroomAnalytics>>((rows, classroom) => {
          rows[classroom.id] = {
            studentsCount: getUniqueIds(
              enrollments.filter((item) => item.classroom_id === classroom.id).map((item) => item.student_id)
            ).length,
            questionsCount: questions.filter((item) => item.classroom_id === classroom.id).length,
            topicsCount: topics.filter((item) => item.classroom_id === classroom.id).length,
          };
          return rows;
        }, {})
      );
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando tus cursos...</Text>
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
            paddingBottom: isDesktop ? 32 : MOBILE_BOTTOM_NAV_SPACER + 84,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <TeacherPageHeader
            icon="book"
            isDesktop={isDesktop}
            title="Cursos y clases"
            mobileTitle="Cursos y clases"
            subtitle="Encuentra rápido el grupo que necesitas gestionar."
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
            actions={isDesktop ? (
              <AppButton
                label="Crear curso"
                accessibilityLabel="Crear curso"
                icon="add"
                role="teacher"
                onPress={() => router.push('/(teacher)/create-subject' as any)}
              />
            ) : undefined}
          />

          <View className="mb-4">
            <AppTabs<CatalogTab>
              accessibilityLabel="Ver cursos o clases"
              fill
              items={[
                { key: 'courses', label: `Cursos (${subjects.length})`, icon: 'book-outline' },
                { key: 'classrooms', label: `Clases (${classrooms.length})`, icon: 'people-outline' },
              ]}
              onChange={(nextTab) => {
                setCatalogTab(nextTab);
                setPage(0);
                setSearch('');
              }}
              role="teacher"
              value={catalogTab}
            />
          </View>

          <View className="mb-4 gap-3">
            <View className="h-12 flex-row items-center rounded-xl border border-[#20375E] bg-[#09162C] px-4">
              <Ionicons name="search-outline" size={20} color="#AFC2DB" />
              <TextInput
                accessibilityLabel={catalogTab === 'courses' ? 'Buscar curso' : 'Buscar clase'}
                className="ml-3 min-w-0 flex-1 text-white"
                placeholder={catalogTab === 'courses' ? 'Buscar curso...' : 'Buscar clase o curso...'}
                placeholderTextColor="#8FA7C7"
                value={search}
                onChangeText={(value) => {
                  setSearch(value);
                  setPage(0);
                }}
              />
            </View>

            {isDesktop && catalogTab === 'courses' ? (
              <View className="gap-3">
                <AppTabs<ClassFilter>
                  accessibilityLabel="Filtrar cursos"
                  compact
                  role="teacher"
                  items={teacherClassFilters.map((filter) => ({ key: filter.id, label: filter.label, icon: filter.icon }))}
                  value={selectedFilter}
                  onChange={(filter) => {
                    setSelectedFilter(filter);
                    setPage(0);
                  }}
                />
                <AppTabs<ClassSort>
                  accessibilityLabel="Ordenar cursos"
                  compact
                  role="teacher"
                  items={teacherClassSorts.map((sort) => ({ key: sort.id, label: sort.label, icon: 'swap-vertical-outline' as const }))}
                  value={selectedSort}
                  onChange={(sort) => {
                    setSelectedSort(sort);
                    setPage(0);
                  }}
                />
              </View>
            ) : null}
          </View>

          <View className="mb-3 flex-row items-center justify-between gap-3">
            <Text className="text-[13px] text-[#AFC2DB]">
              {catalogTab === 'courses'
                ? `${visibleTotal} cursos · ${totals.students} alumnos · ${totals.questions} preguntas`
                : `${visibleTotal} clases activas en ${subjects.length} cursos`}
            </Text>
            {!isDesktop && catalogTab === 'courses' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSelectedSort((current) => getNextClassSort(current));
                  setPage(0);
                }}
                className="flex-row items-center gap-2 rounded-lg bg-[#102343] px-3 py-2"
              >
                <Ionicons name="swap-vertical-outline" size={15} color="#B9A7FF" />
                <Text className="text-[12px] font-black text-[#B9A7FF]">{getClassSortLabel(selectedSort)}</Text>
              </Pressable>
            ) : null}
          </View>

          {catalogTab === 'courses' ? (
            <TeacherCoursesList analyticsByCourse={analyticsBySubject} courses={pagedSubjects} isDesktop={isDesktop} />
          ) : (
            <TeacherClassroomsList
              analyticsByClassroom={analyticsByClassroom}
              classrooms={pagedClassrooms}
              coursesById={coursesById}
              isDesktop={isDesktop}
            />
          )}

          <PaginationControls
            compact={!isDesktop}
            onNext={() => setPage((current) => current + 1)}
            onPrevious={() => setPage((current) => Math.max(0, current - 1))}
            page={safePage}
            pageSize={pageSize}
            total={visibleTotal}
          />

          {isDesktop ? <CreateCourseCTA onPress={() => router.push('/(teacher)/create-subject' as any)} /> : null}
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="classes" /> : null}
      {!isDesktop ? <CreateCourseCTA onPress={() => router.push('/(teacher)/create-subject' as any)} sticky /> : null}
    </View>
  );
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
