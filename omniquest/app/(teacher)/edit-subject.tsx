import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function EditSubjectScreen() {
  const { id } = useLocalSearchParams();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchSubject = async () => {
      const { data, error } = await supabase.from('subjects').select('*').eq('id', id).single();
      if (!error && data) {
        setName(data.name);
        setDescription(data.description || '');
        setIcon(data.icon || '📚');
      }
      setLoading(false);
    };
    fetchSubject();
  }, [id]);

  const handleUpdate = async () => {
    if (!name.trim()) return Alert.alert('Error', 'El nombre es obligatorio');
    setSaving(true);
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ name, description, icon })
        .eq('id', id);
      if (error) throw error;
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View className="flex-1 bg-slate-900 justify-center"><ActivityIndicator color="#6366f1" /></View>;

  return (
    <ScrollView className="flex-1 bg-slate-900 px-6 pt-12">
      <View className="flex-row items-center mb-8">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 bg-slate-800 rounded-full">
          <Ionicons name="close" size={24} color="#cbd5e1" />
        </Pressable>
        <Text className="text-2xl font-bold text-white">Editar Asignatura</Text>
      </View>

      <View className="space-y-6">
        <View>
          <Text className="text-slate-300 font-medium mb-2">Icono</Text>
          <TextInput
            className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-3xl text-white"
            value={icon}
            onChangeText={setIcon}
          />
        </View>

        <View>
          <Text className="text-slate-300 font-medium mb-2">Nombre</Text>
          <TextInput
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View>
          <Text className="text-slate-300 font-medium mb-2">Descripción</Text>
          <TextInput
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <Pressable 
          onPress={handleUpdate}
          disabled={saving}
          className={`w-full bg-indigo-500 rounded-xl py-4 items-center mt-6 ${saving ? 'opacity-70' : ''}`}
        >
          <Text className="text-white font-bold text-lg">
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}