import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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

const recentActivity = [
  { icon: 'people', color: '#8B5CF6', title: 'Nueva inscripción en una clase', time: 'Hace 2h' },
  { icon: 'checkmark', color: '#34D399', title: 'Un alumno completó un reto', time: 'Hace 4h' },
  { icon: 'trophy', color: '#F6A64A', title: 'Nueva mejor puntuación registrada', time: 'Ayer' },
] as const

export default function TeacherHomeScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [analyticsBySubject, setAnalyticsBySubject] = useState<Record<number, SubjectAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDesktop = width >= 1080;
  const isWide = width >= 860;

  const totals = useMemo(() => {
    const analytics = Object.values(analyticsBySubject);
    const students = analytics.reduce((total, item) => total + item.enrolledCount, 0);
    const questions = analytics.reduce((total, item) => total + item.questionsCount, 0);
    const attempts = analytics.reduce((total, item) => total + item.playedCount, 0);
    const weightedScore = analytics.reduce((total, item) => total + item.averageScore * item.playedCount, 0);

    return {
      students,
      questions,
      attempts,
      averageScore: attempts > 0 ? Math.round(weightedScore / attempts) : 0,
    };
  }, [analyticsBySubject]);

  const fetchDashboard = useCallback(async () => {
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
          <View className="mb-7 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[280px] flex-1">
              {!isDesktop ? (
                <Text className="mb-3 text-[#9FD6FF]" style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}>
                  OmniQuest
                </Text>
              ) : null}
              <Text className="text-[28px] font-black text-white">¡Bienvenido de nuevo, Profesor! 👋</Text>
              <Text className="mt-2 text-[14px] text-[#B7C4D7]">
                Aquí tienes un resumen de tus clases y estudiantes.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => router.push('/(teacher)/classes' as any)}
                className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-5 py-3"
              >
                <Ionicons name="book-outline" size={18} color="#FFFFFF" />
                <Text className="font-bold text-white">Ir a Mis Clases</Text>
              </Pressable>
              <Pressable className="rounded-2xl border border-[#20375E] bg-[#09162C] p-3">
                <Ionicons name="notifications-outline" size={22} color="#AFC2DB" />
              </Pressable>
              <View className="h-11 w-11 items-center justify-center rounded-full bg-[#5B4BC4]">
                <Text className="font-black text-white">PR</Text>
              </View>
            </View>
          </View>

          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <MetricCard icon="school" title="Clases activas" value={String(subjects.length)} color="#8B5CF6" />
            <MetricCard icon="people" title="Estudiantes" value={String(totals.students)} color="#43D991" />
            <MetricCard icon="clipboard" title="Retos creados" value={String(totals.questions)} color="#3B82F6" />
            <MetricCard icon="trophy" title="Nota media" value={`${totals.averageScore} XP`} color="#F6A64A" />
          </View>

          <View className={isDesktop ? 'mt-8 flex-row gap-6' : 'mt-8 gap-6'}>
            <View className={isDesktop ? 'flex-[1.6]' : ''}>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-[24px] font-black text-white">Clases recientes</Text>
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
                    Añade una asignatura para empezar a gestionar alumnos y retos.
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View className={isDesktop ? 'flex-1 gap-5' : 'gap-5'}>
              <Panel title="Actividad reciente" action="Ver todo">
                <View style={{ gap: 14 }}>
                  {recentActivity.map((item) => (
                    <ActivityRow key={item.title} item={item} />
                  ))}
                </View>
              </Panel>

              <Panel title="Accesos rápidos" action="Gestionar">
                <View style={{ gap: 10 }}>
                  <QuickAction icon="add" label="Crear nueva clase" onPress={() => router.push('/(teacher)/create-subject' as any)} />
                  <QuickAction icon="book-outline" label="Ver Mis Clases" onPress={() => router.push('/(teacher)/classes' as any)} />
                  <QuickAction icon="people-outline" label="Revisar estudiantes" onPress={() => showComingSoon('La vista global de estudiantes')} />
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
          <Text className="font-black text-[#B9A7FF]">{analytics.averageScore} XP</Text>
          <Text className="text-[11px] text-[#8FA7C7]">{analytics.enrolledCount} alumnos</Text>
        </View>
      </Pressable>
    </Link>
  );
}

function Panel({ title, action, children }: { title: string; action: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-black text-white">{title}</Text>
        <Text className="text-[12px] font-semibold text-[#B9A7FF]">{action}</Text>
      </View>
      {children}
    </View>
  );
}

function ActivityRow({ item }: { item: (typeof recentActivity)[number] }) {
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

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-xl border border-[#172A4A] bg-[#0D1D3B] px-4 py-3">
      <Ionicons name={icon} size={18} color="#B9A7FF" />
      <Text className="font-bold text-white">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#AFC2DB" style={{ marginLeft: 'auto' }} />
    </Pressable>
  );
}
