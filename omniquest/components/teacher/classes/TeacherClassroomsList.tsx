import React from 'react'
import { Text, View } from 'react-native'
import TeacherClassroomCard from './TeacherClassroomCard'
import VirtualizedStack from '../../ui/VirtualizedStack'
import type { TeacherClassroom, TeacherClassroomAnalytics, TeacherCourse } from './types'

export default function TeacherClassroomsList({ analyticsByClassroom, classrooms, coursesById, isDesktop }: {
  analyticsByClassroom: Record<number, TeacherClassroomAnalytics>
  classrooms: TeacherClassroom[]
  coursesById: Record<number, TeacherCourse>
  isDesktop: boolean
}) {
  if (classrooms.length === 0) {
    return (
      <View className="items-center rounded-2xl border border-dashed border-border-default bg-surface-default px-5 py-10">
        <Text className="font-black text-white">No hay clases que coincidan</Text>
        <Text className="mt-2 text-center text-[13px] text-text-muted">Crea una clase dentro de uno de tus cursos o cambia la búsqueda.</Text>
      </View>
    )
  }

  return (
    <View className={isDesktop ? 'overflow-hidden rounded-2xl border border-border-default bg-surface-default' : 'gap-3'}>
      {isDesktop ? (
        <View className="flex-row items-center gap-4 border-b border-border-default bg-surface-raised px-4 py-3">
          <Text className="w-10 text-[11px] font-black uppercase text-text-muted">Clase</Text>
          <Text className="flex-[1.4] text-[11px] font-black uppercase text-text-muted">Nombre / curso</Text>
          <Text className="min-w-24 flex-1 text-[11px] font-black uppercase text-text-muted">Año</Text>
          <Text className="w-20 text-center text-[11px] font-black uppercase text-text-muted">Alumnos</Text>
          <Text className="w-20 text-center text-[11px] font-black uppercase text-text-muted">Preguntas</Text>
          <Text className="w-20 text-center text-[11px] font-black uppercase text-text-muted">Temas</Text>
          <View className="w-[18px]" />
        </View>
      ) : null}
      <VirtualizedStack
        data={classrooms}
        keyExtractor={(classroom) => String(classroom.id)}
        gap={isDesktop ? 0 : 12}
        renderItem={(classroom) => (
          <TeacherClassroomCard
            analytics={analyticsByClassroom[classroom.id] || { studentsCount: 0, questionsCount: 0, topicsCount: 0 }}
            classroom={classroom}
            course={classroom.subject_id ? coursesById[classroom.subject_id] : undefined}
            isDesktop={isDesktop}
          />
        )}
        accessibilityLabel="Clases del profesor"
      />
    </View>
  )
}
