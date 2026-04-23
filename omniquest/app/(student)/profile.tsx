import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: session } = await supabase.auth.getSession();
      const { data } = await supabase.from('profiles').select('*').eq('id', session.session?.user.id).single();
      setProfile(data);
    };
    fetchProfile();
  }, []);

  if (!profile) return <View className="flex-1 bg-slate-900 justify-center"><ActivityIndicator color="#6366f1" /></View>;

  const badges = [
    { name: 'Primeros Pasos', icon: 'footsteps', color: '#3b82f6', earned: profile.points > 0 },
    { name: 'Estudiante Bronce', icon: 'star-half', color: '#b45309', earned: profile.points >= 100 },
    { name: 'Estudiante Plata', icon: 'star', color: '#94a3b8', earned: profile.points >= 500 },
    { name: 'Maestro OmniQuest', icon: 'diamond', color: '#fbbf24', earned: profile.points >= 1000 },
  ];

  return (
    <ScrollView className="flex-1 bg-slate-900 px-6 pt-12">
      <View className="flex-row items-center mb-8 justify-between">
        <Pressable onPress={() => router.back()} className="p-2 bg-slate-800 rounded-full"><Ionicons name="arrow-back" size={24} color="#cbd5e1" /></Pressable>
        <Text className="text-xl font-bold text-white">Mi Perfil</Text>
        <View className="w-10" />
      </View>

      <View className="items-center bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl mb-8">
        <View className="h-24 w-24 bg-indigo-500/20 rounded-full items-center justify-center mb-4 border-2 border-indigo-500">
          <Text className="text-5xl">🧑‍🎓</Text>
        </View>
        <Text className="text-3xl font-black text-white mb-1">{profile.alias}</Text>
        <Text className="text-indigo-400 font-bold tracking-widest uppercase">Nivel {Math.floor(profile.points / 100) + 1}</Text>
      </View>

      <View className="flex-row space-x-4 mb-8">
        <View className="flex-1 bg-slate-800 p-5 rounded-2xl border border-slate-700 items-center">
          <Ionicons name="flash" size={32} color="#fbbf24" mb={2} />
          <Text className="text-3xl font-bold text-white">{profile.points}</Text>
          <Text className="text-slate-400 text-xs uppercase font-bold mt-1">Puntos Totales</Text>
        </View>
      </View>

      <Text className="text-white font-bold text-xl mb-4">Tus Insignias</Text>
      <View className="flex-row flex-wrap justify-between">
        {badges.map((badge, idx) => (
          <View key={idx} className={`w-[48%] p-4 rounded-2xl border mb-4 items-center ${badge.earned ? 'bg-slate-800 border-slate-600' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
            <View className={`p-3 rounded-full mb-2`} style={{ backgroundColor: badge.earned ? `${badge.color}20` : '#1e293b' }}>
              <Ionicons name={badge.icon as any} size={28} color={badge.earned ? badge.color : '#475569'} />
            </View>
            <Text className="text-white font-semibold text-center text-sm">{badge.name}</Text>
            {!badge.earned && <Text className="text-slate-500 text-xs mt-1 text-center">Bloqueado</Text>}
          </View>
        ))}
      </View>
      <View className="h-10" />
    </ScrollView>
  );
}