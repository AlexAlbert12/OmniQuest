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
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-[#0F2854]">
      <View className="flex-1 justify-center px-6 py-12">
        <View className="items-center mb-8">
          <Text style={{ fontFamily: 'Pacifico_400Regular' }} className="text-6xl text-[#BDE8F5] mb-4">
            OmniQuest
          </Text>
          <Text style={{ fontFamily: 'Pacifico_400Regular' }} className="text-[#4988C4] text-xl text-center">
            Crea tu cuenta para empezar.
          </Text>
        </View>
        <View className="rounded-3xl border border-[#4988C4] bg-[#13315F] p-6 shadow-xl">
          <View className="space-y-5">
            <View>
              <Text className="text-[#EAF6FB] font-medium mb-1 ml-1">Alias (Nombre de usuario)</Text>
              <TextInput
                className="w-full bg-[#16366A] border border-[#4988C4] rounded-2xl px-4 py-3.5 text-[#EAF6FB]"
                placeholder="Jugador123"
                placeholderTextColor="#9FC7E2"
                value={alias}
                onChangeText={setAlias}
                autoCapitalize="none"
              />
            </View>

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
              onPress={signUpWithEmail}
              disabled={loading}
              className={`w-full rounded-2xl py-4 items-center ${loading ? 'opacity-70' : 'bg-[#1C4D8D] active:bg-[#4988C4]'}`}
            >
              <Text className="text-[#F5FBFE] font-semibold text-lg">
                {loading ? 'Creando cuenta...' : 'Registrarse'}
              </Text>
            </Pressable>

            {statusMessage ? (
              <Text className="text-center text-sm text-[#BDE8F5] mt-4">{statusMessage}</Text>
            ) : null}

            <View className="flex-row justify-center mt-6">
              <Text className="text-[#9FC7E2]">¿Ya tienes cuenta? </Text>
              <Link href="/login" asChild>
                <Pressable>
                  <Text className="text-[#4988C4] font-semibold">Inicia Sesión.</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
