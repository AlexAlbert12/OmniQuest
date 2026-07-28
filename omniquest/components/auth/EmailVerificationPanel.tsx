import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import AuthStatusBanner from './AuthStatusBanner'
import AuthSubmitButton from './AuthSubmitButton'

type EmailVerificationPanelProps = {
  email: string
  loading?: boolean
  sent?: boolean
  onResend: () => void
  onGoToLogin?: () => void
  onChangeEmail?: () => void
}

export default function EmailVerificationPanel({
  email,
  loading = false,
  sent = false,
  onResend,
  onGoToLogin,
  onChangeEmail,
}: EmailVerificationPanelProps) {
  return (
    <View style={{ gap: 16 }}>
      <View className="items-center rounded-3xl border border-semantic-info bg-surface-raised px-5 py-6">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-semantic-surface-info">
          <Ionicons name="mail-open" size={32} color="#7DD3FC" />
        </View>
        <Text className="mt-4 text-center text-[22px] font-black text-white">Confirma tu correo</Text>
        <Text className="mt-2 text-center text-[13px] leading-5 text-text-secondary">
          Hemos enviado un enlace de verificación a
        </Text>
        <Text className="mt-1 text-center text-[14px] font-black text-semantic-info">{email}</Text>
        <Text className="mt-3 text-center text-[12px] leading-5 text-text-muted">
          Abre el enlace y después vuelve a iniciar sesión. Revisa también la carpeta de correo no deseado.
        </Text>
      </View>

      {sent ? (
        <AuthStatusBanner
          variant="success"
          title="Correo reenviado"
          message="Te hemos enviado un nuevo enlace. El anterior puede dejar de ser válido."
        />
      ) : null}

      <AuthSubmitButton
        label="Reenviar verificación"
        loadingLabel="Reenviando..."
        loading={loading}
        icon="paper-plane"
        onPress={onResend}
      />

      <View className="flex-row flex-wrap items-center justify-center gap-4">
        {onChangeEmail ? (
          <Pressable accessibilityRole="button" onPress={onChangeEmail} hitSlop={6}>
            <Text className="text-[13px] font-black text-text-secondary">Cambiar correo</Text>
          </Pressable>
        ) : null}
        {onGoToLogin ? (
          <Pressable accessibilityRole="button" onPress={onGoToLogin} hitSlop={6}>
            <Text className="text-[13px] font-black text-semantic-info">Ir a iniciar sesión</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
