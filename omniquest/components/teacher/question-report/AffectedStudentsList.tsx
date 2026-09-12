import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import StudentProfileAvatar from '../students/StudentProfileAvatar'
import AppButton from '../../ui/AppButton'
import PaginationControls from '../../ui/PaginationControls'
import { useAppTheme } from '../../../lib/appTheme'
import type { AffectedStudent } from '../../../lib/teacherQuestionReport'

export default function AffectedStudentsList({
  items,
  total,
  page,
  pageSize,
  onPage,
  onOpenStudent,
}: {
  items: AffectedStudent[]
  total: number
  page: number
  pageSize: number
  onPage: (page: number) => void
  onOpenStudent: (studentId: string) => void
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="flex-row items-center justify-between gap-3">
        <View>
          <Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>Alumnos afectados</Text>
          <Text className="mt-1 text-[12px]" style={{ color: tokens.text.secondary }}>{total} alumno{total === 1 ? '' : 's'} con al menos un fallo.</Text>
        </View>
        <Ionicons name="people-outline" size={25} color={tokens.semantic.warning} />
      </View>
      <View className="mt-4 gap-3">
        {items.length ? items.map((item) => (
          <View key={item.student_id} className="flex-row flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
            <StudentProfileAvatar alias={item.alias} avatar={item.avatar} size={40} accentColor={tokens.semantic.warning} />
            <View className="min-w-[180px] flex-1">
              <Text className="font-black" style={{ color: tokens.text.primary }}>{item.alias}</Text>
              <Text className="mt-1 text-[11px]" style={{ color: tokens.text.muted }}>{item.classroom_name} · {item.failures} fallo{item.failures === 1 ? '' : 's'} · {item.average_time_seconds == null ? 'sin tiempo' : `${item.average_time_seconds}s de media`}</Text>
            </View>
            <AppButton label="Ver historial" icon="time-outline" variant="secondary" size="sm" onPress={() => onOpenStudent(item.student_id)} />
          </View>
        )) : <Text className="py-6 text-center" style={{ color: tokens.text.muted }}>No hay alumnos afectados con estos filtros.</Text>}
      </View>
      <PaginationControls page={page} pageSize={pageSize} total={total} onPrevious={() => onPage(Math.max(0, page - 1))} onNext={() => onPage(page + 1)} />
    </View>
  )
}
