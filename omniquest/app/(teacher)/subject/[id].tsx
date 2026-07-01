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
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { accuracyToGrade, answersToAccuracyPercent } from '../../../lib/grades';
import { generateUniqueClassCode } from '../../../lib/classCode';
import { difficultyOptions, getDifficultyMeta, type DifficultyLevel } from '../../../lib/difficulty';
import {
  buildStudentListRows,
  buildStudentReportRows,
  buildTemporalEvolution,
  getGradeColor,
  getInitials,
  getNextStudentSortKey,
  getNextStudentStatusFilter,
  getScorePerformance,
  getStudentSortLabel,
  getStudentStatus,
  getStudentStatusFilterLabel,
  getStudentStatusMeta,
  slugifyStudentName,
  type Enrollment,
  type EvolutionReport,
  type StudentProfile,
  type StudentReport,
  type StudentSortKey,
  type StudentStatusFilter,
  type SubjectScore,
} from '../../../lib/teacherSubjectAnalytics';
import TeacherSidebar from '../../../components/teacher/TeacherSidebar';
import TeacherStudentImportModal from '../../../components/teacher/TeacherStudentImportModal';

type IconName = keyof typeof Ionicons.glyphMap

type Subject = {
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

type Question = {
  id: number
  text: string
  points_base: number | null
  difficulty?: number | null
  topic_id: number | null
  classroom_id?: number | null
  created_at?: string | null
  answers?: { text: string; is_correct: boolean }[]
}

type Topic = {
  id: number
  classroom_id?: number | null
  title: string
  description: string | null
  icon: string | null
  sort_order: number | null
  available_until?: string | null
}

type TopicScore = {
  topic_id: number
  classroom_id?: number | null
  max_score: number | null
}

type Classroom = {
  id: number
  name: string
  academic_year: string | null
  active: boolean | null
  code?: string | null
}

type ActivityItem = {
  icon: IconName
  color: string
  title: string
  detail: string
  meta: string
  time: string
  warning: boolean
}

type FailedQuestionReport = {
  id: number
  text: string
  topic: string
  actualFailures: number
  totalAttempts: number
  failureRate: number
}

type ManualReviewRow = {
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

type SubjectTabKey = 'summary' | 'students' | 'activities' | 'questions' | 'review' | 'reports' | 'resources' | 'settings'

const tabItems: { key: SubjectTabKey; label: string; icon: IconName }[] = [
  { key: 'summary', label: 'Resumen', icon: 'document-text-outline' },
  { key: 'students', label: 'Estudiantes', icon: 'people-outline' },
  { key: 'activities', label: 'Actividades', icon: 'calendar-outline' },
  { key: 'questions', label: 'Preguntas', icon: 'checkmark-circle-outline' },
  { key: 'review', label: 'Revisión', icon: 'create-outline' },
  { key: 'reports', label: 'Informes', icon: 'bar-chart-outline' },
  { key: 'resources', label: 'Recursos', icon: 'book-outline' },
  { key: 'settings', label: 'Configuración', icon: 'settings-outline' },
]

const INSUFFICIENT_TREND_DATA = 'Datos disponibles cuando haya actividad suficiente'

export default function SubjectDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
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

  const isDesktop = width >= 1080;
  const isWide = width >= 900;
  const subjectId = Array.isArray(id) ? id[0] : id;
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
  const topicRows = useMemo(() => {
    const rows: {
      id: number | 'general'
      title: string
      description: string | null
      icon: string | null
      availableUntil: string | null
      questionsCount: number
      playedCount: number
      averageScore: number
    }[] = topics.map((topic) => {
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
        id: 'general' as const,
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
  const [failedQuestionRows, setFailedQuestionRows] = useState<FailedQuestionReport[]>([]);

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

  const renderTabContent = (currentSubject: Subject) => {
    if (activeTab === 'students') {
      const activeStudents = studentReportRows.filter((student) => getStudentStatus(student) === 'active').length;
      const studentsNeedingAttention = studentReportRows.filter((student) => getStudentStatus(student) === 'needs_help');
      const bestStudent = studentReportRows.find((student) => student.hasActivity);

      return (
        <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
          <View className={isDesktop ? 'flex-[1.55] gap-5' : 'gap-5'}>
            <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
              <StudentMetricCard icon="people" label="Alumnos inscritos" value={String(enrollments.length)} detail={`${studentReportRows.length} en esta clase`} color="#8B5CF6" />
              <StudentMetricCard icon="checkmark-circle" label="Activos esta semana" value={String(activeStudents)} detail={`${reportSummary.participation}% del total`} color="#34D399" />
              <StudentMetricCard icon="star" label="XP media de la clase" value={`${averageXp} XP`} detail="Puntuación media" color="#3B82F6" />
              <StudentMetricCard icon="trophy" label="Mejor alumno" value={`${bestStudent?.score ?? 0} XP`} detail={bestStudent?.name || 'Sin actividad'} color="#F59E0B" />
            </View>

            <View className="rounded-xl border border-[#183052] bg-[#07162D] p-4">
              <View className="mb-4 flex-row flex-wrap items-center gap-3">
                <View className="h-11 min-w-[220px] flex-1 flex-row items-center rounded-lg border border-[#20375E] bg-[#09162C] px-3">
                  <TextInput
                    className="min-w-0 flex-1 text-[13px] text-white"
                    placeholder="Buscar alumno..."
                    placeholderTextColor="#60799C"
                    value={studentSearch}
                    onChangeText={setStudentSearch}
                  />
                  <Ionicons name="search-outline" size={17} color="#8FA7C7" />
                </View>
                <InlineSelect
                  label={`Estado: ${getStudentStatusFilterLabel(studentStatusFilter)}`}
                  icon="chevron-down"
                  onPress={() => setStudentStatusFilter(getNextStudentStatusFilter(studentStatusFilter))}
                />
                <InlineSelect
                  label={`Ordenar por: ${getStudentSortLabel(studentSortKey)}`}
                  icon="chevron-down"
                  onPress={() => setStudentSortKey(getNextStudentSortKey(studentSortKey))}
                />
                <Pressable
                  onPress={() => setShowStudentImportModal(true)}
                  className="h-11 flex-row items-center gap-2 rounded-lg px-4"
                  style={({ pressed }) => ({
                    borderWidth: 1,
                    borderColor: '#6D5AF6',
                    backgroundColor: '#111B3D',
                    opacity: pressed ? 0.82 : 1,
                  })}
                >
                  <Ionicons name="person-add-outline" size={17} color="#C4B5FD" />
                  <Text className="text-[12px] font-black text-[#C4B5FD]">Importar alumnos</Text>
                </Pressable>
              </View>

              <View className="hidden flex-row border-b border-[#183052] px-2 pb-3 md:flex">
                <StudentTableHeader label="Pos." flex={0.35} />
                <StudentTableHeader label="Alumno" flex={1.4} />
                <StudentTableHeader label="Progreso" flex={1} />
                <StudentTableHeader label="XP" flex={0.75} />
                <StudentTableHeader label="Retos" flex={0.55} />
                <StudentTableHeader label="Nota media" flex={0.8} />
                <StudentTableHeader label="Estado" flex={0.85} />
                <StudentTableHeader label="Última actividad" flex={0.9} />
              </View>

              {studentListRows.length > 0 ? (
                studentListRows.map((student, index) => (
                  <StudentClassRow key={student.id} student={student} index={index} />
                ))
              ) : (
                <View className="items-center justify-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
                  <Ionicons name="people-outline" size={44} color="#64748B" />
                  <Text className="mt-3 text-center font-bold text-white">No hay alumnos para mostrar</Text>
                  <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">Comparte el código de la clase o cambia los filtros.</Text>
                </View>
              )}

              <Text className="mt-4 text-right text-[11px] text-[#8FA7C7]">
                Mostrando {studentListRows.length} de {studentReportRows.length} alumnos
              </Text>
            </View>
          </View>

          <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
            <Panel title="Distribución de notas">
              <GradeDistributionBars distribution={gradeDistribution} total={scorePerformanceRows.length} />
            </Panel>

            <Panel title="Actividad de la clase">
              <ProgressLine label="Alumnos activos" value={activeStudents} total={Math.max(studentReportRows.length, 1)} color="#8B5CF6" />
              <ProgressLine label="Retos completados" value={studentReportRows.reduce((total, student) => total + student.playedSessions, 0)} total={Math.max(studentReportRows.length * Math.max(questions.length, 1), 1)} color="#7C5CFF" />
              <ProgressLine label="XP generado" value={scores.reduce((total, score) => total + (score.max_score ?? 0), 0)} total={Math.max(scores.reduce((total, score) => total + (score.max_score ?? 0), 0) + 500, 1)} color="#3B82F6" />
            </Panel>

            <Panel title="Alumnos que necesitan atención" actionLabel="Ver todo">
              <View style={{ gap: 12 }}>
                {studentsNeedingAttention.slice(0, 4).map((student) => (
                  <StudentAttentionItem key={student.id} student={student} />
                ))}
                {studentsNeedingAttention.length === 0 ? (
                  <Text className="text-[12px] text-[#8FA7C7]">No hay alumnos en riesgo ahora mismo.</Text>
                ) : null}
              </View>
            </Panel>

            <View className="rounded-xl border border-[#20375E] bg-[#111B3D] p-5">
              <View className="flex-row gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-[#5A46D8]">
                  <Ionicons name="bulb-outline" size={19} color="#FFFFFF" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-black text-white">Consejo para profesores</Text>
                  <Text className="mt-2 text-[12px] leading-5 text-[#B7C4D7]">
                    Revisa alumnos con baja participación y anímalos a completar retos pendientes.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (activeTab === 'activities') {
      return (
        <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
          <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
            <Panel title="Actividad reciente">
              {recentActivity.map((item, index) => (
                <ActivityRow key={`${item.title}-${index}`} {...item} />
              ))}
            </Panel>
          </View>

          <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
            <Panel title="Actividad por tema">
              {topicRows.length > 0 ? (
                topicRows.map((topic) => (
                  <View key={String(topic.id)} className="flex-row items-center justify-between border-b border-[#13284A] py-3">
                    <View className="min-w-0 flex-1 pr-3">
                      <Text className="font-semibold text-white">{topic.title}</Text>
                      <Text className="mt-1 text-[11px] text-[#8FA7C7]">{topic.questionsCount} preguntas</Text>
                    </View>
                    <Text className="text-[12px] font-bold text-[#A78BFA]">{topic.playedCount} jugados</Text>
                  </View>
                ))
              ) : (
                <Text className="text-[12px] text-[#8FA7C7]">Aún no hay temas para analizar actividad.</Text>
              )}
            </Panel>
          </View>
        </View>
      );
    }

    if (activeTab === 'questions') {
      return (
        <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
          <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
            <Panel title={`Preguntas: ${selectedTopicLabel}`}>
              <DifficultyFilterBar selected={selectedDifficulty} onChange={setSelectedDifficulty} />
              {filteredQuestions.length === 0 ? (
                <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
                  <Ionicons name="help-circle-outline" size={44} color="#64748B" />
                  <Text className="mt-3 text-center font-bold text-white">No hay preguntas todavía</Text>
                  <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">Añade tu primera pregunta para activar este tema.</Text>
                  <Link
                    href={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${selectedClassroom?.id ? `&classroomId=${selectedClassroom.id}` : ''}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}${selectedDifficulty !== 'all' ? `&difficulty=${selectedDifficulty}` : ''}`}
                    asChild
                  >
                    <Pressable className="mt-5 rounded-xl bg-[#5A46D8] px-5 py-3">
                      <Text className="font-bold text-white">Crear pregunta</Text>
                    </Pressable>
                  </Link>
                </View>
              ) : (
                <View className="gap-3">
                  {filteredQuestions.map((question, index) => (
                    <QuestionRow
                      key={question.id}
                      question={question}
                      index={filteredQuestions.length - index}
                      subjectId={currentSubject.id}
                      topicName={question.topic_id ? topics.find((topic) => topic.id === question.topic_id)?.title : 'Tema general'}
                      onDelete={() => handleDelete(question.id)}
                    />
                  ))}
                </View>
              )}
            </Panel>
          </View>

          <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
            <Panel title="Gestión rápida">
              <Link
                href={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${selectedClassroom?.id ? `&classroomId=${selectedClassroom.id}` : ''}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}${selectedDifficulty !== 'all' ? `&difficulty=${selectedDifficulty}` : ''}`}
                asChild
              >
                <Pressable className="mb-3 rounded-xl bg-[#5A46D8] px-4 py-3">
                  <Text className="text-center font-bold text-white">Nueva pregunta</Text>
                </Pressable>
              </Link>
              <Text className="text-[12px] text-[#8FA7C7]">
                Total preguntas: <Text className="font-bold text-white">{questions.length}</Text>
              </Text>
            </Panel>
          </View>
        </View>
      );
    }

    if (activeTab === 'reports') {
      return (
        <View className="gap-5">
          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <ReportMetricCard icon="people" label="Alumnos evaluados" value={`${reportSummary.answered}/${reportSummary.enrolled}`} color="#38BDF8" detail={`${reportSummary.participation}% participación`} />
            <ReportMetricCard icon="shield-checkmark" label="Nota media" value={reportSummary.averageGrade.toFixed(1)} suffix="/10" color="#F59E0B" detail={`${reportSummary.averageAccuracy}% precisión media`} />
            <ReportMetricCard icon="close-circle" label="Preguntas falladas" value={String(reportSummary.failedAnswers)} color="#F43F5E" detail={`${reportSummary.correctAnswers} correctas registradas`} />
            <ReportMetricCard icon="star" label="Puntuación media" value={`${averageXp.toLocaleString('es-ES')}`} color="#3B82F6" detail="puntos con bonus aparte" />
          </View>

          <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
            <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
              <Panel title="Métricas por alumno">
                {studentReportRows.length > 0 ? (
                  <View className="gap-3">
                    {studentReportRows.map((student, index) => (
                      <StudentReportRow key={student.id} student={student} index={index} />
                    ))}
                  </View>
                ) : (
                  <Text className="text-[12px] text-[#8FA7C7]">Aún no hay alumnos inscritos para generar métricas.</Text>
                )}
              </Panel>

              <Panel title="Evolución temporal">
                <View className="gap-3">
                  {temporalEvolution.map((item) => (
                    <EvolutionRow key={item.label} item={item} maxValue={Math.max(1, reportSummary.enrolled)} />
                  ))}
                </View>
              </Panel>
            </View>

            <View className={isDesktop ? 'w-[380px] gap-5' : 'gap-5'}>
              <Panel title="Preguntas más falladas">
                {failedQuestionRows.length > 0 ? (
                  <View className="gap-3">
                    {failedQuestionRows.map((question) => (
                      <FailedQuestionRow key={question.id} question={question} />
                    ))}
                  </View>
                ) : (
                  <Text className="text-[12px] text-[#8FA7C7]">No hay fallos registrados en attempt_history todavía.</Text>
                )}
              </Panel>

              <Panel title="Distribución de notas">
                <GradeDistributionBars distribution={gradeDistribution} total={scorePerformanceRows.length} />
              </Panel>
            </View>
          </View>
        </View>
      );
    }

    if (activeTab === 'review') {
      return (
        <View className="gap-5">
          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <ReportMetricCard
              icon="time"
              label="Pendientes"
              value={String(manualReviewPendingCount)}
              color="#F59E0B"
              detail="Respuestas abiertas sin corregir"
            />
            <ReportMetricCard
              icon="checkmark-done"
              label="Revisadas"
              value={String(manualReviewReviewedCount)}
              color="#34D399"
              detail="Marcadas como correctas o fallidas"
            />
            <ReportMetricCard
              icon="chatbox-ellipses"
              label="Total abiertas"
              value={String(manualReviewRows.length)}
              color="#38BDF8"
              detail="Últimas respuestas recibidas"
            />
          </View>

          <Panel title="Corrección de respuestas abiertas">
            {manualReviewRows.length === 0 ? (
              <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
                <Ionicons name="chatbox-ellipses-outline" size={44} color="#64748B" />
                <Text className="mt-3 text-center font-bold text-white">No hay respuestas abiertas para revisar</Text>
                <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">
                  Cuando un alumno responda una pregunta abierta, aparecerá aquí para que puedas corregirla.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {manualReviewRows.map((row) => (
                  <ManualReviewRowCard
                    key={row.id}
                    row={row}
                    busy={reviewingAttemptId === row.id}
                    onApprove={() => handleReviewOpenAttempt(row.id, true)}
                    onReject={() => handleReviewOpenAttempt(row.id, false)}
                  />
                ))}
              </View>
            )}
          </Panel>
        </View>
      );
    }

    if (activeTab === 'resources') {
      return (
        <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
          <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
            <Panel title="Recursos del curso">
              <View className="gap-3">
                <Pressable
                  onPress={() => router.push(`/(teacher)/edit-subject?id=${currentSubject.id}` as any)}
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                >
                  <Text className="font-bold text-white">Editar información del curso</Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab('students')}
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                >
                  <Text className="font-bold text-white">Gestionar alumnos</Text>
                </Pressable>
                <Pressable
                  onPress={() => showAlert('Código del curso', currentSubject.code)}
                  className="rounded-xl border border-[#6D5AF6] bg-[#1A1E55] px-4 py-3"
                >
                  <Text className="font-bold text-[#D8B4FE]">Ver código de acceso</Text>
                </Pressable>
              </View>
            </Panel>
          </View>

          <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
            <Panel title="Temas disponibles">
              {topicRows.length > 0 ? (
                topicRows.map((topic) => (
                  <View key={String(topic.id)} className="border-b border-[#13284A] py-3">
                    <Text className="font-semibold text-white">{topic.title}</Text>
                    <Text className="mt-1 text-[11px] text-[#8FA7C7]">{topic.questionsCount} preguntas</Text>
                  </View>
                ))
              ) : (
                <Text className="text-[12px] text-[#8FA7C7]">Sin temas todavía.</Text>
              )}
            </Panel>
          </View>
        </View>
      );
    }

    if (activeTab === 'settings') {
      return (
        <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
          <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
            <Panel title="Configuración del curso">
              <View className="gap-3">
                <Pressable
                  onPress={() => router.push(`/(teacher)/edit-subject?id=${currentSubject.id}` as any)}
                  className="rounded-xl bg-[#5A46D8] px-4 py-3"
                >
                  <Text className="text-center font-bold text-white">Editar curso</Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab('students')}
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                >
                  <Text className="text-center font-bold text-white">Gestionar estudiantes</Text>
                </Pressable>
                <Pressable
                  onPress={() => showAlert('Código del curso', `Comparte este código con tus alumnos: ${currentSubject.code}`)}
                  className="rounded-xl border border-[#6D5AF6] bg-[#1A1E55] px-4 py-3"
                >
                  <Text className="text-center font-bold text-[#D8B4FE]">Compartir código</Text>
                </Pressable>
              </View>
            </Panel>
          </View>
        </View>
      );
    }

    return (
      <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
        <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
          <Panel
            title="Actividad reciente"
            actionLabel="Ver todo"
            onAction={() => setActiveTab('activities')}
          >
            {recentActivity.map((item, index) => (
              <ActivityRow key={`${item.title}-${index}`} {...item} />
            ))}
          </Panel>

          <View className="rounded-xl border border-[#183052] bg-[#07162D] p-5">
            <View className="flex-row flex-wrap items-center gap-4">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#B91C4C33]">
                <Ionicons name="radio-button-on" size={27} color="#F43F5E" />
              </View>
              <View className="min-w-[220px] flex-1">
                <Text className="text-[12px] font-semibold text-[#B7C4D7]">Última pregunta creada</Text>
                <Text className="mt-1 text-[20px] font-black text-white">{latestQuestion?.text || 'Crea la primera pregunta'}</Text>
              </View>
              <InfoStack label="Progreso de la clase" value={`${progress}%`} />
              <InfoStack label="Participación" value={`${scores.length} / ${Math.max(enrollments.length, 1)}`} />
              <Link
                href={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${selectedClassroom?.id ? `&classroomId=${selectedClassroom.id}` : ''}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}${selectedDifficulty !== 'all' ? `&difficulty=${selectedDifficulty}` : ''}`}
                asChild
              >
                <Pressable className="rounded-xl bg-[#1A1E55] px-5 py-3">
                  <Text className="text-[12px] font-bold text-white">Nueva pregunta</Text>
                </Pressable>
              </Link>
            </View>
            <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#13294C]">
              <View className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${Math.min(progress, 100)}%` }} />
            </View>
            <Text className="mt-3 text-[12px] text-[#8FA7C7]">
              {answeredClassQuestions} de {possibleClassQuestions} preguntas posibles respondidas
            </Text>
          </View>

          <Panel title={`Preguntas: ${selectedTopicLabel}`}>
            <DifficultyFilterBar selected={selectedDifficulty} onChange={setSelectedDifficulty} />
            {filteredQuestions.length === 0 ? (
              <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
                <Ionicons name="help-circle-outline" size={44} color="#64748B" />
                <Text className="mt-3 text-center font-bold text-white">No hay preguntas todavía</Text>
                <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">Añade tu primera pregunta para activar este tema.</Text>
                <Link
                  href={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${selectedClassroom?.id ? `&classroomId=${selectedClassroom.id}` : ''}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}${selectedDifficulty !== 'all' ? `&difficulty=${selectedDifficulty}` : ''}`}
                  asChild
                >
                  <Pressable className="mt-5 rounded-xl bg-[#5A46D8] px-5 py-3">
                    <Text className="font-bold text-white">Crear pregunta</Text>
                  </Pressable>
                </Link>
              </View>
            ) : (
              <View className="gap-3">
                {filteredQuestions.map((question, index) => (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    index={filteredQuestions.length - index}
                    subjectId={currentSubject.id}
                    topicName={question.topic_id ? topics.find((topic) => topic.id === question.topic_id)?.title : 'Tema general'}
                    onDelete={() => handleDelete(question.id)}
                  />
                ))}
              </View>
            )}
          </Panel>
        </View>

        <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
          <Panel title="Distribución de notas">
            <GradeDistributionBars distribution={gradeDistribution} total={scorePerformanceRows.length} />
          </Panel>

          <View className="rounded-xl border border-[#4733B7] bg-[#1A1E55] p-5">
            <View className="mb-3 flex-row items-center gap-3">
              <Ionicons name="qr-code-outline" size={24} color="#D8B4FE" />
              <Text className="font-black text-white">Código del curso</Text>
            </View>
            <Text className="text-[12px] leading-5 text-[#C4D0E3]">
              Comparte este código con tus alumnos para que se unan al curso.
            </Text>
            <View className="mt-4 flex-row items-center gap-3">
              <View className="rounded-lg bg-[#07162D] px-4 py-3">
                <Text className="font-mono font-black text-[#A78BFA]">{currentSubject.code}</Text>
              </View>
              <Pressable
                onPress={() => showAlert('Código del curso', currentSubject.code)}
                className="flex-row items-center gap-2 rounded-lg border border-[#6D5AF6] px-4 py-3"
              >
                <Text className="text-[12px] font-bold text-[#C4B5FD]">Copiar</Text>
                <Ionicons name="copy-outline" size={15} color="#C4B5FD" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  };

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
        .eq('id', subjectId)
        .eq('teacher_id', teacherId)
        .single();

      if (subjectResult.error) throw subjectResult.error;

      const classroomsResult = await supabase
        .from('classrooms')
        .select('id, name, academic_year, active, code')
        .eq('subject_id', subjectId)
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
          .eq('subject_id', subjectId)
          .eq('classroom_id', classroomId)
          .eq('active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('subject_topics')
          .select('id, title, description, icon, sort_order, available_until, classroom_id')
          .eq('subject_id', subjectId)
          .eq('classroom_id', classroomId)
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('topic_scores')
          .select('topic_id, max_score, classroom_id')
          .eq('subject_id', subjectId)
          .eq('classroom_id', classroomId),
        supabase.from('enrollments').select('student_id, classroom_id').eq('subject_id', subjectId).eq('classroom_id', classroomId),
        supabase
          .from('subject_scores')
          .select('student_id, max_score, correct_answers, played_days, played_at, classroom_id')
          .eq('subject_id', subjectId)
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
          .eq('questions.subject_id', subjectId)
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
  }, [selectedClassroomId, subjectId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateClassroom = async () => {
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
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const handleEditClass = () => {
    if (!subject) return;
    router.push(`/(teacher)/edit-subject?id=${subject.id}` as any);
  };

  const handleArchiveClass = async () => {
    if (!subject) return;

    const executeArchive = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const teacherId = sessionData.session?.user.id;

        if (!teacherId) {
          throw new Error('No se encontró una sesión activa.');
        }

        const { error } = await supabase
          .from('subjects')
          .update({ is_archived: true })
          .eq('id', subject.id)
          .eq('teacher_id', teacherId);

        if (error) {
          if (error.code === '42703') {
            throw new Error('Falta la columna is_archived en subjects. Aplica la migración de archivado.');
          }
          throw error;
        }

        showAlert('Curso archivado', 'El curso se archivó correctamente.');
        router.replace('/(teacher)/classes' as any);
      } catch (archiveError: any) {
        showAlert('No se pudo archivar', archiveError.message || 'Inténtalo de nuevo.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmArchive = window.confirm('¿Seguro que quieres archivar este curso? Se ocultará de la lista activa.');
      if (confirmArchive) {
        await executeArchive();
      }
      return;
    }

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
  };

  const handleDuplicateClass = async () => {
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
  };

  const handleRegenerateClassCode = async () => {
    if (!subject) return;

    try {
      const nextCode = await generateUniqueClassCode();
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData.session?.user.id;

      if (!teacherId) {
        throw new Error('No se encontró una sesión activa.');
      }

      const { error } = await supabase
        .from('subjects')
        .update({ code: nextCode })
        .eq('id', subject.id)
        .eq('teacher_id', teacherId);

      if (error) throw error;
      setSubject((current) => (current ? { ...current, code: nextCode } : current));
      showAlert('Código actualizado', `Nuevo código del curso: ${nextCode}`);
    } catch (regenerateError: any) {
      showAlert('No se pudo regenerar el código', regenerateError.message || 'Inténtalo de nuevo.');
    }
  };

  const handleManageAccess = () => {
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
  };

  const handleClassMenu = () => {
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
  };

  const handleCreateTopic = async () => {
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
      const { data, error } = await supabase
        .from('subject_topics')
        .insert([{
          subject_id: subjectId,
          classroom_id: selectedClassroomId,
          title: newTopicTitle.trim(),
          description: newTopicDescription.trim() || null,
          icon: '📘',
          sort_order: topics.length + 1,
          available_until: parsedAvailableUntil ? parsedAvailableUntil.toISOString() : null,
        }])
        .select('id, title, description, icon, sort_order, available_until, classroom_id')
        .single();

      if (error) throw error;

      setTopics((prevTopics) => [...prevTopics, data as Topic]);
      setSelectedTopicId(Number(data.id));
      setNewTopicTitle('');
      setNewTopicDescription('');
      setNewTopicAvailableUntil('');
      router.push(`/(teacher)/subject/add-question?subjectId=${subjectId}${selectedClassroomId ? `&classroomId=${selectedClassroomId}` : ''}&topicId=${data.id}&difficulty=${newTopicDifficulty}` as any);
    } catch (error: any) {
      showAlert('No se pudo crear el tema', error.message);
    } finally {
      setCreatingTopic(false);
    }
  };

  const handleReviewOpenAttempt = async (attemptId: number, isCorrect: boolean) => {
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
  };

  const executeDelete = async (questionId: number) => {
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)
        .eq('subject_id', subjectId);
      if (error) throw error;
      setQuestions((prevQuestions) => prevQuestions.filter((question) => question.id !== questionId));
    } catch (error: any) {
      showAlert('Error al borrar', error.message);
    }
  };

  const handleDelete = (questionId: number) => {
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm('¿Estás seguro de que quieres eliminar esta pregunta? Esta acción no se puede deshacer.');
      if (confirmDelete) executeDelete(questionId);
      return;
    }

    Alert.alert('Borrar pregunta', '¿Estás seguro de que quieres eliminar esta pregunta? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sí, borrar', style: 'destructive', onPress: () => executeDelete(questionId) },
    ]);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login' as any);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando curso...</Text>
      </View>
    );
  }

  if (!subject) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126] px-6">
        <Ionicons name="alert-circle-outline" size={52} color="#F87171" />
        <Text className="mt-4 text-center text-xl font-black text-white">No se encontró este curso</Text>
        <Pressable onPress={() => router.replace('/(teacher)/classes' as any)} className="mt-5 rounded-xl bg-[#5A46D8] px-5 py-3">
          <Text className="font-bold text-white">Volver a Cursos</Text>
        </Pressable>
      </View>
    );
  }

  const currentSubject = subject;
  const selectedClassroom = classrooms.find((classroom) => classroom.id === selectedClassroomId) || classrooms[0] || null;

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar
            activeSection="classes"
            subjectsCount={subjectsCount}
            onSignOut={handleSignOut}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 14,
            paddingTop: isDesktop ? 22 : 18,
            paddingBottom: 36,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-5 flex-row flex-wrap items-center justify-between gap-4">
            <Pressable onPress={() => router.push('/(teacher)/classes' as any)} className="flex-row items-center gap-2">
              <Ionicons name="arrow-back" size={18} color="#8FA7C7" />
              <Text className="font-semibold text-[#8FA7C7]">Cursos</Text>
            </Pressable>

            <View className="flex-row flex-wrap items-center gap-3">
              <Pressable onPress={handleClassMenu} className="rounded-xl border border-[#20375E] bg-[#09162C] p-3">
                <Ionicons name="ellipsis-horizontal" size={19} color="#C4D0E3" />
              </Pressable>
              <Pressable
                onPress={() => showAlert('Código del curso', `Comparte este código con tus alumnos: ${currentSubject.code}`)}
                className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
              >
                <Ionicons name="share-social-outline" size={16} color="#AFC2DB" />
                <Text className="text-[12px] font-bold text-[#DCE7F8]">Compartir código</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/(teacher)/edit-subject?id=${currentSubject.id}` as any)}
                className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-5 py-3"
              >
                <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                <Text className="text-[12px] font-bold text-white">Editar curso</Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-6 flex-row flex-wrap items-center gap-4">
            <View className="h-20 w-20 items-center justify-center rounded-2xl border border-[#6D5AF6] bg-[#2A1C61]">
              <Ionicons name={iconForSubject(currentSubject.icon)} size={42} color="#D8B4FE" />
            </View>
            <View className="min-w-[230px] flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-[26px] font-black text-white">{currentSubject.name}</Text>
                <Ionicons name="pencil-outline" size={16} color="#8FA7C7" />
              </View>
              <Text className="mt-1 text-[13px] font-semibold text-[#B7C4D7]">
                {currentSubject.description || 'Curso sin descripción'} · Código del curso:{' '}
                <Text className="font-mono text-[#A78BFA]">{currentSubject.code}</Text>
              </Text>
              <Text className="mt-1 text-[12px] text-[#8FA7C7]">
                {classrooms.length} clase{classrooms.length === 1 ? '' : 's'} · Clase activa: {selectedClassroom?.name || 'Sin clase'} · Creado {formatDate(currentSubject.created_at)}
              </Text>
            </View>
          </View>

          <Panel title="Clases del curso">
            <View className="flex-row flex-wrap gap-3">
              {classrooms.map((classroom) => {
                const active = classroom.id === selectedClassroomId;
                return (
                  <Pressable
                    key={classroom.id}
                    onPress={() => {
                      setSelectedClassroomId(classroom.id);
                      setSelectedTopicId('all');
                    }}
                    className="flex-row items-center gap-2 rounded-xl px-4 py-3"
                    style={({ pressed }) => ({
                      borderWidth: 1,
                      borderColor: active ? '#8B5CF6' : '#20375E',
                      backgroundColor: active ? '#211B58' : '#09162C',
                      opacity: pressed ? 0.82 : 1,
                    })}
                  >
                    <Ionicons name={active ? 'radio-button-on' : 'ellipse-outline'} size={16} color={active ? '#C4B5FD' : '#8FA7C7'} />
                    <Text className={`text-[12px] font-black ${active ? 'text-[#C4B5FD]' : 'text-[#B7C4D7]'}`}>{classroom.name}</Text>
                    {classroom.code ? <Text className="font-mono text-[11px] text-[#8FA7C7]">{classroom.code}</Text> : null}
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-4 flex-row flex-wrap items-end gap-3 border-t border-[#13284A] pt-4">
              <View className="min-w-[240px] flex-1">
                <Text className="mb-2 text-[12px] font-semibold text-[#B7C4D7]">Nueva clase dentro del curso</Text>
                <TextInput
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3 text-white"
                  placeholder="Ej. Grupo A, 1º DAM tarde..."
                  placeholderTextColor="#60799C"
                  value={newClassroomName}
                  onChangeText={setNewClassroomName}
                />
              </View>
              <Pressable
                onPress={handleCreateClassroom}
                disabled={creatingClassroom}
                className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-5 py-3"
                style={({ pressed }) => ({ opacity: creatingClassroom ? 0.65 : pressed ? 0.82 : 1 })}
              >
                {creatingClassroom ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={16} color="#FFFFFF" />}
                <Text className="text-[12px] font-bold text-white">{creatingClassroom ? 'Creando...' : 'Crear clase'}</Text>
              </Pressable>
            </View>
          </Panel>

          <View className={isWide ? 'mb-5 flex-row gap-4' : 'mb-5 gap-4'}>
            <MetricCard icon="checkmark-circle" label="Precisión media" value={`${averageAccuracy}%`} color="#34D399" detail="Aciertos sobre respuestas estimadas" />
            <MetricCard icon="shield-checkmark" label="Nota media" value={`${averageGrade.toFixed(1)}`} suffix="/10" color="#F59E0B" detail="Calculada por precisión" />
            <MetricCard icon="star" label="Puntuación media" value={`${averageXp.toLocaleString('es-ES')} pts`} color="#3B82F6" detail="Puntos y bonus separados" />
            <MetricCard icon="radio-button-on" label="Preguntas respondidas" value={`${answeredClassQuestions}/${possibleClassQuestions}`} color="#F43F5E" detail="Respuestas sobre preguntas posibles" />
            <MetricCard icon="trending-up" label="Participación" value={`${participation}%`} color="#8B5CF6" detail={INSUFFICIENT_TREND_DATA} />
          </View>

          <Panel title={`Temas de ${selectedClassroom?.name || 'la clase activa'}`}>
            <View className="mb-4 flex-row flex-wrap gap-3">
              <TopicFilterChip
                label="Todos"
                icon="albums-outline"
                active={selectedTopicId === 'all'}
                onPress={() => setSelectedTopicId('all')}
              />
              {topicRows.map((topic) => (
                <TopicFilterChip
                  key={topic.id}
                  label={topic.title}
                  icon={topic.icon && topic.icon.includes('-outline') ? topic.icon as IconName : 'book-outline'}
                  active={selectedTopicId === topic.id}
                  onPress={() => setSelectedTopicId(topic.id)}
                />
              ))}
            </View>

            <View style={{ gap: 12 }}>
              {topicRows.length === 0 ? (
                <View className="rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-5">
                  <Text className="font-bold text-white">Todavía no hay temas</Text>
                  <Text className="mt-1 text-[12px] text-[#8FA7C7]">Crea el primer tema para agrupar las preguntas de esta clase.</Text>
                </View>
              ) : (
                topicRows.map((topic) => (
                  <TopicSummaryRow
                    key={topic.id}
                    topic={topic}
                    active={selectedTopicId === topic.id}
                    onPress={() => {
                      if (typeof topic.id === 'number') {
                        router.push(`/(teacher)/topic/${topic.id}` as any);
                      } else {
                        setSelectedTopicId(topic.id);
                      }
                    }}
                  />
                ))
              )}
            </View>

            <View className="mt-5 flex-row flex-wrap items-end gap-3 border-t border-[#13284A] pt-4">
              <View className="min-w-[220px] flex-1">
                <Text className="mb-2 text-[12px] font-semibold text-[#B7C4D7]">Nuevo tema</Text>
                <TextInput
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3 text-white"
                  placeholder="Ej. Ecuaciones de primer grado"
                  placeholderTextColor="#60799C"
                  value={newTopicTitle}
                  onChangeText={setNewTopicTitle}
                />
              </View>
              <View className="min-w-[240px] flex-1">
                <Text className="mb-2 text-[12px] font-semibold text-[#B7C4D7]">Descripción</Text>
                <TextInput
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3 text-white"
                  placeholder="Opcional"
                  placeholderTextColor="#60799C"
                  value={newTopicDescription}
                  onChangeText={setNewTopicDescription}
                />
              </View>
              <View className="min-w-[240px] flex-1">
                <Text className="mb-2 text-[12px] font-semibold text-[#B7C4D7]">Límite opcional</Text>
                <TextInput
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3 text-white"
                  placeholder="2026-07-01 18:30"
                  placeholderTextColor="#60799C"
                  value={newTopicAvailableUntil}
                  onChangeText={setNewTopicAvailableUntil}
                />
                <Text className="mt-1 text-[10px] text-[#8FA7C7]">Vacío = siempre abierto.</Text>
              </View>
              <View className="min-w-[220px]">
                <Text className="mb-2 text-[12px] font-semibold text-[#B7C4D7]">Dificultad inicial</Text>
                <View className="flex-row flex-wrap gap-2">
                  {difficultyOptions.map((option) => {
                    const active = newTopicDifficulty === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setNewTopicDifficulty(option.value)}
                        className="rounded-lg border px-3 py-2"
                        style={{
                          borderColor: active ? option.color : '#20375E',
                          backgroundColor: active ? `${option.color}30` : '#09162C',
                        }}
                      >
                        <Text className="text-[12px] font-bold" style={{ color: active ? '#FFFFFF' : '#AFC2DB' }}>
                          {option.shortLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Pressable
                onPress={handleCreateTopic}
                disabled={creatingTopic}
                className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-5 py-3"
                style={({ pressed }) => ({ opacity: creatingTopic ? 0.65 : pressed ? 0.82 : 1 })}
              >
                {creatingTopic ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={16} color="#FFFFFF" />}
                <Text className="text-[12px] font-bold text-white">{creatingTopic ? 'Creando...' : 'Crear tema'}</Text>
              </Pressable>
            </View>
          </Panel>

          <View className="mb-5 flex-row flex-wrap rounded-xl border border-[#183052] bg-[#07162D] p-2">
            {tabItems.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <Pressable key={tab.label} onPress={() => setActiveTab(tab.key)}>
                  <View className={`flex-row items-center gap-2 rounded-lg px-4 py-3 ${isActive ? 'border-b-2 border-[#8B5CF6]' : ''}`}>
                    <Ionicons name={isActive ? tab.icon.replace('-outline', '') as IconName : tab.icon} size={15} color={isActive ? '#A78BFA' : '#AFC2DB'} />
                    <Text className={`text-[12px] font-bold ${isActive ? 'text-[#A78BFA]' : 'text-[#B7C4D7]'}`}>{tab.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {renderTabContent(currentSubject)}
        </ScrollView>
      </View>
      <TeacherStudentImportModal
        visible={showStudentImportModal}
        subjectId={currentSubject.id}
        subjectName={currentSubject.name}
        classroomId={selectedClassroom?.id ?? null}
        classroomName={selectedClassroom?.name ?? null}
        onClose={() => setShowStudentImportModal(false)}
        onImported={fetchData}
      />
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  suffix,
  color,
  detail,
}: {
  icon: IconName
  label: string
  value: string
  suffix?: string
  color: string
  detail?: string
}) {
  return (
    <View className="min-w-[155px] flex-1 rounded-xl border border-[#183052] bg-[#07162D] p-4">
      <View className="mb-3 flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}26` }}
        >
          <Ionicons name={icon} size={21} color={color} />
        </View>

        <Text className="flex-1 text-[12px] font-semibold text-[#B7C4D7]">
          {label}
        </Text>
      </View>

      <Text className="text-[24px] font-black text-white">
        {value}{' '}
        {suffix ? (
          <Text className="text-[12px] text-[#B7C4D7]">
            {suffix}
          </Text>
        ) : null}
      </Text>

      {detail ? (
        <View className="mt-3 flex-row items-center gap-1">
          <Ionicons name="information-circle-outline" size={13} color="#8FA7C7" />
          <Text className="flex-1 text-[11px] font-semibold text-[#8FA7C7]">
            {detail}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function ReportMetricCard({
  icon,
  label,
  value,
  suffix,
  color,
  detail,
}: {
  icon: IconName
  label: string
  value: string
  suffix?: string
  color: string
  detail: string
}) {
  return (
    <View className="min-w-[180px] flex-1 rounded-xl border border-[#183052] bg-[#07162D] p-4">
      <View className="mb-3 flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: `${color}26` }}>
          <Ionicons name={icon} size={21} color={color} />
        </View>
        <Text className="min-w-0 flex-1 text-[12px] font-semibold text-[#B7C4D7]">{label}</Text>
      </View>
      <Text className="text-[25px] font-black text-white">
        {value} {suffix ? <Text className="text-[12px] text-[#B7C4D7]">{suffix}</Text> : null}
      </Text>
      <Text className="mt-2 text-[11px] font-semibold text-[#8FA7C7]">{detail}</Text>
    </View>
  );
}

function Panel({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  children: React.ReactNode
}) {
  return (
    <View className="rounded-xl border border-[#183052] bg-[#07162D] p-5">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-[16px] font-black text-white">{title}</Text>
        {actionLabel ? (
          <Pressable onPress={onAction}>
            <Text className="text-[12px] font-bold text-[#A78BFA]">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function TopicFilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string
  icon: IconName
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-2 rounded-lg px-4 py-3 ${active ? 'bg-[#4F46E5]' : 'border border-[#20375E] bg-[#09162C]'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : '#AFC2DB'} />
      <Text className={`text-[12px] font-bold ${active ? 'text-white' : 'text-[#DDE7F4]'}`}>{label}</Text>
    </Pressable>
  );
}

function TopicSummaryRow({
  topic,
  active,
  onPress,
}: {
  topic: {
    id: number | 'general'
    title: string
    description: string | null
    icon: string | null
    availableUntil: string | null
    questionsCount: number
    playedCount: number
    averageScore: number
  }
  active: boolean
  onPress: () => void
}) {
  const icon = topic.icon && topic.icon.includes('-outline') ? topic.icon as IconName : 'book-outline';

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row flex-wrap items-center gap-4 rounded-xl border p-4 ${active ? 'border-[#6D5AF6] bg-[#1A1E55]' : 'border-[#183052] bg-[#09162C]'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}
    >
      <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#13284A]">
        {topic.icon && !topic.icon.includes('-outline') ? (
          <Text className="text-[22px]">{topic.icon}</Text>
        ) : (
          <Ionicons name={icon} size={24} color="#A78BFA" />
        )}
      </View>
      <View className="min-w-[220px] flex-1">
        <Text className="font-black text-white">{topic.title}</Text>
        <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={1}>
          {topic.description || 'Tema de la clase'}
        </Text>
      </View>
      <InfoStack label="Preguntas" value={String(topic.questionsCount)} />
      <InfoStack label="Jugados" value={String(topic.playedCount)} />
      <InfoStack label="Puntuación media" value={`${topic.averageScore}`} />
      <InfoStack label="Acceso" value={formatTopicDeadline(topic.availableUntil)} />
    </Pressable>
  );
}

function ActivityRow({
  icon,
  color,
  title,
  detail,
  meta,
  time,
  warning,
}: {
  icon: IconName
  color: string
  title: string
  detail: string
  meta: string
  time: string
  warning: boolean
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-[#13284A] py-3">
      <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}30` }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white">{title}</Text>
        <View className="mt-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-[12px] text-[#B7C4D7]">{detail}</Text>
          {warning ? (
            <View className="rounded-md bg-[#7F1D1D] px-2 py-1">
              <Text className="text-[10px] font-bold text-[#FCA5A5]">Necesita apoyo</Text>
            </View>
          ) : null}
        </View>
      </View>
      {meta ? <Text className="text-[12px] font-bold text-[#A78BFA]">{meta}</Text> : null}
      <Text className="text-[11px] text-[#8FA7C7]">{time}</Text>
    </View>
  );
}

function InfoStack({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[110px]">
      <Text className="text-[12px] text-[#B7C4D7]">{label}</Text>
      <Text className="mt-1 text-[18px] font-black text-white">{value}</Text>
    </View>
  );
}

function StudentReportRow({ student, index }: { student: StudentReport; index: number }) {
  const statusColor = student.hasActivity ? '#34D399' : '#F59E0B';
  const statusLabel = student.hasActivity ? 'Activo' : 'Pendiente';

  return (
    <View className="flex-row flex-wrap items-center gap-4 rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#1A1E55]">
        <Text className="font-black text-[#A78BFA]">{index + 1}</Text>
      </View>
      <View className="min-w-[180px] flex-1">
        <Text className="font-black text-white" numberOfLines={1}>{student.name}</Text>
        <Text className="mt-1 text-[11px] text-[#8FA7C7]">
          {student.lastActivity ? `Última actividad: ${formatDate(student.lastActivity)}` : 'Sin actividad registrada'}
        </Text>
      </View>
      <ReportStack label="Participación" value={`${student.participation}%`} color={statusColor} meta={statusLabel} />
      <ReportStack label="Nota media" value={student.hasActivity ? student.grade.toFixed(1) : '-'} color="#F59E0B" meta={student.hasActivity ? `${student.accuracyPercent}% precisión` : 'Sin nota'} />
      <ReportStack label="Correctas" value={String(student.correctAnswers)} color="#34D399" meta={`${student.playedSessions} sesión${student.playedSessions === 1 ? '' : 'es'}`} />
      <ReportStack label="Falladas" value={String(student.failedAnswers)} color="#F43F5E" meta="estimadas" />
    </View>
  );
}

function StudentMetricCard({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: IconName
  label: string
  value: string
  detail: string
  color: string
}) {
  return (
    <View className="min-w-[175px] flex-1 rounded-xl border border-[#183052] bg-[#07162D] p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: `${color}2A` }}>
          <Ionicons name={icon} size={21} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[22px] font-black text-white" numberOfLines={1}>{value}</Text>
          <Text className="mt-1 text-[11px] font-semibold text-[#B7C4D7]" numberOfLines={1}>{label}</Text>
        </View>
      </View>
      <Text className="mt-3 text-[11px] font-semibold" style={{ color }}>{detail}</Text>
    </View>
  );
}

function InlineSelect({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-11 flex-row items-center gap-2 rounded-lg border border-[#20375E] bg-[#09162C] px-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <Text className="text-[12px] font-semibold text-[#DDE7F4]">{label}</Text>
      <Ionicons name={icon} size={15} color="#8FA7C7" />
    </Pressable>
  );
}

function StudentTableHeader({ label, flex }: { label: string; flex: number }) {
  return (
    <Text className="text-[10px] font-black uppercase text-[#8FA7C7]" style={{ flex }}>
      {label}
    </Text>
  );
}

function StudentClassRow({ student, index }: { student: StudentReport; index: number }) {
  const status = getStudentStatus(student);
  const statusMeta = getStudentStatusMeta(status);
  const gradeColor = getGradeColor(student.grade);

  return (
    <View className="flex-row flex-wrap items-center gap-y-3 border-b border-[#13284A] px-2 py-4">
      <View className="min-w-[45px] flex-[0.35]">
        <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: index < 3 ? '#F59E0B' : '#1E3356' }}>
          <Text className="text-[11px] font-black text-white">{index + 1}</Text>
        </View>
      </View>
      <View className="min-w-[180px] flex-[1.4] flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#17315E]">
          <Text className="font-black text-[#9FD6FF]">{getInitials(student.name)}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black text-white" numberOfLines={1}>{student.name}</Text>
          <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={1}>@{slugifyStudentName(student.name)}</Text>
        </View>
      </View>
      <View className="min-w-[130px] flex-[1] flex-row items-center gap-3">
        <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full bg-[#7C5CFF]" style={{ width: `${student.participation}%` }} />
        </View>
        <Text className="w-10 text-right text-[12px] font-bold text-white">{student.participation}%</Text>
      </View>
      <View className="min-w-[90px] flex-[0.75]">
        <Text className="text-[12px] font-black text-white">{student.score.toLocaleString('es-ES')} XP</Text>
      </View>
      <Text className="min-w-[60px] flex-[0.55] text-[12px] font-bold text-white">{student.playedSessions}</Text>
      <View className="min-w-[90px] flex-[0.8]">
        <View className="self-start rounded-md border px-2 py-1" style={{ borderColor: gradeColor }}>
          <Text className="text-[12px] font-black" style={{ color: gradeColor }}>
            {student.hasActivity ? student.grade.toFixed(1) : '-'}
          </Text>
        </View>
      </View>
      <View className="min-w-[105px] flex-[0.85] flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: statusMeta.color }} />
        <Text className="text-[12px] font-semibold" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
      </View>
      <Text className="min-w-[110px] flex-[0.9] text-[12px] text-[#B7C4D7]">
        {formatRelative(student.lastActivity, index)}
      </Text>
    </View>
  );
}

function ProgressLine({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className="text-[12px] font-semibold text-white">{label}</Text>
        <Text className="text-[12px] text-[#DDE7F4]">{value.toLocaleString('es-ES')}</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
        <View className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function StudentAttentionItem({ student }: { student: StudentReport }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#17315E]">
        <Text className="text-[12px] font-black text-[#9FD6FF]">{getInitials(student.name)}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-bold text-white" numberOfLines={1}>{student.name}</Text>
        <Text className="text-[11px] text-[#B7C4D7]">{student.hasActivity ? 'Baja nota media' : 'Sin actividad'}</Text>
      </View>
      <View className="rounded-md border border-[#F43F5E] px-2 py-1">
        <Text className="text-[11px] font-black text-[#F43F5E]">{student.hasActivity ? student.grade.toFixed(1) : '0%'}</Text>
      </View>
    </View>
  );
}

function ReportStack({ label, value, color, meta }: { label: string; value: string; color: string; meta: string }) {
  return (
    <View className="min-w-[100px]">
      <Text className="text-[11px] text-[#8FA7C7]">{label}</Text>
      <Text className="mt-1 text-[18px] font-black" style={{ color }}>{value}</Text>
      <Text className="mt-1 text-[10px] font-semibold text-[#B7C4D7]">{meta}</Text>
    </View>
  );
}

function FailedQuestionRow({ question }: { question: FailedQuestionReport }) {
  return (
    <View className="rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#3B1020]">
          <Ionicons name="close-circle-outline" size={20} color="#FB7185" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-white" numberOfLines={2}>{question.text}</Text>
          <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={1}>{question.topic}</Text>
        </View>
        <View className="items-end">
          <Text className="text-[18px] font-black text-[#FB7185]">{question.actualFailures}</Text>
          <Text className="text-[10px] font-semibold text-[#8FA7C7]">fallos reales</Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-[11px] font-semibold text-[#B7C4D7]">
          {question.totalAttempts} intento{question.totalAttempts === 1 ? '' : 's'} registrados
        </Text>
        <Text className="text-[11px] font-black text-[#FB7185]">{question.failureRate}% fallo</Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13284A]">
        <View className="h-full rounded-full bg-[#FB7185]" style={{ width: `${question.failureRate}%` }} />
      </View>
    </View>
  );
}

function EvolutionRow({ item, maxValue }: { item: EvolutionReport; maxValue: number }) {
  const progress = Math.min(100, Math.round((item.activityCount / maxValue) * 100));

  return (
    <View className="rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="font-bold text-white">{item.label}</Text>
        <Text className="text-[12px] font-semibold text-[#C4D0E3]">
          {item.activityCount} activos · {item.averageScore} puntos
        </Text>
      </View>
      <View className="h-3 overflow-hidden rounded-full bg-[#13284A]">
        <View className="h-full rounded-full bg-[#34D399]" style={{ width: `${progress}%` }} />
      </View>
    </View>
  );
}

function ManualReviewRowCard({
  busy,
  onApprove,
  onReject,
  row,
}: {
  busy: boolean
  onApprove: () => void
  onReject: () => void
  row: ManualReviewRow
}) {
  const statusMeta = getManualReviewStatusMeta(row.status);
  const pending = row.status === 'pending';

  return (
    <View className="rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-start gap-4">
        <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${statusMeta.color}24` }}>
          <Ionicons name={statusMeta.icon} size={21} color={statusMeta.color} />
        </View>
        <View className="min-w-[240px] flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-black text-white">{row.studentName}</Text>
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: `${statusMeta.color}22` }}>
              <Text className="text-[10px] font-black uppercase" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
            </View>
            <Text className="text-[11px] font-semibold text-[#8FA7C7]">{formatDate(row.attemptedAt)}</Text>
          </View>
          <Text className="mt-2 text-[13px] font-bold leading-5 text-[#DDE7F4]">{row.questionText}</Text>
          <Text className="mt-1 text-[11px] font-semibold text-[#8FA7C7]">{row.topicName}</Text>
          <View className="mt-3 rounded-xl border border-[#243E65] bg-[#07162D] p-3">
            <Text className="text-[11px] font-black uppercase tracking-[0.06em] text-[#8FA7C7]">Respuesta del alumno</Text>
            <Text className="mt-2 text-[14px] leading-6 text-white">{row.answerText}</Text>
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <MiniInfo icon="star-outline" label={`${row.earnedPoints}/${row.possiblePoints} XP`} />
            {row.timeTaken !== null ? <MiniInfo icon="time-outline" label={`${row.timeTaken}s`} /> : null}
            {row.reviewedAt ? <MiniInfo icon="checkmark-done-outline" label={`Revisada ${formatDate(row.reviewedAt)}`} /> : null}
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Pressable
            onPress={onApprove}
            disabled={!pending || busy}
            className="flex-row items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: pending ? '#047857' : '#123044', opacity: busy ? 0.65 : 1 }}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            <Text className="text-[12px] font-bold text-white">Correcta</Text>
          </Pressable>
          <Pressable
            onPress={onReject}
            disabled={!pending || busy}
            className="flex-row items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: pending ? '#BE123C' : '#123044', opacity: busy ? 0.65 : 1 }}
          >
            <Ionicons name="close" size={14} color="#FFFFFF" />
            <Text className="text-[12px] font-bold text-white">Fallida</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MiniInfo({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-lg bg-[#102544] px-2 py-1">
      <Ionicons name={icon} size={12} color="#AFC2DB" />
      <Text className="text-[10px] font-bold text-[#C4D0E3]">{label}</Text>
    </View>
  );
}

function getManualReviewStatusMeta(status: string): { label: string; color: string; icon: IconName } {
  if (status === 'approved') return { label: 'Correcta', color: '#34D399', icon: 'checkmark-circle-outline' };
  if (status === 'rejected') return { label: 'Fallida', color: '#FB7185', icon: 'close-circle-outline' };
  if (status === 'pending') return { label: 'Pendiente', color: '#F59E0B', icon: 'time-outline' };
  return { label: 'Sin revisión', color: '#8FA7C7', icon: 'ellipse-outline' };
}

function DifficultyFilterBar({
  onChange,
  selected,
}: {
  selected: DifficultyLevel | 'all'
  onChange: (value: DifficultyLevel | 'all') => void
}) {
  return (
    <View className="mb-4 flex-row flex-wrap gap-2">
      <Pressable
        onPress={() => onChange('all')}
        className="rounded-lg border px-3 py-2"
        style={{
          borderColor: selected === 'all' ? '#8B5CF6' : '#20375E',
          backgroundColor: selected === 'all' ? '#312E8126' : '#09162C',
        }}
      >
        <Text className="text-[12px] font-bold" style={{ color: selected === 'all' ? '#D8B4FE' : '#AFC2DB' }}>Todas</Text>
      </Pressable>
      {difficultyOptions.map((option) => {
        const active = selected === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className="rounded-lg border px-3 py-2"
            style={{ borderColor: active ? option.color : '#20375E', backgroundColor: active ? `${option.color}26` : '#09162C' }}
          >
            <Text className="text-[12px] font-bold" style={{ color: active ? '#FFFFFF' : '#AFC2DB' }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function QuestionRow({
  question,
  index,
  subjectId,
  topicName,
  onDelete,
}: {
  question: Question
  index: number
  subjectId: number
  topicName?: string
  onDelete: () => void
}) {
  const answer = question.answers?.find((item) => item.is_correct)?.text || 'Sin respuesta marcada';
  const difficulty = getDifficultyMeta(question.difficulty || 1);

  return (
    <View className="rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg bg-[#1A1E55]">
          <Text className="font-black text-[#A78BFA]">{index}</Text>
        </View>
        <View className="min-w-[220px] flex-1">
          <Text className="font-black text-white">{question.text}</Text>
          <Text className="mt-2 text-[12px] text-[#34D399]">✓ {answer}</Text>
          {topicName ? <Text className="mt-1 text-[11px] font-semibold text-[#8FA7C7]">{topicName}</Text> : null}
          <Text className="mt-1 text-[11px] font-black" style={{ color: difficulty.color }}>{difficulty.label}</Text>
        </View>
        <View className="rounded-lg bg-[#13284A] px-3 py-2">
          <Text className="text-[11px] font-black text-[#C4D0E3]">{question.points_base ?? 0} pts</Text>
        </View>
        <Link href={`/(teacher)/subject/edit-question?questionId=${question.id}&subjectId=${subjectId}${question.classroom_id ? `&classroomId=${question.classroom_id}` : ''}${question.topic_id ? `&topicId=${question.topic_id}` : ''}&difficulty=${question.difficulty || 1}`} asChild>
          <Pressable className="rounded-lg border border-[#4F46E5] bg-[#312E8126] p-2">
            <Ionicons name="create-outline" size={18} color="#A78BFA" />
          </Pressable>
        </Link>
        <Pressable onPress={onDelete} className="rounded-lg border border-[#BE123C] bg-[#7F1D1D33] p-2">
          <Ionicons name="trash-outline" size={18} color="#FB7185" />
        </Pressable>
      </View>
    </View>
  );
}

function GradeDistributionBars({
  distribution,
  total,
}: {
  distribution: { label: string; color: string; count: number }[]
  total: number
}) {
  if (total <= 0) {
    return (
      <View className="rounded-xl border border-dashed border-[#29466F] bg-[#07162D] p-4">
        <Text className="text-center text-[12px] text-[#8FA7C7]">Aún no hay notas para distribuir.</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[12px] font-semibold text-[#B7C4D7]">Alumnos con nota</Text>
        <Text className="text-[18px] font-black text-white">{total}</Text>
      </View>
      {distribution.map((item) => {
        const percent = Math.round((item.count / total) * 100);
        return (
          <View key={item.label}>
            <View className="mb-1 flex-row items-center justify-between gap-3">
              <Text className="min-w-0 flex-1 text-[11px] font-semibold text-[#C4D0E3]">{item.label}</Text>
              <Text className="text-[11px] font-bold text-white">
                {item.count} ({percent}%)
              </Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full bg-[#13294C]">
              <View className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: item.color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function iconForSubject(icon: string | null): IconName {
  if (!icon) return 'book-outline';
  if (icon.includes('🧮') || icon.includes('➗')) return 'calculator-outline';
  if (icon.includes('⚽') || icon.includes('🏀')) return 'football-outline';
  if (icon.includes('🔬')) return 'flask-outline';
  if (icon.includes('🎨')) return 'color-palette-outline';
  return 'book-outline';
}

function formatDate(value?: string | null) {
  if (!value) return 'recientemente';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function parseDateTimeInput(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatTopicDeadline(value?: string | null) {
  if (!value) return 'Abierto';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Abierto';
  if (date.getTime() <= Date.now()) return 'Bloqueado';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
  const tab = tabItems.find((item) => item.key === rawValue);
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

  // Obtener intentos fallidos reales de la BD
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

  // Contar intentos fallidos reales por pregunta
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
