import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getAuthErrorMessage, getEmailRedirectTo, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import SpaceBackground from '../../components/SpaceBackground'

export default function RegisterScreen() {
  const { width, height } = useWindowDimensions()
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const router = useRouter()

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'

  async function signUpWithEmail() {
    console.log('[register] button pressed')
    setStatusMessage('Boton pulsado')

    if (!alias || !email || !password) {
      console.log('[register] validation failed: missing fields')
      setStatusMessage('Faltan campos por rellenar')
      Alert.alert('Error', 'Por favor, rellena todos los campos')
      return
    }

    const normalizedEmail = normalizeEmail(email)

    if (!isValidEmail(normalizedEmail)) {
      console.log('[register] validation failed: invalid email', normalizedEmail)
      setStatusMessage('Correo invalido')
      Alert.alert('Error', 'Introduce un correo electronico valido.')
      return
    }

    if (password.length < 6) {
      console.log('[register] validation failed: short password')
      setStatusMessage('Contrasena demasiado corta')
      Alert.alert('Error', 'La contrasena debe tener al menos 6 caracteres.')
      return
    }

    console.log('[register] starting supabase signUp', {
      email: normalizedEmail,
      redirectTo: getEmailRedirectTo(),
    })
    setStatusMessage('Llamando a Supabase...')
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

      console.log('[register] signUp response', {
        hasSession: !!data.session,
        userId: data.user?.id,
        error,
      })

      if (error) {
        setStatusMessage(`Error de Supabase: ${getAuthErrorMessage(error, 'signUp')}`)
        Alert.alert('Error', getAuthErrorMessage(error, 'signUp'))
        return
      }

      if (!data.session) {
        setStatusMessage('Cuenta creada, pendiente de inicio o confirmacion')
        Alert.alert(
          'Revisa tu correo',
          'Cuenta creada. Si la confirmacion de email esta activada en Supabase, primero debes confirmar tu correo antes de iniciar sesion.'
        )
        router.replace('/(auth)/login' as any)
        return
      }

      setStatusMessage('Registro completado')
      Alert.alert('Exito', 'Cuenta creada correctamente.')
      router.replace('/(student)/homeStudent' as any)
    } catch (error) {
      console.error('[register] unexpected error', error)
      setStatusMessage(`Excepcion: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      Alert.alert('Error', error instanceof Error ? error.message : 'Error inesperado al registrar')
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
            paddingVertical: isDesktop ? 42 : 28,
          }}
        >
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
              Crea tu cuenta para empezar.
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
                  Alias
                </Text>
                <View className="flex-row items-center rounded-lg border border-[#35557C] bg-[#0B2145]">
                  <Ionicons className="ml-4 mr-4" name="person-outline" size={18} color="#8AAED0" />
                  <TextInput
                    className="flex-1 px-3 py-4 text-[15px] text-[#F5FBFF]"
                    placeholder="Jugador123"
                    placeholderTextColor="#8AAED0"
                    value={alias}
                    onChangeText={setAlias}
                    autoCapitalize="none"
                  />
                </View>
              </View>

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

              <View className="rounded-xl border border-[#17365F] bg-[#061A38] px-4 py-3">
                <View className="flex-row items-start gap-3">
                  <Ionicons name="shield-checkmark-outline" size={18} color="#8CD5FF" />
                  <Text className="flex-1 text-[13px] leading-5 text-[#AFCBE3]">
                    Tu contraseña debe tener al menos 6 caracteres. Usaremos tu alias para mostrarte en preguntas y rankings.
                  </Text>
                </View>
              </View>

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
                      Inicia Sesión.
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
