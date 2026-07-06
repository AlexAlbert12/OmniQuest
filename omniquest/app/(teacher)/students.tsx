import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { accuracyToGrade, answersToAccuracyPercent, scoreToGrade } from '../../lib/grades';
import TeacherSidebar from '../../components/teacher/TeacherSidebar';
import BrandLogo from '../../components/BrandLogo';
import NotificationBadge from '../../components/NotificationBadge';
import TeacherHeaderAvatar from '../../components/teacher/TeacherHeaderAvatar';

type IconName = keyof typeof Ionicons.glyphMap;

type Subject = {
  id: number
  name: string
}

type Classroom = {
  id: number
  subject_id: number | null
  name: string
  academic_year?: string | null
}

type Enrollment = {
  student_id: string
  subject_id: number
  classroom_id?: number | null
  joined_at?: string | null
}

type StudentProfile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
}

type SubjectScore = {
  student_id: string
  subject_id: number
  classroom_id?: number | null
  max_score: number | null
  correct_answers?: number | null
  played_days?: string[] | null
  played_at?: string | null
}

type QuestionSummary = {
  id: number
  subject_id: number | null
  classroom_id?: number | null
  topic_id?: number | null
  subject_topics?: { title: string | null } | null
}

type AttemptHistoryRow = {
  id: number
  student_id: string
  question_id: number
  is_correct: boolean
  attempted_at: string | null
  created_at?: string | null
  earned_points?: number | null
  questions?: {
    text: string | null
    subject_id: number | null
    topic_id: number | null
    subject_topics?: { title: string | null } | null
  } | null
}

type StudentCourseContext = {
  subjectId: number
  subjectName: string
  classroomId: number | null
  classroomName: string
  joinedAt: string | null
}

type StudentWeakArea = {
  title: string
  detail: string
  mistakes: number
  accuracyPercent: number | null
}

type StudentRecentAttempt = {
  id: number
  questionText: string
  topicTitle: string
  subjectName: string
  isCorrect: boolean
  attemptedAt: string | null
  earnedPoints: number
}

type StudentStatus = 'active' | 'inactive' | 'needs_help' | 'no_activity' | 'excellent'
type StudentStatusFilter = 'all' | StudentStatus
type StudentSortKey = 'attention' | 'accuracy' | 'xp' | 'last_activity' | 'name'

type StudentRow = {
  id: string
  alias: string
  handle: string
  globalPoints: number
  subjectScore: number
  averageScore: number
  accuracyPercent: number
  challenges: number
  progress: number
  status: StudentStatus
  hasActivity: boolean
  subjectIds: number[]
  subjectNames: string[]
  classroomIds: number[]
  classroomNames: string[]
  courseContexts: StudentCourseContext[]
  weakAreas: StudentWeakArea[]
  recentAttempts: StudentRecentAttempt[]
  lastActivityAt: string | null
  importedAt: string | null
}

type ConfirmDialog = {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}

const statusFilterOptions: { value: StudentStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'no_activity', label: 'Sin actividad' },
  { value: 'needs_help', label: 'Necesita apoyo' },
  { value: 'active', label: 'Activos' },
  { value: 'excellent', label: 'Excelente' },
  { value: 'inactive', label: 'Inactivos' },
];

const sortOptions: { value: StudentSortKey; label: string }[] = [
  { value: 'attention', label: 'Necesitan atención' },
  { value: 'accuracy', label: 'Precisión' },
  { value: 'xp', label: 'XP' },
  { value: 'last_activity', label: 'Última actividad' },
  { value: 'name', label: 'Nombre' },
];

function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204';
}

