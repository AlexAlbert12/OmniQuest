import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
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
  isValidEmail,
  normalizeEmail,
} from '../../lib/auth'
import { supabase } from '../../lib/supabase'

type LoginErrors = { email?: string; password?: string }
type Status = { variant: 'info' | 'success' | 'warning' | 'error'; title?: string; message: string } | null

export default function LoginScreen() {
  const { width, height } = useWindowDimensions()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({})

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'

  const validateEmail = (value = email) => {
    const normalized = normalizeEmail(value)
    const error = isValidEmail(normalized) ? undefined : 'Introduce un correo electrónico válido.'
    setFieldErrors((current) => ({ ...current, email: error }))
    return !error
  }

  const validatePassword = (value = password) => {
    const error = value ? undefined : 'Introduce tu contraseña.'
    setFieldErrors((current) => ({ ...current, password: error }))
    return !error
  }

  const signInWithEmail = async () => {
    const normalizedEmail = normalizeEmail(email)
    const validEmail = isValidEmail(normalizedEmail)
    if (!validEmail) validateEmail(normalizedEmail)
    if (!password) validatePassword(password)
    if (!validEmail || !password) return

    setStatus({ variant: 'info', message: 'Estamos comprobando tus credenciales…' })
    setVerificationEmail(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (error) {
        if (isEmailVerificationError(error)) {
          setVerificationEmail(normalizedEmail)
          setStatus({
            variant: 'warning',
            title: 'Correo pendiente de verificación',
            message: 'Confirma tu correo antes de entrar. Puedes solicitar un enlace nuevo desde aquí.',
          })
          return
        }
        setStatus({ variant: 'error', title: 'No se pudo iniciar sesión', message: getAuthErrorMessage(error, 'signIn') })
        return
      }
      setStatus({ variant: 'success', message: 'Sesión iniciada. Preparando tu espacio…' })
    } catch (error) {
      console.error('[login] unexpected error', error)
      setStatus({ variant: 'error', title: 'Error de conexión', message: 'No hemos podido iniciar sesión. Inténtalo de nuevo.' })
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    const targetEmail = verificationEmail || normalizeEmail(email)
    if (!isValidEmail(targetEmail)) {
      validateEmail(targetEmail)
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
        title: 'Verificación reenviada',
        message: `Hemos enviado un nuevo enlace a ${targetEmail}. Revisa también correo no deseado.`,
      })
    } catch (error: any) {
      setStatus({ variant: 'error', title: 'No se pudo reenviar', message: getAuthErrorMessage(error, 'signUp') })
    } finally {
      setResending(false)
    }
  }

  return (
    <ScrollView className="flex-1 bg-[#010611]" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View className="overflow-hidden bg-[#010611]" style={{ minHeight: Math.max(height, 760), borderRadius: isWeb ? 0 : 34 }}>
        <HomeVisualBackground isDesktop={isDesktop} />
        <View className="z-10 flex-1 items-center justify-center" style={{ paddingHorizontal: isDesktop ? 32 : 22, paddingVertical: 32 }}>
          <View className="absolute left-5 top-5 z-20">
            <Link href="/" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Volver al inicio"
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
                <Text className="font-extrabold text-[#DDE8FF]">Inicio</Text>
              </Pressable>
            </Link>
          </View>

          <View className="items-center px-2">
            <BrandLogo center size={isDesktop ? 68 : 52} />
            <Text style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 21 : 16 }} className="mt-1 text-center text-[#4FB8FF]">
              Tu viaje de aprendizaje comienza aquí.
            </Text>
            <View className="mb-5 mt-4 flex-row items-center gap-3">
              <View className="h-px w-16 bg-[#3B6FA5]" />
              <OmniGuide state="normal" autoBlink size={isDesktop ? 80 : isTablet ? 70 : 48} />
              <View className="h-px w-16 bg-[#3B6FA5]" />
            </View>
          </View>

          <AuthCard
            accentColor="#38BDF8"
            icon="person-outline"
            title="Iniciar sesión"
            subtitle="Accede a tu cuenta de OmniQuest"
            isDesktop={isDesktop}
            maxWidth={isTablet ? 620 : 460}
            footer={(
              <View className="flex-row flex-wrap items-center justify-center gap-1">
                <Text className="text-[13px] font-semibold text-[#AEBBDD]">¿No tienes cuenta de alumno?</Text>
                <Link href="/register" asChild>
                  <Pressable accessibilityRole="link" hitSlop={6}><Text className="text-[13px] font-extrabold text-[#42B9FF]">Regístrate aquí.</Text></Pressable>
                </Link>
              </View>
            )}
          >
            <AuthRoleNotice mode="login" />

            <AuthInput
              label="Correo electrónico"
              icon="mail-outline"
              placeholder="tu@email.com"
              value={email}
              onChangeText={(value) => {
                setEmail(value)
                if (fieldErrors.email) validateEmail(value)
                setStatus(null)
                setVerificationEmail(null)
              }}
              onBlur={() => validateEmail()}
              error={fieldErrors.email}
              valid={Boolean(email) && !fieldErrors.email && isValidEmail(normalizeEmail(email))}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              inputMode="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />

            <AuthInput
              label="Contraseña"
              icon="lock-closed-outline"
              placeholder="Introduce tu contraseña"
              value={password}
              onChangeText={(value) => {
                setPassword(value)
                if (fieldErrors.password) validatePassword(value)
                setStatus(null)
              }}
              onBlur={() => validatePassword()}
              onSubmitEditing={() => void signInWithEmail()}
              error={fieldErrors.password}
              autoComplete="current-password"
              secureTextEntry={!showPassword}
              secureVisible={showPassword}
              showSecureToggle
              textContentType="password"
              returnKeyType="done"
              onToggleSecureText={() => setShowPassword((current) => !current)}
            />

            <View className="flex-row items-center justify-end">
              <Link href="/forgot-password" asChild>
                <Pressable accessibilityRole="link" hitSlop={6}><Text className="text-[13px] font-bold text-[#42B9FF]">¿Olvidaste tu contraseña?</Text></Pressable>
              </Link>
            </View>

            {status ? (
              <AuthStatusBanner
                variant={status.variant}
                title={status.title}
                message={status.message}
                actionLabel={verificationEmail ? 'Reenviar verificación' : undefined}
                onAction={verificationEmail ? () => void resendVerification() : undefined}
                loading={resending}
              />
            ) : null}

            <AuthSubmitButton label="Iniciar sesión" loadingLabel="Entrando…" loading={loading} onPress={() => void signInWithEmail()} />
          </AuthCard>
        </View>
      </View>
    </ScrollView>
  )
}
