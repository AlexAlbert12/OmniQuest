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
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import TeacherSidebar from '../../components/TeacherSidebar';

type Subject = {
  id: number
  name: string
}

type Enrollment = {
  student_id: string
  subject_id: number
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
  max_score: number | null
  played_at?: string | null
}

type StudentRow = {
  id: string
  alias: string
  handle: string
  globalPoints: number
  subjectScore: number
  averageScore: number
  challenges: number
  progress: number
  status: 'active' | 'inactive' | 'needs_help'
  subjectIds: number[]
}

export default function TeacherStudentsScreen() {
  const { width } = useWindowDimensions();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | 'all'>('all');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDesktop = width >= 1080;
  const isWide = width >= 900;

  const visibleStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    let rows = students;

    if (selectedSubjectId !== 'all') {
      rows = rows.filter((student) => student.subjectIds.includes(selectedSubjectId));
    }

    if (normalizedSearch) {
      rows = rows.filter((student) => `${student.alias} ${student.handle}`.toLowerCase().includes(normalizedSearch));
    }

    return rows.sort((a, b) => b.subjectScore - a.subjectScore || b.globalPoints - a.globalPoints);
  }, [search, selectedSubjectId, students]);

  const stats = useMemo(() => {
    const total = visibleStudents.length;
    const active = visibleStudents.filter((student) => student.status === 'active').length;
    const totalScore = visibleStudents.reduce((sum, student) => sum + student.subjectScore, 0);
    const top = visibleStudents[0];

    return {
      total,
      active,
      averageXp: total > 0 ? Math.round(totalScore / total) : 0,
      topName: top?.alias || '-',
      topScore: top?.subjectScore || 0,
      averageProgress: total > 0 ? Math.round(visibleStudents.reduce((sum, student) => sum + student.progress, 0) / total) : 0,
      completedChallenges: visibleStudents.reduce((sum, student) => sum + student.challenges, 0),
    };
  }, [visibleStudents]);

  const needsAttention = useMemo(
    () => visibleStudents.filter((student) => student.progress < 40 || student.averageScore < 6).slice(0, 3),
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
        .order('created_at', { ascending: false });

      if (subjectsError) throw subjectsError;

      const teacherSubjects = (subjectsData || []) as Subject[];
      setSubjects(teacherSubjects);

      const subjectIds = teacherSubjects.map((subject) => subject.id);
      if (subjectIds.length === 0) {
        setStudents([]);
        return;
      }

      const [enrollmentsResult, scoresResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('student_id, subject_id, joined_at')
          .in('subject_id', subjectIds),
        supabase
          .from('subject_scores')
          .select('student_id, subject_id, max_score, played_at')
          .in('subject_id', subjectIds),
      ]);

      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;

      const enrollments = (enrollmentsResult.data || []) as Enrollment[];
      const scores = (scoresResult.data || []) as SubjectScore[];
      const studentIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.student_id).filter(Boolean)));

      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, alias, avatar, points')
        .in('id', studentIds);

      if (profilesError) throw profilesError;

      const profilesById = new Map(((profilesData || []) as StudentProfile[]).map((profile) => [profile.id, profile]));
      const enrollmentsByStudent = groupBy(enrollments, 'student_id');
      const scoresByStudent = groupBy(scores, 'student_id');

      const rows = studentIds.map((studentId) => {
        const profile = profilesById.get(studentId);
        const studentEnrollments = enrollmentsByStudent.get(studentId) || [];
        const studentScores = scoresByStudent.get(studentId) || [];
        const scoreValues = studentScores.map((score) => score.max_score ?? 0);
        const bestScore = Math.max(0, ...scoreValues);
        const averageXp = scoreValues.length > 0
          ? Math.round(scoreValues.reduce((total, score) => total + score, 0) / scoreValues.length)
          : 0;
        const progress = studentEnrollments.length > 0
          ? Math.round((studentScores.filter((score) => (score.max_score ?? 0) > 0).length / studentEnrollments.length) * 100)
          : 0;
        const averageScore = Math.min(10, Math.max(0, Number((bestScore / 250).toFixed(1))));

        return {
          id: studentId,
          alias: profile?.alias || 'Alumno sin perfil',
          handle: `@${(profile?.alias || 'alumno').toLowerCase().replace(/\s+/g, '')}`,
          globalPoints: profile?.points ?? 0,
          subjectScore: averageXp,
          averageScore,
          challenges: studentScores.length,
          progress,
          status: progress >= 60 ? 'active' : progress >= 35 ? 'inactive' : 'needs_help',
          subjectIds: studentEnrollments.map((enrollment) => enrollment.subject_id),
        } satisfies StudentRow;
      });

      setStudents(rows);
    } catch (error: any) {
      console.error('Error cargando estudiantes:', error.message);
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

  const showComingSoon = (feature: string) => {
    showAlert('Próximamente', `${feature} estará disponible en una próxima iteración.`);
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
            onComingSoon={showComingSoon}
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
                <Text className="mb-3 text-[#9FD6FF]" style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}>
                  OmniQuest
                </Text>
              ) : null}
              <View className="flex-row items-center gap-3">
                <Text className="text-[28px] font-black text-white">Estudiantes</Text>
                <Ionicons name="people-outline" size={25} color="#58B5FF" />
              </View>
              <Text className="mt-2 text-[13px] text-[#B7C4D7]">
                Gestiona y haz seguimiento del progreso de tus estudiantes.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <SubjectSelect
                subjects={subjects}
                selectedSubjectId={selectedSubjectId}
                onSelect={setSelectedSubjectId}
              />
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
            <MetricCard icon="people" title="Total estudiantes" value={String(stats.total)} trend="2 nuevos esta semana" color="#8B5CF6" />
            <MetricCard icon="checkmark-circle" title="Activos esta semana" value={String(stats.active)} trend="12% vs semana pasada" color="#34D399" />
            <MetricCard icon="star" title="XP media de clase" value={stats.averageXp.toLocaleString()} trend="8% vs semana pasada" color="#3B82F6" />
            <MetricCard icon="trophy" title="Top de la clase" value={stats.topName} detail={`${stats.topScore.toLocaleString()} XP`} color="#F6A64A" />
          </View>

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <View className={isDesktop ? 'flex-[1.65]' : ''}>
              <View className="mb-4 flex-row flex-wrap items-center gap-3">
                <View className="h-12 min-w-[250px] flex-1 flex-row items-center rounded-xl border border-[#20375E] bg-[#09162C] px-4">
                  <TextInput
                    className="min-w-0 flex-1 text-white"
                    placeholder="Buscar estudiante..."
                    placeholderTextColor="#8FA7C7"
                    value={search}
                    onChangeText={setSearch}
                  />
                  <Ionicons name="search-outline" size={20} color="#AFC2DB" />
                </View>
                <FilterButton label="Todos los estados" icon="chevron-down" />
                <FilterButton label="Ordenar por: XP" icon="chevron-down" />
                <Pressable onPress={() => showComingSoon('Exportar estudiantes')} className="h-12 flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4">
                  <Ionicons name="download-outline" size={16} color="#AFC2DB" />
                  <Text className="font-semibold text-[#DDE7F4]">Exportar</Text>
                </Pressable>
              </View>

              <View className="overflow-hidden rounded-2xl border border-[#1A3155] bg-[#09162C]">
                <View className="hidden flex-row border-b border-[#1A3155] bg-[#10164A] px-4 py-4 md:flex">
                  <TableHeader label="Estudiante" flex={1.6} />
                  <TableHeader label="Progreso general" flex={1.2} />
                  <TableHeader label="XP" flex={0.65} />
                  <TableHeader label="Preguntas" flex={0.5} />
                  <TableHeader label="Nota media" flex={0.7} />
                  <TableHeader label="Estado" flex={0.9} />
                  <TableHeader label="Acciones" flex={0.65} align="right" />
                </View>

                {visibleStudents.map((student, index) => (
                  <StudentTableRow key={student.id} student={student} index={index} onComingSoon={showComingSoon} />
                ))}

                {visibleStudents.length === 0 ? (
                  <View className="items-center justify-center p-8">
                    <Ionicons name="people-outline" size={48} color="#60799C" />
                    <Text className="mt-3 font-bold text-white">No hay estudiantes para mostrar</Text>
                    <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">Cambia el filtro o comparte el código de una clase.</Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-4 flex-row flex-wrap items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#6D5AF6]">
                  <Text className="font-black text-white">1</Text>
                </View>
                <View className="h-8 w-8 items-center justify-center rounded-lg border border-[#20375E] bg-[#09162C]">
                  <Text className="text-[#AFC2DB]">2</Text>
                </View>
                <View className="h-8 w-8 items-center justify-center rounded-lg border border-[#20375E] bg-[#09162C]">
                  <Text className="text-[#AFC2DB]">3</Text>
                </View>
                <Text className="ml-4 text-[12px] text-[#8FA7C7]">
                  Mostrando {Math.min(visibleStudents.length, 7)} de {visibleStudents.length} estudiantes
                </Text>
              </View>
            </View>

            <View className={isDesktop ? 'flex-1 gap-4' : 'gap-4'}>
              <Panel title="Resumen de progreso">
                <View className="flex-row items-center gap-5">
                  <View className="h-28 w-28 items-center justify-center rounded-full border-[8px] border-[#8B5CF6] bg-[#07162E]">
                    <Text className="text-[26px] font-black text-white">{stats.averageProgress}%</Text>
                    <Text className="text-center text-[9px] text-[#B7C4D7]">Progreso medio</Text>
                  </View>
                  <View className="min-w-0 flex-1" style={{ gap: 9 }}>
                    <LegendRow color="#34D399" label="Excelente" value={visibleStudents.filter((s) => s.progress >= 80).length} total={stats.total} />
                    <LegendRow color="#3B82F6" label="Bueno" value={visibleStudents.filter((s) => s.progress >= 50 && s.progress < 80).length} total={stats.total} />
                    <LegendRow color="#F6A64A" label="Regular" value={visibleStudents.filter((s) => s.progress >= 30 && s.progress < 50).length} total={stats.total} />
                    <LegendRow color="#EF4444" label="Necesita apoyo" value={visibleStudents.filter((s) => s.progress < 30).length} total={stats.total} />
                  </View>
                </View>
              </Panel>

              <Panel title="Actividad esta semana" action="Ver todo">
                <ProgressStat label="Estudiantes activos" value={stats.active} total={Math.max(stats.total, 1)} color="#8B5CF6" />
                <ProgressStat label="Preguntas completadas" value={stats.completedChallenges} total={Math.max(stats.completedChallenges + 6, 1)} color="#7C5CFF" />
                <ProgressStat label="XP ganada" value={stats.averageXp} total={Math.max(stats.averageXp + 650, 1)} color="#3B82F6" />
              </Panel>

              <Panel title="Estudiantes que necesitan atención" action="Ver todo">
                <View style={{ gap: 12 }}>
                  {needsAttention.map((student) => (
                    <AttentionRow key={student.id} student={student} />
                  ))}
                  {needsAttention.length === 0 ? (
                    <Text className="text-[13px] text-[#B7C4D7]">No hay estudiantes en riesgo ahora mismo.</Text>
                  ) : null}
                </View>
              </Panel>

              <View className="rounded-2xl border border-[#31266C] bg-[#1A1751] p-5">
                <View className="flex-row items-start gap-3">
                  <Ionicons name="bulb" size={24} color="#FBBF24" />
                  <View className="min-w-0 flex-1">
                    <Text className="font-black text-white">Consejo docente</Text>
                    <Text className="mt-2 text-[12px] leading-5 text-[#B7C4D7]">
                      Revisa las actividades pendientes para ayudar a tus estudiantes a mejorar.
                    </Text>
                    <Pressable className="mt-3 flex-row items-center gap-2">
                      <Text className="text-[12px] font-bold text-[#B9A7FF]">Ver actividades pendientes</Text>
                      <Ionicons name="arrow-forward" size={13} color="#B9A7FF" />
                    </Pressable>
                  </View>
                </View>
              </View>
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
  detail,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  value: string
  trend?: string
  detail?: string
  color: string
}) {
  return (
    <View className="min-w-[190px] flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="flex-row items-center gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${color}30` }}>
          <Ionicons name={icon} size={27} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] text-[#B7C4D7]">{title}</Text>
          <Text className="mt-1 text-[25px] font-black text-white" numberOfLines={1}>{value}</Text>
          {detail ? <Text className="mt-1 text-[12px] font-bold" style={{ color }}>{detail}</Text> : null}
        </View>
      </View>
      {trend ? (
        <View className="mt-3 flex-row items-center gap-2">
          <Ionicons name="arrow-up" size={13} color="#58E28B" />
          <Text className="text-[12px] font-semibold text-[#58E28B]">{trend}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SubjectSelect({
  subjects,
  selectedSubjectId,
  onSelect,
}: {
  subjects: Subject[]
  selectedSubjectId: number | 'all'
  onSelect: (value: number | 'all') => void
}) {
  const selectedIndex = selectedSubjectId === 'all'
    ? -1
    : subjects.findIndex((subject) => subject.id === selectedSubjectId);
  const nextSubject = selectedIndex >= subjects.length - 1 ? 'all' : subjects[selectedIndex + 1]?.id ?? 'all';
  const label = selectedSubjectId === 'all'
    ? 'Todas'
    : subjects.find((subject) => subject.id === selectedSubjectId)?.name || 'Todas';

  return (
    <Pressable
      onPress={() => onSelect(nextSubject)}
      className="h-12 flex-row items-center gap-3 rounded-xl border border-[#20375E] bg-[#09162C] px-4"
    >
      <Text className="font-bold text-[#DDE7F4]">{label}</Text>
      <Ionicons name="chevron-down" size={16} color="#AFC2DB" />
    </Pressable>
  );
}

function FilterButton({ label, icon }: { label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable className="h-12 flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4">
      <Text className="font-semibold text-[#DDE7F4]">{label}</Text>
      <Ionicons name={icon} size={16} color="#AFC2DB" />
    </Pressable>
  );
}

function TableHeader({ label, flex, align = 'left' }: { label: string; flex: number; align?: 'left' | 'right' }) {
  return (
    <Text className={`text-[11px] font-black text-[#B9A7FF] ${align === 'right' ? 'text-right' : ''}`} style={{ flex }}>
      {label}
    </Text>
  );
}

function StudentTableRow({
  student,
  index,
  onComingSoon,
}: {
  student: StudentRow
  index: number
  onComingSoon: (feature: string) => void
}) {
  const status = getStatusMeta(student.status);

  return (
    <View className="flex-row flex-wrap items-center gap-y-4 border-b border-[#172A4A] px-4 py-4">
      <View className="min-w-[210px] flex-[1.6] flex-row items-center gap-3">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-[#F6A64A]">
          <Text className="text-[12px] font-black text-white">{index + 1}</Text>
        </View>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#17315E]">
          <Ionicons name="person" size={18} color="#9FD6FF" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black text-white" numberOfLines={1}>{student.alias}</Text>
          <Text className="text-[11px] text-[#8FA7C7]" numberOfLines={1}>{student.handle}</Text>
        </View>
      </View>

      <View className="min-w-[150px] flex-[1.2] flex-row items-center gap-3">
        <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${student.progress}%` }} />
        </View>
        <Text className="w-10 text-[12px] font-bold text-white">{student.progress}%</Text>
      </View>

      <View className="min-w-[80px] flex-[0.65]">
        <Text className="font-bold text-white">{student.subjectScore.toLocaleString()}</Text>
        <Text className={`text-[10px] ${student.subjectScore >= 1000 ? 'text-[#58E28B]' : 'text-[#EF4444]'}`}>
          {student.subjectScore >= 1000 ? '↑' : '↓'}
        </Text>
      </View>

      <Text className="min-w-[55px] flex-[0.5] font-bold text-white">{student.challenges}</Text>
      <View className="min-w-[70px] flex-[0.7]">
        <View className="self-start rounded-md border px-2 py-1" style={{ borderColor: getGradeColor(student.averageScore) }}>
          <Text className="text-[12px] font-black" style={{ color: getGradeColor(student.averageScore) }}>
            {student.averageScore.toFixed(1)}
          </Text>
        </View>
      </View>
      <View className="min-w-[100px] flex-[0.9] flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
        <Text className="text-[12px]" style={{ color: status.color }}>{status.label}</Text>
      </View>
      <View className="min-w-[75px] flex-[0.65] flex-row justify-end gap-2">
        <Pressable onPress={() => onComingSoon('Mensajes al estudiante')} className="h-8 w-8 items-center justify-center rounded-lg bg-[#111E3C]">
          <Ionicons name="chatbubble-outline" size={15} color="#B9A7FF" />
        </Pressable>
        <Pressable onPress={() => onComingSoon('Acciones del estudiante')} className="h-8 w-8 items-center justify-center rounded-lg bg-[#111E3C]">
          <Ionicons name="ellipsis-vertical" size={15} color="#AFC2DB" />
        </Pressable>
      </View>
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

function AttentionRow({ student }: { student: StudentRow }) {
  const percent = Math.max(10, student.progress);

  return (
    <View className="flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#17315E]">
        <Ionicons name="person" size={16} color="#9FD6FF" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-bold text-white" numberOfLines={1}>{student.alias}</Text>
        <Text className="text-[11px] text-[#B7C4D7]">{student.progress < 25 ? 'Bajo progreso' : 'Baja participación'}</Text>
      </View>
      <View className="rounded-md border border-[#F59E0B] px-2 py-1">
        <Text className="text-[11px] font-black text-[#F59E0B]">{percent}%</Text>
      </View>
    </View>
  );
}

function getGradeColor(value: number) {
  if (value >= 8) return '#34D399';
  if (value >= 6) return '#F59E0B';
  return '#EF4444';
}

function getStatusMeta(status: StudentRow['status']) {
  if (status === 'active') return { label: 'Activo', color: '#58E28B' };
  if (status === 'needs_help') return { label: 'Necesita apoyo', color: '#F59E0B' };
  return { label: 'Inactivo', color: '#8FA7C7' };
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
