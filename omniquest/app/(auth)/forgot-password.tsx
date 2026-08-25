import React, { useState } from 'react'
import { Link } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import AuthCard from '../../components/auth/AuthCard'
import AuthInput from '../../components/auth/AuthInput'
import AuthStatusBanner from '../../components/auth/AuthStatusBanner'
import AuthSubmitButton from '../../components/auth/AuthSubmitButton'
import BrandLogo from '../../components/BrandLogo'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import OmniGuide from '../../components/OmniGuide'
import { getAuthErrorMessage, getPasswordRecoveryRedirectTo, normalizeEmail } from '../../lib/auth'
import { checkAuthAttempt, formatRetryDelay } from '../../lib/authSecurity'
import { prepareAuthSubmission, validateRecoveryForm } from '../../lib/authFormValidation'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { useResponsiveLayout } from '../../lib/responsive'

export default function ForgotPasswordScreen() {
  const responsive = useResponsiveLayout()
  const { height } = responsive
  const { locale, t } = useI18n()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState<{ variant: 'success' | 'warning' | 'error'; title?: string; message: string } | null>(null)

  const isDesktop = responsive.isDesktop
  const isTablet = !responsive.isMobile
  const validationMessages = { invalidEmail: t('auth.validation.invalidEmail') }

  const validateEmail = (value = email) => {
    const errors = validateRecoveryForm({ email: value }, validationMessages)
    setEmailError(errors.email)
    return !errors.email
  }

  const sendRecoveryEmail = async () => {
    const normalizedEmail = normalizeEmail(email)
    const prepared = await prepareAuthSubmission({
      values: { email: normalizedEmail },
      validate: (values) => validateRecoveryForm(values, validationMessages),
      guard: () => checkAuthAttempt('password_recovery', normalizedEmail),
    })

    if (prepared.status === 'validation_error') {
      setEmailError(prepared.errors.email)
      return
    }
    if (prepared.status === 'rate_limited') {
      setStatus({
        variant: 'warning',
        title: t('auth.rateLimit.title'),
        message: t('auth.rateLimit.message', { delay: formatRetryDelay(prepared.retryAfterSeconds, locale) }),
      })
      return
    }

    setLoading(true)
    setStatus(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getPasswordRecoveryRedirectTo(),
      })
      if (error) throw error
      setSent(true)
      setStatus({
        variant: 'success',
        title: t('auth.forgot.sentTitle'),
        message: t('auth.forgot.sentMessage', { email: normalizedEmail }),
      })
    } catch (error: any) {
      setStatus({ variant: 'error', title: t('auth.forgot.title'), message: getAuthErrorMessage(error, 'resetPassword', t) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView className="flex-1 bg-background-secondary" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View className="overflow-hidden bg-background-secondary" style={{ minHeight: Math.max(height, 760) }}>
        <HomeVisualBackground isDesktop={isDesktop} />
        <View className="z-10 flex-1 items-center justify-center" style={{ paddingHorizontal: isDesktop ? 32 : 22, paddingVertical: 34 }}>
          <View className="items-center px-2">
            <BrandLogo center size={isDesktop ? 68 : 48} />
            <Text maxFontSizeMultiplier={2} style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 21 : 16 }} className="mt-1 text-center text-semantic-info">
              {t('auth.forgot.heading')}
            </Text>
            <OmniGuide state={sent ? 'happy' : 'thinking'} size={isDesktop ? 88 : 72} style={{ marginTop: 12 }} />
          </View>

          <AuthCard
            accentColor="#38BDF8"
            icon="key-outline"
            title={t('auth.forgot.title')}
            subtitle={t('auth.forgot.subtitle')}
            isDesktop={isDesktop}
            maxWidth={isTablet ? 560 : 440}
            footer={(
              <Link href="/login" asChild>
                <Pressable accessibilityRole="link" accessibilityLabel={t('auth.common.backToLogin')} className="flex-row items-center justify-center gap-2" hitSlop={6}>
                  <Text maxFontSizeMultiplier={2} className="font-extrabold text-semantic-info">{t('auth.common.backToLogin')}</Text>
                </Pressable>
              </Link>
            )}
          >
            <AuthInput
              label={t('auth.common.email')}
              icon="mail-outline"
              placeholder={t('auth.common.emailPlaceholder')}
              value={email}
              onChangeText={(value) => {
                setEmail(value)
                if (emailError) validateEmail(value)
                setStatus(null)
              }}
              onBlur={() => validateEmail()}
              onSubmitEditing={() => void sendRecoveryEmail()}
              error={emailError}
              valid={Boolean(email) && !emailError}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              inputMode="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
            />

            {status ? <AuthStatusBanner variant={status.variant} title={status.title} message={status.message} /> : null}

            <AuthSubmitButton
              label={sent ? t('auth.forgot.resend') : t('auth.forgot.submit')}
              loadingLabel={t('auth.forgot.loading')}
              loading={loading}
              icon="paper-plane"
              onPress={() => void sendRecoveryEmail()}
            />
          </AuthCard>
        </View>
      </View>
    </ScrollView>
  )
}
