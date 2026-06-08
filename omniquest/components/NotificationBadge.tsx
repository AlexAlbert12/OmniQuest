import React, { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { calculateStreakDays } from '../lib/studentBadges'
import { NotificationAudience, useNotifications } from '../hooks/useNotifications'

type NotificationBadgeProps = {
  audience?: NotificationAudience
  count?: number
  streakDays?: number
  showStreak?: boolean
  onPress?: () => void
}

export default function NotificationBadge({
  audience = 'student',
  count,
  streakDays,
  showStreak,
  onPress,
}: NotificationBadgeProps) {
  const router = useRouter()
  const { unreadCount } = useNotifications(audience)
  const [calculatedStreakDays, setCalculatedStreakDays] = useState(0)
  const shouldShowStreak = showStreak ?? audience === 'student'
  const displayCount = count ?? unreadCount
  const displayStreakDays = streakDays ?? calculatedStreakDays

  useFocusEffect(
    useCallback(() => {
      if (!shouldShowStreak || typeof streakDays === 'number') return

      let isActive = true

      const fetchStreak = async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const userId = sessionData.session?.user.id
          if (!userId) {
            if (isActive) setCalculatedStreakDays(0)
            return
          }

          const { data, error } = await supabase
            .from('subject_scores')
            .select('played_at, played_days')
            .eq('student_id', userId)

          if (error) throw error

          const playedDays = (data || []).flatMap((score: { played_at: string | null; played_days: string[] | null }) => [
            ...(score.played_days || []),
            ...(score.played_at ? [score.played_at] : []),
          ])

          if (isActive) {
            setCalculatedStreakDays(calculateStreakDays(playedDays))
          }
        } catch (error) {
          console.error('Error cargando racha del badge:', error)
          if (isActive) setCalculatedStreakDays(0)
        }
      }

      void fetchStreak()

      return () => {
        isActive = false
      }
    }, [shouldShowStreak, streakDays])
  )

  const handlePress = () => {
    if (onPress) {
      onPress()
      return
    }

    router.push(audience === 'teacher' ? '/(teacher)/notifications' as any : '/(student)/notifications' as any)
  }

  return (
    <View className="flex-row items-center gap-3">
      {shouldShowStreak ? (
        <View className="flex-row items-center gap-3 rounded-2xl border border-[#162B50] bg-[#0B1933] px-4 py-3">
          <Ionicons name="flash" size={20} color="#FFD34D" />
          <View>
            <Text className="text-[16px] font-black text-white">{displayStreakDays}</Text>
            <Text className="text-[11px] text-[#8FA7C7]">Días de racha</Text>
          </View>
        </View>
      ) : null}
      <Pressable
        onPress={handlePress}
        className="relative rounded-2xl border border-[#20375E] bg-[#09162C] p-3"
      >
        <Ionicons name="notifications-outline" size={22} color="#AFC2DB" />
        {displayCount > 0 ? (
          <View className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-[#EF4444]">
            <Text className="text-[10px] font-black text-white">
              {displayCount > 99 ? '99+' : displayCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  )
}
