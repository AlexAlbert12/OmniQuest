import { useCallback, useMemo } from 'react'
import { Alert, Platform } from 'react-native'
import { useAppToast } from '../components/ui/AppToast'
import { translateUiText, useI18n } from '../lib/i18n'

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
  const { locale } = useI18n()
  const localize = useCallback((value: string) => translateUiText(locale, value), [locale])

  const success = useCallback((title: string, detail?: AppFeedbackDetail) => {
    showToast({ title: localize(title), message: normalizeDetail(detail) ? localize(normalizeDetail(detail) as string) : undefined, variant: 'success' })
  }, [localize, showToast])

  const error = useCallback((title: string, detail?: AppFeedbackDetail) => {
    showToast({ title: localize(title), message: normalizeDetail(detail) ? localize(normalizeDetail(detail) as string) : undefined, variant: 'danger', durationMs: 5200 })
  }, [localize, showToast])

  const warning = useCallback((title: string, detail?: AppFeedbackDetail) => {
    showToast({ title: localize(title), message: normalizeDetail(detail) ? localize(normalizeDetail(detail) as string) : undefined, variant: 'warning', durationMs: 4400 })
  }, [localize, showToast])

  const confirm = useCallback((options: AppFeedbackConfirmOptions) => new Promise<boolean>((resolve) => {
    const confirmLabel = options.confirmLabel || 'Confirmar'
    const cancelLabel = options.cancelLabel || 'Cancelar'

    if (Platform.OS === 'web') {
      const accepted = typeof window !== 'undefined' && window.confirm(`${localize(options.title)}\n\n${localize(options.message)}`)
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
      localize(options.title),
      localize(options.message),
      [
        { text: localize(cancelLabel), style: 'cancel', onPress: () => finish(false) },
        { text: localize(confirmLabel), style: options.destructive ? 'destructive' : 'default', onPress: () => finish(true) },
      ],
      { cancelable: true, onDismiss: () => finish(false) },
    )
  }), [localize])

  return useMemo(() => ({ success, error, warning, confirm }), [confirm, error, success, warning])
}

function normalizeDetail(detail: AppFeedbackDetail) {
  if (detail instanceof Error) return detail.message
  return detail || undefined
}
