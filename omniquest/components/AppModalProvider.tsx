import { Ionicons } from '@expo/vector-icons'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from 'react-native'
import OmniGuide, { type OmniState } from './OmniGuide'

type NativeAlertButton = {
  text?: string
  onPress?: () => void
  style?: 'default' | 'cancel' | 'destructive'
}

type AppModalVariant = 'success' | 'warning' | 'error' | 'info'

type AppModalButton = {
  label: string
  onPress?: () => void
  role: 'primary' | 'cancel' | 'danger'
}

type AppModalState = {
  buttons: AppModalButton[]
  message?: string
  title: string
  variant: AppModalVariant
}

type AppModalContextValue = {
  showModal: (modal: Omit<AppModalState, 'buttons'> & { buttons?: AppModalButton[] }) => void
}

const AppModalContext = createContext<AppModalContextValue | null>(null)

const variantStyles: Record<AppModalVariant, {
  color: string
  background: string
  border: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  omniState: OmniState
}> = {
  success: {
    color: '#43D991',
    background: '#0D2F29',
    border: '#2FBC7E',
    icon: 'checkmark-circle-outline',
    label: 'Confirmación',
    omniState: 'happy',
  },
  warning: {
    color: '#FBBF24',
    background: '#332A10',
    border: '#F6A64A',
    icon: 'alert-circle-outline',
    label: 'Aviso',
    omniState: 'thinking',
  },
  error: {
    color: '#FB7185',
    background: '#351420',
    border: '#F43F5E',
    icon: 'close-circle-outline',
    label: 'Error',
    omniState: 'error',
  },
  info: {
    color: '#58B5FF',
    background: '#0D2848',
    border: '#3B82F6',
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

    const canPatchWindowAlert =
      typeof window !== 'undefined' &&
      typeof window.alert === 'function'

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
      if (previousAlertRef.current) {
        Alert.alert = previousAlertRef.current
      }

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

  if (!context) {
    throw new Error('useAppModal debe usarse dentro de AppModalProvider')
  }

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
  if (!modal) return null

  const style = variantStyles[modal.variant]

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: 'rgba(2, 6, 23, 0.78)' }}>
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View
          className="w-full max-w-[460px] overflow-hidden rounded-3xl border"
          style={{
            backgroundColor: '#08142E',
            borderColor: `${style.border}AA`,
            boxShadow: '0 28px 90px rgba(0, 0, 0, 0.55)',
          } as any}
        >
          <View className="absolute right-[-44px] top-[-48px] h-36 w-36 rounded-full" style={{ backgroundColor: `${style.color}24` }} />
          <View className="absolute bottom-[-64px] left-[-48px] h-36 w-48 rounded-full" style={{ backgroundColor: `${style.color}12` }} />

          <View className="border-b px-6 py-5" style={{ borderColor: '#203864', backgroundColor: '#0B1B38' }}>
            <View className="flex-row items-center gap-3">
              <View className="relative">
                <OmniGuide state={style.omniState} size={64} autoBlink={style.omniState === 'normal'} />
                <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full border" style={{ backgroundColor: style.background, borderColor: style.border }}>
                  <Ionicons name={style.icon} size={16} color={style.color} />
                </View>
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: style.color }}>
                  {style.label}
                </Text>
                <Text className="mt-1 text-[22px] font-black text-white">{modal.title}</Text>
              </View>
            </View>
          </View>

          <View className="px-6 pb-6 pt-5">
            {modal.message ? (
              <Text className="text-[15px] leading-6 text-[#D8E3F3]">{modal.message}</Text>
            ) : null}

            <View className="mt-6 flex-row flex-wrap justify-end gap-3">
              {modal.buttons.map((button, index) => {
                const isPrimary = button.role === 'primary'
                const isDanger = button.role === 'danger'
                const buttonColor = isDanger ? variantStyles.error.color : style.color

                return (
                  <Pressable
                    key={`${button.label}-${index}`}
                    onPress={() => onButtonPress(button, index)}
                    className="min-w-[120px] items-center justify-center rounded-2xl px-5 py-3"
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.84 : 1,
                      backgroundColor: isPrimary || isDanger ? buttonColor : '#0D1D3B',
                      borderColor: isPrimary || isDanger ? buttonColor : '#263E61',
                      borderWidth: 1,
                    })}
                  >
                    {busyButtonIndex === index ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text className="text-[14px] font-black" style={{ color: isPrimary || isDanger ? '#FFFFFF' : '#DDE7F4' }}>
                        {button.label}
                      </Text>
                    )}
                  </Pressable>
                )
              })}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

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
  return /\berror\b|no se pudo|no hemos podido|no puede|fall[oó]|inv[aá]lid|excepci[oó]n|problema/.test(text)
}

function isWarningText(text: string) {
  return /aviso|advertencia|permiso|seguro|confirm|borrar|eliminar|abandonar|archivar|cerrar sesi[oó]n|cuidado/.test(text)
}

function isSuccessText(text: string) {
  return /[ée]xito|correctamente|guardad|cread|actualizad|completad|desbloquead|confirmaci[oó]n/.test(text)
}
