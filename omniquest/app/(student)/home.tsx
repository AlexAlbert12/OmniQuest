import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter, Link, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function StudentHome() {
  const [inviteCode, setInviteCode] = useState('');
  const [enrolledSubjects, setEnrolledSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const router = useRouter();

  const fetchMySubjects = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data, error } = await supabase
        .from('enrollments')
        .select('*, subjects(*)')
        .eq('student_id', session.session.user.id)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      setEnrolledSubjects(data?.map(e => e.subjects) || []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMySubjects();
    }, [])
  );

  const showAlert = (title: string, message: string) => {
    Platform.OS === 'web' ? window.alert(`${title}\n${message}`) : Alert.alert(title, message);
  };

  const handleJoinClass = async () => {
    if (!inviteCode.trim() || inviteCode.length !== 6) {
      return showAlert('Error', 'El código debe tener 6 caracteres.');
    }

    setJoining(true);
    try {
      const { data: session } = await supabase.auth.getSession();

      const { data: subject, error: subjectError } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('code', inviteCode.toUpperCase())
        .single();

      if (subjectError || !subject) {
        throw new Error('No se ha encontrado ninguna clase con ese código.');
      }

      const { error: enrollError } = await supabase
        .from('enrollments')
        .insert([{ student_id: session.session?.user.id, subject_id: subject.id }]);

      if (enrollError) {
        if (enrollError.code === '23505') throw new Error('Ya estás matriculado en esta clase.');
        throw enrollError;
      }

      showAlert('¡Éxito!', `Te has unido a ${subject.name}`);
      setInviteCode('');
      fetchMySubjects();

    } catch (error: any) {
      showAlert('Error', error.message);
    } finally {
      setJoining(false);
    }
  };

  const renderSubject = ({ item }: { item: any }) => (
    <View className="bg-slate-800 p-5 rounded-2xl mb-4 border border-slate-700">
      <View className="flex-row items-center mb-4">
        <Text className="text-3xl mr-3">{item.icon}</Text>
        <View className="flex-1">
          <Text className="text-white font-bold text-xl">{item.name}</Text>
          <Text className="text-slate-400 text-sm">{item.description}</Text>
        </View>
      </View>

      <Link
        href={{
          pathname: '/(student)/play/[id]',
          params: { id: String(item.id) },
        }}
        asChild
      >
        <Pressable className="bg-emerald-500 py-3 rounded-xl items-center active:bg-emerald-600 flex-row justify-center shadow-lg shadow-emerald-500/30">
          <Ionicons name="play" size={20} color="white" className="mr-2" />
          <Text className="text-white font-bold text-lg ml-2">Jugar Retos</Text>
        </Pressable>
      </Link>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-900 pt-12 px-6">
      <View className="flex-row justify-between items-center mb-8">
        <View>
          <Text className="text-3xl font-bold text-white mb-1">OmniQuest</Text>
          <Text className="text-slate-400">¿Qué quieres aprender hoy?</Text>
        </View>
        <Pressable
          onPress={() => supabase.auth.signOut()}
          className="bg-slate-800 p-3 rounded-full border border-slate-700 active:bg-slate-700"
        >
          <Ionicons name="log-out-outline" size={20} color="#f87171" />
        </Pressable>
      </View>

      <View className="bg-indigo-900/30 p-5 rounded-2xl border border-indigo-500/30 mb-8">
        <Text className="text-indigo-300 font-semibold mb-3">Unirse a una nueva clase</Text>
        <View className="flex-row space-x-3">
          <TextInput
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono tracking-widest text-center text-lg uppercase"
            placeholder="CÓDIGO (Ej: A7X9P2)"
            placeholderTextColor="#64748b"
            value={inviteCode}
            onChangeText={setInviteCode}
            maxLength={6}
            autoCapitalize="characters"
          />
          <Pressable
            onPress={handleJoinClass}
            disabled={joining}
            className={`bg-indigo-500 px-6 justify-center rounded-xl active:bg-indigo-600 ${joining ? 'opacity-70' : ''}`}
          >
            <Text className="text-white font-bold">Unirse</Text>
          </Pressable>
        </View>
      </View>

      <Text className="text-slate-400 mb-4 font-semibold uppercase tracking-wider">Tus Asignaturas</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" className="mt-10" />
      ) : (
        <FlatList
          data={enrolledSubjects}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderSubject}
          ListEmptyComponent={
            <View className="items-center justify-center mt-10 p-6">
              <Ionicons name="search-outline" size={64} color="#334155" mb-4 />
              <Text className="text-slate-400 text-center text-lg">Aún no tienes clases.</Text>
              <Text className="text-slate-500 text-center text-sm mt-2">Pídele a tu profesor el código de invitación para empezar a jugar.</Text>
            </View>
          }
        />
      )}
      
      <View className="flex-row justify-around items-center bg-slate-800 py-4 px-6 rounded-t-3xl border-t border-slate-700 absolute bottom-0 left-0 right-0">
        <Pressable className="items-center opacity-100">
          <Ionicons name="home" size={24} color="#818cf8" />
          <Text className="text-indigo-400 text-xs font-bold mt-1">Inicio</Text>
        </Pressable>

        <Link href="/(student)/ranking" asChild>
          <Pressable className="items-center opacity-60 active:opacity-100">
            <Ionicons name="trophy-outline" size={24} color="#cbd5e1" />
            <Text className="text-slate-300 text-xs font-medium mt-1">Ranking</Text>
          </Pressable>
        </Link>

        <Link href="/(student)/profile" asChild>
          <Pressable className="items-center opacity-60 active:opacity-100">
            <Ionicons name="person-outline" size={24} color="#cbd5e1" />
            <Text className="text-slate-300 text-xs font-medium mt-1">Perfil</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
