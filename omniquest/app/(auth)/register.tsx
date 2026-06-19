import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AuthInput from '../../components/auth/AuthInput'
import BrandLogo from '../../components/BrandLogo'
import SpaceBackground from '../../components/SpaceBackground'
import { getAuthErrorMessage, getEmailRedirectTo, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

type RegisterErrors = {
  alias?: string
  confirmPassword?: string
  email?: string
  password?: string
}

export default function RegisterScreen() {
  const { width, height } = useWindowDimensions()
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({})
  const router = useRouter()

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'

  const clearFieldError = (field: keyof RegisterErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setStatusMessage('')
  }

  async function signUpWithEmail() {
    const normalizedEmail = normalizeEmail(email)
    const nextErrors: RegisterErrors = {}

    if (!alias.trim()) {
      nextErrors.alias = 'Elige un alias para tu perfil.'
    }

    if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = 'Introduce un correo electrónico válido.'
    }

    if (password.length < 6) {
      nextErrors.password = 'La contraseña debe tener al menos 6 caracteres.'
    }

    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setStatusMessage('')
      return
    }

    setFieldErrors({})
    setStatusMessage('Creando cuenta...')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getEmailRedirectTo(),
          data: {
            alias: alias.trim(),
            role_id: 'student',
          },
        },
      })

      if (error) {
        setStatusMessage(getAuthErrorMessage(error, 'signUp') || 'No hemos podido crear la cuenta. Revisa los datos.')
        return
      }

      if (!data.session) {
        setStatusMessage('Cuenta creada. Revisa tu correo antes de iniciar sesión.')
        Alert.alert(
          'Revisa tu correo',
          'Cuenta creada correctamente. Si la confirmación por email está activada, confirma tu correo antes de iniciar sesión.'
        )
        router.replace('/(auth)/login' as any)
        return
      }

      setStatusMessage('Cuenta creada correctamente.')
      router.replace('/(student)/homeStudent' as any)
    } catch (error) {
      console.error('[register] unexpected error', error)
      setStatusMessage('No hemos podido crear la cuenta. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView className="flex-1 bg-[#04112A]" contentContainerStyle={{ flexGrow: 1 }}>
      <View
        className="overflow-hidden rounded-[34px] border border-[#27436F] bg-[#071630]"
        style={{
          minHeight: isDesktop ? Math.max(height, 760) : Math.max(height - 28, 760),
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
              Crea tu cuenta para empezar.
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
            <View style={{ padding: isDesktop ? 30 : 20, gap: 18 }}>
              <AuthInput
                label="Alias"
                icon="person-outline"
                placeholder="Jugador123"
                value={alias}
                onChangeText={(value) => {
                  setAlias(value)
                  clearFieldError('alias')
                }}
                error={fieldErrors.alias}
                autoCapitalize="none"
                autoComplete="username"
                textContentType="username"
              />

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
                  if (fieldErrors.confirmPassword) clearFieldError('confirmPassword')
                }}
                error={fieldErrors.password}
                helper="Mínimo 6 caracteres."
                autoComplete="new-password"
                secureTextEntry={!showPassword}
                secureVisible={showPassword}
                showSecureToggle
                textContentType="newPassword"
                onToggleSecureText={() => setShowPassword((current) => !current)}
              />

              <AuthInput
                label="Confirmar contraseña"
                icon="lock-closed-outline"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value)
                  clearFieldError('confirmPassword')
                }}
                error={fieldErrors.confirmPassword}
                autoComplete="new-password"
                secureTextEntry={!showConfirmPassword}
                secureVisible={showConfirmPassword}
                showSecureToggle
                textContentType="newPassword"
                onToggleSecureText={() => setShowConfirmPassword((current) => !current)}
              />

              <Pressable
                onPress={signUpWithEmail}
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
                    {loading ? 'Creando cuenta...' : 'Registrarse'}
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
                <Text className="text-[13px] text-[#AFCBE3]">¿Ya tienes cuenta?</Text>
                <Link href="/(auth)/login" asChild>
                  <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
                    <Text className="text-[13px] font-bold text-[#4FB8FF]">
                      Inicia sesión.
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
