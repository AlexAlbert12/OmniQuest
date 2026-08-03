import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import AuthCapsLockWarning from '../../components/auth/AuthCapsLockWarning'
import AuthCard from '../../components/auth/AuthCard'
import AuthInput from '../../components/auth/AuthInput'
import AuthRoleNotice from '../../components/auth/AuthRoleNotice'
import AuthStatusBanner from '../../components/auth/AuthStatusBanner'
import AuthSubmitButton from '../../components/auth/AuthSubmitButton'
import BrandLogo from '../../components/BrandLogo'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import OmniGuide from '../../components/OmniGuide'
import {
  getAuthErrorMessage,
  getEmailRedirectTo,
  isEmailVerificationError,
  isInvalidCredentialError,
  normalizeEmail,
} from '../../lib/auth'
import {
  checkAuthAttempt,
  clearAuthFailures,
  formatRetryDelay,
  recordAuthFailure,
} from '../../lib/authSecurity'
import { prepareAuthSubmission, validateLoginForm } from '../../lib/authFormValidation'
import { useI18n } from '../../lib/i18n'
import { registerCurrentSession } from '../../lib/sessionSecurity'
import { supabase } from '../../lib/supabase'

type LoginErrors = { email?: string; password?: string }
type Status = { variant: 'info' | 'success' | 'warning' | 'error'; title?: string; message: string } | null

