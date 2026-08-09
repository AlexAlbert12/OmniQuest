import { Ionicons } from '@expo/vector-icons'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import OmniGuide, { type OmniState } from './OmniGuide'
import AppBottomSheet from './ui/AppBottomSheet'
import AppButton, { type AppButtonVariant } from './ui/AppButton'
import AppStatusBanner, { type AppStatusBannerVariant } from './ui/AppStatusBanner'
import { releaseWebFocus } from '../lib/webFocus'

export type NativeAlertButton = {
  text?: string
  onPress?: () => void
  style?: 'default' | 'cancel' | 'destructive'
}

export type AppModalVariant = 'success' | 'warning' | 'error' | 'info'

export type AppModalButton = {
  label: string
  onPress?: () => void
  role: 'primary' | 'cancel' | 'danger'
}

export type AppModalState = {
  buttons: AppModalButton[]
  message?: string
  title: string
  variant: AppModalVariant
}

type AppModalContextValue = {
  showModal: (modal: Omit<AppModalState, 'buttons'> & { buttons?: AppModalButton[] }) => void
}

const AppModalContext = createContext<AppModalContextValue | null>(null)

const variantConfig: Record<AppModalVariant, {
  bannerVariant: AppStatusBannerVariant
  icon: keyof typeof Ionicons.glyphMap
  label: string
  omniState: OmniState
}> = {
  success: {
    bannerVariant: 'success',
    icon: 'checkmark-circle-outline',
    label: 'Confirmación',
    omniState: 'happy',
  },
  warning: {
    bannerVariant: 'warning',
    icon: 'alert-circle-outline',
    label: 'Aviso',
    omniState: 'thinking',
  },
  error: {
    bannerVariant: 'danger',
    icon: 'close-circle-outline',
    label: 'Error',
    omniState: 'error',
  },
  info: {
    bannerVariant: 'info',
    icon: 'information-circle-outline',
    label: 'Información',
    omniState: 'thinking',
  },
}

export function AppModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<AppModalState | null>(null)
  const [busyButtonIndex, setBusyButtonIndex] = useState<number | null>(null)
  const previousAlertRef = useRef<typeof Alert.alert | null>(null)
  const previousWindowAlertRef = useRef<((message?: unknown) => void) | null>(null)

  const showModal = useCallback((nextModal: Omit<AppModalState, 'buttons'> & { buttons?: AppModalButton[] }) => {
    setBusyButtonIndex(null)
    releaseWebFocus()
    setModal({
      ...nextModal,
      buttons: nextModal.buttons?.length ? nextModal.buttons : [{ label: 'Aceptar', role: 'primary' }],
    })
  }, [])

  useEffect(() => {
    previousAlertRef.current = Alert.alert
    Alert.alert = ((title: string, message?: string, buttons?: NativeAlertButton[]) => {
      showModal({
        title: normalizeTitle(title),
        message,
        variant: inferModalVariant(title, message, buttons),
        buttons: normalizeButtons(buttons),
      })
    }) as typeof Alert.alert

    const canPatchWindowAlert = typeof window !== 'undefined' && typeof window.alert === 'function'
    if (canPatchWindowAlert) {
      previousWindowAlertRef.current = window.alert.bind(window)
      window.alert = ((message?: unknown) => {
        const parsed = parseWindowAlertMessage(String(message ?? ''))
        showModal({
          title: parsed.title,
          message: parsed.message,
          variant: inferModalVariant(parsed.title, parsed.message),
        })
      }) as typeof window.alert
    }

    return () => {
      if (previousAlertRef.current) Alert.alert = previousAlertRef.current
      if (previousWindowAlertRef.current && typeof window !== 'undefined') {
        window.alert = previousWindowAlertRef.current
      }
    }
  }, [showModal])

  const contextValue = useMemo<AppModalContextValue>(() => ({ showModal }), [showModal])

  const closeModal = useCallback(() => {
    setBusyButtonIndex(null)
    setModal(null)
  }, [])

  const handleButtonPress = useCallback((button: AppModalButton, index: number) => {
    if (!button.onPress) {
      closeModal()
      return
    }

    setBusyButtonIndex(index)
    try {
      button.onPress()
    } finally {
      closeModal()
    }
  }, [closeModal])

  return (
    <AppModalContext.Provider value={contextValue}>
      {children}
      <StyledAppModal
        busyButtonIndex={busyButtonIndex}
        modal={modal}
        onButtonPress={handleButtonPress}
        onClose={closeModal}
      />
    </AppModalContext.Provider>
  )
}

