import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { withAlpha } from '../../../lib/color'
import type { TeacherCourse, TeacherCourseAnalytics } from './types'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'
import AppPressable from '../../ui/AppPressable'

const ATTENTION_BADGE_BACKGROUND = '#B77900'

export default function TeacherCourseCard({
  analytics,
  course,
  density,
}: {
  analytics: TeacherCourseAnalytics
  course: TeacherCourse
  density: 'compact' | 'comfortable'
}) {
  const router = useRouter()
  const compact = density === 'compact'
  const color = course.theme_color || '#8B5CF6'
  const participation = analytics.enrolledCount > 0
    ? Math.round((analytics.activeStudentsCount / analytics.enrolledCount) * 100)
    : 0
  const needsAttention = analytics.enrolledCount > 0 && participation < 40

  return (
    <AppPressable
      accessibilityLabel={`Abrir curso ${course.name}`}
      accessibilityHint="Abre el detalle, las clases y el contenido del curso"
      accessibilityRole="button"
      onPress={() => router.push(`/(teacher)/subject/${course.id}` as any)}
      className={compact
        ? 'flex-row items-start gap-4 overflow-hidden rounded-2xl border border-border-default bg-surface-default p-4'
        : 'min-h-16 flex-row items-center gap-4 border-b border-border-default px-4 py-3'}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className={`${compact ? 'h-14 w-14 rounded-2xl' : 'h-10 w-10 rounded-xl'} shrink-0 items-center justify-center`} style={{ backgroundColor: withAlpha(color, '26') }}>
        <Ionicons name={normalizeAcademicIcon(course.icon, 'book-outline')} size={compact ? 27 : 20} color={color} />
      </View>
      <View className={`min-w-0 ${compact ? 'flex-1' : 'flex-[1.5]'}`}>
        <Text className={`${compact ? 'text-[18px] leading-6' : 'text-[14px] leading-5'} font-black text-white`} numberOfLines={2}>{course.name}</Text>
        {compact ? (
          <>
          <Text className="mt-1 text-[13px] leading-5 text-text-secondary" numberOfLines={2}>
            {analytics.enrolledCount} alumnos · {analytics.questionsCount} preguntas
          </Text>
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <Text className={`text-[12px] font-black ${needsAttention ? 'text-gamification-badge' : 'text-text-secondary'}`}>{participation}% participación</Text>
            {needsAttention ? (
              <View className="rounded-full px-2 py-1" style={{ backgroundColor: ATTENTION_BADGE_BACKGROUND }}>
                <Text className="text-[10px] font-black text-white">Necesita atención</Text>
              </View>
            ) : null}
          </View>
          </>
        ) : (
          <Text className="mt-1 text-[12px] text-text-muted" numberOfLines={2}>{course.description || `Código ${course.code}`}</Text>
        )}
      </View>
      {!compact ? <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.enrolledCount}</Text> : null}
      {!compact ? <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.questionsCount}</Text> : null}
      {!compact ? (
        <View className="w-28 items-center">
          <View className={`rounded-full px-3 py-1 ${needsAttention ? 'bg-semantic-surface-warning' : 'bg-semantic-surface-success'}`}>
            <Text className={`text-[11px] font-black ${needsAttention ? 'text-gamification-badge' : 'text-text-secondary'}`}>{participation}%</Text>
          </View>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={compact ? 20 : 18} color="#AFC2DB" />
    </AppPressable>
  )
}
