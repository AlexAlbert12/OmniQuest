import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl, Platform, Alert } from 'react-native';
import { useRouter, useFocusEffect, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function TeacherDashboard() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchSubjects = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('teacher_id', session.session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubjects(data || []);
    } catch (error: any) {
      console.error('Error cargando asignaturas:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSubjects();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubjects();
  };

  const executeDeleteSubject = async (id: number) => {
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
      setSubjects(prev => prev.filter(s => s.id !== id));
    } catch (error: any) {
      const msg = "Error al borrar asignatura: " + error.message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert("Error", msg);
    }
  };

  const handleDeleteSubject = (id: number, name: string) => {
    const message = `¿Estás seguro de borrar "${name}"? Se eliminarán todas sus preguntas y datos asociados permanentemente.`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) executeDeleteSubject(id);
    } else {
      Alert.alert("Confirmar borrado", message, [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar todo", style: "destructive", onPress: () => executeDeleteSubject(id) }
      ]);
    }
  };

  const renderSubject = ({ item }: { item: any }) => (
    <View className="bg-slate-800 p-5 rounded-2xl mb-4 border border-slate-700 active:bg-slate-700">
      <Link href={`/(teacher)/subject/${item.id}`} asChild>
        <Pressable className="flex-1">
          <View className="flex-row items-center mb-2">
            <Text className="text-2xl mr-2">{item.icon}</Text>
            <Text className="text-white font-bold text-xl flex-1">{item.name}</Text>
          </View>
          <Text className="text-slate-400 mb-3">{item.description}</Text>
        </Pressable>
      </Link>

      <View className="flex-row justify-between items-center mt-2 pt-3 border-t border-slate-700/50">
        <View className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
          <Text className="text-indigo-400 font-mono font-bold tracking-widest">{item.code}</Text>
        </View>

        <View className="flex-row space-x-4">
          <Link href={`/(teacher)/edit-subject?id=${item.id}`} asChild>
            <Pressable className="p-2">
              <Ionicons name="settings-outline" size={20} color="#818cf8" />
            </Pressable>
          </Link>
          <Pressable onPress={() => handleDeleteSubject(item.id, item.name)} className="p-2 ml-2">
            <Ionicons name="trash-outline" size={20} color="#fb7185" />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-900 pt-12 px-6">
      <View className="flex-row justify-between items-center mb-8">
        <View>
          <Text className="text-3xl font-bold text-white mb-1">Tus Clases</Text>
          <Text className="text-slate-400">Gestiona tus asignaturas y retos</Text>
        </View>
        <Pressable
          onPress={() => supabase.auth.signOut()}
          className="bg-slate-800 p-3 rounded-full border border-slate-700 active:bg-slate-700"
        >
          <Ionicons name="log-out-outline" size={20} color="#f87171" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" className="mt-10" />
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderSubject}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={
            <View className="items-center justify-center mt-20">
              <Ionicons name="school-outline" size={64} color="#334155" mb-4 />
              <Text className="text-slate-400 text-lg text-center mb-2">Aún no tienes asignaturas.</Text>
              <Text className="text-slate-500 text-center mb-6">Crea tu primera clase para empezar a añadir retos.</Text>
            </View>
          }
        />
      )}

      <Pressable
        onPress={() => router.push('/(teacher)/create-subject' as any)}
        className="absolute bottom-8 right-6 bg-indigo-500 w-16 h-16 rounded-full items-center justify-center shadow-lg shadow-indigo-500/50 active:bg-indigo-600"
      >
        <Ionicons name="add" size={32} color="white" />
      </Pressable>
    </View>
  );
}