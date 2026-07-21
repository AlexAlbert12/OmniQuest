import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { accuracyToGrade, answersToAccuracyPercent } from '../../lib/grades';
import { type DifficultyLevel } from '../../lib/difficulty';
import { parseDateTimeInput } from '../../lib/calendar';
import {
  buildStudentListRows,
  buildStudentReportRows,
  buildTemporalEvolution,
  getScorePerformance,
  type Enrollment,
  type StudentProfile,
  type StudentSortKey,
  type StudentStatusFilter,
  type SubjectScore,
} from '../../lib/teacherSubjectAnalytics';
import { type IconName } from '../../components/teacher/subject/SubjectShared';

type TeacherActionResult = {
  error?: string
  [key: string]: unknown
}

export type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  education_level?: string | null
  academic_year?: string | null
  subject_label?: string | null
  theme_color: string | null
  is_archived?: boolean | null
  teacher_id?: string | null
  created_at?: string | null
}

export type Question = {
  id: number
  text: string
  points_base: number | null
  difficulty?: number | null
  topic_id: number | null
  classroom_id?: number | null
  created_at?: string | null
  answers?: { text: string; is_correct: boolean }[]
}

export type Topic = {
  id: number
  classroom_id?: number | null
  title: string
  description: string | null
  icon: string | null
  sort_order: number | null
  available_until?: string | null
}

export type TopicScore = {
  topic_id: number
  classroom_id?: number | null
  max_score: number | null
}

export type Classroom = {
  id: number
  name: string
  academic_year: string | null
  active: boolean | null
  code?: string | null
}

export type ActivityItem = {
  icon: IconName
  color: string
  title: string
  detail: string
  meta: string
  time: string
  warning: boolean
}

export type FailedQuestionReport = {
  id: number
  text: string
  topic: string
  actualFailures: number
  totalAttempts: number
  failureRate: number
}

export type ManualReviewRow = {
  id: number
  studentId: string
  studentName: string
  questionId: number
  questionText: string
  answerText: string
  topicName: string
  status: string
  attemptedAt: string
  reviewedAt: string | null
  earnedPoints: number
  possiblePoints: number
  timeTaken: number | null
}

export type SubjectTabKey = 'summary' | 'students' | 'activities' | 'questions' | 'review' | 'reports' | 'resources' | 'settings'

export const teacherSubjectTabItems: { key: SubjectTabKey; label: string; icon: IconName }[] = [
  { key: 'summary', label: 'Resumen', icon: 'document-text-outline' },
  { key: 'students', label: 'Estudiantes', icon: 'people-outline' },
  { key: 'activities', label: 'Actividades', icon: 'calendar-outline' },
  { key: 'questions', label: 'Preguntas', icon: 'checkmark-circle-outline' },
  { key: 'review', label: 'Revisión', icon: 'create-outline' },
  { key: 'reports', label: 'Informes', icon: 'bar-chart-outline' },
  { key: 'resources', label: 'Recursos', icon: 'book-outline' },
  { key: 'settings', label: 'Configuración', icon: 'settings-outline' },
]

type TopicRow = {
  id: number | 'general'
  title: string
  description: string | null
  icon: string | null
  availableUntil: string | null
  questionsCount: number
  playedCount: number
  averageScore: number
}

