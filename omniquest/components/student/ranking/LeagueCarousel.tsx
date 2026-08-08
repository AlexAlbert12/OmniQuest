import React from 'react'
import { ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { getLeagueProgress, type RankingLeague } from '../../../hooks/student/useStudentRanking'

export default function LeagueCarousel({
  leagues,
  currentLeague,
  selectedLeague,
  points,
  onSelect,
}: {
  leagues: RankingLeague[]
  currentLeague: RankingLeague
  selectedLeague: RankingLeague | null
  points: number
  onSelect: (league: RankingLeague | null) => void
}) {
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const cardWidth = width < 640 ? 150 : 190
  return (
    <View style={{ overflow: 'hidden' }}>
      <View className="mb-3 flex-row items-end justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[17px] font-black text-text-primary">Ligas</Text>
          <Text className="mt-1 text-[12px] leading-5 text-text-secondary">Filtra la clasificación o muestra todas las ligas.</Text>
        </View>
        {selectedLeague ? (
          <AppPressable accessibilityLabel="Quitar filtro de liga" onPress={() => onSelect(null)} className="rounded-xl px-3 py-2">
            <Text className="font-black text-brand-student">Ver todas</Text>
          </AppPressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 28 }}>
        {leagues.map((league) => {
          const active = selectedLeague?.name === league.name || (!selectedLeague && currentLeague.name === league.name)
          const progress = getLeagueProgress(points, league)
          return (
            <AppPressable
              key={league.name}
              accessibilityLabel={`Liga ${league.name}`}
              accessibilityHint="Filtra el ranking por esta liga"
              accessibilityState={{ selected: selectedLeague?.name === league.name }}
              onPress={() => onSelect(league)}
              className="omni-no-hover-lift rounded-2xl border bg-surface-default p-4"
              style={{ width: cardWidth, borderColor: active ? league.color : tokens.border.default }}
            >
              <View className="flex-row items-center justify-between">
                <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${league.color}22` }}>
                  <Ionicons name={league.icon} size={21} color={league.color} />
                </View>
                {currentLeague.name === league.name ? <Text className="text-[10px] font-black uppercase text-brand-student">Tu liga</Text> : null}
              </View>
              <Text className="mt-3 text-[16px] font-black text-text-primary">{league.name}</Text>
              <Text className="mt-1 text-[12px] text-text-secondary">
                {league.nextMinPoints === null ? `${league.minPoints.toLocaleString()}+ XP` : `${league.minPoints.toLocaleString()}–${(league.nextMinPoints - 1).toLocaleString()} XP`}
              </Text>
              <View className="mt-3 h-2 overflow-hidden rounded-full bg-surface-interactive">
                <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: league.color, opacity: active ? 0.78 : 0.56 }} />
              </View>
            </AppPressable>
          )
        })}
      </ScrollView>
    </View>
  )
}
