import React from 'react'
import OmniLoadingScreen from '../../ui/OmniLoadingScreen'
import GameShell from './GameShell'
import ResultState from './GameResultState'
import type { DesignColorTokens } from '../../../lib/designTokens'
import { useI18n } from '../../../lib/i18n'

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
  loadError,
  score,
  summary,
  tokens,
  onRetry,
  onBack,
  isGuest = false,
  onReviewMistakes,
}: {
  status: 'loading' | 'error' | 'empty' | 'gameOver' | 'finished'
  isOffline: boolean
  loadError?: string | null
  score: number
  summary: Summary
  tokens: DesignColorTokens
  onRetry: () => void
  onBack: () => void
  isGuest?: boolean
  onReviewMistakes?: () => void
}) {
  const { t } = useI18n()

  if (status === 'loading') return <OmniLoadingScreen />

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
          omniState="thinking"
          title="Todavía no hay preguntas"
          detail="El profesor aún no ha añadido preguntas a este tema."
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
          ? isGuest
            ? t('guest.game.overDetail')
            : 'Te has quedado sin vidas, pero ya tienes pistas claras para mejorar.'
          : isGuest
            ? t('guest.game.finishedDetail')
            : 'Buen cierre. Ya tienes claro qué reforzar.'}
        score={score}
        summary={summary}
        action={isGuest ? t('guest.game.again') : 'Volver al curso'}
        onPress={onBack}
        secondaryAction={!isGuest && summary.reviewQuestions.length > 0 ? 'Repasar fallos' : undefined}
        onSecondaryPress={!isGuest && summary.reviewQuestions.length > 0 ? onReviewMistakes : undefined}
      />
    </GameShell>
  )
}
