import React from 'react'
import { Text, View } from 'react-native'
import OmniGuide from '../../OmniGuide'
import GameShell from './GameShell'
import ResultState from './GameResultState'
import type { DesignColorTokens } from '../../../lib/designTokens'

type Summary = {
  questionsTotal: number
  answered: number
  correct: number
  incorrect: number
  xp: number
  timeSeconds: number
  reviewQuestions: { id: number; text: string }[]
}

export default function GameStateView({
  status,
  isOffline,
  reviewMode,
  loadError,
  score,
  summary,
  tokens,
  onRetry,
  onBack,
  onReviewMistakes,
}: {
  status: 'loading' | 'error' | 'empty' | 'gameOver' | 'finished'
  isOffline: boolean
  reviewMode?: string
  loadError?: string | null
  score: number
  summary: Summary
  tokens: DesignColorTokens
  onRetry: () => void
  onBack: () => void
  onReviewMistakes: () => void
}) {
  if (status === 'loading') {
    return (
      <GameShell>
        <View className="flex-1 items-center justify-center">
          <OmniGuide state="blink" size={116} />
          <Text className="mt-4 text-text-secondary">Omni está preparando la pregunta...</Text>
        </View>
      </GameShell>
    )
  }

  if (status === 'error') {
    return (
      <GameShell>
        <ResultState
          icon={isOffline ? 'cloud-offline-outline' : 'warning-outline'}
          iconColor={isOffline ? tokens.semantic.warning : tokens.semantic.danger}
          omniState="error"
          title={isOffline ? 'No hay conexión' : 'No se pudo cargar la partida'}
          detail={isOffline
            ? 'Conéctate a Internet para iniciar una partida nueva. Las partidas ya iniciadas se recuperan automáticamente.'
            : loadError || 'Vuelve a intentarlo en unos segundos.'}
          action="Reintentar"
          onPress={onRetry}
          secondaryAction="Volver"
          onSecondaryPress={onBack}
        />
      </GameShell>
    )
  }

  if (status === 'empty') {
    return (
      <GameShell>
        <ResultState
          icon="construct-outline"
          iconColor={tokens.text.muted}
          omniState={reviewMode === 'failed' ? 'happy' : 'thinking'}
          title={reviewMode === 'failed' ? 'Sin fallos pendientes' : 'Todavía no hay preguntas'}
          detail={reviewMode === 'failed'
            ? 'No tienes preguntas falladas para repasar en este tema.'
            : 'El profesor aún no ha añadido preguntas a este tema.'}
          action="Volver al curso"
          onPress={onBack}
        />
      </GameShell>
    )
  }

  const gameOver = status === 'gameOver'
  return (
    <GameShell>
      <ResultState
        icon={gameOver ? 'skull-outline' : 'trophy'}
        iconColor={gameOver ? tokens.semantic.danger : tokens.gamification.xp}
        omniState={gameOver ? 'error' : 'happy'}
        title={gameOver ? 'Partida terminada' : '¡Partida completada!'}
        detail={gameOver
          ? 'Te has quedado sin vidas, pero ya tienes pistas claras para mejorar.'
          : 'Buen cierre. Ya tienes claro qué reforzar.'}
        score={score}
        summary={summary}
        action="Volver al curso"
        onPress={onBack}
        secondaryAction={summary.reviewQuestions.length > 0 ? 'Repasar fallos' : undefined}
        onSecondaryPress={summary.reviewQuestions.length > 0 ? onReviewMistakes : undefined}
      />
    </GameShell>
  )
}
