import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import type { TeacherStudentHistoryWeakness } from '../../../lib/teacherServerData'

export default function StudentHistoryWeaknesses({ items }: { items: TeacherStudentHistoryWeakness[] }) {
  const { tokens } = useAppTheme()
  if (!items.length) return <Empty message="No se han detectado áreas de refuerzo en este periodo." />
  return (
    <View className="gap-3">
      {items.map((item) => (
        <View key={`${item.subject_id}:${item.topic_id ?? 'general'}`} className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
          <View className="flex-row flex-wrap items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: tokens.semanticSurface.warning }}>
              <Ionicons name="warning-outline" size={22} color={tokens.semantic.warning} />
            </View>
            <View className="min-w-[220px] flex-1">
              <Text className="font-black" style={{ color: tokens.text.primary }}>{item.topic_title}</Text>
              <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>{item.subject_name}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[20px] font-black" style={{ color: tokens.semantic.warning }}>{item.accuracy_percent}%</Text>
              <Text className="text-[11px]" style={{ color: tokens.text.muted }}>{item.mistakes} errores · {item.attempts} intentos</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

function Empty({ message }: { message: string }) {
  const { tokens } = useAppTheme()
  return <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}><Text style={{ color: tokens.text.muted }}>{message}</Text></View>
}
