import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'

type AuthStatusVariant = 'info' | 'success' | 'warning' | 'error'

type AuthStatusBannerProps = {
  title?: string
  message: string
  variant?: AuthStatusVariant
  actionLabel?: string
  onAction?: () => void
  loading?: boolean
}

const variants: Record<AuthStatusVariant, {
  color: string
  background: string
  border: string
  icon: keyof typeof Ionicons.glyphMap
}> = {
  info: { color: '#7DD3FC', background: 'rgba(14, 116, 144, 0.16)', border: '#0EA5E9', icon: 'information-circle' },
  success: { color: '#6EE7B7', background: 'rgba(5, 150, 105, 0.16)', border: '#10B981', icon: 'checkmark-circle' },
  warning: { color: '#FCD34D', background: 'rgba(217, 119, 6, 0.16)', border: '#F59E0B', icon: 'alert-circle' },
  error: { color: '#FDA4AF', background: 'rgba(225, 29, 72, 0.16)', border: '#FB7185', icon: 'close-circle' },
}

export default function AuthStatusBanner({
  title,
  message,
  variant = 'info',
  actionLabel,
  onAction,
  loading = false,
}: AuthStatusBannerProps) {
  const palette = variants[variant]

  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-row items-start gap-3 rounded-2xl border p-4"
      style={{ backgroundColor: palette.background, borderColor: `${palette.border}99` }}
    >
      <Ionicons name={palette.icon} size={21} color={palette.color} />
      <View className="min-w-0 flex-1">
        {title ? <Text className="font-black" style={{ color: palette.color }}>{title}</Text> : null}
        <Text className={`${title ? 'mt-1' : ''} text-[13px] font-semibold leading-5 text-[#DDE7F4]`}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            disabled={loading}
            onPress={onAction}
            hitSlop={6}
            className="mt-3 self-start rounded-xl border px-3 py-2"
            style={({ pressed }) => ({
              borderColor: `${palette.border}99`,
              backgroundColor: `${palette.border}24`,
              opacity: loading ? 0.55 : pressed ? 0.76 : 1,
            })}
          >
            <Text className="text-[12px] font-black" style={{ color: palette.color }}>
              {loading ? 'Enviando...' : actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
