import React from 'react'
import { Text, View } from 'react-native'
import TeacherCourseCard from './TeacherCourseCard'
import VirtualizedStack from '../../ui/VirtualizedStack'
import type { TeacherCourse, TeacherCourseAnalytics } from './types'

export default function TeacherCoursesList({ analyticsByCourse, courses, isDesktop }: {
  analyticsByCourse: Record<number, TeacherCourseAnalytics>
  courses: TeacherCourse[]
  isDesktop: boolean
}) {
  if (courses.length === 0) {
    return <EmptyCatalog title="No hay cursos que coincidan" detail="Prueba con otra búsqueda o crea un curso nuevo." />
  }

  return (
    <View className={isDesktop ? 'overflow-hidden rounded-2xl border border-border-default bg-surface-default' : 'gap-3'}>
      {isDesktop ? (
        <View className="flex-row items-center gap-4 border-b border-border-default bg-surface-raised px-4 py-3">
          <Text className="w-10 text-[11px] font-black uppercase text-text-muted">Curso</Text>
          <Text className="flex-[1.5] text-[11px] font-black uppercase text-text-muted">Nombre</Text>
          <Text className="w-20 text-center text-[11px] font-black uppercase text-text-muted">Alumnos</Text>
          <Text className="w-20 text-center text-[11px] font-black uppercase text-text-muted">Preguntas</Text>
          <Text className="w-28 text-center text-[11px] font-black uppercase text-text-muted">Estado</Text>
          <View className="w-[18px]" />
        </View>
      ) : null}
      <VirtualizedStack
        data={courses}
        keyExtractor={(course) => String(course.id)}
        gap={isDesktop ? 0 : 12}
        renderItem={(course) => <TeacherCourseCard course={course} analytics={analyticsByCourse[course.id]} isDesktop={isDesktop} />}
        accessibilityLabel="Cursos del profesor"
      />
    </View>
  )
}

function EmptyCatalog({ detail, title }: { detail: string; title: string }) {
  return (
    <View className="items-center rounded-2xl border border-dashed border-border-default bg-surface-default px-5 py-10">
      <Text className="font-black text-white">{title}</Text>
      <Text className="mt-2 text-center text-[13px] text-text-muted">{detail}</Text>
    </View>
  )
}
