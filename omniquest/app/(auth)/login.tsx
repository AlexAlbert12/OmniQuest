import React, { useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AuthInput from '../../components/auth/AuthInput'
import BrandLogo from '../../components/BrandLogo'
import SpaceBackground from '../../components/SpaceBackground'
import { getAuthErrorMessage, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

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
    <ScrollView className="flex-1 bg-[#04112A]" contentContainerStyle={{ flexGrow: 1 }}>
      <View
        className="overflow-hidden rounded-[34px] border border-[#27436F] bg-[#071630]"
        style={{
          minHeight: isDesktop ? Math.max(height, 720) : Math.max(height - 28, 720),
          shadowColor: '#132C59',
          shadowOpacity: isWeb ? 0 : 0.35,
          shadowRadius: isWeb ? 0 : 28,
          shadowOffset: { width: 0, height: isWeb ? 0 : 18 },
          elevation: isWeb ? 0 : 12,
          borderRadius: isWeb ? 0 : 34,
        }}
      >
        <SpaceBackground isDesktop={isDesktop} />

        <View
          className="z-10 flex-1 items-center justify-center"
          style={{
            paddingHorizontal: isDesktop ? 32 : 18,
            paddingVertical: isDesktop ? 28 : 20,
          }}
        >
          <View className="absolute left-5 top-5">
            <Link href="/" asChild>
              <Pressable
                className="flex-row items-center gap-2 rounded-full border border-[#35557C] bg-[#081D3D]/88 px-4 py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <Ionicons name="home-outline" size={18} color="#8CD5FF" />
                <Text className="font-bold text-[#D9EEFF]">Inicio</Text>
              </Pressable>
            </Link>
          </View>

          <View className="items-center px-2">
            <BrandLogo center size={isDesktop ? 56 : 34} />

            <Text
              style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 20 : 15 }}
              className="text-center text-[#4FB8FF]"
            >
              Tu viaje de aprendizaje comienza aquí.
            </Text>

            <View className="mt-3 mb-4 flex-row items-center gap-3">
              <View className="h-px w-16 bg-[#3B6FA5]" />
              <Ionicons name="rocket" size={18} color="#8CD5FF" />
              <View className="h-px w-16 bg-[#3B6FA5]" />
            </View>
          </View>

          <View
            className="w-full overflow-hidden rounded-[20px] border border-[#3B6FA5] bg-[#081D3D]/92"
            style={{
              maxWidth: isTablet ? 620 : 440,
              shadowColor: '#1B75D8',
              shadowOpacity: isWeb ? 0 : 0.28,
              shadowRadius: isWeb ? 0 : 24,
              shadowOffset: { width: 0, height: isWeb ? 0 : 12 },
              elevation: isWeb ? 0 : 10,
            }}
          >
            <View style={{ padding: isDesktop ? 30 : 20, gap: 20 }}>
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
                    <Text className="text-[13px] font-semibold text-[#8CD5FF]">
                      ¿Olvidaste tu contraseña?
                    </Text>
                  </Pressable>
                </Link>
              </View>

              <Pressable
                onPress={signInWithEmail}
                disabled={loading}
                className="w-full flex-row items-center justify-center rounded-xl bg-[#1C4D8D] px-5 py-4"
                style={({ pressed }) => ({
                  opacity: loading ? 0.7 : pressed ? 0.86 : 1,
                  shadowColor: '#4FB8FF',
                  shadowOpacity: isWeb ? 0 : 0.22,
                  shadowRadius: isWeb ? 0 : 14,
                  shadowOffset: { width: 0, height: isWeb ? 0 : 8 },
                  elevation: isWeb ? 0 : 6,
                })}
              >
                <View className="flex-row items-center gap-3">
                  {loading ? <ActivityIndicator color="#F5FBFF" /> : null}
                  <Text className="text-[16px] font-bold text-[#F5FBFF]">
                    {loading ? 'Entrando...' : 'Iniciar sesión'}
                  </Text>
                </View>
                {!loading && (
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color="#F5FBFF"
                    style={{ position: 'absolute', right: 22 }}
                  />
                )}
              </Pressable>

              {statusMessage ? (
                <Text className="text-center text-[13px] text-[#8CD5FF]">{statusMessage}</Text>
              ) : null}
            </View>

            <View className="border-t border-[#17365F] bg-[#06162F] px-5 py-5">
              <View className="flex-row flex-wrap items-center justify-center gap-1">
                <Text className="text-[13px] text-[#AFCBE3]">¿No tienes cuenta?</Text>
                <Link href="/register" asChild>
                  <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
                    <Text className="text-[13px] font-bold text-[#4FB8FF]">
                      Regístrate aquí.
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
