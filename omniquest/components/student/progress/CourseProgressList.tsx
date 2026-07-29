import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import StudentDashboardCard from '../StudentDashboardCard'
import StudentEmptyState from '../StudentEmptyState'
import AppPressable from '../../ui/AppPressable'
import type { StudentCourseProgress } from '../../../hooks/student/useStudentProgress'

export default function CourseProgressList({ courses, onOpenCourse, onSeeAll }: {
  courses: StudentCourseProgress[]
  onOpenCourse: (course: StudentCourseProgress) => void
  onSeeAll: () => void
}) {
  return (
    <StudentDashboardCard title="Progreso por curso" actionLabel="Ver todos" onAction={onSeeAll}>
      {courses.length === 0 ? (
        <StudentEmptyState icon="book-outline" title="Aún no hay cursos" message="Únete a un curso para empezar a construir tu progreso." />
      ) : (
        <View className="gap-3">
          {courses.map((course) => (
            <AppPressable
              key={`${course.id}:${course.classroomId ?? 'general'}`}
              accessibilityLabel={`Abrir ${course.name}, ${course.barPercent}% completado`}
              onPress={() => onOpenCourse(course)}
              className="rounded-2xl border border-border-default bg-surface-raised p-4"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${course.color}20` }}>
                  <Ionicons name={course.icon} size={22} color={course.color} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[16px] font-black text-text-primary">{course.name}</Text>
                  <Text className="mt-1 text-[12px] text-text-secondary">{course.detail}</Text>
                </View>
                <Text className="text-[15px] font-black text-brand-student">{course.barPercent}%</Text>
              </View>
              <View className="mt-3 h-2 overflow-hidden rounded-full bg-surface-interactive">
                <View className="h-full rounded-full" style={{ width: `${course.barPercent}%`, backgroundColor: course.color }} />
              </View>
              <Text className="mt-2 text-[12px] text-text-muted">
                {course.failedQuestions} para practicar · mejor resultado {course.bestScore ?? 0} XP
              </Text>
            </AppPressable>
          ))}
        </View>
      )}
    </StudentDashboardCard>
  )
}
