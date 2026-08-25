import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import type { TeacherClassroom, TeacherClassroomAnalytics, TeacherCourse } from './types'
import AppPressable from '../../ui/AppPressable'

export default function TeacherClassroomCard({
  analytics,
  classroom,
  course,
  density,
}: {
  analytics: TeacherClassroomAnalytics
  classroom: TeacherClassroom
  course?: TeacherCourse
  density: 'compact' | 'comfortable'
}) {
  const router = useRouter()
  const compact = density === 'compact'
  const openClassroom = () => {
    if (course) router.push(`/(teacher)/subject/${course.id}?classroomId=${classroom.id}` as any)
  }

  return (
    <AppPressable
      accessibilityLabel={`Abrir clase ${classroom.name}`}
      accessibilityHint="Abre la clase seleccionada dentro de su curso"
      accessibilityRole="button"
      disabled={!course}
      onPress={openClassroom}
      className={compact
        ? 'flex-row items-start gap-3 rounded-2xl border border-border-default bg-surface-default p-4'
        : 'min-h-16 flex-row items-center gap-4 border-b border-border-default px-4 py-3'}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className={`${compact ? 'h-12 w-12' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-xl bg-semantic-surface-info`}>
        <Ionicons name="people-outline" size={compact ? 24 : 20} color="#38BDF8" />
      </View>
      <View className={`min-w-0 ${compact ? 'flex-1' : 'flex-[1.4]'}`}>
        <Text className={`${compact ? 'text-[17px] leading-5' : 'text-[14px] leading-5'} font-black text-white`} numberOfLines={2}>{classroom.name}</Text>
        <Text className={`mt-1 ${compact ? 'text-[13px] text-text-secondary' : 'text-[12px] text-text-muted'}`} numberOfLines={2}>{course?.name || 'Curso no disponible'}</Text>
        {compact ? (
          <>
          <Text className="mt-3 text-[13px] leading-5 text-text-secondary">
            {analytics.studentsCount} alumnos · {analytics.questionsCount} preguntas
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] font-bold text-text-muted">{classroom.code ? `Código ${classroom.code}` : classroom.academic_year || 'Sin código'}</Text>
            <Text className="text-[12px] font-black text-semantic-info">Abrir clase</Text>
          </View>
          </>
        ) : null}
      </View>
      {!compact ? <Text className="min-w-24 flex-1 text-[12px] text-text-secondary">{classroom.academic_year || 'Curso actual'}</Text> : null}
      {!compact ? <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.studentsCount}</Text> : null}
      {!compact ? <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.questionsCount}</Text> : null}
      {!compact ? <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.topicsCount}</Text> : null}
      <Ionicons name="chevron-forward" size={compact ? 20 : 18} color="#AFC2DB" />
    </AppPressable>
  )
}
