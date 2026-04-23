// app/(teacher)/create-subject.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function CreateSubjectScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📚');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre de la asignatura es obligatorio');
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('No hay sesión activa');

      const code = generateInviteCode();

      const { error } = await supabase.from('subjects').insert([
        {
          name: name,
          description: description,
          icon: icon,
          code: code,
          teacher_id: session.session.user.id,
        }
      ]);

      if (error) throw error;

      Alert.alert('¡Éxito!', `Asignatura creada.\nCódigo de invitación: ${code}`);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-900 px-6 pt-12">
      <View className="flex-row items-center mb-8">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 bg-slate-800 rounded-full active:bg-slate-700">
          <Ionicons name="arrow-back" size={24} color="#cbd5e1" />
        </Pressable>
        <Text className="text-2xl font-bold text-white">Nueva Asignatura</Text>
      </View>

      <View className="space-y-6">
        <View>
          <Text className="text-slate-300 font-medium mb-2 ml-1">Icono (Emoji)</Text>
          <TextInput
            className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-3xl text-white"
            value={icon}
            onChangeText={setIcon}
            maxLength={2}
          />
        </View>

        <View>
          <Text className="text-slate-300 font-medium mb-2 ml-1">Nombre de la Asignatura</Text>
          <TextInput
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-lg"
            placeholder="Ej. Matemáticas Avanzadas"
            placeholderTextColor="#64748b"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View>
          <Text className="text-slate-300 font-medium mb-2 ml-1">Breve Descripción</Text>
          <TextInput
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white"
            placeholder="Para alumnos de 2º Bachillerato"
            placeholderTextColor="#64748b"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View className="bg-indigo-900/30 p-4 rounded-xl border border-indigo-500/30 mt-4">
          <View className="flex-row items-center mb-2">
            <Ionicons name="information-circle" size={20} color="#818cf8" />
            <Text className="text-indigo-300 font-semibold ml-2">Código de Invitación</Text>
          </View>
          <Text className="text-indigo-200/70 text-sm">
            Se generará automáticamente un código único de 6 caracteres que deberás compartir con tus alumnos para que puedan acceder.
          </Text>
        </View>

        <Pressable 
          onPress={handleCreate}
          disabled={loading}
          className={`w-full bg-indigo-500 rounded-xl py-4 items-center mt-6 ${loading ? 'opacity-70' : 'active:bg-indigo-600'}`}
        >
          <Text className="text-white font-bold text-lg">
            {loading ? 'Creando...' : 'Crear Asignatura'}
          </Text>
        </Pressable>
      </View>
      <View className="h-12" />
    </ScrollView>
  );
}