import React from 'react'
import { Platform, Text, View } from 'react-native'
import GamifiedAvatar from '../../gamification/GamifiedAvatar'
import { formatRelativeDate } from '../../../lib/dateFormat'
import { formatCount } from '../../../lib/formatCount'
import type { RankingProfile } from '../../../hooks/student/useStudentRanking'

type RankingMobileListProps = {
  rows: RankingProfile[]
  currentUserId?: string | null
  emptyMessage: string
}

type RankingMobileRowProps = {
  row: RankingProfile
  own: boolean
}

const RankingMobileRow = React.memo(function RankingMobileRow({ row, own }: RankingMobileRowProps) {
  return (
    <View className={`flex-row items-center gap-3 rounded-2xl border p-4 ${own ? 'border-brand-student bg-surface-selected' : 'border-border-default bg-surface-default'}`}>
      <View className="w-11 items-center"><Text className="text-[20px] font-black text-text-primary">#{row.rank ?? '—'}</Text></View>
      <GamifiedAvatar alias={row.alias} avatarUrl={row.avatar} cosmetics={row.cosmetics} size={46} showLevel={false} />
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-black text-text-primary">{row.alias}{own ? ' · Tú' : ''}</Text>
        <Text className="mt-1 text-[11px] text-text-muted">{formatCount(row.correct_answers, 'acierto', 'aciertos')} · {formatRelativeDate(row.last_activity_at)}</Text>
      </View>
      <Text className="text-[16px] font-black text-gamification-xp">{row.points.toLocaleString()} XP</Text>
    </View>
  )
})

function RankingMobileList({ rows, currentUserId, emptyMessage }: RankingMobileListProps) {
  if (rows.length === 0) {
    return <View className="rounded-2xl border border-border-default bg-surface-default p-6"><Text className="text-center leading-6 text-text-secondary">{emptyMessage}</Text></View>
  }

  // En móvil solo se renderizan 6 participantes por página. Una lista virtualizada anidada, incluso
  // sin desplazamiento propio, puede quedarse con el gesto táctil en Safari/Chrome móvil.
  // Una pila normal deja que el ScrollView principal sea el único dueño del gesto vertical.
  return (
    <View accessibilityLabel="Clasificación de alumnos" className="gap-3" style={Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as any) : undefined}>
      {rows.map((row) => <RankingMobileRow key={row.id} row={row} own={row.id === currentUserId} />)}
    </View>
  )
}

export default React.memo(RankingMobileList)
