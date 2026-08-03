import React, { useCallback } from 'react'
import { Text, View } from 'react-native'
import VirtualizedStack from '../../ui/VirtualizedStack'
import GamifiedAvatar from '../../gamification/GamifiedAvatar'
import { formatRelativeDate } from '../../../lib/dateFormat'
import type { RankingProfile } from '../../../hooks/student/useStudentRanking'

type RankingTableProps = {
  rows: RankingProfile[]
  currentUserId?: string | null
  emptyMessage: string
}

type RankingTableRowProps = {
  row: RankingProfile
  own: boolean
}

const keyExtractor = (row: RankingProfile) => row.id

const RankingTableRow = React.memo(function RankingTableRow({ row, own }: RankingTableRowProps) {
  return (
    <View className={`flex-row items-center border-b border-border-subtle px-5 py-3 ${own ? 'bg-surface-selected' : ''}`}>
      <Text className="w-16 text-[17px] font-black text-text-primary">#{row.rank ?? '—'}</Text>
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <GamifiedAvatar alias={row.alias} avatarUrl={row.avatar} cosmetics={row.cosmetics} size={42} showLevel={false} />
        <View className="min-w-0 flex-1">
          <Text className="font-black text-text-primary">{row.alias}{own ? ' · Tú' : ''}</Text>
          <Text className="mt-1 text-[11px] text-text-muted">{row.visibility === 'private' ? 'Participación privada' : 'Participación pública'}</Text>
        </View>
      </View>
      <Text className="w-28 text-right font-bold text-text-secondary">{row.correct_answers}</Text>
      <Text className="w-32 text-right text-[12px] text-text-secondary">{formatRelativeDate(row.last_activity_at)}</Text>
      <Text className="w-28 text-right text-[17px] font-black text-gamification-xp">{row.points.toLocaleString()}</Text>
    </View>
  )
})

function RankingTable({ rows, currentUserId, emptyMessage }: RankingTableProps) {
  const renderItem = useCallback((row: RankingProfile) => (
    <RankingTableRow row={row} own={row.id === currentUserId} />
  ), [currentUserId])

  if (rows.length === 0) {
    return <View className="rounded-2xl border border-border-default bg-surface-default p-8"><Text className="text-center text-text-secondary">{emptyMessage}</Text></View>
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-border-default bg-surface-default">
      <View className="flex-row border-b border-border-default bg-surface-raised px-5 py-3">
        <Text className="w-16 text-[11px] font-black uppercase text-text-muted">Puesto</Text>
        <Text className="flex-1 text-[11px] font-black uppercase text-text-muted">Alumno</Text>
        <Text className="w-28 text-right text-[11px] font-black uppercase text-text-muted">Aciertos</Text>
        <Text className="w-32 text-right text-[11px] font-black uppercase text-text-muted">Actividad</Text>
        <Text className="w-28 text-right text-[11px] font-black uppercase text-text-muted">XP</Text>
      </View>
      <VirtualizedStack data={rows} keyExtractor={keyExtractor} gap={0} renderItem={renderItem} accessibilityLabel="Tabla de clasificación" />
    </View>
  )
}

export default React.memo(RankingTable)
