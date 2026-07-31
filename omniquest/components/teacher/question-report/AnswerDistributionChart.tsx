import React from 'react'
import { Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import type { AnswerDistributionPoint } from '../../../lib/teacherQuestionReport'

export default function AnswerDistributionChart({ items }: { items: AnswerDistributionPoint[] }) {
  const { tokens } = useAppTheme()
  return (
    <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>Distribución de respuestas</Text>
      <Text className="mt-1 text-[12px]" style={{ color: tokens.text.secondary }}>Porcentaje de selección de cada alternativa.</Text>
      <View className="mt-4 gap-4">
        {items.length ? items.map((item) => (
          <View key={item.label}>
            <View className="mb-2 flex-row items-center justify-between gap-3">
              <Text className="min-w-0 flex-1 text-[13px] font-bold" style={{ color: tokens.text.primary }}>{item.label}</Text>
              <Text className="text-[12px] font-black" style={{ color: item.correct ? tokens.semantic.success : tokens.text.secondary }}>{item.percent}% · {item.count}</Text>
            </View>
            <View className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: tokens.surface.interactive }}>
              <View style={{ width: `${Math.max(2, Math.min(100, item.percent))}%`, height: '100%', borderRadius: 999, backgroundColor: item.correct ? tokens.semantic.success : tokens.brand.teacher }} />
            </View>
          </View>
        )) : <Text className="py-6 text-center" style={{ color: tokens.text.muted }}>No hay respuestas en el periodo seleccionado.</Text>}
      </View>
    </View>
  )
}
