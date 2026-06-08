import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { Link, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/StudentSidebar'
import NotificationBadge from '../../components/NotificationBadge'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
  role_id?: string | null
}

export default function RankingScreen() {
  const { width } = useWindowDimensions()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isDesktop = width >= 1024
  const rankingRows = useMemo(() => profiles, [profiles])

  const points = currentProfile?.points ?? rankingRows.find((item) => item.id === currentUserId)?.points ?? 0
  const alias = currentProfile?.alias || 'Usuario'
  const level = Math.floor(points / 100) + 1
  const nextLevelProgress = points % 100
  const isGuest = currentProfile?.role_id === 'guest'
  const currentRankIndex = rankingRows.findIndex((item) => item.id === currentUserId)
  const currentRank = !isGuest && currentRankIndex >= 0 ? currentRankIndex + 1 : null
  const maxPoints = Math.max(...rankingRows.map((item) => item.points ?? 0), 1)

  const fetchRanking = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id || null
      setCurrentUserId(userId)

      if (userId) {
        const profileResult = await supabase
          .from('profiles')
          .select('id, alias, points, avatar, role_id')
          .eq('id', userId)
          .single()

        if (profileResult.error) throw profileResult.error

        setCurrentProfile(profileResult.data || null)
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, alias, points, avatar')
        .eq('role_id', 'student')
        .order('points', { ascending: false })
        .limit(50)

      if (error) throw error
      setProfiles(data || [])
    } catch (error) {
      console.error('Error fetching ranking:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchRanking()
    }, [fetchRanking])
  )

  useEffect(() => {
    let isMounted = true
    let subscription: any = null

    const setupSubscription = async () => {
      try {
        subscription = supabase
          .channel('public:profiles')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles' },
            (payload) => {
              if (!isMounted) return

              setProfiles((currentProfiles) => {
                const updated = currentProfiles.map((profile) =>
                  profile.id === payload.new.id ? { ...profile, ...payload.new } : profile
                )
                return updated.sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
              })

              if (payload.new.id === currentUserId) {
                setCurrentProfile((profile) => (profile ? { ...profile, ...payload.new } : profile))
              }
            }
          )
          .subscribe()
      } catch (error) {
        console.error('Error setting up Realtime subscription:', error)
      }
    }

    setupSubscription()

    return () => {
      isMounted = false
      if (subscription) {
        supabase.removeChannel(subscription)
      }
    }
  }, [currentUserId])

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  const showComingSoon = (feature: string) => {
    showAlert('Próximamente', `${feature} estará disponible en una próxima iteración.`)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#6574FF" />
        <Text className="mt-4 text-[#8FA7C7]">Actualizando ranking...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection="ranking"
            alias={alias}
            avatar={currentProfile?.avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={() => supabase.auth.signOut()}
            onComingSoon={showComingSoon}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 22 : 18,
            paddingBottom: isDesktop ? 28 : 104,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              {!isDesktop ? (
                <Text
                  className="mb-3 text-[#9FD6FF]"
                  style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}
                >
                  OmniQuest
                </Text>
              ) : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="trophy" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Ranking</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Compite, aprende y sube posiciones 🚀
              </Text>
            </View>
            <NotificationBadge />
          </View>

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <View className={isDesktop ? 'flex-[1.45]' : ''}>
              <RankingTabs onComingSoon={showComingSoon} />
              <View className="mt-4 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
                <View className="mb-4 flex-row items-center border-b border-[#172A4A] pb-3">
                  <Text className="w-24 text-[12px] font-bold uppercase text-[#8FA7C7]">Posición</Text>
                  <Text className="min-w-0 flex-1 text-[12px] font-bold uppercase text-[#8FA7C7]">
                    Estudiante
                  </Text>
                  <Text className="w-24 text-right text-[12px] font-bold uppercase text-[#8FA7C7]">XP</Text>
                </View>

                <View style={{ gap: 6 }}>
                  {rankingRows.length > 0 ? (
                    rankingRows.slice(0, 8).map((item, index) => (
                      <RankingRow
                        key={item.id}
                        item={item}
                        index={index}
                        isMe={item.id === currentUserId}
                        maxPoints={maxPoints}
                      />
                    ))
                  ) : (
                    <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] px-4 py-8">
                      <Ionicons name="trophy-outline" size={34} color="#8FA7C7" />
                      <Text className="mt-2 text-center text-[13px] text-[#AFC2DB]">
                        Aún no hay estudiantes con puntuación en el ranking.
                      </Text>
                    </View>
                  )}
                </View>

                <Pressable
                  onPress={() => showComingSoon('El ranking completo')}
                  className="mt-5 flex-row items-center justify-center gap-2 border-t border-[#172A4A] pt-4"
                >
                  <Text className="text-[13px] font-bold text-[#8290FF]">Ver ranking completo</Text>
                  <Ionicons name="arrow-forward" size={14} color="#8290FF" />
                </Pressable>
              </View>
            </View>

            <View className={isDesktop ? 'flex-1 gap-5' : 'gap-5'}>
              <PositionCard rank={currentRank} points={points} isGuest={isGuest} totalRanked={rankingRows.length} />
              <RankingSummaryCard points={points} rankingRows={rankingRows} />
            </View>
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <BottomNav /> : null}
    </View>
  )
}

