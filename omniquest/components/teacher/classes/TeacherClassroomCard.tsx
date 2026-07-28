import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import type { TeacherClassroom, TeacherClassroomAnalytics, TeacherCourse } from './types'

export default function TeacherClassroomCard({
  analytics,
  classroom,
  course,
  isDesktop,
}: {
  analytics: TeacherClassroomAnalytics
  classroom: TeacherClassroom
  course?: TeacherCourse
  isDesktop: boolean
}) {
  const router = useRouter()
  const openClassroom = () => {
    if (course) router.push(`/(teacher)/subject/${course.id}` as any)
  }

  if (isDesktop) {
    return (
      <Pressable
        accessibilityLabel={`Abrir clase ${classroom.name}`}
        accessibilityRole="button"
        disabled={!course}
        onPress={openClassroom}
        className="min-h-16 flex-row items-center gap-4 border-b border-border-default px-4 py-3"
        style={({ pressed }) => ({ backgroundColor: pressed ? '#102343' : 'transparent' })}
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-semantic-surface-info">
          <Ionicons name="people-outline" size={20} color="#38BDF8" />
        </View>
        <View className="min-w-0 flex-[1.4]">
          <Text className="font-black text-white" numberOfLines={1}>{classroom.name}</Text>
          <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>{course?.name || 'Curso no disponible'}</Text>
        </View>
        <Text className="min-w-24 flex-1 text-[12px] text-text-secondary">{classroom.academic_year || 'Curso actual'}</Text>
        <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.studentsCount}</Text>
        <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.questionsCount}</Text>
        <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.topicsCount}</Text>
        <Ionicons name="chevron-forward" size={18} color="#8FA7C7" />
      </Pressable>
    )
  }

  return (
    <Pressable
      accessibilityLabel={`Abrir clase ${classroom.name}`}
      accessibilityRole="button"
      disabled={!course}
      onPress={openClassroom}
      className="rounded-2xl border border-border-default bg-surface-default p-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-semantic-surface-info">
          <Ionicons name="people-outline" size={24} color="#38BDF8" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[17px] font-black text-white" numberOfLines={1}>{classroom.name}</Text>
          <Text className="mt-1 text-[13px] text-text-secondary" numberOfLines={1}>{course?.name || 'Curso no disponible'}</Text>
          <Text className="mt-3 text-[13px] leading-5 text-text-secondary">
            {analytics.studentsCount} alumnos · {analytics.questionsCount} preguntas · {analytics.topicsCount} temas
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] font-bold text-text-muted">{classroom.code ? `Código ${classroom.code}` : classroom.academic_year || 'Sin código'}</Text>
            <Text className="text-[12px] font-black text-semantic-info">Abrir curso</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#AFC2DB" />
      </View>
    </Pressable>
  )
}
