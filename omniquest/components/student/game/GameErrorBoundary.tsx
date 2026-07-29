import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppButton } from '../../ui'
import { trackUsageEvent, toSafeAnalyticsError } from '../../../lib/analytics'
import { useAppTheme } from '../../../lib/appTheme'

type Props = { children: React.ReactNode; resetKey: string; onReset: () => void }
type State = { error: Error | null }

export default class GameErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    void trackUsageEvent('game_error', {
      properties: { stage: 'render_boundary', message: toSafeAnalyticsError(error) },
    })
  }

  componentDidUpdate(previousProps: Props) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return <GameErrorFallback onReset={this.props.onReset} />
  }
}

function GameErrorFallback({ onReset }: { onReset: () => void }) {
  const { tokens } = useAppTheme()
  return (
    <View className="flex-1 items-center justify-center bg-background-primary px-6">
      <View className="w-full max-w-[520px] items-center rounded-[28px] border border-semantic-danger bg-semantic-surface-danger p-6">
        <Ionicons name="warning-outline" size={46} color={tokens.semantic.danger} />
        <Text className="mt-4 text-center text-[24px] font-black text-text-primary">La partida encontró un error inesperado</Text>
        <Text className="mt-2 text-center text-[14px] leading-6 text-text-secondary">
          El progreso sincronizado permanece seguro. Reinicia esta pantalla para recuperar el último estado guardado.
        </Text>
        <AppButton style={{ marginTop: 20 }} role="student" label="Recuperar partida" onPress={onReset} />
      </View>
    </View>
  )
}
