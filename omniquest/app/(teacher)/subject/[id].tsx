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
import TeacherSidebar from '../../../components/TeacherSidebar';

type IconName = keyof typeof Ionicons.glyphMap

type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  theme_color: string | null
  is_archived?: boolean | null
  teacher_id?: string | null
  created_at?: string | null
}

type Question = {
  id: number
  text: string
  points_base: number | null
  topic_id: number | null
  created_at?: string | null
  answers?: { text: string; is_correct: boolean }[]
}

type Topic = {
  id: number
  title: string
  description: string | null
  icon: string | null
  sort_order: number | null
}

type TopicScore = {
  topic_id: number
  max_score: number | null
}

type Enrollment = {
  student_id: string
}

type SubjectScore = {
  student_id: string
  max_score: number | null
  correct_answers?: number | null
  played_days?: string[] | null
  played_at?: string | null
}

type StudentProfile = {
  id: string
  alias: string | null
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

type StudentReport = {
  id: string
  name: string
  score: number
  grade: number
  correctAnswers: number
  failedAnswers: number
  participation: number
  playedSessions: number
  lastActivity?: string | null
  hasActivity: boolean
}

type FailedQuestionReport = {
  id: number
  text: string
  topic: string
  estimatedFailures: number
  actualFailures: number
  risk: number
}

type EvolutionReport = {
  label: string
  activityCount: number
  averageScore: number
}

type SubjectTabKey = 'summary' | 'students' | 'activities' | 'questions' | 'reports' | 'resources' | 'settings'

const tabItems: { key: SubjectTabKey; label: string; icon: IconName; href?: string }[] = [
  { key: 'summary', label: 'Resumen', icon: 'document-text-outline' },
  { key: 'students', label: 'Estudiantes', icon: 'people-outline', href: 'students' },
  { key: 'activities', label: 'Actividades', icon: 'calendar-outline' },
  { key: 'questions', label: 'Preguntas', icon: 'checkmark-circle-outline' },
  { key: 'reports', label: 'Informes', icon: 'bar-chart-outline' },
  { key: 'resources', label: 'Recursos', icon: 'book-outline' },
  { key: 'settings', label: 'Configuración', icon: 'settings-outline' },
]

export default function SubjectDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicScores, setTopicScores] = useState<TopicScore[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [scores, setScores] = useState<SubjectScore[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, StudentProfile>>({});
  const [subjectsCount, setSubjectsCount] = useState(0);
  const [selectedTopicId, setSelectedTopicId] = useState<number | 'all' | 'general'>('all');
  const [activeTab, setActiveTab] = useState<SubjectTabKey>(() => getSubjectTabFromParam(tab));
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
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
    if (selectedTopicId === 'all') return questions;
    if (selectedTopicId === 'general') return questionsWithoutTopic;
    return questions.filter((question) => question.topic_id === selectedTopicId);
  }, [questions, questionsWithoutTopic, selectedTopicId]);

  const scoreValues = useMemo(
    () => scores.map((item) => item.max_score).filter((score): score is number => typeof score === 'number'),
    [scores]
  );
  const averageXp = scoreValues.length > 0
    ? Math.round(scoreValues.reduce((total, score) => total + score, 0) / scoreValues.length)
    : 0;
  const averageGrade = xpToGrade(averageXp);
  const participation = enrollments.length > 0 ? Math.min(100, Math.round((scores.length / enrollments.length) * 100)) : 0;
  const progress = Math.round((participation + Math.min(100, questions.length * 8)) / 2);
  const completedChallenges = scores.length;
  const activeChallenge = filteredQuestions[0] || questions[0];
  const topicRows = useMemo(() => {
    const rows: {
      id: number | 'general'
      title: string
      description: string | null
      icon: string | null
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

    scoreValues.forEach((score) => {
      const grade = xpToGrade(score);
      if (grade >= 9) base[0].count += 1;
      else if (grade >= 7) base[1].count += 1;
      else if (grade >= 5) base[2].count += 1;
      else base[3].count += 1;
    });

    return base;
  }, [scoreValues]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const scoreActivity = scores.slice(0, 4).map((score, index) => {
      const studentName = profilesById[score.student_id]?.alias || `Alumno ${index + 1}`;
      const points = score.max_score ?? 0;
      return {
        icon: points >= averageXp ? 'trophy' : 'checkmark',
        color: points >= averageXp ? '#8B5CF6' : '#34D399',
        title: `${studentName} completó una pregunta`,
        detail: activeChallenge?.text || subject?.name || 'Actividad de clase',
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
        detail: activeChallenge?.text || 'Añade preguntas para activar la clase',
        meta: '',
        time: 'Ahora',
        warning: questions.length === 0,
      },
    ];
  }, [activeChallenge?.text, averageXp, enrollments.length, profilesById, questions.length, scores, subject?.name]);

  const studentReportRows = useMemo(
    () => buildStudentReportRows(enrollments, scores, profilesById, questions.length),
    [enrollments, profilesById, questions.length, scores]
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
      failedAnswers,
      correctAnswers,
    };
  }, [averageGrade, enrollments.length, studentReportRows]);
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
              {filteredQuestions.length === 0 ? (
                <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
                  <Ionicons name="help-circle-outline" size={44} color="#64748B" />
                  <Text className="mt-3 text-center font-bold text-white">No hay preguntas todavía</Text>
                  <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">Añade tu primera pregunta para activar este tema.</Text>
                  <Link
                    href={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}`}
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
                href={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}`}
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
      const latestEvolution = temporalEvolution[temporalEvolution.length - 1];

      return (
        <View className="gap-5">
          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <ReportMetricCard icon="people" label="Alumnos evaluados" value={`${reportSummary.answered}/${reportSummary.enrolled}`} color="#38BDF8" detail={`${reportSummary.participation}% participación`} />
            <ReportMetricCard icon="shield-checkmark" label="Nota media" value={reportSummary.averageGrade.toFixed(1)} suffix="/10" color="#F59E0B" detail={`${averageXp.toLocaleString('es-ES')} puntuación media`} />
            <ReportMetricCard icon="close-circle" label="Preguntas falladas" value={String(reportSummary.failedAnswers)} color="#F43F5E" detail={`${reportSummary.correctAnswers} correctas registradas`} />
            <ReportMetricCard icon="trending-up" label="Evolución" value={`${latestEvolution?.activityCount || 0}`} color="#34D399" detail="activos en el último tramo" />
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
              <Panel title="Preguntas falladas">
                {failedQuestionRows.length > 0 ? (
                  <View className="gap-3">
                    {failedQuestionRows.map((question) => (
                      <FailedQuestionRow key={question.id} question={question} />
                    ))}
                  </View>
                ) : (
                  <Text className="text-[12px] text-[#8FA7C7]">No hay fallos registrados todavía.</Text>
                )}
              </Panel>

              <Panel title="Distribución de notas">
                <View className="flex-row items-center gap-5">
                  <DonutCard value={scoreValues.length || enrollments.length} />
                  <View className="min-w-0 flex-1 gap-2">
                    {gradeDistribution.map((item) => {
                      const percent = scoreValues.length > 0 ? Math.round((item.count / scoreValues.length) * 100) : 0;
                      return (
                        <View key={item.label} className="flex-row items-center gap-2">
                          <View className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <Text className="min-w-0 flex-1 text-[11px] text-[#C4D0E3]">{item.label}</Text>
                          <Text className="text-[11px] font-bold text-white">
                            {item.count} ({percent}%)
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Panel>
            </View>
          </View>

          {/*
            Los datos guardados por partida viven agregados por alumno. Cuando exista un
            histórico por pregunta, este bloque podrá mostrar fallos exactos en vez de
            estimaciones repartidas por riesgo.
          */}
        </View>
      );
    }

    if (activeTab === 'resources') {
      return (
        <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
          <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
            <Panel title="Recursos de la clase">
              <View className="gap-3">
                <Pressable
                  onPress={() => router.push(`/(teacher)/edit-subject?id=${currentSubject.id}` as any)}
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                >
                  <Text className="font-bold text-white">Editar información de la clase</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/(teacher)/subject/students?subjectId=${currentSubject.id}` as any)}
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                >
                  <Text className="font-bold text-white">Gestionar alumnos</Text>
                </Pressable>
                <Pressable
                  onPress={() => showAlert('Código de la clase', currentSubject.code)}
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
            <Panel title="Configuración de la clase">
              <View className="gap-3">
                <Pressable
                  onPress={() => router.push(`/(teacher)/edit-subject?id=${currentSubject.id}` as any)}
                  className="rounded-xl bg-[#5A46D8] px-4 py-3"
                >
                  <Text className="text-center font-bold text-white">Editar clase</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/(teacher)/subject/students?subjectId=${currentSubject.id}` as any)}
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                >
                  <Text className="text-center font-bold text-white">Gestionar estudiantes</Text>
                </Pressable>
                <Pressable
                  onPress={() => showAlert('Código de clase', `Comparte este código con tus alumnos: ${currentSubject.code}`)}
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
                <Text className="text-[12px] font-semibold text-[#B7C4D7]">Pregunta activa de la clase</Text>
                <Text className="mt-1 text-[20px] font-black text-white">{activeChallenge?.text || 'Crea la primera pregunta'}</Text>
              </View>
              <InfoStack label="Progreso de la clase" value={`${progress}%`} />
              <InfoStack label="Participación" value={`${scores.length} / ${Math.max(enrollments.length, 1)}`} />
              <Link
                href={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}`}
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
            <Text className="mt-3 text-[12px] text-[#8FA7C7]">Finaliza en 3 días</Text>
          </View>

          <Panel title={`Preguntas: ${selectedTopicLabel}`}>
            {filteredQuestions.length === 0 ? (
              <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
                <Ionicons name="help-circle-outline" size={44} color="#64748B" />
                <Text className="mt-3 text-center font-bold text-white">No hay preguntas todavía</Text>
                <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">Añade tu primera pregunta para activar este tema.</Text>
                <Link
                  href={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}`}
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
            <View className="flex-row items-center gap-5">
              <DonutCard value={scoreValues.length || enrollments.length} />
              <View className="min-w-0 flex-1 gap-2">
                {gradeDistribution.map((item) => {
                  const percent = scoreValues.length > 0 ? Math.round((item.count / scoreValues.length) * 100) : 0;
                  return (
                    <View key={item.label} className="flex-row items-center gap-2">
                      <View className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <Text className="min-w-0 flex-1 text-[11px] text-[#C4D0E3]">{item.label}</Text>
                      <Text className="text-[11px] font-bold text-white">
                        {item.count} ({percent}%)
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Panel>

          <View className="rounded-xl border border-[#4733B7] bg-[#1A1E55] p-5">
            <View className="mb-3 flex-row items-center gap-3">
              <Ionicons name="qr-code-outline" size={24} color="#D8B4FE" />
              <Text className="font-black text-white">Código de la clase</Text>
            </View>
            <Text className="text-[12px] leading-5 text-[#C4D0E3]">
              Comparte este código con tus alumnos para que se unan a la clase.
            </Text>
            <View className="mt-4 flex-row items-center gap-3">
              <View className="rounded-lg bg-[#07162D] px-4 py-3">
                <Text className="font-mono font-black text-[#A78BFA]">{currentSubject.code}</Text>
              </View>
              <Pressable
                onPress={() => showAlert('Código de clase', currentSubject.code)}
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

      const [subjectResult, questionsResult, topicsResult, topicScoresResult, enrollmentsResult, scoresResult, subjectsCountResult] = await Promise.all([
        supabase.from('subjects').select('*').eq('id', subjectId).single(),
        supabase
          .from('questions')
          .select('*, answers(*)')
          .eq('subject_id', subjectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('subject_topics')
          .select('id, title, description, icon, sort_order')
          .eq('subject_id', subjectId)
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('topic_scores')
          .select('topic_id, max_score')
          .eq('subject_id', subjectId),
        supabase.from('enrollments').select('student_id').eq('subject_id', subjectId),
        supabase
          .from('subject_scores')
          .select('student_id, max_score, correct_answers, played_days, played_at')
          .eq('subject_id', subjectId)
          .order('played_at', { ascending: false }),
        teacherId
          ? supabase.from('subjects').select('id').eq('teacher_id', teacherId).eq('is_archived', false)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (subjectResult.error) throw subjectResult.error;
      if (questionsResult.error) throw questionsResult.error;
      if (topicsResult.error) throw topicsResult.error;
      if (topicScoresResult.error) throw topicScoresResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;
      if (subjectsCountResult.error) throw subjectsCountResult.error;

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
      setQuestions((questionsResult.data || []) as Question[]);
      setTopics((topicsResult.data || []) as Topic[]);
      setTopicScores((topicScoresResult.data || []) as TopicScore[]);
      setEnrollments(nextEnrollments);
      setScores(nextScores);
      setSubjectsCount(subjectsCountResult.data?.length || 0);
    } catch (error: any) {
      console.error('Error cargando detalle de clase:', error.message);
      showAlert('No se pudo cargar la clase', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [subjectId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
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

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let index = 0; index < 6; index += 1) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateUniqueClassCode = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = generateInviteCode();
      const { data, error } = await supabase
        .from('subjects')
        .select('id')
        .eq('code', candidate)
        .maybeSingle();

      if (error) throw error;
      if (!data) return candidate;
    }

    throw new Error('No se pudo generar un código único. Inténtalo de nuevo.');
  };

  const handleEditClass = () => {
    if (!subject) return;
    router.push(`/(teacher)/edit-subject?id=${subject.id}` as any);
  };

  const handleArchiveClass = async () => {
    if (!subject) return;

    const executeArchive = async () => {
      try {
        const { error } = await supabase
          .from('subjects')
          .update({ is_archived: true })
          .eq('id', subject.id);

        if (error) {
          if (error.code === '42703') {
            throw new Error('Falta la columna is_archived en subjects. Aplica la migración de archivado.');
          }
          throw error;
        }

        showAlert('Clase archivada', 'La clase se archivó correctamente.');
        router.replace('/(teacher)/classes' as any);
      } catch (archiveError: any) {
        showAlert('No se pudo archivar', archiveError.message || 'Inténtalo de nuevo.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmArchive = window.confirm('¿Seguro que quieres archivar esta clase? Se ocultará de la lista activa.');
      if (confirmArchive) {
        await executeArchive();
      }
      return;
    }

    Alert.alert('Archivar clase', 'La clase se ocultará de las clases activas.', [
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
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData.session?.user.id;
      if (!teacherId) {
        throw new Error('No se encontró una sesión activa.');
      }

      const duplicateCode = await generateUniqueClassCode();

      const { data: duplicatedSubject, error: duplicatedSubjectError } = await supabase
        .from('subjects')
        .insert([
          {
            name: `${subject.name} (Copia)`,
            description: subject.description,
            icon: subject.icon,
            code: duplicateCode,
            teacher_id: teacherId,
            theme_color: subject.theme_color,
            is_archived: false,
          },
        ])
        .select('id')
        .single();

      if (duplicatedSubjectError) {
        if (duplicatedSubjectError.code === '42703') {
          throw new Error('Falta la columna is_archived en subjects. Aplica la migración de archivado.');
        }
        throw duplicatedSubjectError;
      }

      const duplicatedSubjectId = duplicatedSubject.id as number;

      const { data: sourceTopics, error: sourceTopicsError } = await supabase
        .from('subject_topics')
        .select('id, title, description, icon, sort_order, active')
        .eq('subject_id', subject.id);

      if (sourceTopicsError) throw sourceTopicsError;

      const topicIdMap = new Map<number, number>();
      for (const topic of sourceTopics || []) {
        const { data: newTopic, error: newTopicError } = await supabase
          .from('subject_topics')
          .insert([
            {
              subject_id: duplicatedSubjectId,
              title: topic.title,
              description: topic.description,
              icon: topic.icon,
              sort_order: topic.sort_order,
              active: topic.active,
            },
          ])
          .select('id')
          .single();

        if (newTopicError) throw newTopicError;
        topicIdMap.set(Number(topic.id), Number(newTopic.id));
      }

      const { data: sourceQuestions, error: sourceQuestionsError } = await supabase
        .from('questions')
        .select('id, type, text, points_base, time_limit_seconds, topic_id')
        .eq('subject_id', subject.id)
        .order('created_at', { ascending: true });

      if (sourceQuestionsError) throw sourceQuestionsError;

      const questionIdMap = new Map<number, number>();
      for (const question of sourceQuestions || []) {
        const duplicatedTopicId = question.topic_id ? topicIdMap.get(Number(question.topic_id)) || null : null;
        const { data: newQuestion, error: newQuestionError } = await supabase
          .from('questions')
          .insert([
            {
              subject_id: duplicatedSubjectId,
              topic_id: duplicatedTopicId,
              type: question.type,
              text: question.text,
              points_base: question.points_base,
              time_limit_seconds: question.time_limit_seconds,
            },
          ])
          .select('id')
          .single();

        if (newQuestionError) throw newQuestionError;
        questionIdMap.set(Number(question.id), Number(newQuestion.id));
      }

      if (questionIdMap.size > 0) {
        const sourceQuestionIds = Array.from(questionIdMap.keys());
        const { data: sourceAnswers, error: sourceAnswersError } = await supabase
          .from('answers')
          .select('question_id, text, is_correct, sort_order')
          .in('question_id', sourceQuestionIds);

        if (sourceAnswersError) throw sourceAnswersError;

        const answersToInsert = (sourceAnswers || [])
          .map((answer) => {
            const duplicatedQuestionId = questionIdMap.get(Number(answer.question_id));
            if (!duplicatedQuestionId) return null;
            return {
              question_id: duplicatedQuestionId,
              text: answer.text,
              is_correct: answer.is_correct,
              sort_order: answer.sort_order,
            };
          })
          .filter(Boolean);

        if (answersToInsert.length > 0) {
          const { error: insertAnswersError } = await supabase.from('answers').insert(answersToInsert as any[]);
          if (insertAnswersError) throw insertAnswersError;
        }
      }

      showAlert('Clase duplicada', 'Se creó una copia completa con temas, preguntas y respuestas.');
      router.push(`/(teacher)/subject/${duplicatedSubjectId}` as any);
    } catch (duplicateError: any) {
      showAlert('No se pudo duplicar', duplicateError.message || 'Inténtalo de nuevo.');
    }
  };

  const handleRegenerateClassCode = async () => {
    if (!subject) return;

    try {
      const nextCode = await generateUniqueClassCode();
      const { error } = await supabase
        .from('subjects')
        .update({ code: nextCode })
        .eq('id', subject.id);

      if (error) throw error;
      setSubject((current) => (current ? { ...current, code: nextCode } : current));
      showAlert('Código actualizado', `Nuevo código de clase: ${nextCode}`);
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
        router.push(`/(teacher)/subject/students?subjectId=${subject.id}` as any);
        return;
      }
      if (choice === '2') {
        showAlert('Código de clase', subject.code);
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
          onPress: () => router.push(`/(teacher)/subject/students?subjectId=${subject.id}` as any),
        },
        {
          text: 'Más opciones',
          onPress: () => {
            Alert.alert('Opciones de acceso', 'Elige una acción', [
              { text: 'Ver código', onPress: () => showAlert('Código de clase', subject.code) },
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
        onPress: () => router.push(`/(teacher)/subject/students?subjectId=${subject.id}` as any),
      },
      {
        text: 'Ver código',
        onPress: () => showAlert('Código de clase', subject.code),
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
        `Menú de clase\n1) Editar clase\n2) Archivar clase\n3) Duplicar clase\n4) Regenerar código\n5) Gestionar acceso\n\nEscribe una opción (1-5)`
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
      Alert.alert('Menú de clase', 'Elige una acción', [
        { text: 'Editar clase', onPress: handleEditClass },
        { text: 'Gestionar acceso', onPress: handleManageAccess },
        {
          text: 'Más acciones',
          onPress: () => {
            Alert.alert('Más acciones', 'Selecciona una opción', [
              {
                text: 'Duplicar clase',
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
                text: 'Archivar clase',
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

    Alert.alert('Menú de clase', 'Elige una acción', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Editar clase', onPress: handleEditClass },
      {
        text: 'Archivar clase',
        style: 'destructive',
        onPress: () => {
          void handleArchiveClass();
        },
      },
      {
        text: 'Duplicar clase',
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
    if (!newTopicTitle.trim()) {
      showAlert('Tema sin nombre', 'Escribe un nombre para el tema.');
      return;
    }

    setCreatingTopic(true);
    try {
      const { data, error } = await supabase
        .from('subject_topics')
        .insert([{
          subject_id: subjectId,
          title: newTopicTitle.trim(),
          description: newTopicDescription.trim() || null,
          icon: '📘',
          sort_order: topics.length + 1,
        }])
        .select('id, title, description, icon, sort_order')
        .single();

      if (error) throw error;

      setTopics((prevTopics) => [...prevTopics, data as Topic]);
      setSelectedTopicId(Number(data.id));
      setNewTopicTitle('');
      setNewTopicDescription('');
    } catch (error: any) {
      showAlert('No se pudo crear el tema', error.message);
    } finally {
      setCreatingTopic(false);
    }
  };

  const executeDelete = async (questionId: number) => {
    try {
      const { error } = await supabase.from('questions').delete().eq('id', questionId);
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
        <Text className="mt-4 text-[#8FA7C7]">Cargando clase...</Text>
      </View>
    );
  }

  if (!subject) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126] px-6">
        <Ionicons name="alert-circle-outline" size={52} color="#F87171" />
        <Text className="mt-4 text-center text-xl font-black text-white">No se encontró esta clase</Text>
        <Pressable onPress={() => router.replace('/(teacher)/classes' as any)} className="mt-5 rounded-xl bg-[#5A46D8] px-5 py-3">
          <Text className="font-bold text-white">Volver a Mis Clases</Text>
        </Pressable>
      </View>
    );
  }

  const currentSubject = subject;

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
              <Text className="font-semibold text-[#8FA7C7]">Mis Clases</Text>
            </Pressable>

            <View className="flex-row flex-wrap items-center gap-3">
              <Pressable onPress={handleClassMenu} className="rounded-xl border border-[#20375E] bg-[#09162C] p-3">
                <Ionicons name="ellipsis-horizontal" size={19} color="#C4D0E3" />
              </Pressable>
              <Pressable
                onPress={() => showAlert('Código de clase', `Comparte este código con tus alumnos: ${currentSubject.code}`)}
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
                <Text className="text-[12px] font-bold text-white">Editar clase</Text>
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
                {currentSubject.description || 'Clase sin descripción'} · Código:{' '}
                <Text className="font-mono text-[#A78BFA]">{currentSubject.code}</Text>
              </Text>
              <Text className="mt-1 text-[12px] text-[#8FA7C7]">
                {enrollments.length} alumno{enrollments.length === 1 ? '' : 's'} · Creada {formatDate(currentSubject.created_at)}
              </Text>
            </View>
          </View>

          <View className={isWide ? 'mb-5 flex-row gap-4' : 'mb-5 gap-4'}>
            <MetricCard icon="people" label="Progreso medio" value={`${progress}%`} color="#8B5CF6" detail="+ 12% vs semana pasada" />
            <MetricCard icon="shield-checkmark" label="Nota media" value={`${averageGrade.toFixed(1)}`} suffix="/10" color="#F59E0B" detail="+ 0.6 vs semana pasada" />
            <MetricCard icon="star" label="Puntuación media" value={`${averageXp.toLocaleString('es-ES')} puntos`} color="#3B82F6" detail="+ 15% vs semana pasada" />
            <MetricCard icon="radio-button-on" label="Preguntas completadas" value={String(completedChallenges)} color="#F43F5E" detail="+ 4 vs semana pasada" />
            <MetricCard icon="trending-up" label="Participación" value={`${participation}%`} color="#8B5CF6" detail="+ 10% vs semana pasada" />
          </View>

          <Panel title="Temas de la clase">
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
              const content = (
                <View className={`flex-row items-center gap-2 rounded-lg px-4 py-3 ${isActive ? 'border-b-2 border-[#8B5CF6]' : ''}`}>
                  <Ionicons name={isActive ? tab.icon.replace('-outline', '') as IconName : tab.icon} size={15} color={isActive ? '#A78BFA' : '#AFC2DB'} />
                  <Text className={`text-[12px] font-bold ${isActive ? 'text-[#A78BFA]' : 'text-[#B7C4D7]'}`}>{tab.label}</Text>
                </View>
              );

              if (tab.href === 'students') {
                return (
                  <Link href={`/(teacher)/subject/students?subjectId=${currentSubject.id}`} asChild key={tab.label}>
                    <Pressable>{content}</Pressable>
                  </Link>
                );
              }

              return (
                <Pressable key={tab.label} onPress={() => setActiveTab(tab.key)}>
                  {content}
                </Pressable>
              );
            })}
          </View>

          {renderTabContent(currentSubject)}
        </ScrollView>
      </View>
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
  detail: string
}) {
  return (
    <View className="min-w-[155px] flex-1 rounded-xl border border-[#183052] bg-[#07162D] p-4">
      <View className="mb-3 flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: `${color}26` }}>
          <Ionicons name={icon} size={21} color={color} />
        </View>
        <Text className="flex-1 text-[12px] font-semibold text-[#B7C4D7]">{label}</Text>
      </View>
      <Text className="text-[24px] font-black text-white">
        {value} {suffix ? <Text className="text-[12px] text-[#B7C4D7]">{suffix}</Text> : null}
      </Text>
      <Text className="mt-3 text-[11px] font-semibold text-[#34D399]">↑ {detail}</Text>
    </View>
  );
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
      <ReportStack label="Nota media" value={student.hasActivity ? student.grade.toFixed(1) : '-'} color="#F59E0B" meta={student.hasActivity ? `${student.score} puntos` : 'Sin nota'} />
      <ReportStack label="Correctas" value={String(student.correctAnswers)} color="#34D399" meta={`${student.playedSessions} sesión${student.playedSessions === 1 ? '' : 'es'}`} />
      <ReportStack label="Falladas" value={String(student.failedAnswers)} color="#F43F5E" meta="estimadas" />
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
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13284A]">
        <View className="h-full rounded-full bg-[#FB7185]" style={{ width: `${question.risk}%` }} />
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
        </View>
        <View className="rounded-lg bg-[#13284A] px-3 py-2">
          <Text className="text-[11px] font-black text-[#C4D0E3]">{question.points_base ?? 0} pts</Text>
        </View>
        <Link href={`/(teacher)/subject/edit-question?questionId=${question.id}&subjectId=${subjectId}`} asChild>
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

function DonutCard({ value }: { value: number }) {
  return (
    <View className="h-24 w-24 items-center justify-center rounded-full border-[10px] border-[#34D399] bg-[#09162C]">
      <View className="absolute h-24 w-24 rounded-full border-[10px] border-l-[#3B82F6] border-r-transparent border-t-[#F59E0B] border-b-[#F43F5E]" />
      <Text className="text-[24px] font-black text-white">{value}</Text>
      <Text className="text-[10px] font-semibold text-[#B7C4D7]">alumnos</Text>
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

function xpToGrade(score: number) {
  return Math.min(10, Math.max(0, Number((score / 160).toFixed(1))));
}

function formatDate(value?: string | null) {
  if (!value) return 'recientemente';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
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
  return tab && tab.key !== 'students' ? tab.key : 'summary';
}

function buildStudentReportRows(
  enrollments: Enrollment[],
  scores: SubjectScore[],
  profilesById: Record<string, StudentProfile>,
  questionsCount: number
): StudentReport[] {
  const scoreByStudentId = new Map<string, SubjectScore>();
  scores.forEach((score) => {
    if (!scoreByStudentId.has(score.student_id)) {
      scoreByStudentId.set(score.student_id, score);
    }
  });
  const maxSessions = Math.max(1, ...scores.map((score) => getPlayedSessions(score, questionsCount)));

  return enrollments
    .map((enrollment, index) => {
      const score = scoreByStudentId.get(enrollment.student_id);
      const hasActivity = Boolean(score?.played_at || typeof score?.max_score === 'number');
      const playedSessions = getPlayedSessions(score, questionsCount);
      const answeredQuestions = questionsCount > 0 ? playedSessions * questionsCount : 0;
      const correctAnswers = score?.correct_answers ?? 0;
      const failedAnswers = hasActivity ? Math.max(0, answeredQuestions - correctAnswers) : 0;

      return {
        id: enrollment.student_id,
        name: profilesById[enrollment.student_id]?.alias || `Alumno ${index + 1}`,
        score: score?.max_score ?? 0,
        grade: xpToGrade(score?.max_score ?? 0),
        correctAnswers,
        failedAnswers,
        participation: hasActivity ? Math.min(100, Math.round((playedSessions / maxSessions) * 100)) : 0,
        playedSessions,
        lastActivity: score?.played_at,
        hasActivity,
      };
    })
    .sort((a, b) => Number(b.hasActivity) - Number(a.hasActivity) || b.score - a.score || a.name.localeCompare(b.name));
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

  const { data: attempts, error } = await supabaseClient
    .from('attempt_history')
    .select('question_id, is_correct')
    .in('student_id', studentIds);

  if (error) {
    console.error('Error fetching attempts:', error);
    return [];
  }

  // Contar intentos fallidos reales por pregunta
  const failureCount = new Map<number, number>();
  attempts?.forEach((attempt: any) => {
    if (!attempt.is_correct) {
      failureCount.set(attempt.question_id, (failureCount.get(attempt.question_id) || 0) + 1);
    }
  });

  const topicById = new Map(topicRows.map((topic) => [topic.id, topic]));
  
  return questions
    .map((question) => {
      const topic = question.topic_id ? topicById.get(question.topic_id) : topicById.get('general');
      const actualFailures = failureCount.get(question.id) || 0;
      const questionsInTopic = Math.max(1, topic?.questionsCount || questions.length);
      const expectedTopicScore = questionsInTopic * 160;
      const topicWeakness = Math.max(0.18, 1 - ((topic?.averageScore || 0) / expectedTopicScore));
      const weight = (question.points_base || 100) * topicWeakness;
      const totalWeight = questions.reduce((acc, q) => acc + ((q.points_base || 100) * topicWeakness), 0) || 1;
      const risk = Math.min(100, Math.max(12, Math.round((weight / totalWeight) * 100 * Math.min(questions.length, 6))));

      return {
        id: question.id,
        text: question.text,
        topic: topic?.title || 'Tema general',
        estimatedFailures: actualFailures,
        actualFailures,
        risk,
      };
    })
    .filter((q) => q.actualFailures > 0)
    .sort((a, b) => b.actualFailures - a.actualFailures || b.risk - a.risk)
    .slice(0, 5);
}

function buildTemporalEvolution(scores: SubjectScore[], questionsCount: number): EvolutionReport[] {
  const today = new Date();
  const periods = Array.from({ length: 6 }, (_, index) => {
    const start = startOfDay(addDays(today, -35 + index * 7));
    const end = endOfDay(addDays(start, 6));

    return { start, end, label: `${formatShortDate(start)} - ${formatShortDate(end)}` };
  });

  return periods.map((period) => {
    const activeScores = scores.filter((score) =>
      getPlayedDateKeys(score).some((dateKey) => {
        const date = new Date(`${dateKey}T12:00:00`);
        return date >= period.start && date <= period.end;
      })
    );
    const averageScore = activeScores.length > 0
      ? Math.round(activeScores.reduce((total, score) => total + (score.max_score ?? 0), 0) / activeScores.length)
      : 0;

    return {
      label: period.label,
      activityCount: activeScores.length,
      averageScore: questionsCount > 0 ? averageScore : 0,
    };
  });
}

function getPlayedSessions(score: SubjectScore | undefined, questionsCount: number) {
  if (!score) return 0;
  const playedDays = Array.isArray(score.played_days) ? score.played_days.filter(Boolean).length : 0;
  const sessionsFromCorrectAnswers = questionsCount > 0 ? Math.ceil((score.correct_answers ?? 0) / questionsCount) : 0;
  return Math.max(score.played_at ? 1 : 0, playedDays, sessionsFromCorrectAnswers);
}

function getPlayedDateKeys(score: SubjectScore) {
  const playedDays = Array.isArray(score.played_days) ? score.played_days.filter(Boolean) : [];
  if (playedDays.length > 0) return playedDays;
  if (!score.played_at) return [];
  return [toDateKey(new Date(score.played_at))];
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date);
}
