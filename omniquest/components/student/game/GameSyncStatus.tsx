import React from 'react'
import { View } from 'react-native'
import { AppStatusBanner } from '../../ui'
import type { GameSyncState } from './types'

export default function GameSyncStatus({
  state,
  resumed,
  error,
  onRetry,
}: {
  state: GameSyncState
  resumed: boolean
  error?: string | null
  onRetry: () => void
}) {
  if (state === 'idle' && !resumed) return null

  const config = state === 'offline'
    ? { variant: 'warning' as const, icon: 'cloud-offline-outline' as const, title: 'Sin conexión', message: 'Tu respuesta queda guardada en este dispositivo y se enviará al recuperar Internet.' }
    : state === 'saving'
      ? { variant: 'info' as const, icon: 'cloud-upload-outline' as const, title: 'Guardando respuesta', message: 'Estamos validando y sincronizando la respuesta con el servidor.' }
      : state === 'retrying'
        ? { variant: 'info' as const, icon: 'sync-outline' as const, title: 'Reintentando sincronización', message: 'No cierres la partida mientras enviamos la respuesta pendiente.' }
        : state === 'conflict'
          ? { variant: 'warning' as const, icon: 'git-compare-outline' as const, title: 'La pregunta cambió', message: 'El profesor editó esta pregunta mientras estabas sin conexión. Debes actualizar la partida.' }
          : state === 'error'
            ? { variant: 'danger' as const, icon: 'warning-outline' as const, title: 'No se pudo guardar', message: error || 'Revisa la conexión y vuelve a intentarlo.' }
            : { variant: 'success' as const, icon: 'checkmark-circle-outline' as const, title: resumed ? 'Partida recuperada' : 'Respuesta sincronizada', message: resumed ? 'Has continuado desde el último punto guardado.' : 'La respuesta ya está registrada en el servidor.' }

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
