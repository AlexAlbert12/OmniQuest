import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import StudentDashboardCard from '../StudentDashboardCard'
import { useAppTheme } from '../../../lib/appTheme'
import { useI18n } from '../../../lib/i18n'
import { formatDurationShort } from '../../../lib/studentRecentGamesPresentation'
import { getDifficultyMeta } from '../../../lib/difficulty'
import type { StudentRecentGame } from '../../../features/student-progress/types'

export default function RecentGames({ games, onOpenGame }: { games: StudentRecentGame[]; onOpenGame: (game: StudentRecentGame) => void }) {
  const { tokens } = useAppTheme()
  const { formatDate } = useI18n()

  return (
    <StudentDashboardCard title="Partidas recientes">
      {games.length ? (
        <View className="gap-2">
          {games.map((game) => {
            const hasPending = game.pendingTotal > 0
            const result = [
              `${game.correctTotal} ${game.correctTotal === 1 ? 'correcta' : 'correctas'}`,
              `${game.incorrectTotal} ${game.incorrectTotal === 1 ? 'incorrecta' : 'incorrectas'}`,
              ...(hasPending ? [`${game.pendingTotal} ${game.pendingTotal === 1 ? 'pendiente' : 'pendientes'}`] : []),
            ].join(' · ')
            const context = [game.subjectName, game.topicName].filter(Boolean).join(' · ')
            const difficultyLabel = game.difficulty == null ? null : getDifficultyMeta(game.difficulty).label
            const gameContext = [game.classroomName, difficultyLabel ? `Dificultad ${difficultyLabel}` : null].filter(Boolean).join(' · ')
            return (
              <AppPressable
                key={game.id}
                accessibilityLabel={`Ver partida de ${context || game.subjectName}`}
                accessibilityHint="Abre el detalle de esta partida en modo solo lectura"
                accessibilityRole="button"
                onPress={() => onOpenGame(game)}
                className="flex-row items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised p-3"
              >
                <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: tokens.semanticSurface.info }}>
                  <Ionicons name="game-controller-outline" size={21} color={tokens.brand.student} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[13px] font-black text-text-primary" numberOfLines={2}>{context || 'Partida'}</Text>
                  <Text className="mt-1 text-[11px] font-semibold text-text-secondary" numberOfLines={2}>{result}</Text>
                  {gameContext ? <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={2}>{gameContext}</Text> : null}
                  <Text className="mt-1 text-[11px] text-text-muted">
                    {formatDate(game.finishedAt || game.startedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    {game.durationSeconds == null ? '' : ` · ${formatDurationShort(game.durationSeconds)}`}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-[13px] font-black text-gamification-xp">{game.totalScore} XP{hasPending ? ' *' : ''}</Text>
                  <Text className="text-[11px] font-black text-brand-student">Ver partida</Text>
                </View>
              </AppPressable>
            )
          })}
          {games.some((game) => game.pendingTotal > 0) }
        </View>
      ) : (
        <View className="items-center rounded-xl border border-dashed border-border-default bg-surface-raised px-4 py-6">
          <Ionicons name="game-controller-outline" size={26} color={tokens.text.muted} />
          <Text className="mt-2 text-center text-[13px] font-black text-text-primary">Aún no tienes partidas finalizadas</Text>
          <Text className="mt-1 text-center text-[11px] leading-4 text-text-muted">Cuando termines una misión podrás consultar aquí su resultado.</Text>
        </View>
      )}
    </StudentDashboardCard>
  )
}
