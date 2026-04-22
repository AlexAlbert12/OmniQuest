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
    <View className="flex-1 justify-center px-6 bg-slate-900">
      <View className="items-center mb-10">
        <Text style={{ fontFamily: 'Pacifico_400Regular' }} className="text-4xl text-white mb-2">
          OmniQuest
        </Text>
        <Text className="text-slate-400 text-lg">Tu viaje comienza aquí.</Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="text-slate-300 font-medium mb-1.5 ml-1">Correo Electrónico</Text>
          <TextInput
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white"
            placeholder="alumno@omniquest.com"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
        </View>

        <View className="mb-6">
          <Text className="text-slate-300 font-medium mb-1.5 ml-1">Contraseña</Text>
          <TextInput
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white"
            placeholder="••••••••"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <Pressable 
          onPress={signInWithEmail}
          disabled={loading}
          className={`w-full bg-indigo-500 rounded-xl py-4 items-center ${loading ? 'opacity-70' : 'active:bg-indigo-600'}`}
        >
          <Text className="text-white font-semibold text-lg">
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </Text>
        </Pressable>

        {statusMessage ? (
          <Text className="text-center text-sm text-amber-300 mt-4">{statusMessage}</Text>
        ) : null}

        <View className="flex-row justify-center mt-6">
          <Text className="text-slate-400">¿No tienes cuenta? </Text>
          <Link href="/register" asChild>
            <Pressable>
              <Text className="text-indigo-400 font-semibold">Regístrate aquí.</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  )
}