export default function LoginScreen() {
  const { width, height } = useWindowDimensions()
  const { locale, t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({})

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'

  const validationMessages = {
    invalidEmail: t('auth.validation.invalidEmail'),
    requiredPassword: t('auth.validation.passwordRequired'),
  }

  const validateValues = (nextEmail = email, nextPassword = password) => {
    const errors = validateLoginForm({ email: nextEmail, password: nextPassword }, validationMessages) as LoginErrors
    setFieldErrors(errors)
    return errors
  }

  const showRateLimit = (retryAfterSeconds: number) => {
    setStatus({
      variant: 'warning',
      title: t('auth.rateLimit.title'),
      message: t('auth.rateLimit.message', { delay: formatRetryDelay(retryAfterSeconds, locale) }),
    })
  }

  const signInWithEmail = async () => {
    const normalizedEmail = normalizeEmail(email)
    const prepared = await prepareAuthSubmission({
      values: { email: normalizedEmail, password },
      validate: (values) => validateLoginForm(values, validationMessages),
      guard: () => checkAuthAttempt('sign_in', normalizedEmail),
    })

    if (prepared.status === 'validation_error') {
      setFieldErrors(prepared.errors as LoginErrors)
      return
    }
    if (prepared.status === 'rate_limited') {
      showRateLimit(prepared.retryAfterSeconds)
      return
    }

    setStatus({ variant: 'info', message: t('auth.login.checking') })
    setVerificationEmail(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (error) {
        if (isInvalidCredentialError(error)) {
          const localGate = await recordAuthFailure('sign_in', normalizedEmail)
          if (!localGate.allowed) {
            showRateLimit(localGate.retryAfterSeconds)
            return
          }
        }
        if (isEmailVerificationError(error)) {
          setVerificationEmail(normalizedEmail)
          setStatus({
            variant: 'warning',
            title: t('auth.login.pendingTitle'),
            message: t('auth.login.pendingMessage'),
          })
          return
        }
        setStatus({
          variant: 'error',
          title: t('auth.login.title'),
          message: getAuthErrorMessage(error, 'signIn', t),
        })
        return
      }

      await clearAuthFailures('sign_in', normalizedEmail)

      if (data.session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role_id')
          .eq('id', data.session.user.id)
          .maybeSingle()

        if (profile?.role_id === 'teacher' || profile?.role_id === 'admin') {
          const managedSession = await registerCurrentSession()
          if (managedSession.revoked) {
            await supabase.auth.signOut({ scope: 'local' })
            setStatus({ variant: 'error', title: t('auth.login.title'), message: t('auth.error.invalidCredentials') })
            return
          }
        }
      }

      setStatus({ variant: 'success', message: t('auth.login.success') })
    } catch (error) {
      console.error('[login] unexpected error', error)
      setStatus({ variant: 'error', title: t('auth.login.title'), message: t('auth.login.connectionError') })
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    const targetEmail = verificationEmail || normalizeEmail(email)
    const prepared = await prepareAuthSubmission({
      values: { email: targetEmail },
      validate: (values) => validateLoginForm({ email: values.email, password: 'verification-placeholder' }, validationMessages),
      guard: () => checkAuthAttempt('resend_verification', targetEmail),
    })

    if (prepared.status === 'validation_error') {
      setFieldErrors((current) => ({ ...current, email: prepared.errors.email }))
      return
    }
    if (prepared.status === 'rate_limited') {
      showRateLimit(prepared.retryAfterSeconds)
      return
    }

    setResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: { emailRedirectTo: getEmailRedirectTo('/login') },
      })
      if (error) throw error
      setStatus({
        variant: 'success',
        title: t('auth.login.resendSuccessTitle'),
        message: t('auth.login.resendSuccessMessage', { email: targetEmail }),
      })
    } catch (error: any) {
      setStatus({ variant: 'error', title: t('auth.login.resend'), message: getAuthErrorMessage(error, 'signUp', t) })
    } finally {
      setResending(false)
    }
  }

  return (
    <ScrollView className="flex-1 bg-background-secondary" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View className="overflow-hidden bg-background-secondary" style={{ minHeight: Math.max(height, 760), borderRadius: isWeb ? 0 : 34 }}>
        <HomeVisualBackground isDesktop={isDesktop} />
        <View className="z-10 flex-1 items-center justify-center" style={{ paddingHorizontal: isDesktop ? 32 : 22, paddingVertical: 32 }}>
          <View className="absolute left-5 top-5 z-20">
            <Link href="/" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('auth.common.home')}
                className="flex-row items-center gap-2 px-4 py-3"
                style={({ pressed }) => ({
                  backgroundColor: 'rgba(16, 42, 82, 0.88)',
                  borderColor: 'rgba(99, 177, 235, 0.32)',
                  borderWidth: 1,
                  borderRadius: 999,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Ionicons name="home-outline" size={18} color="#8CD5FF" />
                <Text maxFontSizeMultiplier={2} className="font-extrabold text-text-secondary">{t('auth.common.home')}</Text>
              </Pressable>
            </Link>
          </View>

          <View className="items-center px-2">
            <BrandLogo center size={isDesktop ? 68 : 52} />
            <Text maxFontSizeMultiplier={2} style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 21 : 16 }} className="mt-1 text-center text-semantic-info">
              {t('auth.login.journey')}
            </Text>
            <View className="mb-5 mt-4 flex-row items-center gap-3">
              <View className="h-px w-16 bg-brand-student" />
              <OmniGuide state="normal" autoBlink size={isDesktop ? 80 : isTablet ? 70 : 48} />
              <View className="h-px w-16 bg-brand-student" />
            </View>
          </View>

          <AuthCard
            accentColor="#38BDF8"
            icon="person-outline"
            title={t('auth.login.title')}
            subtitle={t('auth.login.subtitle')}
            isDesktop={isDesktop}
            maxWidth={isTablet ? 620 : 460}
            footer={(
              <View className="flex-row flex-wrap items-center justify-center gap-1">
                <Text maxFontSizeMultiplier={2} className="text-[13px] font-semibold text-text-muted">{t('auth.login.noStudentAccount')}</Text>
                <Link href="/register" asChild>
                  <Pressable accessibilityRole="link" hitSlop={6}>
                    <Text maxFontSizeMultiplier={2} className="text-[13px] font-extrabold text-semantic-info">{t('auth.login.registerLink')}</Text>
                  </Pressable>
                </Link>
              </View>
            )}
          >
            <AuthInput
              label={t('auth.common.email')}
              testID="login-email"
              icon="mail-outline"
              placeholder={t('auth.common.emailPlaceholder')}
              value={email}
              onChangeText={(value) => {
                setEmail(value)
                if (fieldErrors.email) validateValues(value, password)
                setStatus(null)
                setVerificationEmail(null)
              }}
              onBlur={() => validateValues(email, password)}
              error={fieldErrors.email}
              valid={Boolean(email) && !fieldErrors.email}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              inputMode="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />

            <AuthInput
              label={t('auth.common.password')}
              testID="login-password"
              icon="lock-closed-outline"
              placeholder={t('auth.login.passwordPlaceholder')}
              value={password}
              onChangeText={(value) => {
                setPassword(value)
                if (fieldErrors.password) validateValues(email, value)
                setStatus(null)
              }}
              onBlur={() => validateValues(email, password)}
              onSubmitEditing={() => void signInWithEmail()}
              onCapsLockChange={setCapsLock}
              error={fieldErrors.password}
              autoComplete="current-password"
              secureTextEntry={!showPassword}
              secureVisible={showPassword}
              showSecureToggle
              textContentType="password"
              returnKeyType="done"
              onToggleSecureText={() => setShowPassword((current) => !current)}
            />

            <AuthCapsLockWarning visible={capsLock} />

            <View className="flex-row items-center justify-end">
              <Link href="/forgot-password" asChild>
                <Pressable accessibilityRole="link" hitSlop={6}>
                  <Text maxFontSizeMultiplier={2} className="text-[13px] font-bold text-semantic-info">{t('auth.login.forgot')}</Text>
                </Pressable>
              </Link>
            </View>

            <AuthRoleNotice compact />

            <AuthStatusBanner
              variant="info"
              message={t('auth.login.managedSessions')}
            />

            {status ? (
              <AuthStatusBanner
                variant={status.variant}
                title={status.title}
                message={status.message}
                actionLabel={verificationEmail ? t('auth.login.resend') : undefined}
                onAction={verificationEmail ? () => void resendVerification() : undefined}
                loading={resending}
              />
            ) : null}

            <AuthSubmitButton
              label={t('auth.login.submit')}
              loadingLabel={t('auth.login.loading')}
              loading={loading}
              testID="login-submit"
              onPress={() => void signInWithEmail()}
            />
          </AuthCard>
        </View>
      </View>
    </ScrollView>
  )
}
