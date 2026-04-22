import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { getAuthErrorMessage, getEmailRedirectTo, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export default function RegisterScreen() {
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const router = useRouter()

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
        router.replace('/login' as any)
        return
      }

      setStatusMessage('Registro completado')
      Alert.alert('Exito', 'Cuenta creada correctamente.')
      router.replace('/home' as any)
    } catch (error) {
      console.error('[register] unexpected error', error)
      setStatusMessage(`Excepcion: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      Alert.alert('Error', error instanceof Error ? error.message : 'Error inesperado al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-slate-900">
      <View className="flex-1 justify-center px-6 py-12">
        <View className="items-center mb-10">
          <Text style={{ fontFamily: 'Pacifico_400Regular' }} className="text-4xl text-white mb-2">
            OmniQuest
          </Text>
          <Text className="text-slate-400 text-lg">Crea tu cuenta para empezar.</Text>
        </View>

        <View className="space-y-4">
          <View>
            <Text className="text-slate-300 font-medium mb-1.5 ml-1">Alias (Nombre de usuario)</Text>
            <TextInput
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white"
              placeholder="Jugador123"
              placeholderTextColor="#64748b"
              value={alias}
              onChangeText={setAlias}
              autoCapitalize="none"
            />
          </View>

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
            onPress={signUpWithEmail}
            disabled={loading}
            className={`w-full bg-indigo-500 rounded-xl py-4 items-center mt-2 ${loading ? 'opacity-70' : 'active:bg-indigo-600'}`}
          >
            <Text className="text-white font-semibold text-lg">
              {loading ? 'Creando cuenta...' : 'Registrarse'}
            </Text>
          </Pressable>

          {statusMessage ? (
            <Text className="text-center text-sm text-amber-300 mt-4">{statusMessage}</Text>
          ) : null}

          <View className="flex-row justify-center mt-6">
            <Text className="text-slate-400">¿Ya tienes cuenta? </Text>
            <Link href="/login" asChild>
              <Pressable>
                <Text className="text-indigo-400 font-semibold">Inicia Sesión.</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
