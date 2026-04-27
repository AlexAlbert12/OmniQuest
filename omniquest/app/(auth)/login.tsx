import React, { useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getAuthErrorMessage, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import SpaceBackground from '../../components/SpaceBackground'

export default function LoginScreen() {
  const { width, height } = useWindowDimensions()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'

  async function signInWithEmail() {
    console.log('[login] button pressed')
    setStatusMessage('Boton pulsado')

    const normalizedEmail = normalizeEmail(email)

    if (!isValidEmail(normalizedEmail)) {
      console.log('[login] validation failed: invalid email', normalizedEmail)
      setStatusMessage('Correo invalido')
      Alert.alert('Error', 'Introduce un correo electronico valido.')
      return
    }

    if (!password) {
      console.log('[login] validation failed: missing password')
      setStatusMessage('Falta la contrasena')
      Alert.alert('Error', 'Introduce tu contrasena.')
      return
    }

    console.log('[login] starting signIn', { email: normalizedEmail })
    setStatusMessage('Iniciando sesion...')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      console.log('[login] signIn response', {
        hasSession: !!data.session,
        userId: data.user?.id,
        error,
      })

      if (error) {
        setStatusMessage(`Error de Supabase: ${getAuthErrorMessage(error, 'signIn')}`)
        Alert.alert('Error', getAuthErrorMessage(error, 'signIn'))
        return
      }

      setStatusMessage('Sesion iniciada')
    } catch (error) {
      console.error('[login] unexpected error', error)
      setStatusMessage(`Excepcion: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      Alert.alert('Error', error instanceof Error ? error.message : 'Error inesperado al iniciar sesion')
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
            paddingVertical: isDesktop ? 42 : 28,
          }}
        >
          <Link href="/" asChild className="absolute top-5 left-5">
            <Pressable
              className="rounded-full border border-[#4FB8FF] p-4"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Ionicons name="home" size={18} color="#8CD5FF" />
            </Pressable>
          </Link>

          <View className="items-center px-2">
            <Text
              style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 72 : 40 }}
              className="text-center text-[#CDEFFF]"
            >
              OmniQuest
            </Text>

            <Text
              style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 22 : 16 }}
              className="text-center text-[#4FB8FF]"
            >
              Tu viaje de aprendizaje comienza aquí.
            </Text>

            <View className="mt-4 mb-4 flex-row items-center gap-3">
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
              <View style={{ gap: 8 }}>
                <Text className="ml-1 text-[13px] font-bold text-[#D9EEFF]">
                  Correo Electrónico
                </Text>
                <View className="flex-row items-center rounded-lg border border-[#35557C] bg-[#0B2145]">
                  <Ionicons className="ml-4 mr-4" name="mail-outline" size={18} color="#8AAED0" />
                  <TextInput
                    className="flex-1 px-3 py-4 text-[15px] text-[#F5FBFF]"
                    placeholder="Introduzca su correo"
                    placeholderTextColor="#8AAED0"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Text className="ml-1 text-[13px] font-bold text-[#D9EEFF]">
                  Contraseña
                </Text>
                <View className="flex-row items-center rounded-lg border border-[#35557C] bg-[#0B2145] px-4">
                  <Ionicons className="mr-4" name="lock-closed-outline" size={18} color="#8AAED0" />
                  <TextInput
                    className="flex-1 px-3 py-4 text-[15px] text-[#F5FBFF]"
                    placeholder="Introduzca su contraseña"
                    placeholderTextColor="#8AAED0"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    className="items-center justify-center rounded-full p-2"
                    style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
                  >
                    <Ionicons
                      className="ml-2"
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={18}
                      color="#9FC7E2"
                    />
                  </Pressable>
                </View>
              </View>

              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <Pressable
                  onPress={() => setRememberMe(!rememberMe)}
                  className="flex-row items-center gap-2"
                  style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
                >
                  <View
                    className="items-center justify-center rounded border"
                    style={{
                      width: 17,
                      height: 17,
                      backgroundColor: rememberMe ? '#4FB8FF' : 'transparent',
                      borderColor: rememberMe ? '#4FB8FF' : '#7EA9CA',
                    }}
                  >
                    {rememberMe && <Ionicons name="checkmark" size={13} color="#04112A" />}
                  </View>
                  <Text className="text-[13px] text-[#D8E7F6]">Recordarme</Text>
                </Pressable>

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
                    {loading ? 'Entrando...' : 'Iniciar Sesión'}
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

            <View className="border-t border-[#17365F] px-5 pt-5">
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
