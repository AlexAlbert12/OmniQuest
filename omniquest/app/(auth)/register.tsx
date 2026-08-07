import React, { useMemo, useState } from 'react'
import { Link, useRouter } from 'expo-router'
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import AuthCapsLockWarning from '../../components/auth/AuthCapsLockWarning'
import AuthCard from '../../components/auth/AuthCard'
import AuthHomeLink from '../../components/auth/AuthHomeLink'
import AuthInput from '../../components/auth/AuthInput'
import AuthStatusBanner from '../../components/auth/AuthStatusBanner'
import AuthSubmitButton from '../../components/auth/AuthSubmitButton'
import EmailVerificationPanel from '../../components/auth/EmailVerificationPanel'
import PasswordStrength from '../../components/auth/PasswordStrength'
import BrandLogo from '../../components/BrandLogo'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import { getAuthErrorMessage, getEmailRedirectTo, getPasswordStrength, normalizeEmail } from '../../lib/auth'
import { checkAuthAttempt, formatRetryDelay } from '../../lib/authSecurity'
import { buildPublicStudentSignUpOptions, prepareAuthSubmission, validateRegistrationForm } from '../../lib/authFormValidation'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'

type RegisterErrors = { alias?: string; confirmPassword?: string; email?: string; password?: string }
type Status = { variant: 'info' | 'success' | 'warning' | 'error'; title?: string; message: string } | null

