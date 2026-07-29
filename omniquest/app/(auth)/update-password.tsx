import React, { useEffect, useMemo, useState } from 'react'
import { Link, useRouter } from 'expo-router'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import AuthCapsLockWarning from '../../components/auth/AuthCapsLockWarning'
import AuthCard from '../../components/auth/AuthCard'
import AuthInput from '../../components/auth/AuthInput'
import AuthStatusBanner from '../../components/auth/AuthStatusBanner'
import AuthSubmitButton from '../../components/auth/AuthSubmitButton'
import PasswordStrength from '../../components/auth/PasswordStrength'
import BrandLogo from '../../components/BrandLogo'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import OmniGuide from '../../components/OmniGuide'
import { getAuthErrorMessage, getPasswordStrength } from '../../lib/auth'
import { validatePasswordUpdateForm } from '../../lib/authFormValidation'
import { useI18n } from '../../lib/i18n'
import {
  clearPasswordRecoverySession,
  hasActivePasswordRecoverySession,
  markPasswordRecoverySession,
  recoveryLinkIsPresent,
} from '../../lib/recoverySession'
import { supabase } from '../../lib/supabase'

type RecoveryState = 'checking' | 'ready' | 'invalid'

export default function UpdatePasswordScreen() {
  const { width, height } = useWindowDimensions()
  const router = useRouter()
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [confirmationError, setConfirmationError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('checking')
  const [status, setStatus] = useState<{ variant: 'success' | 'error'; title?: string; message: string } | null>(null)

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const strength = useMemo(() => getPasswordStrength(password, t), [password, t])
  const validationMessages = {
    weakPassword: t('auth.validation.weakPassword'),
    confirmRequired: t('auth.validation.confirmRequired'),
    passwordMismatch: t('auth.validation.passwordMismatch'),
  }

  useEffect(() => {
    let mounted = true

    const verifyRecovery = async () => {
      if (recoveryLinkIsPresent()) await markPasswordRecoverySession()

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const [{ data }, markerActive] = await Promise.all([
          supabase.auth.getSession(),
          hasActivePasswordRecoverySession(),
        ])
        if (data.session && markerActive) {
          if (mounted) setRecoveryState('ready')
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 350))
      }
      if (mounted) setRecoveryState('invalid')
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        void markPasswordRecoverySession().then(() => {
          if (mounted) setRecoveryState('ready')
        })
      }
    })

    void verifyRecovery()
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const validateValues = (nextPassword = password, nextConfirmation = confirmPassword) => {
    const errors = validatePasswordUpdateForm({ password: nextPassword, confirmPassword: nextConfirmation }, validationMessages)
    setPasswordError(errors.password)
    setConfirmationError(errors.confirmPassword)
    return errors
  }

  const updatePassword = async () => {
    const errors = validateValues()
    if (errors.password || errors.confirmPassword || recoveryState !== 'ready') return
    setLoading(true)
    setStatus(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await clearPasswordRecoverySession()
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })
      if (signOutError) console.warn('[password-recovery] could not close every session', signOutError)
      setStatus({ variant: 'success', title: t('auth.update.successTitle'), message: t('auth.update.successMessage') })
      setTimeout(() => router.replace('/login' as any), 1100)
    } catch (error: any) {
      setStatus({ variant: 'error', title: t('auth.update.title'), message: getAuthErrorMessage(error, 'updatePassword', t) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView className="flex-1 bg-background-secondary" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View className="overflow-hidden bg-background-secondary" style={{ minHeight: Math.max(height, 720) }}>
        <HomeVisualBackground isDesktop={isDesktop} />
        <View className="z-10 flex-1 items-center justify-center" style={{ paddingHorizontal: isDesktop ? 32 : 22, paddingVertical: 34 }}>
          <BrandLogo center size={isDesktop ? 64 : 48} />
          <OmniGuide
            state={status?.variant === 'success' ? 'happy' : recoveryState === 'invalid' ? 'error' : 'thinking'}
            size={isDesktop ? 86 : 72}
            style={{ marginTop: 12, marginBottom: 18 }}
          />

          <AuthCard
            accentColor="#7C5CFF"
            icon="lock-closed-outline"
            title={t('auth.update.title')}
            subtitle={t('auth.update.subtitle')}
            isDesktop={isDesktop}
            maxWidth={isTablet ? 560 : 440}
          >
            {recoveryState === 'checking' ? (
              <AuthStatusBanner variant="info" title={t('auth.update.checking')} message={t('auth.update.subtitle')} loading />
            ) : recoveryState === 'invalid' ? (
              <>
                <AuthStatusBanner variant="error" title={t('auth.update.invalidTitle')} message={t('auth.update.invalidMessage')} />
                <Link href="/forgot-password" asChild>
                  <Pressable accessibilityRole="link" className="items-center rounded-2xl border border-semantic-info px-4 py-3">
                    <Text maxFontSizeMultiplier={2} className="font-black text-semantic-info">{t('auth.forgot.submit')}</Text>
                  </Pressable>
                </Link>
              </>
            ) : (
              <>
                <AuthInput
                  label={t('auth.update.title')}
                  icon="lock-closed-outline"
                  placeholder={t('auth.register.passwordPlaceholder')}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value)
                    if (passwordError || confirmPassword) validateValues(value, confirmPassword)
                    setStatus(null)
                  }}
                  onBlur={() => validateValues(password, confirmPassword)}
                  onCapsLockChange={setCapsLock}
                  error={passwordError}
                  autoComplete="new-password"
                  secureTextEntry={!showPassword}
                  secureVisible={showPassword}
                  showSecureToggle
                  textContentType="newPassword"
                  onToggleSecureText={() => setShowPassword((current) => !current)}
                />
                <AuthCapsLockWarning visible={capsLock} />
                <PasswordStrength result={strength} />
                <AuthInput
                  label={t('auth.common.confirmPassword')}
                  icon="shield-checkmark-outline"
                  placeholder={t('auth.register.confirmPlaceholder')}
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value)
                    if (confirmationError || value === password) validateValues(password, value)
                    setStatus(null)
                  }}
                  onBlur={() => validateValues(password, confirmPassword)}
                  onSubmitEditing={() => void updatePassword()}
                  onCapsLockChange={setCapsLock}
                  error={confirmationError}
                  valid={Boolean(confirmPassword) && confirmPassword === password && !confirmationError}
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
                  label={t('auth.update.submit')}
                  loadingLabel={t('auth.update.loading')}
                  loading={loading}
                  disabled={!strength.isAcceptable}
                  icon="checkmark"
                  onPress={() => void updatePassword()}
                />
              </>
            )}
          </AuthCard>
        </View>
      </View>
    </ScrollView>
  )
}