export default function TeacherStudentsScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { subjectId, classroomId } = useLocalSearchParams<{ subjectId?: string; classroomId?: string }>();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | 'all'>('all');
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<StudentStatusFilter>('all');
  const [selectedSort, setSelectedSort] = useState<StudentSortKey>('attention');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionStudent, setActionStudent] = useState<StudentRow | null>(null);
  const [detailStudent, setDetailStudent] = useState<StudentRow | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);

  const isDesktop = width >= 1080;
  const isWide = width >= 900;

  const classroomOptions = useMemo(() => {
    if (selectedSubjectId === 'all') return classrooms;
    return classrooms.filter((classroom) => classroom.subject_id === selectedSubjectId);
  }, [classrooms, selectedSubjectId]);

  useEffect(() => {
    if (!subjectId) return;
    const parsedSubjectId = Number(subjectId);
    if (Number.isFinite(parsedSubjectId)) {
      setSelectedSubjectId(parsedSubjectId);
    }
  }, [subjectId]);

  useEffect(() => {
    if (!classroomId) return;
    const parsedClassroomId = Number(classroomId);
    if (Number.isFinite(parsedClassroomId)) {
      setSelectedClassroomId(parsedClassroomId);
    }
  }, [classroomId]);

  useEffect(() => {
    if (selectedClassroomId === 'all') return;
    const selectedClassroom = classrooms.find((classroom) => classroom.id === selectedClassroomId);
    if (!selectedClassroom) {
      setSelectedClassroomId('all');
      return;
    }
    if (selectedSubjectId !== 'all' && selectedClassroom.subject_id !== selectedSubjectId) {
      setSelectedClassroomId('all');
    }
  }, [classrooms, selectedClassroomId, selectedSubjectId]);

  const visibleStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    let rows = [...students];

    if (selectedSubjectId !== 'all') {
      rows = rows.filter((student) => student.subjectIds.includes(selectedSubjectId));
    }

    if (selectedClassroomId !== 'all') {
      rows = rows.filter((student) => student.classroomIds.includes(selectedClassroomId));
    }

    if (selectedStatus !== 'all') {
      rows = rows.filter((student) => student.status === selectedStatus);
    }

    if (normalizedSearch) {
      rows = rows.filter((student) => {
        const searchable = `${student.alias} ${student.handle} ${student.subjectNames.join(' ')} ${student.classroomNames.join(' ')}`;
        return searchable.toLowerCase().includes(normalizedSearch);
      });
    }

    return rows.sort((a, b) => compareStudents(a, b, selectedSort));
  }, [search, selectedClassroomId, selectedSort, selectedStatus, selectedSubjectId, students]);

  const stats = useMemo(() => {
    const total = visibleStudents.length;
    const studentsWithActivity = visibleStudents.filter((student) => student.hasActivity);
    const active = visibleStudents.filter((student) => student.status === 'active' || student.status === 'excellent').length;
    const noActivity = visibleStudents.filter((student) => student.status === 'no_activity').length;
    const needsHelp = visibleStudents.filter((student) => student.status === 'needs_help').length;
    const totalScore = studentsWithActivity.reduce((sum, student) => sum + student.subjectScore, 0);

    return {
      total,
      active,
      noActivity,
      needsHelp,
      withActivity: studentsWithActivity.length,
      averageXp: studentsWithActivity.length > 0 ? Math.round(totalScore / studentsWithActivity.length) : null,
      averageGrade: studentsWithActivity.length > 0
        ? Number((studentsWithActivity.reduce((sum, student) => sum + student.averageScore, 0) / studentsWithActivity.length).toFixed(1))
        : null,
      averageAccuracy: studentsWithActivity.length > 0
        ? Math.round(studentsWithActivity.reduce((sum, student) => sum + student.accuracyPercent, 0) / studentsWithActivity.length)
        : null,
      completedChallenges: studentsWithActivity.reduce((sum, student) => sum + student.challenges, 0),
    };
  }, [visibleStudents]);

  const needsAttention = useMemo(
    () => visibleStudents.filter((student) => student.status === 'needs_help' || student.status === 'inactive').slice(0, 4),
    [visibleStudents]
  );

  const pendingStudents = useMemo(
    () => visibleStudents.filter((student) => student.status === 'no_activity'),
    [visibleStudents]
  );

  const fetchStudents = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('teacher_id', session.session.user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (subjectsError) throw subjectsError;

      const teacherSubjects = (subjectsData || []) as Subject[];
      setSubjects(teacherSubjects);

      const subjectIds = teacherSubjects.map((subject) => subject.id);
      if (subjectIds.length === 0) {
        setClassrooms([]);
        setStudents([]);
        return;
      }

      const [classroomsResult, enrollmentsResult, scoresResult, questionsResult] = await Promise.all([
        supabase
          .from('classrooms')
          .select('id, subject_id, name, academic_year')
          .in('subject_id', subjectIds)
          .neq('active', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('enrollments')
          .select('student_id, subject_id, classroom_id, joined_at')
          .in('subject_id', subjectIds),
        supabase
          .from('subject_scores')
          .select('student_id, subject_id, classroom_id, max_score, correct_answers, played_days, played_at')
          .in('subject_id', subjectIds),
        supabase
          .from('questions')
          .select('id, subject_id, classroom_id, topic_id, subject_topics(title)')
          .in('subject_id', subjectIds),
      ]);

      if (classroomsResult.error && !isMissingSchemaError(classroomsResult.error.code)) throw classroomsResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;
      if (questionsResult.error) throw questionsResult.error;

      const teacherClassrooms = ((classroomsResult.error ? [] : classroomsResult.data) || []) as Classroom[];
      setClassrooms(teacherClassrooms);

      const enrollments = (enrollmentsResult.data || []) as Enrollment[];
      const scores = (scoresResult.data || []) as SubjectScore[];
      const questions = (questionsResult.data || []) as QuestionSummary[];
      const studentIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.student_id).filter(Boolean)));

      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      const [profilesResult, attemptsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, alias, avatar, points')
          .in('id', studentIds),
        (supabase.from('attempt_history') as any)
          .select('id, student_id, question_id, is_correct, attempted_at, created_at, earned_points, questions!inner(text, subject_id, topic_id, subject_topics(title))')
          .in('student_id', studentIds)
          .in('questions.subject_id', subjectIds)
          .order('attempted_at', { ascending: false })
          .limit(500),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (attemptsResult.error && !isMissingSchemaError(attemptsResult.error.code)) {
        console.warn('No se pudo cargar attempt_history:', attemptsResult.error.message);
      }

      const profilesById = new Map(((profilesResult.data || []) as StudentProfile[]).map((profile) => [profile.id, profile]));
      const subjectMap = new Map(teacherSubjects.map((subject) => [subject.id, subject.name]));
      const classroomMap = new Map(teacherClassrooms.map((classroom) => [classroom.id, classroom]));
      const questionsCountBySubject = questions.reduce<Map<number, number>>((map, question) => {
        if (typeof question.subject_id === 'number') {
          map.set(question.subject_id, (map.get(question.subject_id) || 0) + 1);
        }
        return map;
      }, new Map());
      const enrollmentsByStudent = groupBy(enrollments, 'student_id');
      const scoresByStudent = groupBy(scores, 'student_id');
      const attempts = (attemptsResult.error ? [] : attemptsResult.data || []) as AttemptHistoryRow[];
      const attemptsByStudent = groupBy(attempts, 'student_id');

      const rows = studentIds.map((studentId) => {
        const profile = profilesById.get(studentId);
        const studentEnrollments = enrollmentsByStudent.get(studentId) || [];
        const studentScores = scoresByStudent.get(studentId) || [];
        const studentAttempts = attemptsByStudent.get(studentId) || [];
        const scoreValues = studentScores.map((score) => score.max_score ?? 0).filter((score) => score > 0);
        const subjectScore = scoreValues.reduce((total, score) => total + score, 0);
        const progress = studentEnrollments.length > 0
          ? Math.round((studentEnrollments.filter((enrollment) => hasScoreForEnrollment(enrollment, studentScores)).length / studentEnrollments.length) * 100)
          : 0;
        const answerTotals = getAnswerTotals(studentScores, questionsCountBySubject);
        const accuracyPercent = answerTotals.totalAnswers > 0
          ? answersToAccuracyPercent(answerTotals.correctAnswers, answerTotals.totalAnswers)
          : 0;
        const fallbackGrade = getFallbackScoreGrade(studentScores, questionsCountBySubject);
        const hasActivity = studentAttempts.length > 0 || studentScores.some(hasSubjectScoreActivity) || answerTotals.totalAnswers > 0;
        const averageScore = hasActivity
          ? answerTotals.totalAnswers > 0
            ? accuracyToGrade(accuracyPercent)
            : fallbackGrade
          : 0;
        const status = getStudentStatus({ hasActivity, averageScore, accuracyPercent, progress });
        const courseContexts = buildCourseContexts(studentEnrollments, subjectMap, classroomMap);
        const recentAttempts = buildRecentAttempts(studentAttempts, subjectMap);

        return {
          id: studentId,
          alias: profile?.alias || 'Alumno sin perfil',
          handle: `@${(profile?.alias || 'alumno').toLowerCase().replace(/\s+/g, '')}`,
          globalPoints: profile?.points ?? 0,
          subjectScore,
          averageScore,
          accuracyPercent,
          challenges: hasActivity ? Math.max(answerTotals.totalAnswers, studentAttempts.length, studentScores.length) : 0,
          progress,
          status,
          hasActivity,
          subjectIds: Array.from(new Set(studentEnrollments.map((enrollment) => enrollment.subject_id))),
          subjectNames: Array.from(new Set(courseContexts.map((context) => context.subjectName))),
          classroomIds: Array.from(new Set(studentEnrollments.map((enrollment) => enrollment.classroom_id).filter((id): id is number => typeof id === 'number'))),
          classroomNames: Array.from(new Set(courseContexts.map((context) => context.classroomName))),
          courseContexts,
          weakAreas: buildWeakAreas(studentScores, studentAttempts, subjectMap, questionsCountBySubject),
          recentAttempts,
          lastActivityAt: getLastActivityDate(studentScores, studentAttempts),
          importedAt: getFirstEnrollmentDate(studentEnrollments),
        } satisfies StudentRow;
      });

      setStudents(rows);
    } catch (error: any) {
      console.error('Error cargando estudiantes:', error.message);
      showAlert('No se pudieron cargar los estudiantes', error.message || 'Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStudents();
    }, [fetchStudents])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const handleViewStudentDetails = (student: StudentRow) => {
    setActionStudent(null);
    setDetailStudent(student);
  };

  const handleRemoveFromClass = async (student: StudentRow) => {
    const subjectIds = student.subjectIds;
    if (subjectIds.length === 0) {
      showAlert('Sin cursos', `${student.alias} no está inscrito en ningún curso.`);
      return;
    }

    try {
      await deleteStudentProgressForSubjects(student.id, subjectIds);

      const deleteEnrollments = await supabase
        .from('enrollments')
        .delete()
        .eq('student_id', student.id)
        .in('subject_id', subjectIds);
      if (deleteEnrollments.error) throw deleteEnrollments.error;

      setStudents((prev) => prev.filter((row) => row.id !== student.id));
      showAlert('Estudiante eliminado', `${student.alias} ha sido removido de sus cursos y clases.`);
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo eliminar al estudiante.');
    }
  };

  const requestRemoveFromClass = (student: StudentRow) => {
    setActionStudent(null);
    setDetailStudent(null);
    setConfirmDialog({
      title: 'Quitar de clase',
      message: `Se eliminará a ${student.alias} de sus cursos y clases actuales y se limpiará su progreso asociado.`,
      confirmLabel: 'Sí, quitar',
      destructive: true,
      onConfirm: () => handleRemoveFromClass(student),
    });
  };

  const handleResetProgress = async (student: StudentRow) => {
    const subjectIds = student.subjectIds;
    if (subjectIds.length === 0) {
      showAlert('Sin progreso', `${student.alias} no tiene progreso registrado.`);
      return;
    }

    try {
      await deleteStudentProgressForSubjects(student.id, subjectIds);

      setStudents((prev) => prev.map((row) => (
        row.id === student.id
          ? {
              ...row,
              subjectScore: 0,
              averageScore: 0,
              accuracyPercent: 0,
              challenges: 0,
              progress: 0,
              status: 'no_activity',
              hasActivity: false,
              weakAreas: [],
              recentAttempts: [],
              lastActivityAt: null,
            }
          : row
      )));
      showAlert('Progreso reiniciado', `El progreso de ${student.alias} ha sido reiniciado.`);
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo reiniciar el progreso.');
    }
  };

  const requestResetProgress = (student: StudentRow) => {
    setActionStudent(null);
    setConfirmDialog({
      title: 'Reiniciar progreso',
      message: `Se borrarán puntuaciones, progreso por tema y el historial de intentos de ${student.alias} en sus cursos actuales.`,
      confirmLabel: 'Reiniciar',
      destructive: true,
      onConfirm: () => handleResetProgress(student),
    });
  };

  const handleAssignActivity = (student: StudentRow) => {
    const targetSubjectId = selectedSubjectId !== 'all' ? selectedSubjectId : student.subjectIds[0];
    const targetClassroomId = selectedClassroomId !== 'all'
      ? selectedClassroomId
      : student.classroomIds[0];

    if (!targetSubjectId) {
      showAlert('Asignar repaso', 'Selecciona primero un curso o una clase para asignar una actividad de refuerzo.');
      return;
    }

    router.push({
      pathname: '/(teacher)/subject/add-question',
      params: {
        subjectId: String(targetSubjectId),
        ...(targetClassroomId ? { classroomId: String(targetClassroomId) } : {}),
      },
    } as any);
  };

  const handleSendReminder = () => {
    if (pendingStudents.length === 0) {
      showAlert('Sin pendientes', 'No hay estudiantes pendientes de empezar con los filtros actuales.');
      return;
    }

    showAlert(
      'Recordatorio preparado',
      `Hay ${pendingStudents.length} estudiante${pendingStudents.length === 1 ? '' : 's'} sin actividad. Puedes exportar la lista y enviarles sus credenciales o un recordatorio.`
    );
  };

  const handleViewHistory = (student: StudentRow) => {
    showAlert(
      'Historial del estudiante',
      `Últimos intentos cargados: ${student.recentAttempts.length}. Puedes conectar esta acción con una pantalla de historial filtrada por ${student.alias}.`
    );
  };

  const openStudentActions = (student: StudentRow) => {
    setActionStudent(student);
  };

  const handleExportStudentsCsv = async () => {
    if (visibleStudents.length === 0) {
      showAlert('Sin datos', 'No hay estudiantes visibles para exportar.');
      return;
    }

    const selectedSubjectName = selectedSubjectId === 'all'
      ? 'Todos los cursos'
      : subjects.find((subject) => subject.id === selectedSubjectId)?.name || `Curso ${selectedSubjectId}`;
    const selectedClassroomName = selectedClassroomId === 'all'
      ? 'Todas las clases'
      : classrooms.find((classroom) => classroom.id === selectedClassroomId)?.name || `Clase ${selectedClassroomId}`;

    const exportedAt = new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date());

    const escapeCsv = (value: string | number | null | undefined) => {
      const text = String(value ?? '');
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const headers = [
      'ID', 'Alias', 'Usuario', 'XP_Cursos', 'XP_Global',
      'Precision_Porcentaje', 'Participacion_Porcentaje', 'Preguntas_Completadas', 'Nota_Media',
      'Estado', 'Tiene_Actividad', 'Ultima_Actividad', 'Cursos_IDs', 'Cursos', 'Clases_IDs', 'Clases',
      'Filtro_Curso', 'Filtro_Clase', 'Filtro_Estado', 'Exportado_El',
    ];

    const rows = visibleStudents.map((student) => [
      student.id,
      student.alias,
      student.handle,
      student.subjectScore,
      student.globalPoints,
      student.accuracyPercent,
      student.progress,
      student.challenges,
      student.averageScore.toFixed(1),
      getStatusMeta(student.status).label,
      student.hasActivity ? 'Sí' : 'No',
      student.lastActivityAt ? formatDate(student.lastActivityAt) : 'Sin actividad',
      student.subjectIds.join('|'),
      student.subjectNames.join(' | '),
      student.classroomIds.join('|'),
      student.classroomNames.join(' | '),
      selectedSubjectName,
      selectedClassroomName,
      statusFilterOptions.find((option) => option.value === selectedStatus)?.label || 'Todos',
      exportedAt,
    ]);

    const csvBody = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
      .join('\n');

    const csvText = `\uFEFF${csvBody}`;

    const date = new Date().toISOString().slice(0, 10);
    const filterSlug = `${selectedSubjectName}-${selectedClassroomName}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'estudiantes';
    const filename = `omniquest_estudiantes_${filterSlug}_${date}.csv`;

    if (Platform.OS === 'web') {
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else {
      showAlert('Exportación disponible en web', 'La descarga CSV está disponible desde la versión web.');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando estudiantes...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar
            activeSection="students"
            subjectsCount={subjects.length}
            onSignOut={() => supabase.auth.signOut()}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 24 : 18,
            paddingBottom: 32,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[260px] flex-1">
              {!isDesktop ? (
                <BrandLogo size={30} style={{ marginBottom: 12 }} />
              ) : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="people" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Estudiantes</Text>
              </View>
              <Text className="mt-2 text-[13px] text-[#B7C4D7]">
                Gestiona tus alumnos por curso, clase, actividad y necesidades de refuerzo.
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

          <View className="mb-4 flex-row flex-wrap items-center gap-3 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
            <CycleSelectButton
              label="Curso"
              value={selectedSubjectId}
              allLabel="Todos"
              options={subjects.map((subject) => ({ id: subject.id, label: subject.name }))}
              onChange={(value) => {
                setSelectedSubjectId(value);
                setSelectedClassroomId('all');
              }}
            />
            <CycleSelectButton
              label="Clase"
              value={selectedClassroomId}
              allLabel="Todas"
              options={classroomOptions.map((classroom) => ({ id: classroom.id, label: classroom.name }))}
              onChange={setSelectedClassroomId}
            />
            <CycleStringSelectButton
              label="Estado"
              value={selectedStatus}
              options={statusFilterOptions}
              onChange={setSelectedStatus}
            />
            <CycleStringSelectButton
              label="Ordenar"
              value={selectedSort}
              options={sortOptions}
              onChange={setSelectedSort}
            />
            <View className="h-12 min-w-[230px] flex-1 flex-row items-center rounded-xl border border-[#20375E] bg-[#07162E] px-4">
              <TextInput
                className="min-w-0 flex-1 text-white"
                placeholder="Buscar estudiante, curso o clase..."
                placeholderTextColor="#8FA7C7"
                value={search}
                onChangeText={setSearch}
              />
              <Ionicons name="search-outline" size={20} color="#AFC2DB" />
            </View>
            <Pressable
              onPress={handleExportStudentsCsv}
              disabled={visibleStudents.length === 0}
              className="h-12 flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#07162E] px-4"
              style={({ pressed }) => ({
                opacity: visibleStudents.length === 0 ? 0.55 : pressed ? 0.86 : 1,
              })}
            >
              <Ionicons name="download-outline" size={16} color="#AFC2DB" />
              <Text className="font-semibold text-[#DDE7F4]">Exportar</Text>
            </Pressable>
          </View>

          <View className={isWide ? 'flex-row flex-wrap gap-4' : 'gap-4'}>
            <MetricCard icon="people" title="Total estudiantes" value={String(stats.total)} detail="Según filtros actuales" color="#8B5CF6" />
            <MetricCard icon="checkmark-circle" title="Con actividad" value={String(stats.withActivity)} detail={`${stats.active} activos o excelentes`} color="#34D399" />
            <MetricCard icon="time-outline" title="Sin actividad" value={String(stats.noActivity)} detail="Importados sin empezar" color="#8FA7C7" />
            <MetricCard icon="medkit" title="Necesitan apoyo" value={String(stats.needsHelp)} detail="Con baja precisión o nota" color="#F59E0B" />
            <MetricCard icon="analytics" title="Precisión media" value={formatNullablePercent(stats.averageAccuracy)} detail={stats.averageAccuracy === null ? 'Sin datos todavía' : 'Solo alumnos con intentos'} color="#3B82F6" />
            <MetricCard icon="school" title="Nota media" value={formatNullableGrade(stats.averageGrade)} detail={stats.averageGrade === null ? 'Sin datos todavía' : 'Solo alumnos con intentos'} color="#F6A64A" />
          </View>

          {pendingStudents.length > 0 ? (
            <PendingFirstAccessCard
              count={pendingStudents.length}
              onSendReminder={handleSendReminder}
              onExport={handleExportStudentsCsv}
            />
          ) : null}

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <View className={isDesktop ? 'flex-[1.65]' : ''}>
              <View className="mb-4 flex-row flex-wrap items-center justify-between gap-3">
                <View>
                  <Text className="text-[18px] font-black text-white">Listado de estudiantes</Text>
                  <Text className="mt-1 text-[12px] text-[#8FA7C7]">
                    Mostrando {visibleStudents.length} de {students.length} estudiantes.
                  </Text>
                </View>
              </View>

              <View className={isWide ? 'flex-row flex-wrap gap-4' : 'gap-4'}>
                {visibleStudents.map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    isWide={isWide}
                    onViewDetails={handleViewStudentDetails}
                    onAssignActivity={handleAssignActivity}
                    onOpenActions={openStudentActions}
                  />
                ))}

                {visibleStudents.length === 0 ? (
                  <View className="w-full items-center justify-center rounded-2xl border border-[#1A3155] bg-[#09162C] p-8">
                    <Ionicons name="people-outline" size={48} color="#60799C" />
                    <Text className="mt-3 font-bold text-white">No hay estudiantes para mostrar</Text>
                    <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">
                      Cambia el filtro, busca otro nombre o comparte el código de una clase.
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View className={isDesktop ? 'flex-1 gap-4' : 'gap-4'}>
              <Panel title="Resumen de progreso">
                <View className="flex-row items-center gap-5">
                  <View className="h-28 w-28 items-center justify-center rounded-full border-[8px] border-[#8B5CF6] bg-[#07162E]">
                    <Text className="text-[24px] font-black text-white">{formatNullablePercent(stats.averageAccuracy)}</Text>
                    <Text className="text-center text-[9px] text-[#B7C4D7]">Precisión media</Text>
                  </View>
                  <View className="min-w-0 flex-1" style={{ gap: 9 }}>
                    <LegendRow color="#8FA7C7" label="Sin actividad" value={visibleStudents.filter((s) => s.status === 'no_activity').length} total={Math.max(stats.total, 1)} />
                    <LegendRow color="#F59E0B" label="Necesita apoyo" value={visibleStudents.filter((s) => s.status === 'needs_help').length} total={Math.max(stats.total, 1)} />
                    <LegendRow color="#94A3B8" label="Inactivo" value={visibleStudents.filter((s) => s.status === 'inactive').length} total={Math.max(stats.total, 1)} />
                    <LegendRow color="#58E28B" label="Activo" value={visibleStudents.filter((s) => s.status === 'active').length} total={Math.max(stats.total, 1)} />
                    <LegendRow color="#38BDF8" label="Excelente" value={visibleStudents.filter((s) => s.status === 'excellent').length} total={Math.max(stats.total, 1)} />
                  </View>
                </View>
              </Panel>

              <Panel title="Actividad registrada" action="Solo con intentos">
                <ProgressStat label="Estudiantes con actividad" value={stats.withActivity} total={Math.max(stats.total, 1)} color="#8B5CF6" />
                <ProgressStat label="Preguntas respondidas" value={stats.completedChallenges} total={Math.max(stats.completedChallenges + 6, 1)} color="#7C5CFF" />
                <ProgressStat label="XP medio" value={stats.averageXp ?? 0} total={Math.max((stats.averageXp ?? 0) + 650, 1)} color="#3B82F6" />
              </Panel>

              <Panel title="Estudiantes que necesitan atención" action="Ver detalle">
                <View style={{ gap: 12 }}>
                  {needsAttention.map((student) => (
                    <AttentionRow key={student.id} student={student} onPress={handleViewStudentDetails} />
                  ))}
                  {needsAttention.length === 0 ? (
                    <Text className="text-[13px] text-[#B7C4D7]">No hay estudiantes en riesgo ahora mismo.</Text>
                  ) : null}
                </View>
              </Panel>
            </View>
          </View>
        </ScrollView>
      </View>
      <StudentActionsModal
        student={actionStudent}
        visible={Boolean(actionStudent)}
        onClose={() => setActionStudent(null)}
        onViewDetails={handleViewStudentDetails}
        onRemoveFromClass={requestRemoveFromClass}
        onResetProgress={requestResetProgress}
        onAssignActivity={(student) => {
          setActionStudent(null);
          handleAssignActivity(student);
        }}
      />
      <StudentDetailModal
        student={detailStudent}
        visible={Boolean(detailStudent)}
        onClose={() => setDetailStudent(null)}
        onAssignActivity={(student) => {
          setDetailStudent(null);
          handleAssignActivity(student);
        }}
        onViewHistory={handleViewHistory}
        onRemoveFromClass={requestRemoveFromClass}
      />
      <ConfirmModal
        dialog={confirmDialog}
        visible={Boolean(confirmDialog)}
        onClose={() => setConfirmDialog(null)}
      />
    </View>
  );
}

function StudentActionsModal({
  student,
  visible,
  onClose,
  onViewDetails,
  onRemoveFromClass,
  onResetProgress,
  onAssignActivity,
}: {
  student: StudentRow | null
  visible: boolean
  onClose: () => void
  onViewDetails: (student: StudentRow) => void
  onRemoveFromClass: (student: StudentRow) => void
  onResetProgress: (student: StudentRow) => void
  onAssignActivity: (student: StudentRow) => void
}) {
  if (!student) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end p-4 md:items-center md:justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.62)' }}>
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[420px] rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
          <View className="flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] font-semibold text-[#9FD6FF]">Acciones del estudiante</Text>
              <Text className="mt-1 text-[24px] font-black text-white" numberOfLines={1}>{student.alias}</Text>
              <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={1}>{student.handle}</Text>
            </View>
            <Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-xl border border-[#20375E] bg-[#111E3C]">
              <Ionicons name="close" size={18} color="#DDE7F4" />
            </Pressable>
          </View>

          <View className="mt-5 gap-3">
            <ModalActionButton
              icon="document-text-outline"
              title="Ver detalle"
              detail="Resumen, cursos, áreas a reforzar y últimos intentos"
              onPress={() => onViewDetails(student)}
            />
            <ModalActionButton
              icon="add-circle-outline"
              title="Asignar repaso"
              detail="Crear una pregunta o actividad de refuerzo"
              onPress={() => onAssignActivity(student)}
            />
            <ModalActionButton
              icon="refresh-outline"
              title="Reiniciar progreso"
              detail="Borra puntuaciones, temas e historial de intentos"
              destructive
              onPress={() => onResetProgress(student)}
            />
            <ModalActionButton
              icon="person-remove-outline"
              title="Quitar de clase"
              detail="Elimina la inscripción y su progreso asociado"
              destructive
              onPress={() => onRemoveFromClass(student)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StudentDetailModal({
  student,
  visible,
  onClose,
  onAssignActivity,
  onViewHistory,
  onRemoveFromClass,
}: {
  student: StudentRow | null
  visible: boolean
  onClose: () => void
  onAssignActivity: (student: StudentRow) => void
  onViewHistory: (student: StudentRow) => void
  onRemoveFromClass: (student: StudentRow) => void
}) {
  if (!student) return null;

  const status = getStatusMeta(student.status);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end p-4 md:items-center md:justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.62)' }}>
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="max-h-[92%] w-full max-w-[620px] rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
          <View className="flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] font-semibold text-[#9FD6FF]">Detalle del estudiante</Text>
              <Text className="mt-1 text-[24px] font-black text-white" numberOfLines={1}>{student.alias}</Text>
              <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={1}>{student.handle}</Text>
            </View>
            <Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-xl border border-[#20375E] bg-[#111E3C]">
              <Ionicons name="close" size={18} color="#DDE7F4" />
            </Pressable>
          </View>

          <ScrollView className="mt-5" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              <View className="flex-row flex-wrap gap-3">
                <DetailMetric label="Precisión" value={student.hasActivity ? `${student.accuracyPercent}%` : 'Sin datos'} color="#38BDF8" />
                <DetailMetric label="Preguntas" value={student.challenges.toLocaleString()} color="#8B5CF6" />
                <DetailMetric label="XP" value={student.subjectScore.toLocaleString()} color="#FBBF24" />
                <DetailMetric label="Nota media" value={student.hasActivity ? `${student.averageScore.toFixed(1)} /10` : 'Sin datos'} color="#F6A64A" />
              </View>

              <View className="rounded-xl border border-[#20375E] bg-[#07162E] p-4">
                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[12px] font-bold text-[#8FA7C7]">Estado</Text>
                    <View className="mt-2 flex-row items-center gap-2">
                      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                      <Text className="font-black" style={{ color: status.color }}>{status.label}</Text>
                    </View>
                    <Text className="mt-2 text-[12px] leading-5 text-[#B7C4D7]">{status.description}</Text>
                  </View>
                  <View className="rounded-xl border border-[#20375E] bg-[#0D1D3B] px-4 py-3">
                    <Text className="text-[11px] text-[#8FA7C7]">Última actividad</Text>
                    <Text className="mt-1 text-[13px] font-black text-white">{formatRelativeDate(student.lastActivityAt)}</Text>
                  </View>
                </View>
              </View>

              <DetailSection title="Cursos y clases">
                <View className="gap-2">
                  {student.courseContexts.map((context) => (
                    <View key={`${context.subjectId}:${context.classroomId ?? 'general'}`} className="rounded-xl border border-[#20375E] bg-[#071A32] p-3">
                      <Text className="text-[13px] font-black text-white">{context.subjectName}</Text>
                      <Text className="mt-1 text-[12px] text-[#AFC2DB]">Clase: {context.classroomName}</Text>
                      <Text className="mt-1 text-[11px] text-[#8FA7C7]">Inscrito: {formatDate(context.joinedAt)}</Text>
                    </View>
                  ))}
                  {student.courseContexts.length === 0 ? (
                    <Text className="text-[13px] text-[#8FA7C7]">No hay cursos asociados.</Text>
                  ) : null}
                </View>
              </DetailSection>

              <DetailSection title="Áreas a reforzar">
                <View className="gap-2">
                  {student.weakAreas.map((area) => (
                    <View key={`${area.title}:${area.detail}`} className="rounded-xl border border-[#4A2B1A] bg-[#21140A] p-3">
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="min-w-0 flex-1">
                          <Text className="text-[13px] font-black text-white" numberOfLines={2}>{area.title}</Text>
                          <Text className="mt-1 text-[12px] text-[#FBBF24]">{area.detail}</Text>
                        </View>
                        <Text className="text-[12px] font-black text-[#F59E0B]">
                          {area.mistakes} error{area.mistakes === 1 ? '' : 'es'}
                        </Text>
                      </View>
                      <Text className="mt-2 text-[11px] text-[#F8D7A1]">
                        {area.accuracyPercent === null ? 'Acierto pendiente de calcular' : `${area.accuracyPercent}% de acierto`}
                      </Text>
                    </View>
                  ))}
                  {student.weakAreas.length === 0 ? (
                    <Text className="text-[13px] text-[#8FA7C7]">
                      {student.hasActivity ? 'No hay áreas críticas detectadas.' : 'Aparecerán cuando el alumno responda preguntas.'}
                    </Text>
                  ) : null}
                </View>
              </DetailSection>

              <DetailSection title="Últimos intentos">
                <View className="gap-2">
                  {student.recentAttempts.slice(0, 5).map((attempt) => (
                    <View key={attempt.id} className="rounded-xl border border-[#20375E] bg-[#071A32] p-3">
                      <View className="flex-row items-start gap-3">
                        <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: attempt.isCorrect ? '#22C55E24' : '#EF444424' }}>
                          <Ionicons name={attempt.isCorrect ? 'checkmark' : 'close'} size={17} color={attempt.isCorrect ? '#22C55E' : '#FB7185'} />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="text-[13px] font-bold text-white" numberOfLines={2}>{attempt.questionText}</Text>
                          <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={1}>
                            {attempt.subjectName} · {attempt.topicTitle} · {formatDate(attempt.attemptedAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {student.recentAttempts.length === 0 ? (
                    <Text className="text-[13px] text-[#8FA7C7]">Todavía no hay intentos registrados.</Text>
                  ) : null}
                </View>
              </DetailSection>

              <View className="flex-row flex-wrap gap-3 pt-1">
                <DetailActionButton icon="add-circle-outline" label="Asignar repaso" onPress={() => onAssignActivity(student)} />
                <DetailActionButton icon="time-outline" label="Ver historial" onPress={() => onViewHistory(student)} />
                <DetailActionButton icon="person-remove-outline" label="Quitar de clase" destructive onPress={() => onRemoveFromClass(student)} />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmModal({
  dialog,
  visible,
  onClose,
}: {
  dialog: ConfirmDialog | null
  visible: boolean
  onClose: () => void
}) {
  if (!dialog) return null;

  const handleConfirm = () => {
    const confirm = dialog.onConfirm;
    onClose();
    confirm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end p-4 md:items-center md:justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.62)' }}>
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[420px] rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
          <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: dialog.destructive ? '#EF444433' : '#8B5CF633' }}>
            <Ionicons name={dialog.destructive ? 'warning-outline' : 'information-circle-outline'} size={24} color={dialog.destructive ? '#FF8A8A' : '#B9A7FF'} />
          </View>
          <Text className="mt-4 text-[24px] font-black text-white">{dialog.title}</Text>
          <Text className="mt-2 text-[14px] leading-6 text-[#B7C4D7]">{dialog.message}</Text>

          <View className="mt-6 flex-row gap-3">
            <Pressable onPress={onClose} className="flex-1 items-center justify-center rounded-xl border border-[#20375E] bg-[#111E3C] px-4 py-3">
              <Text className="font-bold text-[#DDE7F4]">Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              className="flex-1 items-center justify-center rounded-xl px-4 py-3"
              style={{ backgroundColor: dialog.destructive ? '#DC2626' : '#5A46D8' }}
            >
              <Text className="font-black text-white">{dialog.confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ModalActionButton({
  icon,
  title,
  detail,
  destructive = false,
  onPress,
}: {
  icon: IconName
  title: string
  detail: string
  destructive?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-[#20375E] bg-[#07162E] px-4 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: destructive ? '#EF444433' : '#8B5CF633' }}>
        <Ionicons name={icon} size={19} color={destructive ? '#FF8A8A' : '#B9A7FF'} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className={`font-black ${destructive ? 'text-[#FFB4B4]' : 'text-white'}`}>{title}</Text>
        <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={2}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8FA7C7" />
    </Pressable>
  );
}

function MetricCard({
  icon,
  title,
  value,
  detail,
  color,
}: {
  icon: IconName
  title: string
  value: string
  detail?: string
  color: string
}) {
  return (
    <View className="min-w-[175px] flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="flex-row items-center gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${color}30` }}>
          <Ionicons name={icon} size={27} color={color} />
        </View>

        <View className="min-w-0 flex-1">
          <Text className="text-[12px] text-[#B7C4D7]">{title}</Text>
          <Text className="mt-1 text-[24px] font-black text-white" numberOfLines={1}>{value}</Text>
          {detail ? (
            <View className="mt-2 flex-row items-center gap-1">
              <Ionicons name="information-circle-outline" size={13} color="#8FA7C7" />
              <Text className="flex-1 text-[12px] font-semibold text-[#8FA7C7]">
                {detail}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function PendingFirstAccessCard({
  count,
  onSendReminder,
  onExport,
}: {
  count: number
  onSendReminder: () => void
  onExport: () => void
}) {
  return (
    <View className="mt-5 rounded-2xl border border-[#263E61] bg-[#0B1930] p-5">
      <View className="flex-row flex-wrap items-center justify-between gap-4">
        <View className="min-w-[250px] flex-1 flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#13284A]">
            <Ionicons name="mail-unread-outline" size={25} color="#9FD6FF" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[18px] font-black text-white">Pendientes de primer acceso</Text>
            <Text className="mt-1 text-[13px] leading-5 text-[#B7C4D7]">
              {count} alumno{count === 1 ? '' : 's'} importado{count === 1 ? '' : 's'} todavía no han iniciado actividad.
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Pressable onPress={onSendReminder} className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-4 py-3">
            <Ionicons name="send-outline" size={16} color="#FFFFFF" />
            <Text className="text-[12px] font-black text-white">Enviar recordatorio</Text>
          </Pressable>
          <Pressable onPress={onExport} className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#07162E] px-4 py-3">
            <Ionicons name="download-outline" size={16} color="#DDE7F4" />
            <Text className="text-[12px] font-black text-[#DDE7F4]">Exportar credenciales</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CycleSelectButton({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string
  value: number | 'all'
  allLabel: string
  options: { id: number; label: string }[]
  onChange: (value: number | 'all') => void
}) {
  const selectedIndex = value === 'all' ? -1 : options.findIndex((option) => option.id === value);
  const nextValue = selectedIndex >= options.length - 1 ? 'all' : options[selectedIndex + 1]?.id ?? 'all';
  const selectedLabel = value === 'all' ? allLabel : options.find((option) => option.id === value)?.label || allLabel;

  return (
    <Pressable
      onPress={() => onChange(nextValue)}
      className="h-12 min-w-[165px] flex-row items-center justify-between gap-3 rounded-xl border border-[#20375E] bg-[#07162E] px-4"
    >
      <View className="min-w-0 flex-1">
        <Text className="text-[10px] font-black uppercase tracking-[0.8px] text-[#8FA7C7]">{label}</Text>
        <Text className="text-[12px] font-bold text-[#DDE7F4]" numberOfLines={1}>{selectedLabel}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color="#AFC2DB" />
    </Pressable>
  );
}

function CycleStringSelectButton<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  const nextOption = options[selectedIndex >= options.length - 1 ? 0 : selectedIndex + 1] || options[0];
  const selectedLabel = options.find((option) => option.value === value)?.label || options[0]?.label || '';

  return (
    <Pressable
      onPress={() => onChange(nextOption.value)}
      className="h-12 min-w-[165px] flex-row items-center justify-between gap-3 rounded-xl border border-[#20375E] bg-[#07162E] px-4"
    >
      <View className="min-w-0 flex-1">
        <Text className="text-[10px] font-black uppercase tracking-[0.8px] text-[#8FA7C7]">{label}</Text>
        <Text className="text-[12px] font-bold text-[#DDE7F4]" numberOfLines={1}>{selectedLabel}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color="#AFC2DB" />
    </Pressable>
  );
}

function StudentCard({
  student,
  isWide,
  onViewDetails,
  onAssignActivity,
  onOpenActions,
}: {
  student: StudentRow
  isWide: boolean
  onViewDetails: (student: StudentRow) => void
  onAssignActivity: (student: StudentRow) => void
  onOpenActions: (student: StudentRow) => void
}) {
  const status = getStatusMeta(student.status);
  const mainContext = student.courseContexts[0];

  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5" style={{ width: isWide ? '48.5%' : '100%' }}>
      <View className="flex-row items-start gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-[#17315E]">
          <Text className="text-[15px] font-black text-white">{getInitials(student.alias)}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="min-w-0 flex-1 text-[17px] font-black text-white" numberOfLines={1}>{student.alias}</Text>
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${status.color}24` }}>
              <Text className="text-[11px] font-black" style={{ color: status.color }}>{status.label}</Text>
            </View>
          </View>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={1}>{student.handle}</Text>
          <Text className="mt-2 text-[12px] text-[#AFC2DB]" numberOfLines={2}>
            {mainContext ? `${mainContext.subjectName} · ${mainContext.classroomName}` : 'Sin curso asignado'}
          </Text>
          {!student.hasActivity ? (
            <Text className="mt-1 text-[11px] font-semibold text-[#9FD6FF]">Importado recientemente · pendiente de empezar</Text>
          ) : null}
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-3">
        <StudentMiniStat label="Precisión" value={student.hasActivity ? `${student.accuracyPercent}%` : '—'} color="#38BDF8" />
        <StudentMiniStat label="Preguntas" value={student.challenges.toLocaleString()} color="#8B5CF6" />
        <StudentMiniStat label="Nota" value={student.hasActivity ? student.averageScore.toFixed(1) : '—'} color="#F6A64A" />
        <StudentMiniStat label="XP" value={student.subjectScore.toLocaleString()} color="#FBBF24" />
      </View>

      <View className="mt-4 rounded-xl border border-[#20375E] bg-[#07162E] p-3">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-[12px] font-bold text-white">Participación</Text>
          <Text className="text-[12px] font-black text-[#DDE7F4]">{student.progress}%</Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full" style={{ width: `${student.progress}%`, backgroundColor: status.color }} />
        </View>
        <Text className="mt-2 text-[11px] text-[#8FA7C7]">Última actividad: {formatRelativeDate(student.lastActivityAt)}</Text>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Pressable onPress={() => onViewDetails(student)} className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-4 py-3">
          <Ionicons name="document-text-outline" size={15} color="#FFFFFF" />
          <Text className="text-[12px] font-black text-white">Ver detalle</Text>
        </Pressable>
        <Pressable onPress={() => onAssignActivity(student)} className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#07162E] px-4 py-3">
          <Ionicons name="add-circle-outline" size={15} color="#DDE7F4" />
          <Text className="text-[12px] font-black text-[#DDE7F4]">Asignar repaso</Text>
        </Pressable>
        <Pressable onPress={() => onOpenActions(student)} className="h-11 w-11 items-center justify-center rounded-xl border border-[#20375E] bg-[#07162E]">
          <Ionicons name="ellipsis-horizontal" size={17} color="#AFC2DB" />
        </Pressable>
      </View>
    </View>
  );
}

function StudentMiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="min-w-[86px] flex-1 rounded-xl border border-[#20375E] bg-[#07162E] p-3">
      <Text className="text-[11px] text-[#8FA7C7]">{label}</Text>
      <Text className="mt-1 text-[15px] font-black" style={{ color }}>{value}</Text>
    </View>
  );
}

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-black text-white">{title}</Text>
        {action ? <Text className="text-[12px] font-semibold text-[#B9A7FF]">{action}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function LegendRow({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <View className="flex-row items-center gap-2">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="min-w-0 flex-1 text-[12px] text-[#DDE7F4]">{label}</Text>
      <Text className="text-[12px] text-white">{value} ({percent}%)</Text>
    </View>
  );
}

function ProgressStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = Math.min(100, Math.round((value / total) * 100));

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[12px] font-semibold text-white">{label}</Text>
        <Text className="text-[12px] text-[#DDE7F4]">{value.toLocaleString()}</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
        <View className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function AttentionRow({ student, onPress }: { student: StudentRow; onPress: (student: StudentRow) => void }) {
  const status = getStatusMeta(student.status);
  const reason = student.status === 'needs_help'
    ? 'Baja precisión o nota media'
    : student.status === 'inactive'
      ? 'Baja participación'
      : 'Revisar evolución';

  return (
    <Pressable onPress={() => onPress(student)} className="flex-row items-center gap-3" style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#17315E]">
        <Text className="text-[12px] font-black text-white">{getInitials(student.alias)}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-bold text-white" numberOfLines={1}>{student.alias}</Text>
        <Text className="text-[11px] text-[#B7C4D7]">{reason}</Text>
      </View>
      <View className="rounded-md border px-2 py-1" style={{ borderColor: status.color }}>
        <Text className="text-[11px] font-black" style={{ color: status.color }}>{student.hasActivity ? `${student.accuracyPercent}%` : '—'}</Text>
      </View>
    </Pressable>
  );
}

function DetailMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="min-w-[125px] flex-1 rounded-xl border border-[#20375E] bg-[#07162E] p-3">
      <Text className="text-[11px] text-[#8FA7C7]">{label}</Text>
      <Text className="mt-1 text-[17px] font-black" style={{ color }}>{value}</Text>
    </View>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="rounded-xl border border-[#20375E] bg-[#0A1830] p-4">
      <Text className="mb-3 font-black text-white">{title}</Text>
      {children}
    </View>
  );
}

function DetailActionButton({
  icon,
  label,
  destructive = false,
  onPress,
}: {
  icon: IconName
  label: string
  destructive?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-xl px-4 py-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
        backgroundColor: destructive ? '#7F1D1D66' : '#5A46D8',
        borderWidth: destructive ? 1 : 0,
        borderColor: destructive ? '#BE123C' : 'transparent',
      })}
    >
      <Ionicons name={icon} size={15} color="#FFFFFF" />
      <Text className="text-[12px] font-black text-white">{label}</Text>
    </Pressable>
  );
}

function getStatusMeta(status: StudentStatus) {
  if (status === 'excellent') {
    return {
      label: 'Excelente',
      color: '#38BDF8',
      description: 'Alto rendimiento y buena precisión. Puede avanzar o recibir retos extra.',
    };
  }
  if (status === 'active') {
    return {
      label: 'Activo',
      color: '#58E28B',
      description: 'Tiene actividad reciente y un rendimiento estable.',
    };
  }
  if (status === 'needs_help') {
    return {
      label: 'Necesita apoyo',
      color: '#F59E0B',
      description: 'Tiene actividad, pero su precisión o nota media indican que conviene reforzar.',
    };
  }
  if (status === 'no_activity') {
    return {
      label: 'Sin actividad',
      color: '#8FA7C7',
      description: 'Está inscrito o importado, pero todavía no ha respondido preguntas.',
    };
  }
  return {
    label: 'Inactivo',
    color: '#94A3B8',
    description: 'Tiene algo de actividad, pero su participación es baja.',
  };
}

function getStudentStatus({
  hasActivity,
  averageScore,
  accuracyPercent,
  progress,
}: {
  hasActivity: boolean
  averageScore: number
  accuracyPercent: number
  progress: number
}): StudentStatus {
  if (!hasActivity) return 'no_activity';
  if (averageScore >= 8.5 && accuracyPercent >= 85) return 'excellent';
  if (averageScore < 5 || accuracyPercent < 40) return 'needs_help';
  if (progress < 35) return 'inactive';
  return 'active';
}

function compareStudents(a: StudentRow, b: StudentRow, sort: StudentSortKey) {
  if (sort === 'name') return a.alias.localeCompare(b.alias);
  if (sort === 'accuracy') return b.accuracyPercent - a.accuracyPercent || a.alias.localeCompare(b.alias);
  if (sort === 'xp') return b.subjectScore - a.subjectScore || b.globalPoints - a.globalPoints;
  if (sort === 'last_activity') return getTimeValue(b.lastActivityAt) - getTimeValue(a.lastActivityAt);

  const priority: Record<StudentStatus, number> = {
    needs_help: 5,
    inactive: 4,
    no_activity: 3,
    active: 2,
    excellent: 1,
  };

  return priority[b.status] - priority[a.status]
    || a.accuracyPercent - b.accuracyPercent
    || getTimeValue(a.lastActivityAt) - getTimeValue(b.lastActivityAt)
    || a.alias.localeCompare(b.alias);
}

function buildCourseContexts(
  enrollments: Enrollment[],
  subjectMap: Map<number, string>,
  classroomMap: Map<number, Classroom>
): StudentCourseContext[] {
  const seen = new Set<string>();

  return enrollments.reduce<StudentCourseContext[]>((items, enrollment) => {
    const key = `${enrollment.subject_id}:${enrollment.classroom_id ?? 'general'}`;
    if (seen.has(key)) return items;
    seen.add(key);

    const classroom = typeof enrollment.classroom_id === 'number' ? classroomMap.get(enrollment.classroom_id) : null;
    items.push({
      subjectId: enrollment.subject_id,
      subjectName: subjectMap.get(enrollment.subject_id) || 'Curso',
      classroomId: enrollment.classroom_id ?? null,
      classroomName: classroom?.name || 'Clase principal',
      joinedAt: enrollment.joined_at || null,
    });
    return items;
  }, []);
}

function buildRecentAttempts(attempts: AttemptHistoryRow[], subjectMap: Map<number, string>): StudentRecentAttempt[] {
  return attempts
    .slice()
    .sort((a, b) => getTimeValue(b.attempted_at || b.created_at || null) - getTimeValue(a.attempted_at || a.created_at || null))
    .slice(0, 8)
    .map((attempt) => {
      const question = attempt.questions;
      return {
        id: attempt.id,
        questionText: question?.text || 'Pregunta sin texto',
        topicTitle: question?.subject_topics?.title || 'Práctica general',
        subjectName: typeof question?.subject_id === 'number' ? subjectMap.get(question.subject_id) || 'Curso' : 'Curso',
        isCorrect: attempt.is_correct,
        attemptedAt: attempt.attempted_at || attempt.created_at || null,
        earnedPoints: attempt.earned_points ?? 0,
      };
    });
}

function buildWeakAreas(
  scores: SubjectScore[],
  attempts: AttemptHistoryRow[],
  subjectMap: Map<number, string>,
  questionsCountBySubject: Map<number, number>
): StudentWeakArea[] {
  const mistakesByTopic = new Map<string, { title: string; detail: string; mistakes: number }>();

  attempts.forEach((attempt) => {
    if (attempt.is_correct) return;
    const question = attempt.questions;
    const subjectName = typeof question?.subject_id === 'number' ? subjectMap.get(question.subject_id) || 'Curso' : 'Curso';
    const topicTitle = question?.subject_topics?.title || 'Práctica general';
    const key = `${subjectName}:${topicTitle}`;
    const previous = mistakesByTopic.get(key) || { title: topicTitle, detail: subjectName, mistakes: 0 };
    mistakesByTopic.set(key, { ...previous, mistakes: previous.mistakes + 1 });
  });

  const areasFromAttempts: StudentWeakArea[] = Array.from(mistakesByTopic.values())
    .sort((a, b) => b.mistakes - a.mistakes)
    .slice(0, 4)
    .map((area): StudentWeakArea => ({
      ...area,
      accuracyPercent: null,
    }));

  if (areasFromAttempts.length > 0) return areasFromAttempts;

  const areasFromScores = scores
    .map<StudentWeakArea | null>((score) => {
      const questionsCount = questionsCountBySubject.get(score.subject_id) || 0;
      const playedSessions = getPlayedSessions(score, questionsCount);
      const totalAnswers = questionsCount > 0 ? playedSessions * questionsCount : 0;
      if (totalAnswers <= 0 || typeof score.correct_answers !== 'number') return null;

      const correctAnswers = Math.min(Math.max(0, score.correct_answers), totalAnswers);
      const accuracyPercent = answersToAccuracyPercent(correctAnswers, totalAnswers);
      const mistakes = Math.max(0, totalAnswers - correctAnswers);

      if (mistakes <= 0 || accuracyPercent >= 65) return null;

      return {
        title: subjectMap.get(score.subject_id) || 'Curso',
        detail: 'Curso con errores acumulados',
        mistakes,
        accuracyPercent,
      };
    })
    .filter((area): area is StudentWeakArea => area !== null)
    .sort((a, b) => b.mistakes - a.mistakes)
    .slice(0, 4);

  return areasFromScores;
}

function getAnswerTotals(scores: SubjectScore[], questionsCountBySubject: Map<number, number>) {
  return scores.reduce(
    (totals, score) => {
      if (typeof score.correct_answers !== 'number') {
        return totals;
      }

      const questionsCount = questionsCountBySubject.get(score.subject_id) || 0;
      const playedSessions = getPlayedSessions(score, questionsCount);
      const totalAnswers = questionsCount > 0 ? playedSessions * questionsCount : 0;

      if (totalAnswers <= 0) {
        return totals;
      }

      totals.correctAnswers += Math.min(Math.max(0, score.correct_answers), totalAnswers);
      totals.totalAnswers += totalAnswers;
      return totals;
    },
    { correctAnswers: 0, totalAnswers: 0 }
  );
}

function getFallbackScoreGrade(scores: SubjectScore[], questionsCountBySubject: Map<number, number>) {
  const grades = scores
    .filter((score) => typeof score.max_score === 'number' && (score.max_score ?? 0) > 0)
    .map((score) => {
      const questionsCount = questionsCountBySubject.get(score.subject_id) || 1;
      return scoreToGrade(score.max_score ?? 0, Math.max(160, questionsCount * 160));
    });

  if (grades.length === 0) {
    return 0;
  }

  return Number((grades.reduce((total, grade) => total + grade, 0) / grades.length).toFixed(1));
}

function getPlayedSessions(score: SubjectScore, questionsCount: number) {
  const playedDays = Array.isArray(score.played_days) ? score.played_days.filter(Boolean).length : 0;
  const sessionsFromCorrectAnswers = questionsCount > 0 && typeof score.correct_answers === 'number'
    ? Math.ceil(score.correct_answers / questionsCount)
    : 0;
  return Math.max(score.played_at ? 1 : 0, playedDays, sessionsFromCorrectAnswers);
}

function hasSubjectScoreActivity(score: SubjectScore) {
  return Boolean(score.played_at)
    || (score.max_score ?? 0) > 0
    || (score.correct_answers ?? 0) > 0
    || (Array.isArray(score.played_days) && score.played_days.length > 0);
}

function hasScoreForEnrollment(enrollment: Enrollment, scores: SubjectScore[]) {
  return scores.some((score) => {
    const sameSubject = score.subject_id === enrollment.subject_id;
    const sameClassroom = typeof enrollment.classroom_id === 'number'
      ? score.classroom_id === enrollment.classroom_id || score.classroom_id === null || typeof score.classroom_id === 'undefined'
      : true;
    return sameSubject && sameClassroom && hasSubjectScoreActivity(score);
  });
}

function getLastActivityDate(scores: SubjectScore[], attempts: AttemptHistoryRow[]) {
  const dates = [
    ...scores.map((score) => score.played_at || null),
    ...attempts.map((attempt) => attempt.attempted_at || attempt.created_at || null),
  ].filter((value): value is string => Boolean(value));

  if (dates.length === 0) return null;
  return dates.sort((a, b) => getTimeValue(b) - getTimeValue(a))[0];
}

function getFirstEnrollmentDate(enrollments: Enrollment[]) {
  const dates = enrollments.map((enrollment) => enrollment.joined_at || null).filter((value): value is string => Boolean(value));
  if (dates.length === 0) return null;
  return dates.sort((a, b) => getTimeValue(a) - getTimeValue(b))[0];
}

function getTimeValue(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatNullablePercent(value: number | null) {
  return value === null ? 'Sin datos' : `${value}%`;
}

function formatNullableGrade(value: number | null) {
  return value === null ? 'Sin datos' : `${value.toFixed(1)} /10`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin registro';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeDate(value: string | null | undefined) {
  if (!value) return 'Sin actividad';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin actividad';

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return formatDate(value);
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'AL';
}

async function deleteStudentProgressForSubjects(studentId: string, subjectIds: number[]) {
  if (subjectIds.length === 0) return;

  const questionsResult = await supabase
    .from('questions')
    .select('id')
    .in('subject_id', subjectIds);

  if (questionsResult.error) throw questionsResult.error;

  const questionIds = (questionsResult.data || [])
    .map((question: { id: number | null }) => question.id)
    .filter((id): id is number => typeof id === 'number');

  if (questionIds.length > 0) {
    const deleteAttempts = await supabase
      .from('attempt_history')
      .delete()
      .eq('student_id', studentId)
      .in('question_id', questionIds);

    if (deleteAttempts.error) throw deleteAttempts.error;
  }

  const deleteTopicScores = await supabase
    .from('topic_scores')
    .delete()
    .eq('student_id', studentId)
    .in('subject_id', subjectIds);

  if (deleteTopicScores.error) throw deleteTopicScores.error;

  const deleteSubjectScores = await supabase
    .from('subject_scores')
    .delete()
    .eq('student_id', studentId)
    .in('subject_id', subjectIds);

  if (deleteSubjectScores.error) throw deleteSubjectScores.error;
}

function groupBy<T extends Record<string, any>>(items: T[], key: keyof T) {
  const map = new Map<string, T[]>();

  items.forEach((item) => {
    const value = String(item[key]);
    const group = map.get(value) || [];
    group.push(item);
    map.set(value, group);
  });

  return map;
}
