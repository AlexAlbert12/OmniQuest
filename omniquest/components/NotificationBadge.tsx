import React, { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { calculateStreakDays } from '../lib/studentBadges'
import { NotificationAudience, useNotifications } from '../hooks/useNotifications'
import { useAppTheme } from '../lib/appTheme'
import { useI18n } from '../lib/i18n'

type NotificationBadgeProps = {
  audience?: NotificationAudience
  count?: number
  streakDays?: number
  showStreak?: boolean
  onPress?: () => void
}

export default function NotificationBadge({
  audience,
  count,
  streakDays,
  showStreak,
  onPress,
}: NotificationBadgeProps) {
  const router = useRouter()
  const { colors } = useAppTheme()
  const { t } = useI18n()
  const segments = useSegments()
  const inferredAudience: NotificationAudience =
    audience ?? (segments && segments[0] === '(teacher)' ? 'teacher' : 'student')
  const { refresh, unreadCount } = useNotifications(inferredAudience)
  const [calculatedStreakDays, setCalculatedStreakDays] = useState(0)
  const shouldShowStreak = showStreak ?? audience === 'student'
  const displayCount = count ?? unreadCount
  const displayStreakDays = streakDays ?? calculatedStreakDays

  useFocusEffect(
    useCallback(() => {
      if (typeof count === 'number') return
      void refresh()
    }, [count, refresh])
  )

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
        <View className="min-h-[48px] flex-row items-center gap-2 rounded-2xl border border-border-default bg-background-primary px-3">
          <Ionicons name="flame" size={18} color="#FDBA74" />
          <View>
            <Text className="text-[11px] font-bold text-gamification-streak">{displayStreakDays}</Text>
            <Text className="text-[10px] font-semibold text-text-secondary">racha</Text>
          </View>
        </View>
      ) : null}
      <Pressable
        accessibilityLabel={`${t('common.notifications')}: ${t('common.unreadNotifications', { count: displayCount })}`}
        accessibilityRole="button"
        accessibilityHint={t('common.openNotifications')}
        hitSlop={8}
        onPress={handlePress}
        className="relative rounded-2xl p-3"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
        {displayCount > 0 ? (
          <View className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-semantic-danger">
            <Text className="text-[10px] font-black text-white">
              {displayCount > 99 ? '99+' : displayCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  )
}
