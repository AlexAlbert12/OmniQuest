import React from 'react'
import { Text, useWindowDimensions, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import { formatCount } from '../../../lib/formatCount'
import type { TeacherStudentHistoryMetricsPayload } from '../../../lib/teacherServerData'

export default function StudentHistoryMetrics({ data }: { data: TeacherStudentHistoryMetricsPayload | null }) {
  const { tokens } = useAppTheme()
  const { width } = useWindowDimensions()
  const compact = width < 560
  if (!data) return <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}><Text style={{ color: tokens.text.muted }}>Abre esta pestaña para cargar las métricas secundarias.</Text></View>
  return (
    <View className="gap-5">
      <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Text className="text-[17px] font-black" style={{ color: tokens.text.primary }}>Evolución diaria</Text>
        <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>La precisión solo utiliza respuestas ya evaluadas.</Text>
        <View className="mt-4 gap-2">
          {data.evolution.map((item) => compact ? (
            <View key={item.date} className="rounded-xl p-3" style={{ backgroundColor: tokens.surface.raised }}>
              <View className="flex-row items-start justify-between gap-3">
                <Text className="font-black" style={{ color: tokens.text.primary }}>{formatDate(item.date)}</Text>
                <Text className="font-black" style={{ color: tokens.semantic.info }}>{item.accuracyPercent === null ? 'Pendiente' : `${item.accuracyPercent}%`} · <Text style={{ color: tokens.gamification.xp }}>+{item.earnedXp} XP</Text></Text>
              </View>
              <Text className="mt-2 text-[12px]" style={{ color: tokens.text.secondary }}>{formatCount(item.attempts, 'intento', 'intentos')} · {formatCount(item.correct, 'respuesta correcta', 'respuestas correctas')}{item.pending > 0 ? ` · ${formatCount(item.pending, 'pendiente', 'pendientes')}` : ''}</Text>
            </View>
          ) : (
            <View key={item.date} className="flex-row flex-wrap items-center gap-3 rounded-xl p-3" style={{ backgroundColor: tokens.surface.raised }}>
              <Text className="min-w-[100px] font-black" style={{ color: tokens.text.primary }}>{formatDate(item.date)}</Text>
              <Text className="flex-1 text-[12px]" style={{ color: tokens.text.secondary }}>{formatCount(item.attempts, 'intento', 'intentos')} · {formatCount(item.correct, 'respuesta correcta', 'respuestas correctas')}{item.pending > 0 ? ` · ${formatCount(item.pending, 'pendiente', 'pendientes')}` : ''}</Text>
              <Text className="font-black" style={{ color: tokens.semantic.info }}>{item.accuracyPercent === null ? 'Pendiente' : `${item.accuracyPercent}%`}</Text>
              <Text className="font-black" style={{ color: tokens.gamification.xp }}>+{item.earnedXp} XP</Text>
            </View>
          ))}
        </View>
      </View>
      <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Text className="text-[17px] font-black" style={{ color: tokens.text.primary }}>Rendimiento por tema</Text>
        <View className="mt-4 gap-2">
          {data.topics.map((item) => compact ? (
            <View key={`${item.subject_id}:${item.topic_id ?? 'general'}`} className="rounded-xl p-3" style={{ backgroundColor: tokens.surface.raised }}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1"><Text className="font-black" style={{ color: tokens.text.primary }}>{item.topic_title}</Text><Text className="text-[11px]" style={{ color: tokens.text.muted }}>{item.subject_name}</Text></View>
                <Text className="font-black" style={{ color: tokens.semantic.info }}>{item.accuracy_percent === null ? 'Pendiente' : `${item.accuracy_percent}%`} · <Text style={{ color: tokens.gamification.xp }}>+{item.earned_xp} XP</Text></Text>
              </View>
              <Text className="mt-2 text-[12px]" style={{ color: tokens.text.secondary }}>{formatCount(item.attempts, 'intento', 'intentos')} · {formatCount(item.correct, 'respuesta correcta', 'respuestas correctas')}{item.pending > 0 ? ` · ${formatCount(item.pending, 'pendiente', 'pendientes')}` : ''}</Text>
            </View>
          ) : (
            <View key={`${item.subject_id}:${item.topic_id ?? 'general'}`} className="flex-row flex-wrap items-center gap-3 rounded-xl p-3" style={{ backgroundColor: tokens.surface.raised }}>
              <View className="min-w-[220px] flex-1"><Text className="font-black" style={{ color: tokens.text.primary }}>{item.topic_title}</Text><Text className="text-[11px]" style={{ color: tokens.text.muted }}>{item.subject_name}</Text></View>
              <Text style={{ color: tokens.text.secondary }}>{formatCount(item.attempts, 'intento', 'intentos')}</Text>
              <Text className="font-black" style={{ color: tokens.semantic.info }}>{item.accuracy_percent === null ? 'Pendiente' : `${item.accuracy_percent}%`}</Text>
              <Text className="font-black" style={{ color: tokens.gamification.xp }}>+{item.earned_xp} XP</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
