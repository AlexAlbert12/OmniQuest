import React from 'react'
import { Text, View } from 'react-native'
import TeacherClassroomCard from './TeacherClassroomCard'
import type { TeacherClassroom, TeacherClassroomAnalytics, TeacherCourse } from './types'

export default function TeacherClassroomsList({ analyticsByClassroom, classrooms, coursesById, isDesktop }: {
  analyticsByClassroom: Record<number, TeacherClassroomAnalytics>
  classrooms: TeacherClassroom[]
  coursesById: Record<number, TeacherCourse>
  isDesktop: boolean
}) {
  if (classrooms.length === 0) {
    return (
      <View className="items-center rounded-2xl border border-dashed border-[#29466F] bg-[#07162D] px-5 py-10">
        <Text className="font-black text-white">No hay clases que coincidan</Text>
        <Text className="mt-2 text-center text-[13px] text-[#8FA7C7]">Crea una clase dentro de uno de tus cursos o cambia la búsqueda.</Text>
      </View>
    )
  }

  return (
    <View className={isDesktop ? 'overflow-hidden rounded-2xl border border-[#183052] bg-[#07162D]' : 'gap-3'}>
      {isDesktop ? (
        <View className="flex-row items-center gap-4 border-b border-[#29466F] bg-[#0B1D38] px-4 py-3">
          <Text className="w-10 text-[11px] font-black uppercase text-[#8FA7C7]">Clase</Text>
          <Text className="flex-[1.4] text-[11px] font-black uppercase text-[#8FA7C7]">Nombre / curso</Text>
          <Text className="min-w-24 flex-1 text-[11px] font-black uppercase text-[#8FA7C7]">Año</Text>
          <Text className="w-20 text-center text-[11px] font-black uppercase text-[#8FA7C7]">Alumnos</Text>
          <Text className="w-20 text-center text-[11px] font-black uppercase text-[#8FA7C7]">Preguntas</Text>
          <Text className="w-20 text-center text-[11px] font-black uppercase text-[#8FA7C7]">Temas</Text>
          <View className="w-[18px]" />
        </View>
      ) : null}
      {classrooms.map((classroom) => (
        <TeacherClassroomCard
          key={classroom.id}
          analytics={analyticsByClassroom[classroom.id] || { studentsCount: 0, questionsCount: 0, topicsCount: 0 }}
          classroom={classroom}
          course={classroom.subject_id ? coursesById[classroom.subject_id] : undefined}
          isDesktop={isDesktop}
        />
      ))}
    </View>
  )
}
