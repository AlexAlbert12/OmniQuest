import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { StudentHomeRankingProfile, StudentHomeRankingSummary } from './types'

export default function StudentHomeRankingPreview({
  rows,
  summary,
  currentUserId,
  emptyTitle = 'Aún no hay clasificación',
  emptyMessage = 'Completa una actividad para aparecer en el ranking',
  onOpen,
}: {
  rows: StudentHomeRankingProfile[]
  summary: StudentHomeRankingSummary | null
  currentUserId: string | null
  emptyTitle?: string
  emptyMessage?: string
  onOpen: () => void
}) {
  const { tokens } = useAppTheme()

  return (
    <View className="rounded-[24px] border border-border-default bg-surface-default p-5">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[18px] font-black text-white">Ranking</Text>
          <Text className="mt-1 text-[13px] text-text-muted">
            {summary ? `Tu posición estimada: ${summary.position}` : emptyTitle}
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
        {rows.slice(0, 3).map((row, index) => {
          const isCurrent = row.id === currentUserId
          return (
            <View
              key={row.id}
              className="flex-row items-center gap-3 rounded-xl border px-3 py-2.5"
              style={{
                borderColor: isCurrent ? tokens.border.active : tokens.border.subtle,
                backgroundColor: isCurrent ? tokens.surface.selected : tokens.surface.raised,
              }}
            >
              <Text className="w-6 text-center text-[12px] font-black" style={{ color: index === 0 ? tokens.gamification.xp : tokens.text.muted }}>
                {index + 1}
              </Text>
              <Text maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[13px] font-black text-white">
                {row.alias || 'Alumno'}{isCurrent ? ' · Tú' : ''}
              </Text>
              <Text className="text-[12px] font-black text-brand-student">{(row.points ?? 0).toLocaleString()} XP</Text>
            </View>
          )
        })}
      </View>

      <AppButton label="Ver ranking completo" variant="ghost" size="sm" icon="arrow-forward" iconPosition="right" onPress={onOpen} style={{ marginTop: 14 }} />
    </View>
  )
}
