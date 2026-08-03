import { useCallback, useMemo } from 'react'
import { Alert, Platform } from 'react-native'
import { useAppToast } from '../components/ui/AppToast'

export type AppFeedbackDetail = string | Error | null | undefined

export type AppFeedbackConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export type AppFeedback = {
  success: (title: string, detail?: AppFeedbackDetail) => void
  error: (title: string, detail?: AppFeedbackDetail) => void
  warning: (title: string, detail?: AppFeedbackDetail) => void
  confirm: (options: AppFeedbackConfirmOptions) => Promise<boolean>
}

export function useAppFeedback(): AppFeedback {
  const { showToast } = useAppToast()

  const success = useCallback((title: string, detail?: AppFeedbackDetail) => {
    showToast({ title, message: normalizeDetail(detail), variant: 'success' })
  }, [showToast])

  const error = useCallback((title: string, detail?: AppFeedbackDetail) => {
    showToast({ title, message: normalizeDetail(detail), variant: 'danger', durationMs: 5200 })
  }, [showToast])

  const warning = useCallback((title: string, detail?: AppFeedbackDetail) => {
    showToast({ title, message: normalizeDetail(detail), variant: 'warning', durationMs: 4400 })
  }, [showToast])

  const confirm = useCallback((options: AppFeedbackConfirmOptions) => new Promise<boolean>((resolve) => {
    const confirmLabel = options.confirmLabel || 'Confirmar'
    const cancelLabel = options.cancelLabel || 'Cancelar'

    if (Platform.OS === 'web') {
      const accepted = typeof window !== 'undefined' && window.confirm(`${options.title}\n\n${options.message}`)
      resolve(accepted)
      return
    }

    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    Alert.alert(
      options.title,
      options.message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => finish(false) },
        { text: confirmLabel, style: options.destructive ? 'destructive' : 'default', onPress: () => finish(true) },
      ],
      { cancelable: true, onDismiss: () => finish(false) },
    )
  }), [])

  return useMemo(() => ({ success, error, warning, confirm }), [confirm, error, success, warning])
}

function normalizeDetail(detail: AppFeedbackDetail) {
  if (detail instanceof Error) return detail.message
  return detail || undefined
}
