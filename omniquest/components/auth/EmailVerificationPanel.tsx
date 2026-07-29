import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import AuthStatusBanner from './AuthStatusBanner'
import AuthSubmitButton from './AuthSubmitButton'
import { useI18n } from '../../lib/i18n'

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
  const { t } = useI18n()

  return (
    <View style={{ gap: 16 }}>
      <View className="items-center rounded-3xl border border-semantic-info bg-surface-raised px-5 py-6">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-semantic-surface-info">
          <Ionicons name="mail-open" size={32} color="#7DD3FC" />
        </View>
        <Text maxFontSizeMultiplier={2} className="mt-4 text-center text-[22px] font-black text-text-primary">
          {t('auth.verification.title')}
        </Text>
        <Text maxFontSizeMultiplier={2} className="mt-2 text-center text-[13px] leading-5 text-text-secondary">
          {t('auth.verification.sentTo')}
        </Text>
        <Text maxFontSizeMultiplier={2} className="mt-1 text-center text-[14px] font-black text-semantic-info">{email}</Text>
        <Text maxFontSizeMultiplier={2} className="mt-3 text-center text-[12px] leading-5 text-text-muted">
          {t('auth.verification.instructions')}
        </Text>
      </View>

      {sent ? (
        <AuthStatusBanner
          variant="success"
          title={t('auth.verification.resentTitle')}
          message={t('auth.verification.resentMessage')}
        />
      ) : null}

      <AuthSubmitButton
        label={t('auth.verification.resend')}
        loadingLabel={t('auth.verification.resending')}
        loading={loading}
        icon="paper-plane"
        onPress={onResend}
      />

      <View className="flex-row flex-wrap items-center justify-center gap-4">
        {onChangeEmail ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.verification.changeEmail')}
            onPress={onChangeEmail}
            hitSlop={6}
          >
            <Text maxFontSizeMultiplier={2} className="text-[13px] font-black text-text-secondary">
              {t('auth.verification.changeEmail')}
            </Text>
          </Pressable>
        ) : null}
        {onGoToLogin ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.verification.goToLogin')}
            onPress={onGoToLogin}
            hitSlop={6}
          >
            <Text maxFontSizeMultiplier={2} className="text-[13px] font-black text-semantic-info">
              {t('auth.verification.goToLogin')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
