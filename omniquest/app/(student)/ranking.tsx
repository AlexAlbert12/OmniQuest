import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function RankingScreen() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchRanking = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      setCurrentUserId(session.session?.user.id || null);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, alias, points, avatar')
        .eq('role_id', 'student')
        .order('points', { ascending: false })
        .limit(50);

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();

    const subscription = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        setProfiles((currentProfiles) => {
          const updated = currentProfiles.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p);
          return updated.sort((a, b) => b.points - a.points);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.id === currentUserId;
    let rankIcon = <Text className="text-slate-400 font-bold text-lg w-6 text-center">{index + 1}</Text>;
    
    if (index === 0) rankIcon = <Ionicons name="medal" size={24} color="#fbbf24" />;
    else if (index === 1) rankIcon = <Ionicons name="medal" size={24} color="#94a3b8" />; 
    else if (index === 2) rankIcon = <Ionicons name="medal" size={24} color="#b45309" />; 

    return (
      <View className={`flex-row items-center p-4 rounded-2xl mb-3 border ${isMe ? 'bg-indigo-900/40 border-indigo-500/50' : 'bg-slate-800 border-slate-700'}`}>
        <View className="w-10 items-center justify-center mr-2">{rankIcon}</View>
        <View className="h-10 w-10 bg-slate-700 rounded-full items-center justify-center mr-3">
          <Text className="text-xl">🧑‍🎓</Text>
        </View>
        <Text className={`flex-1 font-bold text-lg ${isMe ? 'text-indigo-300' : 'text-white'}`}>
          {item.alias} {isMe && '(Tú)'}
        </Text>
        <Text className="text-emerald-400 font-black text-lg">{item.points} pts</Text>
      </View>
    );
  };

  if (loading) return <View className="flex-1 bg-slate-900 justify-center"><ActivityIndicator color="#6366f1" size="large" /></View>;

  return (
    <View className="flex-1 bg-slate-900 px-6 pt-12">
      <View className="flex-row items-center mb-6">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 bg-slate-800 rounded-full active:bg-slate-700">
          <Ionicons name="arrow-back" size={24} color="#cbd5e1" />
        </Pressable>
        <View>
          <Text className="text-2xl font-bold text-white">Clasificación Global</Text>
          <Text className="text-slate-400">Los mejores de OmniQuest en directo 🔴</Text>
        </View>
      </View>
      <FlatList data={profiles} keyExtractor={(item) => item.id} renderItem={renderItem} showsVerticalScrollIndicator={false} />
    </View>
  );
}