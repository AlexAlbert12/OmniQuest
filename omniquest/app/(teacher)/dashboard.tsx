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
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

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
}

const recentActivity = [
  {
    icon: 'trophy',
    color: '#8B5CF6',
    title: 'Los alumnos completaron el reto "Verbos en pasado"',
    time: 'Hace 2h',
  },
  {
    icon: 'checkmark',
    color: '#34D399',
    title: 'Mateo G. respondió correctamente 10 preguntas',
    time: 'Hace 4h',
  },
  {
    icon: 'people',
    color: '#3B82F6',
    title: 'Nueva inscripción en una clase',
    time: 'Hace 6h',
  },
  {
    icon: 'radio-button-on',
    color: '#F6A64A',
    title: 'Una clase alcanzó el 80% de progreso',
    time: 'Ayer',
  },
] as const

const upcomingChallenges = [
  {
    icon: 'clipboard-outline',
    color: '#3B82F6',
    title: 'Repaso de Gramática',
    detail: 'Inglés',
    date: '25 May',
  },
  {
    icon: 'calculator-outline',
    color: '#34D399',
    title: 'Ecuaciones de 1er grado',
    detail: 'Matemáticas',
    date: '28 May',
  },
] as const

export default function TeacherDashboard() {
  const { width } = useWindowDimensions();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [analyticsBySubject, setAnalyticsBySubject] = useState<Record<number, SubjectAnalytics>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const isDesktop = width >= 1080;
  const isWide = width >= 860;

  const filteredSubjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return subjects;

    return subjects.filter((subject) =>
      `${subject.name} ${subject.description || ''} ${subject.code}`.toLowerCase().includes(normalizedSearch)
    );
  }, [search, subjects]);

  const averageClassScore = calculateAverageClassScore(analyticsBySubject);
  const totalStudents = Object.values(analyticsBySubject).reduce((total, item) => total + item.enrolledCount, 0);
  const totalPlayed = Object.values(analyticsBySubject).reduce((total, item) => total + item.playedCount, 0);

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

      const [enrollmentsResult, scoresResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('subject_id')
          .in('subject_id', subjectIds),
        supabase
          .from('subject_scores')
          .select('subject_id, max_score')
          .in('subject_id', subjectIds),
      ]);

      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;

      const nextAnalytics: Record<number, SubjectAnalytics> = {};
      subjectIds.forEach((subjectId) => {
        const subjectEnrollments = enrollmentsResult.data?.filter((item) => item.subject_id === subjectId) || [];
        const subjectScores = scoresResult.data?.filter(
          (item) => item.subject_id === subjectId && typeof item.max_score === 'number'
        ) || [];
        const totalScore = subjectScores.reduce((total, item) => total + (item.max_score ?? 0), 0);

        nextAnalytics[subjectId] = {
          enrolledCount: subjectEnrollments.length,
          playedCount: subjectScores.length,
          averageScore: subjectScores.length > 0 ? Math.round(totalScore / subjectScores.length) : 0,
        };
      });
      setAnalyticsBySubject(nextAnalytics);
    } catch (error: any) {
      console.error('Error cargando asignaturas:', error.message);
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

  const executeDeleteSubject = async (id: number) => {
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;

      setSubjects((currentSubjects) => currentSubjects.filter((subject) => subject.id !== id));
      setAnalyticsBySubject((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch (error: any) {
      const message = `Error al borrar asignatura: ${error.message}`;
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleDeleteSubject = (id: number, name: string) => {
    const message = `¿Estás seguro de borrar "${name}"? Se eliminarán todas sus preguntas y datos asociados permanentemente.`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) executeDeleteSubject(id);
      return;
    }

    Alert.alert('Confirmar borrado', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar todo', style: 'destructive', onPress: () => executeDeleteSubject(id) },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando panel del profesor...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar
            subjectsCount={subjects.length}
            onSignOut={() => supabase.auth.signOut()}
            onCreateSubject={() => router.push('/(teacher)/create-subject' as any)}
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
              <Text className="mt-2 text-[14px] text-[#B7C4D7]">Aquí tienes un resumen de tus clases y estudiantes.</Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => router.push('/(student)/home' as any)}
                className="hidden flex-row items-center gap-2 rounded-2xl border border-[#20375E] bg-[#09162C] px-4 py-3 md:flex"
              >
                <Ionicons name="eye-outline" size={18} color="#B9A7FF" />
                <Text className="font-semibold text-[#DDE7F4]">Ver como alumno</Text>
              </Pressable>
              <Pressable className="rounded-2xl border border-[#20375E] bg-[#09162C] p-3">
                <Ionicons name="notifications-outline" size={22} color="#AFC2DB" />
                <View className="absolute right-2 top-2 h-5 w-5 items-center justify-center rounded-full bg-[#EF4444]">
                  <Text className="text-[10px] font-black text-white">3</Text>
                </View>
              </Pressable>
              <Pressable className="flex-row items-center gap-3 rounded-2xl">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-[#5B4BC4]">
                  <Text className="font-black text-white">PR</Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#AFC2DB" />
              </Pressable>
            </View>
          </View>

          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <MetricCard
              icon="people"
              title="Clases activas"
              value={String(subjects.length)}
              trend={`${subjects.length > 0 ? '1 más' : 'Sin cambios'} que el mes pasado`}
              color="#8B5CF6"
            />
            <MetricCard
              icon="people"
              title="Estudiantes"
              value={String(totalStudents)}
              trend={`${totalStudents > 0 ? totalStudents : 0} esta semana`}
              color="#43D991"
            />
            <MetricCard
              icon="trophy"
              title="Nota media de clase"
              value={`${averageClassScore} XP`}
              trend={averageClassScore > 0 ? '12% esta semana' : 'Sin notas todavía'}
              color="#3B82F6"
            />
            <MetricCard
              icon="radio-button-on"
              title="Intentos puntuados"
              value={String(totalPlayed)}
              trend={totalPlayed > 0 ? '100% esta semana' : 'Sin intentos'}
              color="#F6A64A"
            />
          </View>

          <View className={isDesktop ? 'mt-8 flex-row gap-6' : 'mt-8 gap-6'}>
            <View className={isDesktop ? 'flex-[1.85]' : ''}>
              <View className="mb-5 flex-row flex-wrap items-center justify-between gap-4">
                <Text className="text-[26px] font-black text-white">Tus clases</Text>
                <View className="flex-row flex-wrap items-center gap-3">
                  <View className="h-12 min-w-[260px] flex-row items-center rounded-2xl border border-[#20375E] bg-[#09162C] px-4">
                    <TextInput
                      className="min-w-0 flex-1 text-white"
                      placeholder="Buscar clase..."
                      placeholderTextColor="#8FA7C7"
                      value={search}
                      onChangeText={setSearch}
                    />
                    <Ionicons name="search-outline" size={21} color="#AFC2DB" />
                  </View>
                  <Pressable className="h-12 flex-row items-center gap-2 rounded-2xl border border-[#20375E] bg-[#09162C] px-4">
                    <Text className="font-semibold text-[#DDE7F4]">Ordenar por</Text>
                    <Ionicons name="chevron-down" size={17} color="#AFC2DB" />
                  </Pressable>
                  <View className="h-12 flex-row rounded-2xl border border-[#20375E] bg-[#09162C] p-1">
                    <View className="items-center justify-center rounded-xl bg-[#4F46E5] px-3">
                      <Ionicons name="grid" size={20} color="#FFFFFF" />
                    </View>
                    <View className="items-center justify-center px-3">
                      <Ionicons name="list" size={20} color="#AFC2DB" />
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ gap: 16 }}>
                {filteredSubjects.map((subject, index) => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    index={index}
                    analytics={analyticsBySubject[subject.id] || { enrolledCount: 0, playedCount: 0, averageScore: 0 }}
                    onDelete={() => handleDeleteSubject(subject.id, subject.name)}
                  />
                ))}
              </View>

              {filteredSubjects.length === 0 ? <EmptySubjects /> : null}

              <Pressable
                onPress={() => router.push('/(teacher)/create-subject' as any)}
                className="mt-5 flex-row items-center justify-center gap-6 rounded-3xl border border-dashed border-[#5364F5] bg-[#07162E] px-6 py-12"
                style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
              >
                <View className="h-20 w-20 items-center justify-center rounded-full border-4 border-[#4F46E5] bg-[#251F63]">
                  <Ionicons name="add" size={42} color="#9B8CFF" />
                </View>
                <View className="min-w-0">
                  <Text className="text-[20px] font-black text-white">Crear nueva clase</Text>
                  <Text className="mt-2 text-[#B7C4D7]">Añade una nueva asignatura y comienza</Text>
                </View>
              </Pressable>
            </View>

            <View className={isDesktop ? 'flex-1 gap-5' : 'gap-5'}>
              <SidePanel title="Actividad reciente" action="Ver todo">
                <View style={{ gap: 16 }}>
                  {recentActivity.map((item, index) => (
                    <ActivityRow key={item.title} item={item} last={index === recentActivity.length - 1} />
                  ))}
                </View>
              </SidePanel>

              <SidePanel title="Próximos retos" action="Ver todos">
                <View style={{ gap: 10 }}>
                  {upcomingChallenges.map((item) => (
                    <ChallengeRow key={item.title} item={item} />
                  ))}
                </View>
                <Pressable
                  onPress={() => subjects[0] ? router.push(`/(teacher)/subject/add-question?subjectId=${subjects[0].id}` as any) : router.push('/(teacher)/create-subject' as any)}
                  className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] py-3"
                >
                  <Ionicons name="add" size={20} color="#9B6CFF" />
                  <Text className="font-bold text-[#B9A7FF]">Crear nuevo reto</Text>
                </Pressable>
              </SidePanel>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function TeacherSidebar({
  subjectsCount,
  onSignOut,
  onCreateSubject,
}: {
  subjectsCount: number
  onSignOut: () => void
  onCreateSubject: () => void
}) {
  const navItems: { label: string; icon: keyof typeof Ionicons.glyphMap; active?: boolean; onPress?: () => void }[] = [
    { label: 'Inicio', icon: 'home-outline', active: true },
    { label: 'Mis Clases', icon: 'cube-outline' },
    { label: 'Estudiantes', icon: 'people-outline' },
    { label: 'Retos', icon: 'checkmark-circle-outline', onPress: onCreateSubject },
    { label: 'Actividades', icon: 'calendar-outline' },
    { label: 'Informes', icon: 'analytics-outline' },
    { label: 'Recursos', icon: 'archive-outline' },
    { label: 'Configuración', icon: 'settings-outline' },
  ];

  return (
    <View className="w-[250px] border-r border-[#183052] bg-[#041024] px-5 py-8">
      <View className="mb-8 flex-row items-center gap-2">
        <Text className="text-[#9B8CFF]" style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}>
          OmniQuest
        </Text>
        <Ionicons name="rocket" size={22} color="#7FCBFF" />
      </View>

      <View style={{ gap: 8 }}>
        {navItems.map((item) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            className={`flex-row items-center gap-4 rounded-xl px-4 py-4 ${
              item.active ? 'border border-[#6D5AF6] bg-[#1A1E55]' : ''
            }`}
          >
            <Ionicons name={item.icon} size={22} color={item.active ? '#9B8CFF' : '#AFC2DB'} />
            <Text className={`text-[15px] font-semibold ${item.active ? 'text-white' : 'text-[#C4D0E3]'}`}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-auto gap-5">
        <View className="rounded-2xl border border-[#183052] bg-[#09162C] p-4">
          <View className="mb-3 flex-row items-center gap-3">
            <Ionicons name="sparkles" size={22} color="#FBBF24" />
            <Text className="font-black text-white">Plan Pro</Text>
          </View>
          <Text className="text-[13px] leading-5 text-[#B7C4D7]">
            Desbloquea más herramientas y contenidos para tus clases.
          </Text>
          <Pressable className="mt-4 rounded-lg bg-[#5A46D8] px-4 py-3">
            <Text className="text-center font-bold text-white">Mejorar plan</Text>
          </Pressable>
        </View>

        <View className="rounded-2xl border border-[#183052] bg-[#09162C] p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#5B4BC4]">
              <Text className="font-black text-white">PR</Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-black text-white">Profesor</Text>
              <Text className="text-[12px] text-[#B7C4D7]">Nivel {Math.max(1, subjectsCount + 6)}</Text>
            </View>
          </View>
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13294C]">
            <View className="h-full rounded-full bg-[#8B5CF6]" style={{ width: '65%' }} />
          </View>
          <Text className="mt-2 text-[11px] text-[#AFC2DB]">2,450 / 3,000 XP</Text>
          <Pressable onPress={onSignOut} className="mt-4 flex-row items-center gap-2">
            <Ionicons name="log-out-outline" size={16} color="#F87171" />
            <Text className="text-[12px] font-semibold text-[#FCA5A5]">Cerrar sesión</Text>
          </Pressable>
        </View>
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
    <View className="min-w-[220px] flex-1 overflow-hidden rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="absolute bottom-4 right-4 h-16 w-28 rounded-full opacity-20" style={{ backgroundColor: color }} />
      <View className="flex-row items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${color}30` }}>
          <Ionicons name={icon} size={30} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] text-[#B7C4D7]">{title}</Text>
          <Text className="mt-2 text-[28px] font-black text-white">{value}</Text>
        </View>
      </View>
      <View className="mt-4 flex-row items-center gap-2">
        <Ionicons name="arrow-up" size={14} color="#58E28B" />
        <Text className="text-[13px] font-semibold text-[#58E28B]">{trend}</Text>
      </View>
    </View>
  );
}

function SubjectCard({
  subject,
  index,
  analytics,
  onDelete,
}: {
  subject: Subject
  index: number
  analytics: SubjectAnalytics
  onDelete: () => void
}) {
  const fallbackColors = ['#8B5CF6', '#3B82F6', '#34D399', '#F6A64A'];
  const color = subject.theme_color || fallbackColors[index % fallbackColors.length];
  const progress = analytics.enrolledCount > 0
    ? Math.round((analytics.playedCount / analytics.enrolledCount) * 100)
    : 0;

  return (
    <View
      className={`flex-row flex-wrap items-center gap-5 rounded-2xl border bg-[#09162C] p-6 ${
        index === 0 ? 'border-[#6D5AF6]' : 'border-[#1A3155]'
      }`}
    >
      <Link href={`/(teacher)/subject/${subject.id}`} asChild>
        <Pressable className="min-w-[300px] flex-1 flex-row items-center gap-5">
          <View
            className="h-24 w-24 items-center justify-center rounded-2xl border"
            style={{ backgroundColor: `${color}28`, borderColor: `${color}66` }}
          >
            {subject.icon ? (
              <Text className="text-[46px]">{subject.icon}</Text>
            ) : (
              <Ionicons name={index % 2 === 0 ? 'book-outline' : 'calculator-outline'} size={46} color={color} />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[24px] font-black text-white" numberOfLines={1}>{subject.name}</Text>
            <View className="mt-2 flex-row items-center gap-2">
              <Text className="text-[#B7C4D7]">Código:</Text>
              <View className="rounded-full bg-[#111E3C] px-3 py-1">
                <Text className="font-mono font-bold text-[#9B8CFF]">{subject.code}</Text>
              </View>
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <SmallPill icon="people-outline" label={`${analytics.enrolledCount} alumnos`} color="#38bdf8" />
              <SmallPill icon="trophy-outline" label={`${analytics.averageScore} XP media`} color="#B9A7FF" />
              <SmallPill icon="checkmark-circle-outline" label={`${analytics.playedCount} con nota`} color="#58E28B" />
            </View>
          </View>
        </Pressable>
      </Link>

      <View className="ml-auto flex-row items-center gap-5">
        <ProgressRing progress={progress} color={color} />
        <View className="items-center">
          <Text className="text-[13px] text-[#B7C4D7]">Progreso medio</Text>
        </View>
        <View className="flex-row gap-2">
          <Link href={`/(teacher)/subject/students?subjectId=${subject.id}`} asChild>
            <Pressable className="h-12 w-12 items-center justify-center rounded-xl border border-[#20375E] bg-[#111E3C]">
              <Ionicons name="people-outline" size={20} color="#38bdf8" />
            </Pressable>
          </Link>
          <Pressable onPress={onDelete} className="h-12 w-12 items-center justify-center rounded-xl border border-[#20375E] bg-[#111E3C]">
            <Ionicons name="ellipsis-vertical" size={20} color="#AFC2DB" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SmallPill({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  color: string
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-[#20375E] bg-[#07162E] px-3 py-2">
      <Ionicons name={icon} size={14} color={color} />
      <Text className="text-[12px] font-semibold text-[#DDE7F4]">{label}</Text>
    </View>
  );
}

function ProgressRing({ progress, color }: { progress: number; color: string }) {
  return (
    <View
      className="h-24 w-24 items-center justify-center rounded-full border-[7px] bg-[#07162E]"
      style={{ borderColor: progress > 0 ? color : '#1A3155' }}
    >
      <Text className="text-[22px] font-black text-white">{progress}%</Text>
    </View>
  );
}

function EmptySubjects() {
  return (
    <View className="items-center justify-center rounded-2xl border border-dashed border-[#20375E] bg-[#09162C] p-8">
      <Ionicons name="school-outline" size={58} color="#60799C" />
      <Text className="mt-4 text-center text-lg font-bold text-white">No hay clases con ese filtro</Text>
      <Text className="mt-2 text-center text-sm text-[#8FA7C7]">Prueba otra búsqueda o crea una nueva clase.</Text>
    </View>
  );
}

function SidePanel({
  title,
  action,
  children,
}: {
  title: string
  action: string
  children: React.ReactNode
}) {
  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-[17px] font-black text-white">{title}</Text>
        <Pressable>
          <Text className="font-semibold text-[#B9A7FF]">{action}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function ActivityRow({ item, last }: { item: (typeof recentActivity)[number]; last: boolean }) {
  return (
    <View className={`flex-row items-start gap-4 ${last ? '' : 'border-b border-[#172A4A] pb-4'}`}>
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${item.color}33` }}>
        <Ionicons name={item.icon} size={19} color={item.color} />
      </View>
      <Text className="min-w-0 flex-1 text-[14px] leading-5 text-white">{item.title}</Text>
      <Text className="text-[12px] text-[#8FA7C7]">{item.time}</Text>
    </View>
  );
}

function ChallengeRow({ item }: { item: (typeof upcomingChallenges)[number] }) {
  return (
    <View className="flex-row items-center gap-4 rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-3">
      <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${item.color}33` }}>
        <Ionicons name={item.icon} size={22} color={item.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-black text-white" numberOfLines={1}>{item.title}</Text>
        <Text className="mt-1 text-[12px] text-[#B7C4D7]" numberOfLines={1}>{item.detail}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Ionicons name="calendar-outline" size={16} color="#AFC2DB" />
        <Text className="text-[12px] font-semibold text-white">{item.date}</Text>
      </View>
    </View>
  );
}

function calculateAverageClassScore(analyticsBySubject: Record<number, SubjectAnalytics>) {
  const scoredSubjects = Object.values(analyticsBySubject).filter((item) => item.playedCount > 0);
  if (scoredSubjects.length === 0) return 0;

  const weightedTotal = scoredSubjects.reduce(
    (total, item) => total + item.averageScore * item.playedCount,
    0
  );
  const totalScores = scoredSubjects.reduce((total, item) => total + item.playedCount, 0);

  return totalScores > 0 ? Math.round(weightedTotal / totalScores) : 0;
}
