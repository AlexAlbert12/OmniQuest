import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import GamifiedAvatar from '../../gamification/GamifiedAvatar'
import { getLeagueProgress, type RankingLeague, type RankingProfile, type StudentRankingProfile } from '../../../hooks/student/useStudentRanking'

export default function CurrentPositionCard({
  profile,
  current,
  rank,
  total,
  points,
  league,
  participates,
  isGuest,
}: {
  profile: StudentRankingProfile | null
  current: RankingProfile | null
  rank: number | null
  total: number
  points: number
  league: RankingLeague
  participates: boolean
  isGuest: boolean
}) {
  const progress = getLeagueProgress(points, league)
  const percentile = rank && total > 0 ? Math.max(1, Math.ceil((rank / total) * 100)) : null
  return (
    <View className="overflow-hidden rounded-3xl border border-border-default bg-surface-default p-5">
      <View className="absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-20" style={{ backgroundColor: league.color }} />
      <View className="flex-row flex-wrap items-center gap-4">
        <GamifiedAvatar
          alias={profile?.alias || 'Alumno'}
          avatarUrl={profile?.avatar}
          cosmetics={profile?.cosmetics}
          size={74}
          level={undefined}
          showLevel={false}
        />
        <View className="min-w-[180px] flex-1">
          <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-text-muted">Tu posición actual</Text>
          <Text className="mt-1 text-[28px] font-black text-text-primary">
            {isGuest ? 'Modo invitado' : rank ? `${rank}º de ${Math.max(total, rank)}` : 'Sin posición'}
          </Text>
          <Text className="mt-1 text-[13px] leading-5 text-text-secondary">
            {isGuest
              ? 'Regístrate para competir de forma permanente.'
              : !participates
                ? 'Tu posición solo es visible para ti porque has desactivado tu participación.'
                : percentile
                  ? `Estás en el top ${percentile}% de este ranking.`
                  : 'Completa actividades para entrar en la clasificación.'}
          </Text>
        </View>
        <View className="items-end">
          <View className="flex-row items-center gap-2 rounded-full px-3 py-2" style={{ backgroundColor: `${league.color}22` }}>
            <Ionicons name={league.icon} size={17} color={league.color} />
            <Text className="font-black" style={{ color: league.color }}>{league.name}</Text>
          </View>
          <Text className="mt-2 text-[22px] font-black text-gamification-xp">{points.toLocaleString()} XP</Text>
          {current ? <Text className="mt-1 text-[11px] text-text-muted">{current.correct_answers} respuestas correctas</Text> : null}
        </View>
      </View>
      <View className="mt-5">
        <View className="mb-2 flex-row justify-between gap-3">
          <Text className="text-[12px] text-text-secondary">Progreso dentro de la liga</Text>
          <Text className="text-[12px] font-black text-text-primary">{progress}%</Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-surface-interactive">
          <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: league.color }} />
        </View>
      </View>
    </View>
  )
}
