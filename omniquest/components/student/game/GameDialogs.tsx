import React from 'react'
import AppConfirmModal from '../../AppConfirmModal'
import type { GameQuestionConflict } from './types'

export type GamePendingAction = 'hint' | 'skip' | 'exit' | null

export default function GameDialogs({
  pendingAction,
  feedbackDialog,
  conflict,
  onCancelAction,
  onConfirmExit,
  onConfirmHint,
  onConfirmSkip,
  onDismissFeedback,
  onReloadConflict,
  onExitConflict,
}: {
  pendingAction: GamePendingAction
  feedbackDialog: { title: string; message: string } | null
  conflict: GameQuestionConflict | null
  onCancelAction: () => void
  onConfirmExit: () => void
  onConfirmHint: () => void
  onConfirmSkip: () => void
  onDismissFeedback: () => void
  onReloadConflict: () => void
  onExitConflict: () => void
}) {
  return (
    <>
      <AppConfirmModal
        visible={pendingAction === 'exit'}
        variant="warning"
        showOmni
        omniState="thinking"
        title="¿Salir de la partida?"
        message="La partida se marcará como abandonada y este intento quedará registrado. Las respuestas ya sincronizadas no se perderán."
        cancelLabel="Seguir jugando"
        confirmLabel="Abandonar partida"
        onCancel={onCancelAction}
        onConfirm={onConfirmExit}
      />
      <AppConfirmModal
        visible={pendingAction === 'hint'}
        variant="info"
        showOmni
        omniState="thinking"
        title="¿Usar pista?"
        message="Se destacará una ayuda en la pregunta actual. Si aciertas, se aplicarán -10 XP."
        cancelLabel="Cancelar"
        confirmLabel="Usar pista"
        onCancel={onCancelAction}
        onConfirm={onConfirmHint}
      />
      <AppConfirmModal
        visible={pendingAction === 'skip'}
        variant="warning"
        showOmni
        omniState="thinking"
        title="¿Saltar pregunta?"
        message="Perderás 20 XP y la pregunta quedará como no superada."
        cancelLabel="Cancelar"
        confirmLabel="Saltar pregunta"
        onCancel={onCancelAction}
        onConfirm={onConfirmSkip}
      />
      <AppConfirmModal
        visible={Boolean(feedbackDialog)}
        variant="info"
        showOmni
        omniState="thinking"
        title={feedbackDialog?.title ?? ''}
        message={feedbackDialog?.message ?? ''}
        cancelLabel="Cerrar"
        confirmLabel="Entendido"
        onCancel={onDismissFeedback}
        onConfirm={onDismissFeedback}
      />
      <AppConfirmModal
        visible={Boolean(conflict)}
        variant="warning"
        showOmni
        omniState="error"
        title="Esta pregunta fue actualizada"
        message={conflict?.message || 'El contenido cambió mientras la partida estaba sin conexión. Tu respuesta no se ha corregido con una versión distinta.'}
        cancelLabel="Salir"
        confirmLabel="Actualizar partida"
        onCancel={onExitConflict}
        onConfirm={onReloadConflict}
      />
    </>
  )
}
