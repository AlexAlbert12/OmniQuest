import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { StudentHomeRankingPreviewRow, StudentHomeRankingSummary } from './types'

export default function StudentHomeRankingPreview({
  rows,
  summary,
  currentUserId,
  emptyTitle = 'Aún no hay clasificación',
  emptyMessage = 'Completa una actividad para aparecer en el ranking',
  onOpen,
}: {
  rows: StudentHomeRankingPreviewRow[]
  summary: StudentHomeRankingSummary | null
  currentUserId: string | null
  emptyTitle?: string
  emptyMessage?: string
  onOpen: () => void
}) {
  const { tokens } = useAppTheme()

  return (
    <AppPressable
      accessibilityLabel="Abrir ranking"
      accessibilityHint="Muestra la clasificación completa"
      onPress={onOpen}
      className="rounded-[24px] border border-border-default bg-surface-default p-5"
      style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[18px] font-black text-white">Ranking</Text>
          <Text className="mt-1 text-[13px] text-text-muted">
            {summary
              ? `${summary.estimated ? 'Tu posición estimada' : 'Tu posición'}: ${summary.position}`
              : rows.length > 0
                ? 'Completa una actividad para calcular tu posición'
                : emptyTitle}
          </Text>
        </View>
        <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(tokens.gamification.xp, '24') }}>
          <Ionicons name="trophy" size={23} color={tokens.gamification.xp} />
        </View>
      </View>

      <View className="mt-4 gap-2">
        {rows.length === 0 ? (
          <View className="rounded-xl border border-border-subtle bg-surface-raised px-4 py-4">
            <Text maxFontSizeMultiplier={2} className="text-[13px] leading-5 text-text-secondary">
              {emptyMessage}
            </Text>
          </View>
        ) : null}
        {rows.map((row) => {
          const isCurrent = row.id === currentUserId
          return (
            <View
              key={row.id}
              className="flex-row items-center gap-3 rounded-xl border px-3 py-2.5"
              style={{
                borderColor: isCurrent ? tokens.border.active : withAlpha(tokens.border.subtle, '80'),
                backgroundColor: isCurrent ? tokens.surface.selected : tokens.surface.raised,
              }}
            >
              <Text className="w-7 text-center text-[12px] font-black" style={{ color: row.position === 1 ? tokens.gamification.xp : tokens.text.muted }}>
                {row.estimated ? `≈${row.position}` : row.position}
              </Text>
              <Text maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[13px] font-black text-white">
                {row.alias || 'Alumno'}{isCurrent ? ' · Tú' : ''}
              </Text>
              <Text className="text-[12px] font-black text-brand-student">{(row.points ?? 0).toLocaleString()} XP</Text>
            </View>
          )
        })}
      </View>

      <View className="mt-4 flex-row items-center justify-end gap-1">
        <Text className="text-[11px] font-black text-brand-student">Abrir ranking</Text>
        <Ionicons name="chevron-forward" size={16} color={tokens.brand.student} />
      </View>
    </AppPressable>
  )
}