export function useAppModal() {
  const context = useContext(AppModalContext)
  if (!context) throw new Error('useAppModal debe usarse dentro de AppModalProvider')
  return context
}

function StyledAppModal({
  busyButtonIndex,
  modal,
  onButtonPress,
  onClose,
}: {
  busyButtonIndex: number | null
  modal: AppModalState | null
  onButtonPress: (button: AppModalButton, index: number) => void
  onClose: () => void
}) {
  const config = modal ? variantConfig[modal.variant] : variantConfig.info

  return (
    <AppBottomSheet
      visible={Boolean(modal)}
      onClose={onClose}
      title={modal?.title}
      closeOnBackdropPress={busyButtonIndex === null}
      footer={modal ? (
        <View style={styles.actions}>
          {modal.buttons.map((button, index) => {
            const variant: AppButtonVariant = button.role === 'danger'
              ? 'danger'
              : button.role === 'cancel'
                ? 'secondary'
                : modal.variant === 'success'
                  ? 'success'
                  : 'primary'
            return (
              <AppButton
                key={`${button.label}-${index}`}
                label={button.label}
                variant={variant}
                loading={busyButtonIndex === index}
                disabled={busyButtonIndex !== null && busyButtonIndex !== index}
                onPress={() => onButtonPress(button, index)}
                style={styles.action}
              />
            )
          })}
        </View>
      ) : null}
    >
      {modal ? (
        <View style={styles.body}>
          <View style={styles.omniRow}>
            <OmniGuide state={config.omniState} size={62} autoBlink={config.omniState === 'normal'} />
            <AppStatusBanner
              compact
              variant={config.bannerVariant}
              icon={config.icon}
              title={config.label}
              message={modal.message || 'Revisa la información antes de continuar.'}
            />
          </View>
        </View>
      ) : null}
    </AppBottomSheet>
  )
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
  },
  omniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  action: {
    minWidth: 120,
  },
})
function normalizeButtons(buttons?: NativeAlertButton[]): AppModalButton[] {
  if (!buttons || buttons.length === 0) {
    return [{ label: 'Aceptar', role: 'primary' }]
  }

  return buttons.map((button) => ({
    label: button.text || 'Aceptar',
    onPress: button.onPress,
    role: button.style === 'destructive' ? 'danger' : button.style === 'cancel' ? 'cancel' : 'primary',
  }))
}

function normalizeTitle(title?: string) {
  return title?.trim() || 'OmniQuest'
}

function parseWindowAlertMessage(rawMessage: string) {
  const parts = rawMessage
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length <= 1) {
    return {
      title: inferTitleFromMessage(parts[0] || 'OmniQuest'),
      message: parts[0] || '',
    }
  }

  return {
    title: normalizeTitle(parts[0]),
    message: parts.slice(1).join('\n'),
  }
}

function inferTitleFromMessage(message: string) {
  const normalized = message.toLowerCase()
  if (isErrorText(normalized)) return 'Error'
  if (isSuccessText(normalized)) return 'Confirmación'
  if (isWarningText(normalized)) return 'Aviso'
  return 'OmniQuest'
}

function inferModalVariant(title?: string, message?: string, buttons?: NativeAlertButton[]): AppModalVariant {
  const text = `${title || ''} ${message || ''}`.toLowerCase()

  if (isErrorText(text)) return 'error'
  if (buttons?.some((button) => button.style === 'destructive')) return 'warning'
  if (isWarningText(text)) return 'warning'
  if (isSuccessText(text)) return 'success'
  return 'info'
}

function isErrorText(text: string) {
  return /\berror\b|no se pudo|no hemos podido|no puede|fall[oó]|inv[aá]lid|excepci[oó]n|problema|could not|failed|invalid|exception|problem/.test(text)
}

function isWarningText(text: string) {
  return /aviso|advertencia|permiso|seguro|confirm|borrar|eliminar|abandonar|archivar|cerrar sesi[oó]n|cuidado|warning|permission|sure|delete|leave|archive|sign out|careful/.test(text)
}

function isSuccessText(text: string) {
  return /[ée]xito|correctamente|guardad|cread|actualizad|completad|desbloquead|confirmaci[oó]n|success|successfully|saved|created|updated|completed|unlocked|confirmation/.test(text)
}
