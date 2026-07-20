import React, { useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AuthInput from '../../components/auth/AuthInput'
import BrandLogo from '../../components/BrandLogo'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import { getAuthErrorMessage, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { createShadowStyle } from '../../lib/platformShadow'
import OmniGuide from '../../components/OmniGuide'

type LoginErrors = {
  email?: string
  password?: string
}

export default function LoginScreen() {
  const { width, height } = useWindowDimensions()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({})

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'

  const clearFieldError = (field: keyof LoginErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setStatusMessage('')
  }

  async function signInWithEmail() {
    const normalizedEmail = normalizeEmail(email)
    const nextErrors: LoginErrors = {}

    if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = 'Introduce un correo electrónico válido.'
    }

    if (!password) {
      nextErrors.password = 'Introduce tu contraseña.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setStatusMessage('')
      return
    }

    setFieldErrors({})
    setStatusMessage('Iniciando sesión...')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        setStatusMessage(getAuthErrorMessage(error, 'signIn') || 'No hemos podido iniciar sesión. Revisa tus datos.')
        return
      }

      setStatusMessage('Sesión iniciada.')
    } catch (error) {
      console.error('[login] unexpected error', error)
      setStatusMessage('No hemos podido iniciar sesión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-[#010611]"
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        className="overflow-hidden bg-[#010611]"
        style={{
          minHeight: isDesktop ? Math.max(height, 760) : Math.max(height, 760),
          borderRadius: isWeb ? 0 : 34,
        }}
      >
        <HomeVisualBackground isDesktop={isDesktop} />

        <View
          className="z-10 flex-1 items-center justify-center"
          style={{
            paddingHorizontal: isDesktop ? 32 : 22,
            paddingVertical: isDesktop ? 34 : 28,
          }}
        >
          <View className="absolute left-5 top-5 z-20">
            <Link href="/" asChild>
              <Pressable
                className="flex-row items-center gap-2 px-4 py-3"
                style={({ pressed }) => ({
                  backgroundColor: 'rgba(16, 42, 82, 0.72)',
                  borderColor: 'rgba(99, 177, 235, 0.28)',
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
            <BrandLogo center size={isDesktop ? 68 : 54} />
            <Text
              style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 21 : 16 }}
              className="mt-1 text-center text-[#4FB8FF]"
            >
              Tu viaje de aprendizaje comienza aquí.
            </Text>

            <View className="mt-4 mb-5 flex-row items-center gap-3">
              <View className="h-px w-16 bg-[#3B6FA5]" />
              <OmniGuide state="normal" autoBlink size={isDesktop ? 80 : isTablet ? 80 : 40} />
              <View className="h-px w-16 bg-[#3B6FA5]" />
            </View>
          </View>

          <LinearGradient
            colors={['rgba(56, 189, 248, 0.18)', 'rgba(34, 28, 78, 0.90)']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              borderColor: 'rgba(148, 163, 184, 0.18)',
              borderRadius: 32,
              borderWidth: 1,
              maxWidth: isTablet ? 620 : 440,
              overflow: 'hidden',
              width: '100%',
              ...createShadowStyle({
                color: '#A855F7',
                opacity: 0.14,
                radius: 24,
                offsetY: 12,
                elevation: 10,
                web: '0 18px 34px rgba(168, 85, 247, 0.18)',
              }),
            }}
          >
            <View style={{ padding: isDesktop ? 30 : 22, gap: 20 }}>
              <View className="flex-row items-center gap-4">
                <View
                  className="items-center justify-center"
                  style={{ backgroundColor: '#38BDF8', borderRadius: 22, height: 64, width: 64 }}
                >
                  <Ionicons name="person-outline" size={31} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-[27px] font-extrabold text-white">Iniciar sesión</Text>
                  <Text className="mt-1 text-[15px] font-semibold text-[#B8C5E0]">Accede a tu cuenta</Text>
                </View>
              </View>

              <AuthInput
                label="Correo electrónico"
                icon="mail-outline"
                placeholder="Introduce tu correo"
                value={email}
                onChangeText={(value) => {
                  setEmail(value)
                  clearFieldError('email')
                }}
                error={fieldErrors.email}
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
                placeholder="Introduce tu contraseña"
                value={password}
                onChangeText={(value) => {
                  setPassword(value)
                  clearFieldError('password')
                }}
                error={fieldErrors.password}
                autoComplete="current-password"
                secureTextEntry={!showPassword}
                secureVisible={showPassword}
                showSecureToggle
                textContentType="password"
                onToggleSecureText={() => setShowPassword((current) => !current)}
              />

              <View className="flex-row flex-wrap items-center justify-end gap-3">
                <Link href="/forgot-password" asChild>
                  <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.74 : 1 })}>
                    <Text className="text-[13px] font-bold text-[#42B9FF]">¿Olvidaste tu contraseña?</Text>
                  </Pressable>
                </Link>
              </View>

              <AuthGradientButton
                loading={loading}
                loadingLabel="Entrando..."
                label="Iniciar sesión"
                onPress={signInWithEmail}
              />

              {statusMessage ? (
                <Text className="text-center text-[13px] font-semibold text-[#8CD5FF]">{statusMessage}</Text>
              ) : null}
            </View>

            <View
              className="border-t px-5 py-5"
              style={{
                backgroundColor: 'rgba(16, 42, 82, 0.42)',
                borderColor: 'rgba(99, 177, 235, 0.14)',
              }}
            >
              <View className="flex-row flex-wrap items-center justify-center gap-1">
                <Text className="text-[13px] font-semibold text-[#AEBBDD]">¿No tienes cuenta?</Text>
                <Link href="/register" asChild>
                  <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
                    <Text className="text-[13px] font-extrabold text-[#42B9FF]">Regístrate aquí.</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </ScrollView>
  )
}

function AuthGradientButton({
  label,
  loading,
  loadingLabel,
  onPress,
}: {
  label: string
  loading: boolean
  loadingLabel: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({ opacity: loading ? 0.7 : pressed ? 0.9 : 1 })}
    >
      <LinearGradient
        colors={['#3479F4', '#8D63F7']}
        start={{ x: 0, y: 0.15 }}
        end={{ x: 1, y: 0.9 }}
        style={{
          alignItems: 'center',
          borderRadius: 26,
          flexDirection: 'row',
          justifyContent: 'center',
          minHeight: 62,
          paddingHorizontal: 22,
          ...createShadowStyle({
            color: '#7C66FF',
            opacity: 0.32,
            radius: 20,
            offsetY: 10,
            elevation: 8,
            web: '0 16px 30px rgba(124, 102, 255, 0.26)',
          }),
        }}
      >
        <View className="flex-row items-center gap-3">
          {loading ? <ActivityIndicator color="#F5FBFF" /> : null}
          <Text className="text-[17px] font-extrabold text-[#F5FBFF]">
            {loading ? loadingLabel : label}
          </Text>
        </View>
        {!loading ? (
          <View
            className="absolute right-3 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.18)', height: 44, width: 44 }}
          >
            <Ionicons name="arrow-forward" size={24} color="#F5FBFF" />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  )
}