export function useTeacherSubjectDetail({
  subjectId,
  tab,
}: {
  subjectId: string
  tab?: string | string[]
}) {
  const router = useRouter();
  const subjectIdNumber = Number(subjectId);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicScores, setTopicScores] = useState<TopicScore[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [scores, setScores] = useState<SubjectScore[]>([]);
  const [manualReviewRows, setManualReviewRows] = useState<ManualReviewRow[]>([]);
  const [reviewingAttemptId, setReviewingAttemptId] = useState<number | null>(null);
  const [profilesById, setProfilesById] = useState<Record<string, StudentProfile>>({});
  const [subjectsCount, setSubjectsCount] = useState(0);
  const [selectedTopicId, setSelectedTopicId] = useState<number | 'all' | 'general'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [activeTab, setActiveTab] = useState<SubjectTabKey>(() => getSubjectTabFromParam(tab));
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const [newTopicAvailableUntil, setNewTopicAvailableUntil] = useState('');
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<DifficultyLevel>(1);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [newClassroomName, setNewClassroomName] = useState('');
  const [creatingClassroom, setCreatingClassroom] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<StudentStatusFilter>('all');
  const [studentSortKey, setStudentSortKey] = useState<StudentSortKey>('xp');
  const [showStudentImportModal, setShowStudentImportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failedQuestionRows, setFailedQuestionRows] = useState<FailedQuestionReport[]>([]);

  const requestedTab = getSubjectTabFromParam(tab);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const questionsWithoutTopic = useMemo(() => questions.filter((question) => question.topic_id === null), [questions]);
  const selectedTopicLabel = selectedTopicId === 'all'
    ? 'Todos los temas'
    : selectedTopicId === 'general'
      ? 'Tema general'
      : topics.find((topic) => topic.id === selectedTopicId)?.title || 'Tema';

  const filteredQuestions = useMemo(() => {
    const topicFiltered = selectedTopicId === 'all'
      ? questions
      : selectedTopicId === 'general'
        ? questionsWithoutTopic
        : questions.filter((question) => question.topic_id === selectedTopicId);

    if (selectedDifficulty === 'all') return topicFiltered;
    return topicFiltered.filter((question) => (question.difficulty || 1) === selectedDifficulty);
  }, [questions, questionsWithoutTopic, selectedDifficulty, selectedTopicId]);

  const scoreValues = useMemo(
    () => scores.map((item) => item.max_score).filter((score): score is number => typeof score === 'number'),
    [scores]
  );
  const averageXp = scoreValues.length > 0
    ? Math.round(scoreValues.reduce((total, score) => total + score, 0) / scoreValues.length)
    : 0;
  const scorePerformanceRows = useMemo(
    () => scores.map((score) => getScorePerformance(score, questions.length)),
    [questions.length, scores]
  );
  const answerTotals = useMemo(
    () => scorePerformanceRows.reduce(
      (totals, item) => {
        if (item.totalAnswers > 0) {
          totals.correctAnswers += item.correctAnswers;
          totals.totalAnswers += item.totalAnswers;
        }
        return totals;
      },
      { correctAnswers: 0, totalAnswers: 0 }
    ),
    [scorePerformanceRows]
  );
  const averageAccuracy = answerTotals.totalAnswers > 0
    ? answersToAccuracyPercent(answerTotals.correctAnswers, answerTotals.totalAnswers)
    : 0;
  const fallbackAverageGrade = scorePerformanceRows.length > 0
    ? Number((scorePerformanceRows.reduce((total, item) => total + item.grade, 0) / scorePerformanceRows.length).toFixed(1))
    : 0;
  const averageGrade = answerTotals.totalAnswers > 0 ? accuracyToGrade(averageAccuracy) : fallbackAverageGrade;
  const participation = enrollments.length > 0 ? Math.min(100, Math.round((scores.length / enrollments.length) * 100)) : 0;
  const possibleClassQuestions = enrollments.length * questions.length;
  const answeredClassQuestions = possibleClassQuestions > 0
    ? Math.min(possibleClassQuestions, answerTotals.totalAnswers)
    : 0;
  const progress = possibleClassQuestions > 0
    ? Math.round((answeredClassQuestions / possibleClassQuestions) * 100)
    : 0;
  const latestQuestion = questions[0];
  const manualReviewPendingCount = manualReviewRows.filter((row) => row.status === 'pending').length;
  const manualReviewReviewedCount = manualReviewRows.length - manualReviewPendingCount;

  const topicRows = useMemo<TopicRow[]>(() => {
    const rows: TopicRow[] = topics.map((topic) => {
      const topicQuestions = questions.filter((question) => question.topic_id === topic.id);
      const topicScoreValues = topicScores
        .filter((score) => Number(score.topic_id) === topic.id && typeof score.max_score === 'number')
        .map((score) => score.max_score || 0);
      const average = topicScoreValues.length > 0
        ? Math.round(topicScoreValues.reduce((total, score) => total + score, 0) / topicScoreValues.length)
        : 0;

      return {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        icon: topic.icon,
        availableUntil: topic.available_until ?? null,
        questionsCount: topicQuestions.length,
        playedCount: topicScoreValues.length,
        averageScore: average,
      };
    });

    if (questionsWithoutTopic.length > 0) {
      rows.unshift({
        id: 'general',
        title: 'Tema general',
        description: 'Preguntas creadas antes de organizar la clase por temas.',
        icon: 'layers-outline',
        availableUntil: null,
        questionsCount: questionsWithoutTopic.length,
        playedCount: scores.length,
        averageScore: averageXp,
      });
    }

    return rows;
  }, [averageXp, questions, questionsWithoutTopic.length, scores.length, topicScores, topics]);

  const gradeDistribution = useMemo(() => {
    const base = [
      { label: 'Excelente (9-10)', color: '#34D399', count: 0 },
      { label: 'Bueno (7-8.9)', color: '#3B82F6', count: 0 },
      { label: 'Regular (5-6.9)', color: '#F59E0B', count: 0 },
      { label: 'Necesita apoyo (<5)', color: '#F43F5E', count: 0 },
    ];

    scorePerformanceRows.forEach((score) => {
      const grade = score.grade;
      if (grade >= 9) base[0].count += 1;
      else if (grade >= 7) base[1].count += 1;
      else if (grade >= 5) base[2].count += 1;
      else base[3].count += 1;
    });

    return base;
  }, [scorePerformanceRows]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const scoreActivity = scores.slice(0, 4).map((score, index) => {
      const studentName = profilesById[score.student_id]?.alias || `Alumno ${index + 1}`;
      const points = score.max_score ?? 0;
      return {
        icon: points >= averageXp ? 'trophy' : 'checkmark',
        color: points >= averageXp ? '#8B5CF6' : '#34D399',
        title: `${studentName} completó una pregunta`,
        detail: latestQuestion?.text || subject?.name || 'Actividad de clase',
        meta: `+${points} puntos`,
        time: formatRelative(score.played_at, index),
        warning: false,
      } satisfies ActivityItem;
    });

    if (scoreActivity.length > 0) return scoreActivity;

    return [
      {
        icon: 'people',
        color: '#3B82F6',
        title: `${enrollments.length} alumno${enrollments.length === 1 ? '' : 's'} inscrito${enrollments.length === 1 ? '' : 's'}`,
        detail: subject?.name || 'Clase',
        meta: '',
        time: 'Hoy',
        warning: false,
      },
      {
        icon: 'help-circle',
        color: '#F59E0B',
        title: `${questions.length} pregunta${questions.length === 1 ? '' : 's'} disponible${questions.length === 1 ? '' : 's'}`,
        detail: latestQuestion?.text || 'Añade preguntas para empezar la clase',
        meta: '',
        time: 'Ahora',
        warning: questions.length === 0,
      },
    ];
  }, [averageXp, enrollments.length, latestQuestion?.text, profilesById, questions.length, scores, subject?.name]);

  const studentReportRows = useMemo(
    () => buildStudentReportRows(enrollments, scores, profilesById, questions.length),
    [enrollments, profilesById, questions.length, scores]
  );
  const studentListRows = useMemo(
    () => buildStudentListRows(studentReportRows, studentSearch, studentStatusFilter, studentSortKey),
    [studentReportRows, studentSearch, studentSortKey, studentStatusFilter]
  );
  const reportSummary = useMemo(() => {
    const answeredStudents = studentReportRows.filter((student) => student.hasActivity);
    const failedAnswers = studentReportRows.reduce((total, student) => total + student.failedAnswers, 0);
    const correctAnswers = studentReportRows.reduce((total, student) => total + student.correctAnswers, 0);

    return {
      enrolled: enrollments.length,
      answered: answeredStudents.length,
      participation: enrollments.length > 0 ? Math.round((answeredStudents.length / enrollments.length) * 100) : 0,
      averageGrade,
      averageAccuracy,
      failedAnswers,
      correctAnswers,
    };
  }, [averageAccuracy, averageGrade, enrollments.length, studentReportRows]);

  useEffect(() => {
    const loadFailedQuestions = async () => {
      const rows = await buildFailedQuestionRows(supabase, questions, enrollments, topicRows);
      setFailedQuestionRows(rows);
    };

    loadFailedQuestions();
  }, [questions, enrollments, topicRows]);

  const temporalEvolution = useMemo(
    () => buildTemporalEvolution(scores, questions.length),
    [questions.length, scores]
  );

  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
      return;
    }

    Alert.alert(title, message);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData.session?.user.id;

      if (!teacherId) {
        throw new Error('No se encontró una sesión activa.');
      }

      const subjectResult = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectIdNumber)
        .eq('teacher_id', teacherId)
        .single();

      if (subjectResult.error) throw subjectResult.error;

      const classroomsResult = await supabase
        .from('classrooms')
        .select('id, name, academic_year, active, code')
        .eq('subject_id', subjectIdNumber)
        .eq('active', true)
        .order('created_at', { ascending: true });

      if (classroomsResult.error) throw classroomsResult.error;

      let nextClassrooms = (classroomsResult.data || []) as Classroom[];
      if (nextClassrooms.length === 0) {
        const { data: fallbackClassroomId, error: fallbackClassroomError } = await supabase.rpc('ensure_default_classroom', {
          p_subject_id: Number(subjectId),
        });

        if (fallbackClassroomError) throw fallbackClassroomError;

        const { data: fallbackClassroom, error: fallbackFetchError } = await supabase
          .from('classrooms')
          .select('id, name, academic_year, active, code')
          .eq('id', Number(fallbackClassroomId))
          .single();

        if (fallbackFetchError) throw fallbackFetchError;
        nextClassrooms = fallbackClassroom ? [fallbackClassroom as Classroom] : [];
      }

      const classroomId = selectedClassroomId && nextClassrooms.some((classroom) => classroom.id === selectedClassroomId)
        ? selectedClassroomId
        : nextClassrooms[0]?.id ?? null;

      if (!classroomId) {
        throw new Error('No se encontró ninguna clase activa en este curso.');
      }

      const [questionsResult, topicsResult, topicScoresResult, enrollmentsResult, scoresResult, subjectsCountResult, manualReviewResult] = await Promise.all([
        supabase
          .from('questions')
          .select('*, answers(*)')
          .eq('subject_id', subjectIdNumber)
          .eq('classroom_id', classroomId)
          .eq('active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('subject_topics')
          .select('id, title, description, icon, sort_order, available_until, classroom_id')
          .eq('subject_id', subjectIdNumber)
          .eq('classroom_id', classroomId)
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('topic_scores')
          .select('topic_id, max_score, classroom_id')
          .eq('subject_id', subjectIdNumber)
          .eq('classroom_id', classroomId),
        supabase.from('enrollments').select('student_id, classroom_id').eq('subject_id', subjectIdNumber).eq('classroom_id', classroomId),
        supabase
          .from('subject_scores')
          .select('student_id, max_score, correct_answers, played_days, played_at, classroom_id')
          .eq('subject_id', subjectIdNumber)
          .eq('classroom_id', classroomId)
          .order('played_at', { ascending: false }),
        supabase.from('subjects').select('id').eq('teacher_id', teacherId).eq('is_archived', false),
        supabase
          .from('attempt_history')
          .select(`
            id,
            student_id,
            question_id,
            is_correct,
            submitted_answer_text,
            earned_points,
            attempted_at,
            time_taken_seconds,
            manual_review_status,
            reviewed_at,
            review_notes,
            profiles(alias),
            questions!inner(id, text, type, subject_id, classroom_id, topic_id, points_base)
          `)
          .eq('questions.subject_id', subjectIdNumber)
          .eq('questions.classroom_id', classroomId)
          .eq('questions.type', 'open_answer')
          .order('attempted_at', { ascending: false })
          .limit(100),
      ]);

      if (questionsResult.error) throw questionsResult.error;
      if (topicsResult.error) throw topicsResult.error;
      if (topicScoresResult.error) throw topicScoresResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;
      if (subjectsCountResult.error) throw subjectsCountResult.error;
      if (manualReviewResult.error) throw manualReviewResult.error;

      const nextEnrollments = (enrollmentsResult.data || []) as Enrollment[];
      const nextScores = (scoresResult.data || []) as SubjectScore[];
      const studentIds = Array.from(new Set([...nextEnrollments.map((item) => item.student_id), ...nextScores.map((item) => item.student_id)]));

      if (studentIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, alias')
          .in('id', studentIds);

        if (profilesError) throw profilesError;

        setProfilesById(
          ((profilesData || []) as StudentProfile[]).reduce<Record<string, StudentProfile>>((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {})
        );
      } else {
        setProfilesById({});
      }

      setSubject(subjectResult.data as Subject);
      setClassrooms(nextClassrooms);
      setSelectedClassroomId(classroomId);
      setQuestions((questionsResult.data || []) as Question[]);
      const nextTopics = (topicsResult.data || []) as Topic[];
      const topicTitleById = new Map<number, string>(nextTopics.map((topic) => [topic.id, topic.title]));
      setTopics(nextTopics);
      setTopicScores((topicScoresResult.data || []) as TopicScore[]);
      setEnrollments(nextEnrollments);
      setScores(nextScores);
      setSubjectsCount(subjectsCountResult.data?.length || 0);
      setManualReviewRows(
        ((manualReviewResult.data || []) as any[])
          .map((row) => {
            const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;
            const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
            const topicId = question?.topic_id == null ? null : Number(question.topic_id);

            return {
              id: Number(row.id),
              studentId: row.student_id,
              studentName: profile?.alias || 'Alumno',
              questionId: Number(row.question_id),
              questionText: question?.text || 'Pregunta abierta',
              answerText: row.submitted_answer_text || 'Sin respuesta escrita',
              topicName: topicId ? topicTitleById.get(topicId) || 'Tema' : 'Tema general',
              status: row.manual_review_status || 'not_required',
              attemptedAt: row.attempted_at,
              reviewedAt: row.reviewed_at ?? null,
              earnedPoints: row.earned_points ?? 0,
              possiblePoints: question?.points_base ?? 0,
              timeTaken: row.time_taken_seconds ?? null,
            };
          })
          .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())
      );
    } catch (error: any) {
      console.error('Error cargando detalle de clase:', error.message);
      showAlert('No se pudo cargar la clase', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClassroomId, showAlert, subjectIdNumber]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const invokeTeacherAction = useCallback(async <T extends TeacherActionResult>(
    functionName: string,
    body: Record<string, unknown>
  ): Promise<T> => {
    const { data, error } = await supabase.functions.invoke(functionName, { body });

    if (error) throw error;

    const result = (data || {}) as T;
    if (result.error) throw new Error(result.error);
    return result;
  }, []);

  const handleCreateClassroom = useCallback(async () => {
    if (!subject || !newClassroomName.trim()) {
      showAlert('Clase sin nombre', 'Escribe un nombre para crear la clase dentro del curso.');
      return;
    }

    setCreatingClassroom(true);
    try {
      const { data, error } = await supabase
        .rpc('create_teacher_classroom', {
          p_subject_id: subject.id,
          p_name: newClassroomName.trim(),
          p_academic_year: subject.academic_year ?? null,
        });

      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('La base de datos no devolvió la clase creada.');
      }

      const createdClassroom = data as unknown as Classroom;

      setNewClassroomName('');
      setClassrooms((prevClassrooms) => [...prevClassrooms, createdClassroom]);
      setSelectedClassroomId(Number(createdClassroom.id));
      showAlert('Clase creada', 'La clase se ha añadido al curso.');
    } catch (error: any) {
      showAlert('No se pudo crear la clase', error.message || 'Inténtalo de nuevo.');
    } finally {
      setCreatingClassroom(false);
    }
  }, [newClassroomName, showAlert, subject]);

  const handleEditClass = useCallback(() => {
    if (!subject) return;
    router.push(`/(teacher)/edit-subject?id=${subject.id}` as any);
  }, [router, subject]);

  const handleArchiveClass = useCallback(async () => {
    if (!subject) return;

    const executeArchive = async () => {
      try {
        await invokeTeacherAction('teacher-archive-subject', {
          archive: true,
          subjectId: subject.id,
        });

        showAlert('Curso archivado', 'El curso se archivó correctamente.');
        router.replace('/(teacher)/classes' as any);
      } catch (archiveError: any) {
        showAlert('No se pudo archivar', archiveError.message || 'Inténtalo de nuevo.');
      }
    };

    Alert.alert('Archivar curso', 'El curso se ocultará de los cursos activos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        style: 'destructive',
        onPress: () => {
          void executeArchive();
        },
      },
    ]);
  }, [invokeTeacherAction, router, showAlert, subject]);

  const handleDuplicateClass = useCallback(async () => {
    if (!subject) return;

    try {
      const { data: duplicatedSubject, error: duplicateError } = await supabase.rpc('duplicate_teacher_subject', {
        p_subject_id: subject.id,
        p_name_suffix: ' (Copia)',
      });

      if (duplicateError) throw duplicateError;

      const duplicatedSubjectId =
        duplicatedSubject && typeof duplicatedSubject === 'object' && !Array.isArray(duplicatedSubject)
          ? Number((duplicatedSubject as { id?: number }).id)
          : null;

      if (!duplicatedSubjectId) {
        throw new Error('No se pudo obtener el curso duplicado.');
      }

      showAlert('Curso duplicado', 'Se creó una copia completa con clases, temas, preguntas y respuestas.');
      router.push(`/(teacher)/subject/${duplicatedSubjectId}` as any);
    } catch (duplicateError: any) {
      showAlert('No se pudo duplicar', duplicateError.message || 'Inténtalo de nuevo.');
    }
  }, [router, showAlert, subject]);

  const handleRegenerateClassCode = useCallback(async () => {
    if (!subject) return;

    try {
      const result = await invokeTeacherAction<{ code?: string; error?: string }>('teacher-regenerate-class-code', {
        subjectId: subject.id,
      });
      const nextCode = String(result.code || '');
      if (!nextCode) throw new Error('No se recibió el nuevo código.');

      setSubject((current) => (current ? { ...current, code: nextCode } : current));
      showAlert('Código actualizado', `Nuevo código del curso: ${nextCode}`);
    } catch (regenerateError: any) {
      showAlert('No se pudo regenerar el código', regenerateError.message || 'Inténtalo de nuevo.');
    }
  }, [invokeTeacherAction, showAlert, subject]);

  const handleManageAccess = useCallback(() => {
    if (!subject) return;

    if (Platform.OS === 'web') {
      const choice = window.prompt(
        `Gestionar acceso\n1) Ver estudiantes\n2) Ver código\n3) Regenerar código\n\nCódigo actual: ${subject.code}\nEscribe 1, 2 o 3`
      );

      if (choice === '1') {
        setActiveTab('students');
        return;
      }
      if (choice === '2') {
        showAlert('Código del curso', subject.code);
        return;
      }
      if (choice === '3') {
        void handleRegenerateClassCode();
      }
      return;
    }

    if (Platform.OS === 'android') {
      Alert.alert('Gestionar acceso', `Código actual: ${subject.code}`, [
        {
          text: 'Ver estudiantes',
          onPress: () => setActiveTab('students'),
        },
        {
          text: 'Más opciones',
          onPress: () => {
            Alert.alert('Opciones de acceso', 'Elige una acción', [
              { text: 'Ver código', onPress: () => showAlert('Código del curso', subject.code) },
              {
                text: 'Regenerar código',
                onPress: () => {
                  void handleRegenerateClassCode();
                },
              },
              { text: 'Cancelar', style: 'cancel' },
            ]);
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]);
      return;
    }

    Alert.alert('Gestionar acceso', `Código actual: ${subject.code}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Ver estudiantes',
        onPress: () => setActiveTab('students'),
      },
      {
        text: 'Ver código',
        onPress: () => showAlert('Código del curso', subject.code),
      },
      {
        text: 'Regenerar código',
        style: 'destructive',
        onPress: () => {
          void handleRegenerateClassCode();
        },
      },
    ]);
  }, [handleRegenerateClassCode, showAlert, subject]);

  const handleClassMenu = useCallback(() => {
    if (!subject) return;

    if (Platform.OS === 'web') {
      const choice = window.prompt(
        `Menú de curso\n1) Editar curso\n2) Archivar curso\n3) Duplicar curso\n4) Regenerar código\n5) Gestionar acceso\n\nEscribe una opción (1-5)`
      );

      if (choice === '1') {
        handleEditClass();
        return;
      }
      if (choice === '2') {
        void handleArchiveClass();
        return;
      }
      if (choice === '3') {
        void handleDuplicateClass();
        return;
      }
      if (choice === '4') {
        void handleRegenerateClassCode();
        return;
      }
      if (choice === '5') {
        handleManageAccess();
      }
      return;
    }

    if (Platform.OS === 'android') {
      Alert.alert('Menú de curso', 'Elige una acción', [
        { text: 'Editar curso', onPress: handleEditClass },
        { text: 'Gestionar acceso', onPress: handleManageAccess },
        {
          text: 'Más acciones',
          onPress: () => {
            Alert.alert('Más acciones', 'Selecciona una opción', [
              {
                text: 'Duplicar curso',
                onPress: () => {
                  void handleDuplicateClass();
                },
              },
              {
                text: 'Regenerar código',
                onPress: () => {
                  void handleRegenerateClassCode();
                },
              },
              {
                text: 'Archivar curso',
                style: 'destructive',
                onPress: () => {
                  void handleArchiveClass();
                },
              },
            ]);
          },
        },
      ]);
      return;
    }

    Alert.alert('Menú de curso', 'Elige una acción', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Editar curso', onPress: handleEditClass },
      {
        text: 'Archivar curso',
        style: 'destructive',
        onPress: () => {
          void handleArchiveClass();
        },
      },
      {
        text: 'Duplicar curso',
        onPress: () => {
          void handleDuplicateClass();
        },
      },
      {
        text: 'Regenerar código',
        onPress: () => {
          void handleRegenerateClassCode();
        },
      },
      { text: 'Gestionar acceso', onPress: handleManageAccess },
    ]);
  }, [handleArchiveClass, handleDuplicateClass, handleEditClass, handleManageAccess, handleRegenerateClassCode, subject]);

  const handleCreateTopic = useCallback(async () => {
    const cleanAvailableUntil = newTopicAvailableUntil.trim();
    const parsedAvailableUntil = cleanAvailableUntil ? parseDateTimeInput(cleanAvailableUntil) : null;

    if (!newTopicTitle.trim()) {
      showAlert('Tema sin nombre', 'Escribe un nombre para el tema.');
      return;
    }

    if (!selectedClassroomId) {
      showAlert('Selecciona una clase', 'Elige la clase del curso donde quieres crear el tema.');
      return;
    }

    if (cleanAvailableUntil && !parsedAvailableUntil) {
      showAlert('Fecha inválida', 'Usa el formato AAAA-MM-DD HH:mm, por ejemplo 2026-07-01 18:30.');
      return;
    }

    setCreatingTopic(true);
    try {
      const { data, error } = await supabase.functions.invoke('teacher-create-topic', {
        body: {
          subjectId: subjectIdNumber,
          classroomId: selectedClassroomId,
          title: newTopicTitle.trim(),
          description: newTopicDescription.trim() || null,
          icon: '📘',
          sortOrder: topics.length + 1,
          availableUntil: parsedAvailableUntil ? parsedAvailableUntil.toISOString() : null,
        },
      });

      if (error) throw error;
      const result = (data || {}) as { error?: string; topic?: Topic };
      if (result.error) throw new Error(result.error);
      if (!result.topic) throw new Error('No se recibió el tema creado.');

      setTopics((prevTopics) => [...prevTopics, result.topic as Topic]);
      setSelectedTopicId(Number(result.topic.id));
      setNewTopicTitle('');
      setNewTopicDescription('');
      setNewTopicAvailableUntil('');
      router.push(`/(teacher)/subject/add-question?subjectId=${subjectId}${selectedClassroomId ? `&classroomId=${selectedClassroomId}` : ''}&topicId=${result.topic.id}&difficulty=${newTopicDifficulty}` as any);
    } catch (error: any) {
      showAlert('No se pudo crear el tema', error.message);
    } finally {
      setCreatingTopic(false);
    }
  }, [newTopicAvailableUntil, newTopicDescription, newTopicDifficulty, newTopicTitle, router, selectedClassroomId, showAlert, subjectId, subjectIdNumber, topics.length]);

  const handleReviewOpenAttempt = useCallback(async (attemptId: number, isCorrect: boolean) => {
    setReviewingAttemptId(attemptId);
    try {
      const { error } = await supabase.rpc('review_open_answer_attempt', {
        p_attempt_history_id: attemptId,
        p_is_correct: isCorrect,
        p_notes: null,
      });

      if (error) throw error;
      await fetchData();
    } catch (error: any) {
      showAlert('No se pudo revisar la respuesta', error.message || 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setReviewingAttemptId(null);
    }
  }, [fetchData, showAlert]);

  const executeDelete = useCallback(async (questionId: number) => {
    try {
      await invokeTeacherAction('teacher-delete-question', { questionId });
      setQuestions((prevQuestions) => prevQuestions.filter((question) => question.id !== questionId));
    } catch (error: any) {
      showAlert('Error al borrar', error.message);
    }
  }, [invokeTeacherAction, showAlert]);

  const handleDelete = useCallback((questionId: number) => {
    Alert.alert('Borrar pregunta', '¿Estás seguro de que quieres eliminar esta pregunta? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sí, borrar', style: 'destructive', onPress: () => executeDelete(questionId) },
    ]);
  }, [executeDelete]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login' as any);
  }, [router]);

  const selectedClassroom = classrooms.find((classroom) => classroom.id === selectedClassroomId) || classrooms[0] || null;

  return {
    activeTab,
    answeredClassQuestions,
    averageAccuracy,
    averageGrade,
    averageXp,
    classrooms,
    creatingClassroom,
    creatingTopic,
    enrollments,
    failedQuestionRows,
    fetchData,
    filteredQuestions,
    gradeDistribution,
    handleClassMenu,
    handleCreateClassroom,
    handleCreateTopic,
    handleDelete,
    handleReviewOpenAttempt,
    handleSignOut,
    loading,
    latestQuestion,
    manualReviewPendingCount,
    manualReviewReviewedCount,
    manualReviewRows,
    newClassroomName,
    newTopicAvailableUntil,
    newTopicDescription,
    newTopicDifficulty,
    newTopicTitle,
    onRefresh,
    participation,
    possibleClassQuestions,
    progress,
    questions,
    recentActivity,
    refreshing,
    reportSummary,
    reviewingAttemptId,
    scorePerformanceRows,
    scores,
    selectedClassroom,
    selectedClassroomId,
    selectedDifficulty,
    selectedTopicId,
    selectedTopicLabel,
    setActiveTab,
    setNewClassroomName,
    setNewTopicAvailableUntil,
    setNewTopicDescription,
    setNewTopicDifficulty,
    setNewTopicTitle,
    setSelectedClassroomId,
    setSelectedDifficulty,
    setSelectedTopicId,
    setShowStudentImportModal,
    setStudentSearch,
    setStudentSortKey,
    setStudentStatusFilter,
    showAlert,
    showStudentImportModal,
    studentListRows,
    studentReportRows,
    studentSearch,
    studentSortKey,
    studentStatusFilter,
    subject,
    subjectsCount,
    temporalEvolution,
    topicRows,
    topics,
  };
}

function formatRelative(value: string | null | undefined, index: number) {
  if (!value) return index === 0 ? 'Hace 2h' : index === 1 ? 'Hace 4h' : 'Ayer';
  const date = new Date(value);
  const diffHours = Math.max(1, Math.round((Date.now() - date.getTime()) / 3600000));
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffHours < 48) return 'Ayer';
  return `Hace ${Math.round(diffHours / 24)} días`;
}

function getSubjectTabFromParam(value: string | string[] | undefined): SubjectTabKey {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const tab = teacherSubjectTabItems.find((item) => item.key === rawValue);
  return tab ? tab.key : 'summary';
}

async function buildFailedQuestionRows(
  supabaseClient: typeof supabase,
  questions: Question[],
  enrollments: Enrollment[],
  topicRows: {
    id: number | 'general'
    title: string
    questionsCount: number
    averageScore: number
  }[]
): Promise<FailedQuestionReport[]> {
  if (questions.length === 0) return [];

  const studentIds = enrollments.map((e) => e.student_id);
  if (studentIds.length === 0) return [];
  const questionIds = questions.map((question) => question.id);

  const { data: attempts, error } = await supabaseClient
    .from('attempt_history')
    .select('question_id, is_correct')
    .in('student_id', studentIds)
    .in('question_id', questionIds);

  if (error) {
    console.error('Error fetching attempts:', error);
    return [];
  }

  const failureCount = new Map<number, number>();
  const attemptCount = new Map<number, number>();
  attempts?.forEach((attempt: any) => {
    attemptCount.set(attempt.question_id, (attemptCount.get(attempt.question_id) || 0) + 1);
    if (!attempt.is_correct) {
      failureCount.set(attempt.question_id, (failureCount.get(attempt.question_id) || 0) + 1);
    }
  });

  const topicById = new Map(topicRows.map((topic) => [topic.id, topic]));

  return questions
    .map((question) => {
      const topic = question.topic_id ? topicById.get(question.topic_id) : topicById.get('general');
      const actualFailures = failureCount.get(question.id) || 0;
      const totalAttempts = attemptCount.get(question.id) || 0;
      const failureRate = totalAttempts > 0 ? Math.round((actualFailures / totalAttempts) * 100) : 0;

      return {
        id: question.id,
        text: question.text,
        topic: topic?.title || 'Tema general',
        actualFailures,
        totalAttempts,
        failureRate,
      };
    })
    .filter((q) => q.actualFailures > 0)
    .sort((a, b) => b.actualFailures - a.actualFailures || b.failureRate - a.failureRate)
    .slice(0, 5);
}
