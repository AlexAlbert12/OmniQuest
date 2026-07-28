import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import ManagedSessionsCard from '../../components/settings/ManagedSessionsCard'
import { supabase } from '../../lib/supabase'

export default function AdminSecurityScreen(){
  const router=useRouter()
  return <ScrollView className="flex-1 bg-background-secondary" contentContainerStyle={{padding:24,paddingBottom:80}}>
    <View className="mx-auto w-full max-w-[860px]">
      <Pressable onPress={()=>router.back()} className="mb-5 flex-row items-center gap-2 self-start rounded-xl border border-border-default bg-surface-default px-4 py-3"><Ionicons name="arrow-back" size={18} color="#9FD6FF"/><Text className="font-black text-semantic-info">Volver al portal</Text></Pressable>
      <Text className="text-[28px] font-black text-white">Seguridad administrativa</Text>
      <Text className="mb-5 mt-2 text-[13px] leading-5 text-text-secondary">Gestiona los dispositivos con acceso a tu cuenta de administración y conserva códigos de recuperación.</Text>
      <ManagedSessionsCard/>
      <Pressable onPress={async()=>{await supabase.auth.signOut();router.replace('/(auth)/login' as any)}} className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-semantic-danger bg-surface-default px-4 py-4"><Ionicons name="log-out-outline" size={18} color="#FCA5A5"/><Text className="font-black text-semantic-danger">Cerrar esta sesión</Text></Pressable>
    </View>
  </ScrollView>
}
