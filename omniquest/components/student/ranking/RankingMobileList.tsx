import React from 'react'
import { Text, View } from 'react-native'
import GamifiedAvatar from '../../gamification/GamifiedAvatar'
import { formatRelativeDate } from '../../../lib/dateFormat'
import type { RankingProfile } from '../../../hooks/student/useStudentRanking'

export default function RankingMobileList({ rows, currentUserId, emptyMessage }: { rows: RankingProfile[]; currentUserId?: string | null; emptyMessage: string }) {
  if (rows.length === 0) {
    return <View className="rounded-2xl border border-border-default bg-surface-default p-6"><Text className="text-center leading-6 text-text-secondary">{emptyMessage}</Text></View>
  }
  return (
    <View className="gap-3">
      {rows.map((row) => {
        const own = row.id === currentUserId
        return (
          <View key={row.id} className={`flex-row items-center gap-3 rounded-2xl border p-4 ${own ? 'border-brand-student bg-surface-selected' : 'border-border-default bg-surface-default'}`}>
            <View className="w-11 items-center"><Text className="text-[20px] font-black text-text-primary">#{row.rank ?? '—'}</Text></View>
            <GamifiedAvatar alias={row.alias} avatarUrl={row.avatar} cosmetics={row.cosmetics} size={46} showLevel={false} />
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-black text-text-primary">{row.alias}{own ? ' · Tú' : ''}</Text>
              <Text className="mt-1 text-[11px] text-text-muted">{row.correct_answers} aciertos · {formatRelativeDate(row.last_activity_at)}</Text>
            </View>
            <Text className="text-[16px] font-black text-gamification-xp">{row.points.toLocaleString()} XP</Text>
          </View>
        )
      })}
    </View>
  )
}
