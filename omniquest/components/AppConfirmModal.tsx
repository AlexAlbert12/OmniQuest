import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native'
import OmniGuide, { type OmniState } from './OmniGuide'

type AppConfirmModalVariant = 'danger' | 'info' | 'warning'

type AppConfirmModalProps = {
  busy?: boolean
  cancelLabel?: string
  confirmLabel: string
  message: string
  omniState?: OmniState
  onCancel: () => void
  onConfirm: () => void
  showOmni?: boolean
  title: string
  variant?: AppConfirmModalVariant
  visible: boolean
}

const variantStyles: Record<AppConfirmModalVariant, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  danger: { color: '#FF6B6B', icon: 'warning-outline' },
  info: { color: '#58B5FF', icon: 'bulb-outline' },
  warning: { color: '#FBBF24', icon: 'alert-circle-outline' },
}

export default function AppConfirmModal({
  busy = false,
  cancelLabel = 'Cancelar',
  confirmLabel,
  message,
  omniState = 'thinking',
  onCancel,
  onConfirm,
  showOmni = false,
  title,
  variant = 'warning',
  visible,
}: AppConfirmModalProps) {
  const style = variantStyles[variant]
  const { width } = useWindowDimensions()
  const isPhone = width < 640

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View className={`flex-1 bg-black/70 ${isPhone ? 'justify-end' : 'items-center justify-center px-5'}`}>
        <View
          className={`${isPhone ? 'max-h-[92%] w-full rounded-t-3xl p-5' : 'w-full max-w-[440px] rounded-3xl p-6'} border bg-[#08172E]`}
          style={{ borderColor: `${style.color}80` }}
        >
          <View className="flex-row items-start gap-4">
            {showOmni ? (
              <OmniGuide state={omniState} size={isPhone ? 58 : 64} autoBlink={omniState === 'normal'} />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${style.color}24` }}>
                <Ionicons name={style.icon} size={26} color={style.color} />
              </View>
            )}
            <View className="min-w-0 flex-1">
              <Text className="text-[21px] font-black text-white">{title}</Text>
              <Text className="mt-2 text-[14px] leading-6 text-[#BFD0E8]">{message}</Text>
            </View>
          </View>

          <View className={`mt-6 gap-3 ${isPhone ? '' : 'flex-row justify-end'}`}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              className={`${isPhone ? 'items-center py-4' : 'px-4 py-3'} rounded-xl border border-[#263E61]`}
              style={({ pressed }) => ({ opacity: busy ? 0.55 : pressed ? 0.8 : 1 })}
            >
              <Text className="text-[13px] font-bold text-[#DDE7F4]">{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              className={`${isPhone ? 'py-4' : 'min-w-[132px] px-4 py-3'} items-center rounded-xl`}
              style={({ pressed }) => ({
                backgroundColor: style.color,
                opacity: busy ? 0.7 : pressed ? 0.84 : 1,
              })}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-[13px] font-black text-white">{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
