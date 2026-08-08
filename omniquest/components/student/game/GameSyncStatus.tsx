import React from 'react'
import { View } from 'react-native'
import { AppStatusBanner } from '../../ui'
import type { GameSyncState } from './types'

export default function GameSyncStatus({
  state,
  error,
  onRetry,
}: {
  state: GameSyncState
  error?: string | null
  onRetry: () => void
}) {
  if (state === 'idle' || state === 'saving' || state === 'synced') return null

  const config = state === 'offline'
    ? { variant: 'warning' as const, icon: 'cloud-offline-outline' as const, title: 'Sin conexión', message: 'Tu respuesta queda guardada en este dispositivo y se enviará al recuperar Internet.' }
    : state === 'retrying'
      ? { variant: 'info' as const, icon: 'sync-outline' as const, title: 'Recuperando respuesta', message: 'Mantén la partida abierta mientras terminamos el envío pendiente.' }
      : state === 'conflict'
        ? { variant: 'warning' as const, icon: 'git-compare-outline' as const, title: 'La pregunta cambió', message: 'El profesor editó esta pregunta mientras estabas sin conexión. Debes actualizar la partida.' }
        : { variant: 'danger' as const, icon: 'warning-outline' as const, title: 'No se pudo guardar', message: error || 'Revisa la conexión y vuelve a intentarlo.' }

  return (
    <View className="mt-4">
      <AppStatusBanner
        compact
        variant={config.variant}
        icon={config.icon}
        title={config.title}
        message={config.message}
        actionLabel={state === 'offline' || state === 'error' ? 'Reintentar' : undefined}
        onAction={state === 'offline' || state === 'error' ? onRetry : undefined}
      />
    </View>
  )
}
