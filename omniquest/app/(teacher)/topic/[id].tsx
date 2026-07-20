import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MobileMetricCard from '../../../components/ui/mobile/MobileMetricCard'
import { supabase } from '../../../lib/supabase';
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout';
import { difficultyOptions, getDifficultyMeta, type DifficultyLevel } from '../../../lib/difficulty';
import TeacherSidebar from '../../../components/teacher/TeacherSidebar';
import TeacherBottomNav from '../../../components/teacher/TeacherBottomNav';
import TeacherPageHeader from '../../../components/teacher/TeacherPageHeader';

type IconName = keyof typeof Ionicons.glyphMap

type TeacherActionResult = {
  error?: string
  [key: string]: unknown
}

type Topic = {
  id: number
  title: string
  description: string | null
  icon: string | null
  sort_order: number | null
  available_until?: string | null
  subject_id: number
  classroom_id?: number | null
  created_at?: string | null
}

type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  theme_color: string | null
  teacher_id?: string | null
}

type Question = {
  id: number
  text: string
  points_base: number | null
  difficulty?: number | null
  topic_id: number | null
  created_at?: string | null
  answers?: { text: string; is_correct: boolean }[]
}

type TopicScore = {
  topic_id: number
  max_score: number | null
}

type Enrollment = {
  student_id: string
}

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topicScores, setTopicScores] = useState<TopicScore[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [subjectsCount, setSubjectsCount] = useState(0);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDesktop = width >= 1080;
  const topicId = Array.isArray(id) ? id[0] : id;
  const topicQuestions = questions
    .filter((question) => question.topic_id === Number(topicId))
    .filter((question) => selectedDifficulty === 'all' || (question.difficulty || 1) === selectedDifficulty);

  const scoreValues = topicScores
    .filter((score) => Number(score.topic_id) === Number(topicId) && typeof score.max_score === 'number')
    .map((score) => score.max_score || 0);
  const averageXp = scoreValues.length > 0
    ? Math.round(scoreValues.reduce((total, score) => total + score, 0) / scoreValues.length)
    : 0;
  const participation = enrollments.length > 0 ? Math.min(100, Math.round((scoreValues.length / enrollments.length) * 100)) : 0;

  const fetchData = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData.session?.user.id;

      if (!teacherId) {
        throw new Error('No se encontró una sesión activa.');
      }

      const { data: topicOwnerData, error: topicError } = await supabase
        .from('subject_topics')
        .select('id, subject_id, classroom_id')
        .eq('id', topicId)
        .single();

      if (topicError) throw topicError;

      const subjectId = topicOwnerData.subject_id;
      const classroomId = topicOwnerData.classroom_id ?? null;

      const subjectResult = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .eq('teacher_id', teacherId)
        .single();

      if (subjectResult.error) throw subjectResult.error;

      const [topicResult, questionsResult, topicScoresResult, enrollmentsResult, subjectsCountResult] = await Promise.all([
        supabase
          .from('subject_topics')
          .select('*')
          .eq('id', topicId)
          .eq('subject_id', subjectId)
          .single(),
        supabase
          .from('questions')
          .select('*, answers(*)')
          .eq('topic_id', topicId)
          .eq('subject_id', subjectId)
          .match(classroomId ? { classroom_id: classroomId } : {})
          .eq('active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('topic_scores')
          .select('topic_id, max_score, classroom_id')
          .eq('topic_id', topicId)
          .match(classroomId ? { classroom_id: classroomId } : {}),
        supabase.from('enrollments').select('student_id, classroom_id').eq('subject_id', subjectId).match(classroomId ? { classroom_id: classroomId } : {}),
        supabase.from('subjects').select('id').eq('teacher_id', teacherId).eq('is_archived', false),
      ]);

      if (topicResult.error) throw topicResult.error;
      if (questionsResult.error) throw questionsResult.error;
      if (topicScoresResult.error) throw topicScoresResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (subjectsCountResult.error) throw subjectsCountResult.error;

      const nextEnrollments = (enrollmentsResult.data || []) as Enrollment[];

      setTopic(topicResult.data as Topic);
      setSubject(subjectResult.data as Subject);
      setQuestions((questionsResult.data || []) as Question[]);
      setTopicScores((topicScoresResult.data || []) as TopicScore[]);
      setEnrollments(nextEnrollments);
      setSubjectsCount(subjectsCountResult.data?.length || 0);
    } catch (error: any) {
      console.error('Error cargando detalle del tema:', error.message);
      showAlert('No se pudo cargar el tema', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [topicId]);

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

  const executeDelete = async (questionId: number) => {
    if (!subject) return;

    try {
      await invokeTeacherAction('teacher-delete-question', { questionId });
      setQuestions((prevQuestions) => prevQuestions.filter((question) => question.id !== questionId));
    } catch (error: any) {
      showAlert('Error al borrar', error.message);
    }
  };

  const handleDelete = (questionId: number) => {
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
        <Text className="mt-4 text-[#8FA7C7]">Cargando tema...</Text>
      </View>
    );
  }

  if (!topic || !subject) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126] px-6">
        <Ionicons name="alert-circle-outline" size={52} color="#F87171" />
        <Text className="mt-4 text-center text-xl font-black text-white">No se encontró este tema</Text>
        <Pressable onPress={() => router.replace('/(teacher)/classes' as any)} className="mt-5 rounded-xl bg-[#5A46D8] px-5 py-3">
          <Text className="font-bold text-white">Volver a Cursos</Text>
        </Pressable>
      </View>
    );
  }

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
            paddingBottom: isDesktop ? 36 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <TeacherPageHeader
            backAction={{ label: subject.name, onPress: () => router.push(`/(teacher)/subject/${subject.id}` as any) }}
            isDesktop={isDesktop}
            title={topic.title}
            subtitle={`${topic.description || 'Tema de la clase'} · ${topicQuestions.length} pregunta${topicQuestions.length === 1 ? '' : 's'} · ${scoreValues.length} intento${scoreValues.length === 1 ? '' : 's'} · ${formatTopicDeadline(topic.available_until)}`}
            titleNumberOfLines={2}
            subtitleNumberOfLines={3}
            leading={(
              <View className="h-20 w-20 items-center justify-center rounded-2xl border border-[#6D5AF6] bg-[#2A1C61]">
                {topic.icon && !topic.icon.includes('-outline') ? (
                  <Text className="text-[42px]">{topic.icon}</Text>
                ) : (
                  <Ionicons name="book-outline" size={42} color="#D8B4FE" />
                )}
              </View>
            )}
            actions={(
              <>
                <Pressable
                  accessibilityLabel="Editar tema"
                  accessibilityRole="button"
                  onPress={() => router.push(`/(teacher)/edit-topic?id=${topic.id}` as any)}
                  className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                >
                  <Ionicons name="create-outline" size={16} color="#AFC2DB" />
                  {isDesktop ? <Text className="text-[12px] font-bold text-[#DCE7F8]">Editar tema</Text> : null}
                </Pressable>
                <Link
                  href={`/(teacher)/subject/add-question?subjectId=${subject.id}&classroomId=${topic.classroom_id ?? ''}&topicId=${topic.id}${selectedDifficulty !== 'all' ? `&difficulty=${selectedDifficulty}` : ''}`}
                  asChild
                >
                  <Pressable
                    accessibilityLabel="Crear nueva pregunta"
                    accessibilityRole="button"
                    className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-4 py-3"
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    {isDesktop ? <Text className="text-[12px] font-bold text-white">Nueva pregunta</Text> : null}
                  </Pressable>
                </Link>
              </>
            )}
          />

          <View className="mb-5 flex-row flex-wrap gap-4">
            <MetricCard icon="help-circle" label="Preguntas" value={String(topicQuestions.length)} color="#8B5CF6" />
            <MetricCard icon="radio-button-on" label="Intentos" value={String(scoreValues.length)} color="#F59E0B" />
            <MetricCard icon="star" label="XP media" value={`${averageXp.toLocaleString('es-ES')} XP`} color="#3B82F6" />
            <MetricCard icon="trending-up" label="Participación" value={`${participation}%`} color="#F43F5E" />
          </View>

          <Panel title={`Preguntas del tema: ${topic.title}`}>
            <DifficultyFilterBar selected={selectedDifficulty} onChange={setSelectedDifficulty} />
            {topicQuestions.length === 0 ? (
              <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
                <Ionicons name="help-circle-outline" size={44} color="#64748B" />
                <Text className="mt-3 text-center font-bold text-white">No hay preguntas todavía</Text>
                <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">Añade tu primera pregunta para activar este tema.</Text>
                <Link
                  href={`/(teacher)/subject/add-question?subjectId=${subject.id}&classroomId=${topic.classroom_id ?? ''}&topicId=${topic.id}${selectedDifficulty !== 'all' ? `&difficulty=${selectedDifficulty}` : ''}`}
                  asChild
                >
                  <Pressable className="mt-5 rounded-xl bg-[#5A46D8] px-5 py-3">
                    <Text className="font-bold text-white">Crear pregunta</Text>
                  </Pressable>
                </Link>
              </View>
            ) : (
              <View className="gap-3">
                {topicQuestions.map((question, index) => (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    index={index}
                    subjectId={subject.id}
                    classroomId={topic.classroom_id ?? null}
                    topicId={topicId}
                    onDelete={() => handleDelete(question.id)}
                  />
                ))}
              </View>
            )}
          </Panel>
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="classes" /> : null}
    </View>
  );
}

