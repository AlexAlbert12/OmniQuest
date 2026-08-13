import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import GamifiedAvatar from '../../gamification/GamifiedAvatar'
import { formatCount } from '../../../lib/formatCount'
import { useResponsiveLayout } from '../../../lib/responsive'
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
  const responsive = useResponsiveLayout()
  const progress = getLeagueProgress(points, league)
  const participantTotal = rank ? Math.max(total, rank) : total
  const percentile = rank && participantTotal > 1 ? Math.max(1, Math.ceil((rank / participantTotal) * 100)) : null
  const position = isGuest ? 'Modo invitado' : rank ? `${rank}.º de ${participantTotal}` : 'Sin posición'
  const positionDetail = isGuest
    ? 'Regístrate para competir de forma permanente.'
    : !participates
      ? 'Tu posición solo es visible para ti porque has desactivado tu participación.'
      : rank && participantTotal === 1
        ? 'Eres el único participante por ahora.'
        : percentile
          ? `Estás en el top ${percentile}% de este ranking.`
          : 'Completa actividades para entrar en la clasificación.'

  return (
    <View className={`overflow-hidden rounded-3xl border border-border-default bg-surface-default ${responsive.isMobile ? 'p-4' : 'p-5'}`}>
      <View className="absolute rounded-full" style={{ width: responsive.isMobile ? 112 : 144, height: responsive.isMobile ? 112 : 144, right: responsive.isMobile ? -34 : -40, top: responsive.isMobile ? -38 : -40, opacity: responsive.isMobile ? 0.14 : 0.2, backgroundColor: league.color }} />

      {responsive.isMobile ? (
        <>
          <View className="flex-row items-start gap-3">
            <GamifiedAvatar
              alias={profile?.alias || 'Alumno'}
              avatarUrl={profile?.avatar}
              cosmetics={profile?.cosmetics}
              size={62}
              level={undefined}
              showLevel={false}
            />
            <View className="min-w-0 flex-1 pt-0.5">
              <Text className="text-[10px] font-black uppercase tracking-[0.07em] text-text-muted">Tu posición actual</Text>
              <Text className="mt-1 text-[24px] font-black leading-7 text-text-primary">{position}</Text>
            </View>

            <View className="items-end">
              <View className="flex-row items-center gap-2 rounded-full px-3 py-2" style={{ backgroundColor: `${league.color}22` }}>
                <Ionicons name={league.icon} size={17} color={league.color} />
                <Text className="font-black" style={{ color: league.color }}>{league.name}</Text>
              </View>
              <Text className="mt-2 text-[22px] font-black text-gamification-xp">{points.toLocaleString('es-ES')} XP</Text>
            </View>
          </View>
          <Text className="mt-3 text-[13px] leading-5 text-text-secondary">{positionDetail}</Text>
        </>
      ) : (
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
            <Text className="mt-1 text-[28px] font-black text-text-primary">{position}</Text>
            <Text className="mt-1 text-[13px] leading-5 text-text-secondary">{positionDetail}</Text>
          </View>
          <View className="items-end">
            <View className="flex-row items-center gap-2 rounded-full px-3 py-2" style={{ backgroundColor: `${league.color}22` }}>
              <Ionicons name={league.icon} size={17} color={league.color} />
              <Text className="font-black" style={{ color: league.color }}>{league.name}</Text>
            </View>
            <Text className="mt-2 text-[22px] font-black text-gamification-xp">{points.toLocaleString('es-ES')} XP</Text>
            {current ? <Text className="mt-1 text-[11px] text-text-muted">{formatCount(current.correct_answers, 'respuesta correcta', 'respuestas correctas')}</Text> : null}
          </View>
        </View>
      )}

      <View className={responsive.isMobile ? 'mt-4' : 'mt-5'}>
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
