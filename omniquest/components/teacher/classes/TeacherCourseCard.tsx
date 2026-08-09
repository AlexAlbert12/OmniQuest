import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { withAlpha } from '../../../lib/color'
import type { TeacherCourse, TeacherCourseAnalytics } from './types'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'

export default function TeacherCourseCard({
  analytics,
  course,
  isDesktop,
}: {
  analytics: TeacherCourseAnalytics
  course: TeacherCourse
  isDesktop: boolean
}) {
  const router = useRouter()
  const color = course.theme_color || '#8B5CF6'
  const participation = analytics.enrolledCount > 0
    ? Math.round((analytics.activeStudentsCount / analytics.enrolledCount) * 100)
    : 0
  const needsAttention = analytics.enrolledCount > 0 && participation < 40

  if (isDesktop) {
    return (
      <Pressable
        accessibilityLabel={`Gestionar ${course.name}`}
        accessibilityRole="button"
        onPress={() => router.push(`/(teacher)/subject/${course.id}` as any)}
        className="min-h-16 flex-row items-center gap-4 border-b border-border-default px-4 py-3"
        style={({ pressed }) => ({ backgroundColor: pressed ? '#102343' : 'transparent' })}
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(color, '26') }}>
          <Ionicons name={normalizeAcademicIcon(course.icon, 'book-outline')} size={20} color={color} />
        </View>
        <View className="min-w-0 flex-[1.5]">
          <Text className="font-black text-white" numberOfLines={1}>{course.name}</Text>
          <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>{course.description || `Código ${course.code}`}</Text>
        </View>
        <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.enrolledCount}</Text>
        <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.questionsCount}</Text>
        <View className="w-28 items-center">
          <View className={`rounded-full px-3 py-1 ${needsAttention ? 'bg-semantic-surface-warning' : 'bg-semantic-surface-success'}`}>
            <Text className={`text-[11px] font-black ${needsAttention ? 'text-gamification-badge' : 'text-text-secondary'}`}>{participation}% activo</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#8FA7C7" />
      </Pressable>
    )
  }

  return (
    <Pressable
      accessibilityLabel={`Gestionar ${course.name}`}
      accessibilityRole="button"
      onPress={() => router.push(`/(teacher)/subject/${course.id}` as any)}
      className="overflow-hidden rounded-2xl border bg-surface-default p-4"
      style={({ pressed }) => ({ borderColor: needsAttention ? '#F59E0B88' : '#244A7C', opacity: pressed ? 0.82 : 1 })}
    >
      <View className="flex-row items-start gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(color, '26') }}>
          <Ionicons name={normalizeAcademicIcon(course.icon, 'book-outline')} size={27} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[18px] font-black text-white" numberOfLines={1}>{course.name}</Text>
          <Text className="mt-1 text-[13px] leading-5 text-text-secondary" numberOfLines={2}>
            {analytics.enrolledCount} alumnos · {analytics.questionsCount} preguntas · {analytics.topicsCount} temas
          </Text>
          <View className="mt-3 flex-row items-center justify-between gap-3">
            <Text className={`text-[12px] font-black ${needsAttention ? 'text-gamification-badge' : 'text-text-secondary'}`}>
              {needsAttention ? 'Necesita atención' : `${participation}% participación`}
            </Text>
            <Text className="text-[12px] font-black text-brand-teacher">Gestionar</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#AFC2DB" />
      </View>
    </Pressable>
  )
}
