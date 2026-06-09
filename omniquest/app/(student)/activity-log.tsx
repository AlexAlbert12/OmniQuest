import React, { useEffect, useState, useCallback } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/StudentSidebar'

type AttemptRow = {
  id: number
  is_correct: boolean
  attempted_at: string
  questions: {
    text: string
    subject_topics: {
      title: string
    } | null
  } | null
}

export default function ActivityLogScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const isDesktop = width >= 1024

  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [profile, setProfile] = useState<any>(null)

  const fetchActivityData = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) return

      const [profileResult, historyResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, points').eq('id', userId).single(),
        supabase
          .from('attempt_history')
          .select(`
            id,
            is_correct,
            attempted_at,
            questions (
              text,
              subject_topics ( title )
            )
          `)
          .eq('student_id', userId)
          .order('attempted_at', { ascending: false })
          .limit(50)
      ])

      if (profileResult.data) setProfile(profileResult.data)
      if (historyResult.data) setAttempts(historyResult.data as any[])
    } catch (error) {
      console.error('Error al cargar el historial de actividad:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchActivityData()
  }, [fetchActivityData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchActivityData()
  }

  const renderAttemptItem = ({ item }: { item: AttemptRow }) => {
    const isCorrect = item.is_correct
    const date = new Date(item.attempted_at)
    
    const topicData = item.questions?.subject_topics
    const topicTitle = Array.isArray(topicData) ? topicData[0]?.title : topicData?.title
    const questionText = item.questions?.text || 'Pregunta eliminada'

    const formattedDate = date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })

    return (
      <View className="mb-3 flex-row items-center gap-4 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
        <View 
          className="h-12 w-12 items-center justify-center rounded-xl" 
          style={{ backgroundColor: isCorrect ? '#70E0A520' : '#FB718520' }}
        >
          <Ionicons 
            name={isCorrect ? 'checkmark-circle' : 'close-circle'} 
            size={26} 
            color={isCorrect ? '#70E0A5' : '#FB7185'} 
          />
        </View>
        
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-bold text-white" numberOfLines={1}>
            {isCorrect ? 'Respuesta Correcta' : 'Respuesta Incorrecta'}
          </Text>
          <Text className="mt-0.5 text-[13px] text-[#AFC2DB]" numberOfLines={1}>
            {questionText}
          </Text>
          <Text className="mt-1 text-[11px] font-semibold text-[#8FA7C7]">
            {topicTitle ? `Tema: ${topicTitle}` : 'Práctica libre'}
          </Text>
        </View>

        <View className="items-end">
          <Text className="text-[12px] text-[#8FA7C7]">{formattedDate}</Text>
          <View 
            className="mt-1.5 rounded-md px-2 py-0.5" 
            style={{ backgroundColor: isCorrect ? '#22C55E20' : '#33415550' }}
          >
            <Text className="text-[11px] font-bold" style={{ color: isCorrect ? '#43D991' : '#94A7C4' }}>
              {isCorrect ? '+10 XP' : '0 XP'}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  const points = profile?.points || 0
  const level = Math.floor(points / 100) + 1
  const nextLevelProgress = points % 100

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop && profile ? (
          <StudentSidebar
            activeSection="home" 
            alias={profile.alias || 'Estudiante'}
            avatar={profile.avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={() => supabase.auth.signOut()}
          />
        ) : null}

        <View className="flex-1 px-4 pt-6 md:px-8 lg:pt-8">
          <View className="mb-6 flex-row items-center gap-4">
            <Pressable
              onPress={() => router.back()}
              className="h-12 w-12 items-center justify-center rounded-xl border border-[#2A4369] bg-[#0A1D3F]"
            >
              <Ionicons name="arrow-back" size={22} color="#DDE7F4" />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="text-[28px] font-black text-white">Historial de Actividad</Text>
              <Text className="text-[13px] text-[#9BAEC9]">
                Revisa el registro completo de tus aciertos y errores en los retos
              </Text>
            </View>
          </View>

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#8B5CF6" />
            </View>
          ) : (
            <FlatList
              data={attempts}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderAttemptItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListEmptyComponent={
                <View className="mt-12 items-center justify-center rounded-2xl border border-dashed border-[#1A3155] p-8">
                  <Ionicons name="newspaper-outline" size={48} color="#4B6282" />
                  <Text className="mt-4 text-center text-[16px] font-bold text-white">
                    No hay actividad registrada
                  </Text>
                  <Text className="mt-1 text-center text-[13px] text-[#8FA7C7]">
                    Tus respuestas aparecerán aquí en cuanto empieces a completar retos.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </View>
  )
}