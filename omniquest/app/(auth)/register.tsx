import React, { useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Link, useRouter } from 'expo-router'
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import AuthCard from '../../components/auth/AuthCard'
import AuthInput from '../../components/auth/AuthInput'
import AuthStatusBanner from '../../components/auth/AuthStatusBanner'
import AuthSubmitButton from '../../components/auth/AuthSubmitButton'
import EmailVerificationPanel from '../../components/auth/EmailVerificationPanel'
import PasswordStrength from '../../components/auth/PasswordStrength'
import BrandLogo from '../../components/BrandLogo'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import OmniGuide from '../../components/OmniGuide'
import { getAuthErrorMessage, getEmailRedirectTo, getPasswordStrength, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

type RegisterErrors = { alias?: string; confirmPassword?: string; email?: string; password?: string }
type Status = { variant: 'info' | 'success' | 'warning' | 'error'; title?: string; message: string } | null

export default function RegisterScreen() {
  const { width, height } = useWindowDimensions()
  const router = useRouter()
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [verificationSent, setVerificationSent] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({})

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])

  const validateAlias = (value = alias) => {
    const trimmed = value.trim()
    const error = trimmed.length < 3 ? 'El alias debe tener al menos 3 caracteres.' : trimmed.length > 30 ? 'El alias no puede superar 30 caracteres.' : undefined
    setFieldErrors((current) => ({ ...current, alias: error }))
    return !error
  }
  const validateEmail = (value = email) => {
    const error = isValidEmail(normalizeEmail(value)) ? undefined : 'Introduce un correo electrónico válido.'
    setFieldErrors((current) => ({ ...current, email: error }))
    return !error
  }
  const validatePassword = (value = password) => {
    const strength = getPasswordStrength(value)
    const error = strength.isAcceptable ? undefined : 'Usa 8 caracteres e incluye mayúscula, minúscula, número y símbolo.'
    setFieldErrors((current) => ({ ...current, password: error }))
    return !error
  }
  const validateConfirmation = (value = confirmPassword, sourcePassword = password) => {
    const error = !value ? 'Repite tu contraseña.' : value !== sourcePassword ? 'Las contraseñas no coinciden.' : undefined
    setFieldErrors((current) => ({ ...current, confirmPassword: error }))
    return !error
  }

  const signUpWithEmail = async () => {
    const normalizedEmail = normalizeEmail(email)
    const checks = [validateAlias(), validateEmail(normalizedEmail), validatePassword(), validateConfirmation(confirmPassword, password)]
    if (checks.some((valid) => !valid)) return

    setLoading(true)
    setStatus({ variant: 'info', message: 'Estamos creando tu cuenta de alumno…' })
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getEmailRedirectTo('/login'),
          data: { alias: alias.trim(), role_id: 'student' },
        },
      })
      if (error) {
        setStatus({ variant: 'error', title: 'No se pudo crear la cuenta', message: getAuthErrorMessage(error, 'signUp') })
        return
      }
      if (!data.session) {
        setVerificationEmail(normalizedEmail)
        setVerificationSent(false)
        setStatus(null)
        return
      }
      setStatus({ variant: 'success', message: 'Cuenta creada. Preparando tu aventura…' })
      router.replace('/(student)/homeStudent' as any)
    } catch (error) {
      console.error('[register] unexpected error', error)
      setStatus({ variant: 'error', title: 'Error de conexión', message: 'No hemos podido crear la cuenta. Inténtalo de nuevo.' })
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    if (!verificationEmail) return
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
      setStatus({ variant: 'error', title: 'No se pudo reenviar', message: getAuthErrorMessage(error, 'signUp') })
    } finally {
      setResending(false)
    }
  }

  return (
    <ScrollView className="flex-1 bg-background-secondary" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View className="overflow-hidden bg-background-secondary" style={{ minHeight: Math.max(height, 860), borderRadius: isWeb ? 0 : 34 }}>
        <HomeVisualBackground isDesktop={isDesktop} />
        <View className="z-10 flex-1 items-center justify-center" style={{ paddingHorizontal: isDesktop ? 32 : 22, paddingVertical: 32 }}>
          <View className="absolute left-5 top-5 z-20">
            <Link href="/" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Volver al inicio" className="flex-row items-center gap-2 rounded-full border border-border-active bg-semantic-surface-info px-4 py-3">
                <Ionicons name="home-outline" size={18} color="#8CD5FF" />
                <Text className="font-extrabold text-text-secondary">Inicio</Text>
              </Pressable>
            </Link>
          </View>

          <View className="items-center px-2">
            <BrandLogo center size={isDesktop ? 68 : 48} />
            <Text style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 21 : 16 }} className="mt-1 text-center text-semantic-info">Crea tu cuenta para empezar.</Text>
            <View className="mb-5 mt-4 flex-row items-center gap-3">
              <View className="h-px w-16 bg-brand-student" />
              <OmniGuide state={verificationEmail ? 'happy' : 'normal'} autoBlink={!verificationEmail} size={isDesktop ? 80 : isTablet ? 70 : 48} />
              <View className="h-px w-16 bg-brand-student" />
            </View>
          </View>

          <AuthCard
            accentColor="#A56BFF"
            icon={verificationEmail ? 'mail-open-outline' : 'game-controller-outline'}
            title={verificationEmail ? 'Un último paso' : 'Crear cuenta'}
            subtitle={verificationEmail ? 'Verifica tu correo para activar la cuenta' : 'Empieza tu aventura como alumno'}
            isDesktop={isDesktop}
            maxWidth={isTablet ? 620 : 470}
            footer={!verificationEmail ? (
              <View className="flex-row flex-wrap items-center justify-center gap-1">
                <Text className="text-[13px] font-semibold text-text-muted">¿Ya tienes cuenta?</Text>
                <Link href="/(auth)/login" asChild><Pressable accessibilityRole="link" hitSlop={6}><Text className="text-[13px] font-extrabold text-semantic-info">Inicia sesión.</Text></Pressable></Link>
              </View>
            ) : undefined}
          >
            {verificationEmail ? (
              <EmailVerificationPanel
                email={verificationEmail}
                loading={resending}
                sent={verificationSent}
                onResend={() => void resendVerification()}
                onGoToLogin={() => router.replace('/(auth)/login' as any)}
                onChangeEmail={() => { setVerificationEmail(null); setVerificationSent(false); setStatus(null) }}
              />
            ) : (
              <>
                <AuthInput
                  label="Alias público"
                  icon="person-outline"
                  placeholder="Jugador123"
                  value={alias}
                  onChangeText={(value) => { setAlias(value); if (fieldErrors.alias) validateAlias(value); setStatus(null) }}
                  onBlur={() => validateAlias()}
                  error={fieldErrors.alias}
                  valid={alias.trim().length >= 3 && !fieldErrors.alias}
                  autoCapitalize="none"
                  autoComplete="username"
                  textContentType="username"
                />
                <AuthInput
                  label="Correo electrónico"
                  icon="mail-outline"
                  placeholder="tu@email.com"
                  value={email}
                  onChangeText={(value) => { setEmail(value); if (fieldErrors.email) validateEmail(value); setStatus(null) }}
                  onBlur={() => validateEmail()}
                  error={fieldErrors.email}
                  valid={Boolean(email) && !fieldErrors.email && isValidEmail(normalizeEmail(email))}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  inputMode="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
                <AuthInput
                  label="Contraseña"
                  icon="lock-closed-outline"
                  placeholder="Crea una contraseña segura"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value)
                    if (fieldErrors.password) validatePassword(value)
                    if (confirmPassword) validateConfirmation(confirmPassword, value)
                    setStatus(null)
                  }}
                  onBlur={() => validatePassword()}
                  error={fieldErrors.password}
                  autoComplete="new-password"
                  secureTextEntry={!showPassword}
                  secureVisible={showPassword}
                  showSecureToggle
                  textContentType="newPassword"
                  onToggleSecureText={() => setShowPassword((current) => !current)}
                />
                <PasswordStrength result={passwordStrength} />
                <AuthInput
                  label="Confirmar contraseña"
                  icon="shield-checkmark-outline"
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChangeText={(value) => { setConfirmPassword(value); if (fieldErrors.confirmPassword || value === password) validateConfirmation(value, password); setStatus(null) }}
                  onBlur={() => validateConfirmation()}
                  onSubmitEditing={() => void signUpWithEmail()}
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
                <AuthSubmitButton label="Crear cuenta de alumno" loadingLabel="Creando cuenta…" loading={loading} disabled={!passwordStrength.isAcceptable} onPress={() => void signUpWithEmail()} />
              </>
            )}
          </AuthCard>
        </View>
      </View>
    </ScrollView>
  )
}
