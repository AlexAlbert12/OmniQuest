import React, { useState } from 'react'
import { Link } from 'expo-router'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import AuthCapsLockWarning from '../../components/auth/AuthCapsLockWarning'
import AuthCard from '../../components/auth/AuthCard'
import AuthHomeLink from '../../components/auth/AuthHomeLink'
import AuthInput from '../../components/auth/AuthInput'
import AuthStatusBanner from '../../components/auth/AuthStatusBanner'
import AuthSubmitButton from '../../components/auth/AuthSubmitButton'
import BrandLogo from '../../components/BrandLogo'
import HomeVisualBackground from '../../components/HomeVisualBackground'
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
import { useResponsiveLayout } from '../../lib/responsive'
import { registerCurrentSession } from '../../lib/sessionSecurity'
import { supabase } from '../../lib/supabase'

type LoginErrors = { email?: string; password?: string }
type Status = { variant: 'info' | 'success' | 'warning' | 'error'; title?: string; message: string } | null

export default function LoginScreen() {
  const responsive = useResponsiveLayout()
  const { height } = responsive
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

  const isDesktop = responsive.isDesktop
  const isTablet = !responsive.isMobile
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

        if (profile?.role_id === 'student' || profile?.role_id === 'teacher' || profile?.role_id === 'admin') {
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
        <View
          className="z-10 flex-1 items-center"
          style={{
            justifyContent: isTablet ? 'center' : 'flex-start',
            paddingBottom: 32,
            paddingHorizontal: isDesktop ? 32 : 22,
            paddingTop: isTablet ? 32 : 100,
          }}
        >
          <AuthHomeLink />

          <View className="items-center p-2" style={{ marginBottom: isTablet ? 32 : 24 }}>
            <BrandLogo center size={isDesktop ? 68 : 52} />
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
                <Text maxFontSizeMultiplier={2} className="font-semibold text-text-muted" style={{ fontSize: isTablet ? 13 : 14 }}>{t('auth.login.noStudentAccount')}</Text>
                <Link href="/register" asChild>
                  <Pressable accessibilityRole="link" hitSlop={10}>
                    <Text maxFontSizeMultiplier={2} className="font-extrabold text-semantic-info" style={{ fontSize: isTablet ? 13 : 14 }}>{t('auth.login.registerLink')}</Text>
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
