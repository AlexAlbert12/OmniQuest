import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import { formatCount } from '../../../lib/formatCount'
import { withAlpha } from '../../../lib/color'
import type { TeacherStudentHistoryWeakness } from '../../../lib/teacherServerData'

export default function StudentHistoryWeaknesses({ items }: { items: TeacherStudentHistoryWeakness[] }) {
  const { tokens } = useAppTheme()
  if (!items.length) return <Empty message="No se han detectado áreas de refuerzo en este periodo." />
  return (
    <View className="gap-3">
      <Text className="text-[12px]" style={{ color: tokens.text.muted }}>Las respuestas pendientes de evaluación no se consideran errores hasta que exista una decisión docente.</Text>
      {items.map((item) => {
        const accuracy = Math.max(0, Math.min(100, item.accuracy_percent))
        const errorRate = 100 - accuracy
        const riskColor = accuracy < 35 ? tokens.semantic.danger : tokens.semantic.warning
        return (
          <View
            key={`${item.subject_id}:${item.topic_id ?? 'general'}`}
            className="overflow-hidden rounded-2xl border p-3"
            style={{ borderColor: withAlpha(riskColor, '70'), backgroundColor: tokens.surface.default }}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(riskColor, '24') }}><Ionicons name="warning-outline" size={20} color={riskColor} /></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[14px] font-black" style={{ color: tokens.text.primary }} numberOfLines={1}>{item.topic_title}</Text>
                <Text className="mt-0.5 text-[11px]" style={{ color: tokens.text.muted }} numberOfLines={1}>{item.subject_name}</Text>
              </View>
              <View className="items-end">
                <Text className="text-[19px] font-black" style={{ color: riskColor }}>{accuracy}%</Text>
                <Text className="text-[9px] font-black uppercase" style={{ color: tokens.text.muted }}>Precisión</Text>
              </View>
            </View>
            <View className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: tokens.surface.interactive }}>
              <View className="h-full rounded-full" style={{ width: `${errorRate}%`, backgroundColor: riskColor }} />
            </View>
            <View className="mt-2 flex-row items-center justify-between gap-3">
              <Text className="text-[10px] font-bold" style={{ color: riskColor }}>Necesita refuerzo</Text>
              <Text className="text-[10px]" style={{ color: tokens.text.muted }}>{formatCount(item.mistakes, 'error', 'errores')} · {formatCount(item.attempts, 'intento', 'intentos')}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function Empty({ message }: { message: string }) {
  const { tokens } = useAppTheme()
  return <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}><Text style={{ color: tokens.text.muted }}>{message}</Text></View>
}
