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

const upcomingActivities = [
  { icon: 'clipboard-outline', color: '#8B5CF6', title: 'Repaso de Gramática', detail: 'Inglés', date: '25 May' },
  { icon: 'calculator-outline', color: '#34D399', title: 'Ecuaciones de 1er grado', detail: 'Matemáticas', date: '28 May' },
  { icon: 'book-outline', color: '#3B82F6', title: 'Verbos en pasado', detail: 'Inglés', date: '30 May' },
] as const

const recentActivity = [
  { icon: 'people', color: '#8B5CF6', title: 'Mateo G. completó el reto', detail: '"Verbos en pasado" en Inglés', time: 'Hace 2h' },
  { icon: 'checkmark', color: '#34D399', title: 'Mateo G. respondió correctamente', detail: '10 preguntas en Matemáticas', time: 'Hace 4h' },
  { icon: 'person-add', color: '#3B82F6', title: 'Nueva inscripción en Matemáticas', detail: 'Mateo G.', time: 'Hace 6h' },
] as const

export default function TeacherClassesScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [analyticsBySubject, setAnalyticsBySubject] = useState<Record<number, SubjectAnalytics>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDesktop = width >= 1080;
  const isWide = width >= 860;

  const filteredSubjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return subjects;

    return subjects.filter((subject) =>
      `${subject.name} ${subject.description || ''} ${subject.code}`.toLowerCase().includes(normalizedSearch)
    );
  }, [search, subjects]);

  const totals = useMemo(() => {
    const analytics = Object.values(analyticsBySubject);
    const totalStudents = analytics.reduce((total, item) => total + item.enrolledCount, 0);
    const totalQuestions = analytics.reduce((total, item) => total + item.questionsCount, 0);
    const totalPlayed = analytics.reduce((total, item) => total + item.playedCount, 0);
    const weightedScore = analytics.reduce((total, item) => total + item.averageScore * item.playedCount, 0);

    return {
      students: totalStudents,
      questions: totalQuestions,
      participation: totalStudents > 0 ? Math.round((totalPlayed / totalStudents) * 100) : 0,
      averageScore: totalPlayed > 0 ? Math.round(weightedScore / totalPlayed) : 0,
    };
  }, [analyticsBySubject]);

  const fetchSubjects = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, description, icon, code, theme_color')
        .eq('teacher_id', session.session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const nextSubjects = (data || []) as Subject[];
      setSubjects(nextSubjects);

      const subjectIds = nextSubjects.map((subject) => subject.id);
      if (subjectIds.length === 0) {
        setAnalyticsBySubject({});
        return;
      }

      const [enrollmentsResult, scoresResult, questionsResult] = await Promise.all([
        supabase.from('enrollments').select('subject_id').in('subject_id', subjectIds),
        supabase.from('subject_scores').select('subject_id, max_score').in('subject_id', subjectIds),
        supabase.from('questions').select('subject_id').in('subject_id', subjectIds),
      ]);

      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;
      if (questionsResult.error) throw questionsResult.error;

      const nextAnalytics: Record<number, SubjectAnalytics> = {};
      subjectIds.forEach((subjectId) => {
        const subjectEnrollments = enrollmentsResult.data?.filter((item) => item.subject_id === subjectId) || [];
        const subjectScores = scoresResult.data?.filter(
          (item) => item.subject_id === subjectId && typeof item.max_score === 'number'
        ) || [];
        const subjectQuestions = questionsResult.data?.filter((item) => item.subject_id === subjectId) || [];
        const totalScore = subjectScores.reduce((total, item) => total + (item.max_score ?? 0), 0);

        nextAnalytics[subjectId] = {
          enrolledCount: subjectEnrollments.length,
          playedCount: subjectScores.length,
          averageScore: subjectScores.length > 0 ? Math.round(totalScore / subjectScores.length) : 0,
          questionsCount: subjectQuestions.length,
        };
      });
      setAnalyticsBySubject(nextAnalytics);
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
            onComingSoon={showComingSoon}
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
              <Text className="text-[28px] font-black text-white">Mis Clases 📖</Text>
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
              <Pressable className="rounded-2xl border border-[#20375E] bg-[#09162C] p-3">
                <Ionicons name="notifications-outline" size={22} color="#AFC2DB" />
                <View className="absolute right-2 top-2 h-5 w-5 items-center justify-center rounded-full bg-[#EF4444]">
                  <Text className="text-[10px] font-black text-white">3</Text>
                </View>
              </Pressable>
              <View className="h-11 w-11 items-center justify-center rounded-full bg-[#5B4BC4]">
                <Text className="font-black text-white">PR</Text>
              </View>
            </View>
          </View>

          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <MetricCard icon="school" title="Clases activas" value={String(subjects.length)} trend="1 más que el mes pasado" color="#8B5CF6" />
            <MetricCard icon="people" title="Estudiantes" value={String(totals.students)} trend="1 esta semana" color="#43D991" />
            <MetricCard icon="clipboard" title="Actividades" value={String(totals.questions)} trend="2 esta semana" color="#3B82F6" />
            <MetricCard icon="trophy" title="Participación media" value={`${totals.participation}%`} trend="12% esta semana" color="#F6A64A" />
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
                <Pressable className="h-12 flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4">
                  <Ionicons name="filter" size={16} color="#B9A7FF" />
                  <Text className="font-semibold text-[#DDE7F4]">Todas las clases</Text>
                  <Ionicons name="chevron-down" size={16} color="#AFC2DB" />
                </Pressable>
                <View className="h-12 flex-row rounded-xl border border-[#20375E] bg-[#09162C] p-1">
                  <View className="items-center justify-center rounded-lg bg-[#4F46E5] px-3">
                    <Ionicons name="grid" size={20} color="#FFFFFF" />
                  </View>
                  <View className="items-center justify-center px-3">
                    <Ionicons name="list" size={20} color="#AFC2DB" />
                  </View>
                </View>
              </View>

              <View style={{ gap: 16 }}>
                {filteredSubjects.map((subject, index) => (
                  <ClassCard
                    key={subject.id}
                    subject={subject}
                    index={index}
                    analytics={analyticsBySubject[subject.id] || { enrolledCount: 0, playedCount: 0, averageScore: 0, questionsCount: 0 }}
                    onComingSoon={showComingSoon}
                  />
                ))}
              </View>

              {filteredSubjects.length === 0 ? <EmptyClasses /> : null}

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
              <SidePanel title="Próximas actividades" action="Ver todas">
                <View style={{ gap: 10 }}>
                  {upcomingActivities.map((item) => <ActivityPlanRow key={item.title} item={item} />)}
                </View>
              </SidePanel>

              <SidePanel title="Participación por clase" action="Ver informe">
                <View style={{ gap: 14 }}>
                  {subjects.slice(0, 3).map((subject) => {
                    const analytics = analyticsBySubject[subject.id] || { enrolledCount: 0, playedCount: 0, averageScore: 0, questionsCount: 0 };
                    const progress = analytics.enrolledCount > 0 ? Math.round((analytics.playedCount / analytics.enrolledCount) * 100) : 0;
                    return <ProgressRow key={subject.id} label={subject.name} value={progress} color={subject.theme_color || '#8B5CF6'} />;
                  })}
                </View>
              </SidePanel>

              <SidePanel title="Actividad reciente en clases" action="Ver todo">
                <View style={{ gap: 13 }}>
                  {recentActivity.map((item) => <RecentActivityRow key={item.title} item={item} />)}
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
        <Ionicons name="arrow-up" size={13} color="#58E28B" />
        <Text className="text-[12px] font-semibold text-[#58E28B]">{trend}</Text>
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
  const progress = analytics.enrolledCount > 0 ? Math.round((analytics.playedCount / analytics.enrolledCount) * 100) : 0;

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
              <SmallPill icon="people-outline" label={`${analytics.enrolledCount} alumnos`} color="#38bdf8" />
              <SmallPill icon="trophy-outline" label={`${analytics.averageScore} XP media`} color="#B9A7FF" />
              <SmallPill icon="checkmark-circle-outline" label={`${analytics.playedCount} con nota`} color="#58E28B" />
            </View>
          </View>

          <View className="ml-auto items-center gap-2">
            <ProgressRing progress={progress} color={color} />
            <Text className="text-[12px] text-[#B7C4D7]">Progreso medio</Text>
          </View>
        </Pressable>
      </Link>

      <View className="flex-row flex-wrap border-t border-[#172A4A] bg-[#07162E]">
        <ClassAction href={`/(teacher)/subject/${subject.id}`} icon="eye-outline" label="Ver clase" />
        <ClassAction href={`/(teacher)/subject/students?subjectId=${subject.id}`} icon="people-outline" label="Estudiantes" />
        <ClassAction onPress={() => onComingSoon('Las actividades de la clase')} icon="calendar-outline" label="Actividades" />
        <ClassAction onPress={() => onComingSoon('Los informes de la clase')} icon="analytics-outline" label="Informes" />
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

function EmptyClasses() {
  return (
    <View className="items-center justify-center rounded-2xl border border-dashed border-[#20375E] bg-[#09162C] p-8">
      <Ionicons name="school-outline" size={58} color="#60799C" />
      <Text className="mt-4 text-center text-lg font-bold text-white">Aún no tienes clases</Text>
      <Text className="mt-2 text-center text-sm text-[#8FA7C7]">Crea tu primera asignatura para empezar a gestionar alumnos.</Text>
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

function ActivityPlanRow({ item }: { item: (typeof upcomingActivities)[number] }) {
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
        <Ionicons name="calendar-outline" size={15} color="#AFC2DB" />
        <Text className="text-[12px] font-semibold text-white">{item.date}</Text>
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

function RecentActivityRow({ item }: { item: (typeof recentActivity)[number] }) {
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
