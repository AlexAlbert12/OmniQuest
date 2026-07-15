import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout';
import { accuracyToGrade, answersToAccuracyPercent } from '../../lib/grades';
import TeacherSidebar from '../../components/teacher/TeacherSidebar';
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav';
import BrandLogo from '../../components/BrandLogo';
import NotificationBadge from '../../components/NotificationBadge';
import TeacherHeaderAvatar from '../../components/teacher/TeacherHeaderAvatar';
import {
  statusFilterOptions,
  sortOptions,
  type AttemptHistoryRow,
  type Classroom,
  type ConfirmDialog,
  type Enrollment,
  type QuestionSummary,
  type StudentProfile,
  type StudentRow,
  type StudentSortKey,
  type StudentStatusFilter,
  type Subject,
  type SubjectScore,
  type TeacherActionResult,
} from '../../components/teacher/students/types';
import MobileTeacherStudents from '../../components/teacher/students/MobileTeacherStudents';
import { StudentActionsModal, StudentDetailModal, ConfirmModal } from '../../components/teacher/students/StudentModals';
import {
  AttentionRow,
  CycleSelectButton,
  CycleStringSelectButton,
  LegendRow,
  MetricCard,
  Panel,
  PendingFirstAccessCard,
  ProgressStat,
  StudentCard,
} from '../../components/teacher/students/TeacherStudentList';
import {
  buildCourseContexts,
  buildRecentAttempts,
  buildWeakAreas,
  compareStudents,
  formatDate,
  formatNullableGrade,
  formatNullablePercent,
  getAnswerTotals,
  getFallbackScoreGrade,
  getFirstEnrollmentDate,
  getLastActivityDate,
  getStatusMeta,
  getStudentStatus,
  groupBy,
  hasScoreForEnrollment,
  hasSubjectScoreActivity,
  isMissingSchemaError,
} from '../../components/teacher/students/studentUtils';

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
  const [temporaryPasswordsByStudent, setTemporaryPasswordsByStudent] = useState<Record<string, string>>({});
  const [reminderStudentIds, setReminderStudentIds] = useState<Record<string, boolean>>({});
  const [sendingBulkReminders, setSendingBulkReminders] = useState(false);

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

  const invokeTeacherAction = async <T extends TeacherActionResult>(
    functionName: string,
    body: Record<string, unknown>
  ): Promise<T> => {
    const { data, error } = await supabase.functions.invoke(functionName, { body });

    if (error) throw error;

    const result = (data || {}) as T;
    if (result.error) throw new Error(result.error);
    return result;
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
      await invokeTeacherAction('teacher-remove-student-from-class', {
        studentId: student.id,
        subjectIds,
        classroomIds: student.classroomIds,
      });

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
      await invokeTeacherAction('teacher-reset-student-progress', {
        studentId: student.id,
        subjectIds,
      });

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

  const handleSendReminder = async () => {
    if (pendingStudents.length === 0 || sendingBulkReminders) {
      showAlert('Sin pendientes', 'No hay estudiantes pendientes de empezar con los filtros actuales.');
      return;
    }

    try {
      setSendingBulkReminders(true);
      const { data, error } = await supabase.functions.invoke('teacher-student-reminder', {
        body: {
          studentIds: pendingStudents.map((student) => student.id),
          subjectIds: Array.from(new Set(pendingStudents.flatMap((student) => student.subjectIds))),
          mode: 'reminder',
        },
      });

      if (error) throw new Error(error.message || 'No se pudo enviar el recordatorio.');

      const sent = Number((data as any)?.sent || 0);
      const failed = Number((data as any)?.failed || 0);
      showAlert(
        'Recordatorio enviado',
        `${sent} alumno${sent === 1 ? '' : 's'} recibieron el recordatorio${failed > 0 ? ` · ${failed} error${failed === 1 ? '' : 'es'}` : ''}.`
      );
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo enviar el recordatorio.');
    } finally {
      setSendingBulkReminders(false);
    }
  };

  const handleSendStudentReminder = async (student: StudentRow) => {
    if (reminderStudentIds[student.id]) return;

    try {
      setActionStudent(null);
      setReminderStudentIds((prev) => ({ ...prev, [student.id]: true }));
      const { data, error } = await supabase.functions.invoke('teacher-student-reminder', {
        body: {
          studentIds: [student.id],
          subjectIds: student.subjectIds,
          mode: 'reminder',
        },
      });

      if (error) throw new Error(error.message || 'No se pudo enviar el recordatorio.');
      const result = (data as any)?.results?.[0];
      if (result && result.sent === false) {
        throw new Error(result.error || 'No se pudo enviar el recordatorio.');
      }

      showAlert('Recordatorio enviado', `${student.alias} recibirá un recordatorio para empezar a practicar.`);
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo enviar el recordatorio.');
    } finally {
      setReminderStudentIds((prev) => ({ ...prev, [student.id]: false }));
    }
  };

  const handleResendStudentCredentials = async (student: StudentRow) => {
    if (reminderStudentIds[student.id]) return;

    try {
      setActionStudent(null);
      setReminderStudentIds((prev) => ({ ...prev, [student.id]: true }));
      const { data, error } = await supabase.functions.invoke('teacher-student-reminder', {
        body: {
          studentIds: [student.id],
          subjectIds: student.subjectIds,
          mode: 'credentials',
        },
      });

      if (error) throw new Error(error.message || 'No se pudieron reenviar las credenciales.');
      const result = (data as any)?.results?.[0];
      const temporaryPassword = result?.temporaryPassword;

      if (temporaryPassword) {
        setTemporaryPasswordsByStudent((prev) => ({ ...prev, [student.id]: temporaryPassword }));
      }

      if (result && result.sent === false) {
        showAlert(
          'Contraseña generada',
          `Se generó una nueva contraseña temporal para ${student.alias}, pero no se pudo enviar el email: ${result.error || 'error desconocido'}. Puedes copiarla desde sus acciones rápidas.`
        );
        return;
      }

      showAlert('Credenciales reenviadas', `${student.alias} recibirá un email con una nueva contraseña temporal.`);
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudieron reenviar las credenciales.');
    } finally {
      setReminderStudentIds((prev) => ({ ...prev, [student.id]: false }));
    }
  };

  const handleCopyTemporaryPassword = async (student: StudentRow) => {
    const temporaryPassword = temporaryPasswordsByStudent[student.id];
    if (!temporaryPassword) {
      showAlert('Sin contraseña temporal', 'Primero reenvía las credenciales para generar una nueva contraseña temporal.');
      return;
    }

    const text = `Usuario: ${student.alias}\nContraseña temporal: ${temporaryPassword}`;

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showAlert('Copiado', 'Contraseña temporal copiada al portapapeles.');
        return;
      }

      showAlert('Contraseña temporal', temporaryPassword);
    } catch {
      showAlert('Contraseña temporal', temporaryPassword);
    }
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

  if (!isDesktop) {
    return (
      <View className="flex-1 bg-[#020B1B]">
        <MobileTeacherStudents
          subjects={subjects}
          classroomOptions={classroomOptions}
          selectedSubjectId={selectedSubjectId}
          selectedClassroomId={selectedClassroomId}
          selectedStatus={selectedStatus}
          selectedSort={selectedSort}
          search={search}
          stats={stats}
          students={students}
          visibleStudents={visibleStudents}
          pendingStudents={pendingStudents}
          refreshing={refreshing}
          sendingBulkReminders={sendingBulkReminders}
          temporaryPasswordsByStudent={temporaryPasswordsByStudent}
          reminderStudentIds={reminderStudentIds}
          onRefresh={onRefresh}
          onSelectSubject={(value) => {
            setSelectedSubjectId(value);
            setSelectedClassroomId('all');
          }}
          onSelectClassroom={setSelectedClassroomId}
          onSelectStatus={setSelectedStatus}
          onSelectSort={setSelectedSort}
          onSearch={setSearch}
          onExportStudents={handleExportStudentsCsv}
          onSendReminder={handleSendReminder}
          onViewDetails={handleViewStudentDetails}
          onAssignActivity={handleAssignActivity}
          onOpenActions={openStudentActions}
          onSendStudentReminder={handleSendStudentReminder}
          onResendCredentials={handleResendStudentCredentials}
          onCopyTemporaryPassword={handleCopyTemporaryPassword}
          onNotifications={() => router.push('/(teacher)/notifications' as any)}
        />
        <StudentActionsModal
          student={actionStudent}
          visible={Boolean(actionStudent)}
          temporaryPassword={actionStudent ? temporaryPasswordsByStudent[actionStudent.id] ?? null : null}
          reminderBusy={actionStudent ? Boolean(reminderStudentIds[actionStudent.id]) : false}
          onClose={() => setActionStudent(null)}
          onViewDetails={handleViewStudentDetails}
          onViewHistory={handleViewHistory}
          onRemoveFromClass={requestRemoveFromClass}
          onResetProgress={requestResetProgress}
          onSendReminder={handleSendStudentReminder}
          onResendCredentials={handleResendStudentCredentials}
          onCopyTemporaryPassword={handleCopyTemporaryPassword}
          onAssignActivity={(student) => {
            setActionStudent(null);
            handleAssignActivity(student);
          }}
        />
        <StudentDetailModal
          student={detailStudent}
          visible={Boolean(detailStudent)}
          temporaryPassword={detailStudent ? temporaryPasswordsByStudent[detailStudent.id] ?? null : null}
          reminderBusy={detailStudent ? Boolean(reminderStudentIds[detailStudent.id]) : false}
          onClose={() => setDetailStudent(null)}
          onAssignActivity={(student) => {
            setDetailStudent(null);
            handleAssignActivity(student);
          }}
          onViewHistory={handleViewHistory}
          onRemoveFromClass={requestRemoveFromClass}
          onSendReminder={handleSendStudentReminder}
          onResendCredentials={handleResendStudentCredentials}
          onCopyTemporaryPassword={handleCopyTemporaryPassword}
        />
        <ConfirmModal
          dialog={confirmDialog}
          visible={Boolean(confirmDialog)}
          onClose={() => setConfirmDialog(null)}
        />
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
            paddingBottom: isDesktop ? 32 : MOBILE_BOTTOM_NAV_SPACER,
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
                <Ionicons name="people" size={isDesktop ? 40 : 34} color="#9FD6FF" />
                <Text className={`${isDesktop ? 'text-[40px]' : 'text-[32px]'} flex-shrink font-black text-white`} numberOfLines={1}>Estudiantes</Text>
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

          <View className="mb-4 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
            <ScrollView
              horizontal={!isWide}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 12,
                flexGrow: isWide ? 1 : undefined,
                flexWrap: isWide ? 'wrap' : 'nowrap',
                alignItems: 'center',
              }}
            >
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
            </ScrollView>
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
              sendingReminder={sendingBulkReminders}
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
                    temporaryPassword={temporaryPasswordsByStudent[student.id] ?? null}
                    reminderBusy={Boolean(reminderStudentIds[student.id])}
                    onViewDetails={handleViewStudentDetails}
                    onAssignActivity={handleAssignActivity}
                    onOpenActions={openStudentActions}
                    onSendReminder={handleSendStudentReminder}
                    onResendCredentials={handleResendStudentCredentials}
                    onCopyTemporaryPassword={handleCopyTemporaryPassword}
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
      {!isDesktop ? <TeacherBottomNav active="students" /> : null}
      <StudentActionsModal
        student={actionStudent}
        visible={Boolean(actionStudent)}
        temporaryPassword={actionStudent ? temporaryPasswordsByStudent[actionStudent.id] ?? null : null}
        reminderBusy={actionStudent ? Boolean(reminderStudentIds[actionStudent.id]) : false}
        onClose={() => setActionStudent(null)}
        onViewDetails={handleViewStudentDetails}
        onViewHistory={handleViewHistory}
        onRemoveFromClass={requestRemoveFromClass}
        onResetProgress={requestResetProgress}
        onSendReminder={handleSendStudentReminder}
        onResendCredentials={handleResendStudentCredentials}
        onCopyTemporaryPassword={handleCopyTemporaryPassword}
        onAssignActivity={(student) => {
          setActionStudent(null);
          handleAssignActivity(student);
        }}
      />
      <StudentDetailModal
        student={detailStudent}
        visible={Boolean(detailStudent)}
        temporaryPassword={detailStudent ? temporaryPasswordsByStudent[detailStudent.id] ?? null : null}
        reminderBusy={detailStudent ? Boolean(reminderStudentIds[detailStudent.id]) : false}
        onClose={() => setDetailStudent(null)}
        onAssignActivity={(student) => {
          setDetailStudent(null);
          handleAssignActivity(student);
        }}
        onViewHistory={handleViewHistory}
        onRemoveFromClass={requestRemoveFromClass}
        onSendReminder={handleSendStudentReminder}
        onResendCredentials={handleResendStudentCredentials}
        onCopyTemporaryPassword={handleCopyTemporaryPassword}
      />
      <ConfirmModal
        dialog={confirmDialog}
        visible={Boolean(confirmDialog)}
        onClose={() => setConfirmDialog(null)}
      />
    </View>
  );
}