function MetricCard({ icon, label, value, suffix, color, detail }: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  suffix?: string
  color: string
  detail?: string
}) {
  return (
    <MobileMetricCard
      className="min-w-[190px] flex-1"
      color={color}
      detail={detail}
      icon={icon}
      label={label}
      suffix={suffix}
      value={value}
    />
  )
}

function Panel({ title, children, actionLabel, onAction }: {
  title: string
  children: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View className="mb-5 rounded-xl border border-[#183052] bg-[#07162D] p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-[18px] font-black text-white">{title}</Text>
        {actionLabel && onAction && (
          <Pressable onPress={onAction} className="flex-row items-center gap-1">
            <Text className="text-[12px] font-semibold text-[#8B5CF6]">{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={14} color="#8B5CF6" />
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
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

function formatTopicDeadline(value?: string | null) {
  if (!value) return 'Sin fecha límite';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha límite';
  if (date.getTime() <= Date.now()) return 'Tema bloqueado por fecha límite';
  return `Disponible hasta ${new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}`;
}

function QuestionRow({ question, index, subjectId, classroomId, topicId, onDelete }: {
  question: Question
  index: number
  subjectId: number
  classroomId: number | null
  topicId: string | undefined
  onDelete: () => void
}) {
  const correctAnswer = question.answers?.find((answer) => answer.is_correct);
  const difficulty = getDifficultyMeta(question.difficulty || 1);

  return (
    <View className="flex-row flex-wrap items-center gap-4 rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#13284A]">
        <Text className="font-bold text-[#A78BFA]">#{index + 1}</Text>
      </View>
      <View className="min-w-[300px] flex-1">
        <Text className="font-semibold text-white" numberOfLines={2}>{question.text}</Text>
        <Text className="mt-1 text-[12px] text-[#8FA7C7]">
          {question.points_base} puntos · {question.answers?.length || 0} opciones · Respuesta correcta: {correctAnswer?.text || 'N/A'}
        </Text>
        <Text className="mt-1 text-[11px] font-black" style={{ color: difficulty.color }}>{difficulty.label}</Text>
      </View>
      <View className="flex-row gap-2">
        <Link href={`/(teacher)/subject/edit-question?questionId=${question.id}&subjectId=${subjectId}${classroomId ? `&classroomId=${classroomId}` : ''}${topicId ? `&topicId=${topicId}` : ''}&difficulty=${question.difficulty || 1}`} asChild>
          <Pressable className="flex-row items-center gap-2 rounded-lg bg-[#3B82F6] px-3 py-2">
            <Ionicons name="create-outline" size={14} color="#FFFFFF" />
            <Text className="text-[12px] font-semibold text-white">Editar</Text>
          </Pressable>
        </Link>
        <Pressable
          onPress={onDelete}
          className="flex-row items-center gap-2 rounded-lg bg-[#F43F5E] px-3 py-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
          <Text className="text-[12px] font-semibold text-white">Borrar</Text>
        </Pressable>
      </View>
    </View>
  );
}