function RankingTabs({ onComingSoon }: { onComingSoon: (feature: string) => void }) {
  const tabs = [
    { label: 'Global', icon: 'globe-outline', active: true },
    { label: 'Amigos', icon: 'people-outline', active: false },
    { label: 'Clase', icon: 'school-outline', active: false },
    { label: 'Escuela', icon: 'business-outline', active: false },
  ] as const

  return (
    <View className="flex-row flex-wrap gap-2">
      {tabs.map((tab) => (
        <Pressable
          key={tab.label}
          onPress={() => !tab.active && onComingSoon(`Ranking de ${tab.label.toLowerCase()}`)}
          className={`min-w-[150px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-4 ${tab.active ? 'border-[#5D64FF] bg-[#4F46E5]' : 'border-[#172A4A] bg-[#09162C]'
            }`}
        >
          <Ionicons name={tab.icon} size={18} color={tab.active ? '#FFFFFF' : '#AFC2DB'} />
          <Text className={`font-bold ${tab.active ? 'text-white' : 'text-[#AFC2DB]'}`}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

function RankingRow({
  item,
  index,
  isMe,
  maxPoints,
}: {
  item: Profile
  index: number
  isMe: boolean
  maxPoints: number
}) {
  const points = item.points ?? 0
  const level = Math.floor(points / 300) + 1
  const medalColors = ['#FBBF24', '#CBD5E1', '#F97316']
  const progressColor = index === 0 ? '#FBBF24' : isMe ? '#3B82F6' : '#8B5CF6'
  const progress = Math.max(20, Math.round((points / maxPoints) * 100))

  return (
    <View
      className={`flex-row items-center rounded-xl px-3 py-3 ${isMe ? 'border border-[#5364F5] bg-[#1D2B68]' : ''
        }`}
    >
      <View className="w-20 flex-row items-center justify-center">
        {index < 3 ? (
          <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: medalColors[index] }}>
            <Text className="font-black text-white">{index + 1}</Text>
          </View>
        ) : (
          <Text className="text-[18px] font-bold text-[#B9C7DE]">{index + 1}</Text>
        )}
      </View>

      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#17315E]">
        {item.avatar && item.avatar.startsWith('http') ? (
          <Image source={{ uri: item.avatar }} className="h-full w-full" />
        ) : (
          <Ionicons name="person" size={20} color="#9FD6FF" />
        )}
      </View>

      <View className="ml-4 min-w-0 flex-1">
        <Text className={`font-black ${isMe ? 'text-white' : 'text-[#DDE7F4]'}`} numberOfLines={1}>
          {item.alias}{isMe ? ' (Tú)' : ''}
        </Text>
        <View className="mt-1 flex-row items-center gap-1">
          <View className="h-4 w-4 items-center justify-center rounded bg-[#6D4DDB]">
            <Ionicons name="star" size={10} color="#FFFFFF" />
          </View>
          <Text className="text-[12px] text-[#AFC2DB]">Nivel {level}</Text>
        </View>
      </View>

      <View className="mx-4 hidden h-2 flex-[0.8] overflow-hidden rounded-full bg-[#13294C] md:flex">
        <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: progressColor }} />
      </View>

      <Text className="w-24 text-right text-[14px] font-semibold text-[#DDE7F4]">{points.toLocaleString()} XP</Text>
    </View>
  )
}

function PositionCard({
  rank,
  points,
  isGuest,
  totalRanked,
}: {
  rank: number | null
  points: number
  isGuest: boolean
  totalRanked: number
}) {
  const nextProgress = Math.min(100, (points % 2000) / 20)
  const hasRank = typeof rank === 'number'
  const percentile = hasRank && totalRanked > 0 ? Math.max(1, Math.ceil((rank / totalRanked) * 100)) : null

  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-6">
      <Text className="text-[16px] font-black text-white">Tu posición</Text>
      <View className="items-center py-5">
        <View className="h-36 w-36 items-center justify-center rounded-[38px] border-[8px] border-[#5364F5] bg-[#15235A]">
          <Text className="text-[56px] font-black text-white">{isGuest || !hasRank ? '-' : rank}</Text>
        </View>
        <Text className="mt-4 text-[16px] font-black text-white">
          {isGuest ? 'Modo invitado' : hasRank ? '¡Sigue así!' : 'Sin posición todavía'}
        </Text>
        <Text className="mt-1 text-center text-[13px] text-[#AFC2DB]">
          {isGuest
            ? 'Crea una cuenta para aparecer en el ranking.'
            : hasRank
              ? `Estás en el top ${percentile}% de estudiantes`
              : 'Completa actividades para entrar en el ranking.'}
        </Text>
      </View>
      <View className="rounded-xl border border-[#172A4A] bg-[#0A1A34] p-4">
        <View className="mb-2 flex-row justify-between">
          <Text className="text-[12px] text-[#8FA7C7]">XP para el siguiente nivel</Text>
          <Text className="text-[12px] text-[#AFC2DB]">{points % 2000} / 2,000 XP</Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${nextProgress}%` }} />
        </View>
      </View>
    </View>
  )
}

function RankingSummaryCard({ points, rankingRows }: { points: number; rankingRows: Profile[] }) {
  const totalStudents = rankingRows.length
  const bestPoints = rankingRows.length > 0 ? Math.max(...rankingRows.map((item) => item.points ?? 0)) : 0
  const averagePoints =
    rankingRows.length > 0
      ? Math.round(rankingRows.reduce((sum, item) => sum + (item.points ?? 0), 0) / rankingRows.length)
      : 0

  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-6">
      <Text className="text-[16px] font-black text-white">Resumen real del ranking</Text>
      <View className="mt-5 gap-3">
        <View className="flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3">
          <Text className="text-[13px] text-[#AFC2DB]">Estudiantes en ranking</Text>
          <Text className="text-[14px] font-black text-white">{totalStudents.toLocaleString()}</Text>
        </View>
        <View className="flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3">
          <Text className="text-[13px] text-[#AFC2DB]">Tu XP actual</Text>
          <Text className="text-[14px] font-black text-white">{points.toLocaleString()} XP</Text>
        </View>
        <View className="flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3">
          <Text className="text-[13px] text-[#AFC2DB]">Mejor XP global</Text>
          <Text className="text-[14px] font-black text-white">{bestPoints.toLocaleString()} XP</Text>
        </View>
        <View className="flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0A1A34] px-4 py-3">
          <Text className="text-[13px] text-[#AFC2DB]">Media del ranking</Text>
          <Text className="text-[14px] font-black text-white">{averagePoints.toLocaleString()} XP</Text>
        </View>
      </View>
    </View>
  )
}

function BottomNav() {
  return (
    <View className="absolute bottom-3 left-4 right-4 flex-row justify-around rounded-2xl border border-[#1A3155] bg-[#09162C] py-3">
      <Link href="/(student)/homeStudent" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="home-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Inicio</Text>
        </Pressable>
      </Link>

      <Pressable className="items-center">
        <Ionicons name="trophy" size={22} color="#B09BFF" />
        <Text className="mt-1 text-[11px] font-bold text-[#B09BFF]">Ranking</Text>
      </Pressable>

      <Link href="/(student)/profile" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="person-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Perfil</Text>
        </Pressable>
      </Link>

      <Link href="/(student)/settings" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="settings-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Configuración</Text>
        </Pressable>
      </Link>
    </View>
  )
}
