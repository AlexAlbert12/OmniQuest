import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import { Link } from 'expo-router'
import { getAuthErrorMessage, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

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
    <View className="flex-1 justify-center px-6 bg-[#0F2854]">
      <View className="items-center mb-8">
        <Text style={{ fontFamily: 'Pacifico_400Regular' }} className="text-6xl text-[#BDE8F5] mb-4">
          OmniQuest
        </Text>
        <Text style={{ fontFamily: 'Pacifico_400Regular' }} className="text-[#4988C4] text-xl text-center">
          Tu viaje de aprendizaje comienza aquí.
        </Text>
      </View>
      <View className="rounded-3xl border border-[#4988C4] bg-[#13315F] p-6 shadow-xl">
        <View className="space-y-5">
          <View>
            <Text className="text-[#EAF6FB] font-medium mb-1 ml-1">Correo Electrónico</Text>
            <TextInput
              className="w-full bg-[#16366A] border border-[#4988C4] rounded-2xl px-4 py-3.5 text-[#EAF6FB]"
              placeholder="alumno@omniquest.com"
              placeholderTextColor="#9FC7E2"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View>
            <Text className="text-[#EAF6FB] font-medium mb-1 ml-1">Contraseña</Text>
            <TextInput
              className="w-full bg-[#16366A] border border-[#4988C4] rounded-2xl px-4 py-3.5 text-[#EAF6FB]"
              placeholder="••••••••"
              placeholderTextColor="#9FC7E2"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <Pressable
            onPress={signInWithEmail}
            disabled={loading}
            className={`w-full rounded-2xl py-4 items-center ${loading ? 'opacity-70' : 'bg-[#1C4D8D] active:bg-[#4988C4]'}`}
          >
            <Text className="text-[#F5FBFE] font-semibold text-lg">
              {loading ? 'Entrando...' : 'Iniciar Sesión'}
            </Text>
          </Pressable>

          {statusMessage ? (
            <Text className="text-center text-sm text-[#BDE8F5] mt-4">{statusMessage}</Text>
          ) : null}

          <View className="flex-row justify-center mt-6">
            <Text className="text-[#9FC7E2]">¿No tienes cuenta? </Text>
            <Link href="/register" asChild>
              <Pressable>
                <Text className="text-[#4988C4] font-semibold">Regístrate aquí.</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </View>
  )
}
