import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';

type Subject = {
  id: number
  name: string
  icon: string | null
  code: string
}

type Enrollment = {
  student_id: string
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
  max_score: number | null
  played_at?: string | null
}

type StudentRow = {
  id: string
  alias: string
  avatar: string | null
  globalPoints: number
  subjectScore: number
  playedAt?: string | null
  joinedAt?: string | null
}

export default function SubjectStudentsScreen() {
  const { subjectId } = useLocalSearchParams();
  const router = useRouter();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const normalizedSubjectId = Array.isArray(subjectId) ? subjectId[0] : subjectId;

  const stats = useMemo(() => {
    const scoredStudents = students.filter((student) => student.subjectScore > 0);
    const totalScore = scoredStudents.reduce((total, student) => total + student.subjectScore, 0);

    return {
      enrolled: students.length,
      played: scoredStudents.length,
      average: scoredStudents.length > 0 ? Math.round(totalScore / scoredStudents.length) : 0,
      best: scoredStudents[0]?.subjectScore ?? 0,
    };
  }, [students]);

  const fetchStudents = useCallback(async () => {
    if (!normalizedSubjectId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [subjectResult, enrollmentsResult, scoresResult] = await Promise.all([
        supabase
          .from('subjects')
          .select('id, name, icon, code')
          .eq('id', normalizedSubjectId)
          .single(),
        supabase
          .from('enrollments')
          .select('student_id, joined_at')
          .eq('subject_id', normalizedSubjectId),
        supabase
          .from('subject_scores')
          .select('student_id, max_score, played_at')
          .eq('subject_id', normalizedSubjectId),
      ]);

      if (subjectResult.error) throw subjectResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (scoresResult.error) throw scoresResult.error;

      setSubject(subjectResult.data);

      const enrollments = (enrollmentsResult.data || []) as Enrollment[];
      const studentIds = enrollments.map((enrollment) => enrollment.student_id).filter(Boolean);

      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, alias, avatar, points')
        .in('id', studentIds);

      if (profilesError) throw profilesError;

      const profilesById = new Map(
        ((profilesData || []) as StudentProfile[]).map((profile) => [profile.id, profile])
      );
      const enrollmentsById = new Map(enrollments.map((enrollment) => [enrollment.student_id, enrollment]));
      const scoresById = new Map(
        ((scoresResult.data || []) as SubjectScore[]).map((score) => [score.student_id, score])
      );

      const rows = studentIds
        .map((studentId) => {
          const profile = profilesById.get(studentId);
          const score = scoresById.get(studentId);
          const enrollment = enrollmentsById.get(studentId);

          return {
            id: studentId,
            alias: profile?.alias || 'Alumno sin perfil',
            avatar: profile?.avatar || null,
            globalPoints: profile?.points ?? 0,
            subjectScore: score?.max_score ?? 0,
            playedAt: score?.played_at,
            joinedAt: enrollment?.joined_at,
          };
        })
        .sort((a, b) => b.subjectScore - a.subjectScore || a.alias.localeCompare(b.alias));

      setStudents(rows);
    } catch (error) {
      console.error('Error fetching subject students:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normalizedSubjectId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchStudents();
    }, [fetchStudents])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-4 text-slate-400">Cargando alumnos...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-900 px-6 pt-12">
      <View className="mb-6 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-4 rounded-full bg-slate-800 p-2">
          <Ionicons name="arrow-back" size={24} color="#cbd5e1" />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text className="text-2xl font-bold text-white" numberOfLines={1}>
            {subject?.icon} {subject?.name || 'Asignatura'}
          </Text>
          <Text className="font-mono text-indigo-400">Código: {subject?.code || '------'}</Text>
        </View>
      </View>

      <View className="mb-5 flex-row flex-wrap gap-3">
        <SummaryCard icon="people-outline" value={String(stats.enrolled)} label="Alumnos inscritos" color="#38bdf8" />
        <SummaryCard icon="checkmark-done-outline" value={String(stats.played)} label="Con puntuación" color="#34d399" />
        <SummaryCard icon="analytics-outline" value={`${stats.average} XP`} label="Nota media" color="#a78bfa" />
        <SummaryCard icon="trophy-outline" value={`${stats.best} XP`} label="Mejor nota" color="#fbbf24" />
      </View>

      <View className="mb-5 flex-row rounded-2xl border border-slate-700 bg-slate-800 p-1">
        <Link href={`/(teacher)/subject/${normalizedSubjectId}`} asChild>
          <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3">
            <Ionicons name="help-circle-outline" size={18} color="#cbd5e1" />
            <Text className="font-bold text-slate-300">Preguntas</Text>
          </Pressable>
        </Link>
        <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3">
          <Ionicons name="people" size={18} color="#FFFFFF" />
          <Text className="font-bold text-white">Alumnos</Text>
        </Pressable>
      </View>

      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-semibold text-slate-400">RANKING DE CLASE</Text>
        <Text className="text-xs font-semibold text-slate-500">Puntos de esta asignatura</Text>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <StudentRankingRow student={item} index={index} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        ListEmptyComponent={
          <View className="mt-10 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-800/50 p-8">
            <Ionicons name="people-outline" size={56} color="#64748b" />
            <Text className="mt-4 text-center text-lg font-bold text-slate-300">Aún no hay alumnos inscritos</Text>
            <Text className="mt-2 text-center text-sm text-slate-500">
              Comparte el código de la asignatura para que tus alumnos puedan unirse.
            </Text>
          </View>
        }
      />
    </View>
  );
}

function SummaryCard({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  value: string
  label: string
  color: string
}) {
  return (
    <View className="min-w-[150px] flex-1 rounded-2xl border border-slate-700 bg-slate-800 p-4">
      <View className="mb-3 h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <Text className="text-2xl font-black text-white">{value}</Text>
      <Text className="mt-1 text-xs font-semibold text-slate-400">{label}</Text>
    </View>
  );
}

function StudentRankingRow({ student, index }: { student: StudentRow; index: number }) {
  const medalColors = ['#fbbf24', '#cbd5e1', '#fb923c'];
  const hasScore = student.subjectScore > 0;

  return (
    <View
      className={`mb-3 flex-row items-center rounded-2xl border p-4 ${
        index === 0 && hasScore ? 'border-amber-400/50 bg-amber-500/10' : 'border-slate-700 bg-slate-800'
      }`}
    >
      <View className="w-12 items-center">
        {index < 3 && hasScore ? (
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: medalColors[index] }}
          >
            <Text className="font-black text-slate-950">{index + 1}</Text>
          </View>
        ) : (
          <Text className="text-lg font-black text-slate-400">{index + 1}</Text>
        )}
      </View>

      <View className="ml-3 h-12 w-12 items-center justify-center rounded-full bg-slate-900">
        <Text className="text-2xl">🧑‍🎓</Text>
      </View>

      <View className="ml-4 min-w-0 flex-1">
        <Text className="text-base font-black text-white" numberOfLines={1}>{student.alias}</Text>
        <Text className="mt-1 text-xs text-slate-400">
          {hasScore ? `Último intento: ${formatDate(student.playedAt)}` : 'Todavía no ha completado el reto'}
        </Text>
      </View>

      <View className="hidden min-w-[120px] items-end md:flex">
        <Text className="text-xs text-slate-500">XP global</Text>
        <Text className="font-bold text-slate-300">{student.globalPoints.toLocaleString()} XP</Text>
      </View>

      <View className="ml-4 items-end">
        <Text className={`text-2xl font-black ${hasScore ? 'text-indigo-300' : 'text-slate-500'}`}>
          {student.subjectScore.toLocaleString()}
        </Text>
        <Text className="text-xs font-semibold text-slate-500">XP clase</Text>
      </View>
    </View>
  );
}

function formatDate(date?: string | null) {
  if (!date) return 'sin fecha';

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}
