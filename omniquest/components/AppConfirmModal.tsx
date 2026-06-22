import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native'

type AppConfirmModalVariant = 'danger' | 'info' | 'warning'

type AppConfirmModalProps = {
  busy?: boolean
  cancelLabel?: string
  confirmLabel: string
  message: string
  onCancel: () => void
  onConfirm: () => void
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
  onCancel,
  onConfirm,
  title,
  variant = 'warning',
  visible,
}: AppConfirmModalProps) {
  const style = variantStyles[variant]

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/70 px-5">
        <View
          className="w-full max-w-[440px] rounded-3xl border bg-[#08172E] p-6"
          style={{ borderColor: `${style.color}80` }}
        >
          <View className="flex-row items-start gap-4">
            <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${style.color}24` }}>
              <Ionicons name={style.icon} size={26} color={style.color} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[21px] font-black text-white">{title}</Text>
              <Text className="mt-2 text-[14px] leading-6 text-[#BFD0E8]">{message}</Text>
            </View>
          </View>

          <View className="mt-6 flex-row justify-end gap-3">
            <Pressable
              onPress={onCancel}
              disabled={busy}
              className="rounded-xl border border-[#263E61] px-4 py-3"
              style={({ pressed }) => ({ opacity: busy ? 0.55 : pressed ? 0.8 : 1 })}
            >
              <Text className="text-[13px] font-bold text-[#DDE7F4]">{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              className="min-w-[132px] items-center rounded-xl px-4 py-3"
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
