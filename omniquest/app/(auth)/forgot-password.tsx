import React, { useState } from 'react'
import { Link } from 'expo-router'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import AuthCard from '../../components/auth/AuthCard'
import AuthInput from '../../components/auth/AuthInput'
import AuthStatusBanner from '../../components/auth/AuthStatusBanner'
import AuthSubmitButton from '../../components/auth/AuthSubmitButton'
import BrandLogo from '../../components/BrandLogo'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import OmniGuide from '../../components/OmniGuide'
import { getAuthErrorMessage, getPasswordRecoveryRedirectTo, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export default function ForgotPasswordScreen() {
  const { width, height } = useWindowDimensions()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState<{ variant: 'success' | 'error'; title?: string; message: string } | null>(null)

  const isDesktop = width >= 1100
  const isTablet = width >= 760

  const validateEmail = (value = email) => {
    const error = isValidEmail(normalizeEmail(value)) ? undefined : 'Introduce un correo electrónico válido.'
    setEmailError(error)
    return !error
  }

  const sendRecoveryEmail = async () => {
    const normalizedEmail = normalizeEmail(email)
    if (!validateEmail(normalizedEmail)) return

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
        title: 'Revisa tu correo',
        message: `Hemos enviado un enlace de recuperación a ${normalizedEmail}. También puede estar en correo no deseado.`,
      })
    } catch (error: any) {
      setStatus({ variant: 'error', title: 'No se pudo enviar', message: getAuthErrorMessage(error, 'resetPassword') })
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
            <Text style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 21 : 16 }} className="mt-1 text-center text-semantic-info">Recupera el acceso a tu aventura.</Text>
            <OmniGuide state={sent ? 'happy' : 'thinking'} size={isDesktop ? 88 : 72} style={{ marginTop: 12 }} />
          </View>

          <AuthCard
            accentColor="#38BDF8"
            icon="key-outline"
            title="Recuperar contraseña"
            subtitle="Te enviaremos un enlace seguro para crear una contraseña nueva"
            isDesktop={isDesktop}
            maxWidth={isTablet ? 560 : 440}
            footer={(
              <Link href="/login" asChild>
                <Pressable accessibilityRole="link" className="flex-row items-center justify-center gap-2" hitSlop={6}>
                  <Text className="font-extrabold text-semantic-info">Volver a iniciar sesión</Text>
                </Pressable>
              </Link>
            )}
          >
            <AuthInput
              label="Correo electrónico"
              icon="mail-outline"
              placeholder="tu@email.com"
              value={email}
              onChangeText={(value) => {
                setEmail(value)
                if (emailError) validateEmail(value)
                setStatus(null)
              }}
              onBlur={() => validateEmail()}
              onSubmitEditing={() => void sendRecoveryEmail()}
              error={emailError}
              valid={Boolean(email) && !emailError && isValidEmail(normalizeEmail(email))}
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
              label={sent ? 'Reenviar enlace' : 'Enviar enlace de recuperación'}
              loadingLabel="Enviando…"
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