export default function RegisterScreen() {
  const { width, height } = useWindowDimensions()
  const router = useRouter()
  const { locale, t } = useI18n()
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [verificationSent, setVerificationSent] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({})

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'
  const passwordStrength = useMemo(() => getPasswordStrength(password, t), [password, t])
  const validationMessages = {
    aliasTooShort: t('auth.validation.aliasTooShort'),
    aliasTooLong: t('auth.validation.aliasTooLong'),
    invalidEmail: t('auth.validation.invalidEmail'),
    weakPassword: t('auth.validation.weakPassword'),
    confirmRequired: t('auth.validation.confirmRequired'),
    passwordMismatch: t('auth.validation.passwordMismatch'),
  }

  const validateValues = (
    nextAlias = alias,
    nextEmail = email,
    nextPassword = password,
    nextConfirmation = confirmPassword,
  ) => {
    const errors = validateRegistrationForm({
      alias: nextAlias,
      email: nextEmail,
      password: nextPassword,
      confirmPassword: nextConfirmation,
    }, validationMessages) as RegisterErrors
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

  const signUpWithEmail = async () => {
    const normalizedEmail = normalizeEmail(email)
    const values = { alias, email: normalizedEmail, password, confirmPassword }
    const prepared = await prepareAuthSubmission({
      values,
      validate: (candidate) => validateRegistrationForm(candidate, validationMessages),
      guard: () => checkAuthAttempt('sign_up', normalizedEmail),
    })

    if (prepared.status === 'validation_error') {
      setFieldErrors(prepared.errors as RegisterErrors)
      return
    }
    if (prepared.status === 'rate_limited') {
      showRateLimit(prepared.retryAfterSeconds)
      return
    }

    setLoading(true)
    setStatus({ variant: 'info', message: t('auth.register.creating') })
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: buildPublicStudentSignUpOptions(alias, getEmailRedirectTo('/login')),
      })
      if (error) {
        setStatus({ variant: 'error', title: t('auth.register.title'), message: getAuthErrorMessage(error, 'signUp', t) })
        return
      }

      if (!data.session) {
        setVerificationEmail(normalizedEmail)
        setVerificationSent(false)
        setStatus(data.user?.identities?.length === 0
          ? { variant: 'info', message: t('auth.register.existingObfuscated') }
          : null)
        return
      }

      setStatus({ variant: 'success', message: t('auth.register.success') })
      router.replace('/(student)/homeStudent' as any)
    } catch (error) {
      console.error('[register] unexpected error', error)
      setStatus({ variant: 'error', title: t('auth.register.title'), message: t('auth.register.connectionError') })
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    if (!verificationEmail) return
    const gate = await checkAuthAttempt('resend_verification', verificationEmail)
    if (!gate.allowed) {
      showRateLimit(gate.retryAfterSeconds)
      return
    }

    setResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: verificationEmail,
        options: { emailRedirectTo: getEmailRedirectTo('/login') },
      })
      if (error) throw error
      setVerificationSent(true)
    } catch (error: any) {
      setStatus({ variant: 'error', title: t('auth.login.resend'), message: getAuthErrorMessage(error, 'signUp', t) })
    } finally {
      setResending(false)
    }
  }

  return (
    <ScrollView className="flex-1 bg-background-secondary" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View className="overflow-hidden bg-background-secondary" style={{ minHeight: Math.max(height, 860), borderRadius: isWeb ? 0 : 34 }}>
        <HomeVisualBackground isDesktop={isDesktop} />
        <View className="z-10 flex-1 items-center justify-center" style={{ paddingHorizontal: isDesktop ? 32 : 22, paddingVertical: 32 }}>
          <AuthHomeLink />

          <View className="items-center px-2 mb-8">
            <BrandLogo center size={isDesktop ? 68 : 48} />
          </View>

          <AuthCard
            accentColor="#A56BFF"
            icon={verificationEmail ? 'mail-open-outline' : 'game-controller-outline'}
            title={verificationEmail ? t('auth.register.verificationTitle') : t('auth.register.title')}
            subtitle={verificationEmail ? t('auth.register.verificationSubtitle') : t('auth.register.subtitle')}
            isDesktop={isDesktop}
            maxWidth={isTablet ? 620 : 470}
            surfaceTone="muted-role"
            footer={!verificationEmail ? (
              <View className="flex-row flex-wrap items-center justify-center gap-1">
                <Text maxFontSizeMultiplier={2} className="font-semibold text-text-muted" style={{ fontSize: isTablet ? 13 : 14 }}>{t('auth.register.haveAccount')}</Text>
                <Link href="/(auth)/login" asChild>
                  <Pressable accessibilityRole="link" hitSlop={10}>
                    <Text maxFontSizeMultiplier={2} className="font-extrabold text-semantic-info" style={{ fontSize: isTablet ? 13 : 14 }}>{t('auth.register.loginLink')}</Text>
                  </Pressable>
                </Link>
              </View>
            ) : undefined}
          >
            {verificationEmail ? (
              <>
                {status ? <AuthStatusBanner variant={status.variant} title={status.title} message={status.message} /> : null}
                <EmailVerificationPanel
                  email={verificationEmail}
                  loading={resending}
                  sent={verificationSent}
                  onResend={() => void resendVerification()}
                  onGoToLogin={() => router.replace('/(auth)/login' as any)}
                  onChangeEmail={() => { setVerificationEmail(null); setVerificationSent(false); setStatus(null) }}
                />
              </>
            ) : (
              <>
                <AuthInput
                  label={t('auth.common.alias')}
                  icon="person-outline"
                  placeholder={t('auth.common.aliasPlaceholder')}
                  value={alias}
                  onChangeText={(value) => {
                    setAlias(value)
                    if (fieldErrors.alias) validateValues(value, email, password, confirmPassword)
                    setStatus(null)
                  }}
                  onBlur={() => validateValues(alias, email, password, confirmPassword)}
                  error={fieldErrors.alias}
                  valid={alias.trim().length >= 3 && !fieldErrors.alias}
                  autoCapitalize="none"
                  autoComplete="username"
                  textContentType="username"
                />
                <AuthInput
                  label={t('auth.common.email')}
                  icon="mail-outline"
                  placeholder={t('auth.common.emailPlaceholder')}
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value)
                    if (fieldErrors.email) validateValues(alias, value, password, confirmPassword)
                    setStatus(null)
                  }}
                  onBlur={() => validateValues(alias, email, password, confirmPassword)}
                  error={fieldErrors.email}
                  valid={Boolean(email) && !fieldErrors.email}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  inputMode="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
                <AuthInput
                  label={t('auth.common.password')}
                  icon="lock-closed-outline"
                  placeholder={t('auth.register.passwordPlaceholder')}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value)
                    if (fieldErrors.password || confirmPassword) validateValues(alias, email, value, confirmPassword)
                    setStatus(null)
                  }}
                  onBlur={() => validateValues(alias, email, password, confirmPassword)}
                  onCapsLockChange={setCapsLock}
                  error={fieldErrors.password}
                  autoComplete="new-password"
                  secureTextEntry={!showPassword}
                  secureVisible={showPassword}
                  showSecureToggle
                  textContentType="newPassword"
                  onToggleSecureText={() => setShowPassword((current) => !current)}
                />
                <AuthCapsLockWarning visible={capsLock} />
                <PasswordStrength result={passwordStrength} />
                <AuthInput
                  label={t('auth.common.confirmPassword')}
                  icon="shield-checkmark-outline"
                  placeholder={t('auth.register.confirmPlaceholder')}
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value)
                    if (fieldErrors.confirmPassword || value === password) validateValues(alias, email, password, value)
                    setStatus(null)
                  }}
                  onBlur={() => validateValues(alias, email, password, confirmPassword)}
                  onSubmitEditing={() => void signUpWithEmail()}
                  onCapsLockChange={setCapsLock}
                  error={fieldErrors.confirmPassword}
                  valid={Boolean(confirmPassword) && confirmPassword === password && !fieldErrors.confirmPassword}
                  autoComplete="new-password"
                  secureTextEntry={!showConfirmPassword}
                  secureVisible={showConfirmPassword}
                  showSecureToggle
                  textContentType="newPassword"
                  returnKeyType="done"
                  onToggleSecureText={() => setShowConfirmPassword((current) => !current)}
                />
                {status ? <AuthStatusBanner variant={status.variant} title={status.title} message={status.message} /> : null}
                <AuthSubmitButton
                  label={t('auth.register.submit')}
                  loadingLabel={t('auth.register.loading')}
                  loading={loading}
                  disabled={!passwordStrength.isAcceptable}
                  onPress={() => void signUpWithEmail()}
                />
              </>
            )}
          </AuthCard>
        </View>
      </View>
    </ScrollView>
  )
}
