import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getAuthErrorMessage, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
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
    <ScrollView className="flex-1 bg-[#0F2854]" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 justify-center px-6 py-12">
        <View className="items-center mb-12">
          <Text style={{ fontFamily: 'Pacifico_400Regular' }} className="text-6xl text-[#BDE8F5] mb-3">
            OmniQuest
          </Text>
          <View className="flex-row items-center gap-2 mb-2">
            <View className="flex-1 h-px bg-gradient-to-r from-transparent via-[#4988C4]/50 to-transparent" />
            <Ionicons name="rocket" size={20} color="#4988C4" />
            <View className="flex-1 h-px bg-gradient-to-r from-transparent via-[#4988C4]/50 to-transparent" />
          </View>
          <Text style={{ fontFamily: 'Pacifico_400Regular' }} className="text-[#4988C4] text-lg text-center">
            Tu viaje de aprendizaje comienza aquí.
          </Text>
        </View>

        <View className="rounded-3xl border border-[#4988C4] bg-[#13315F]/80 p-8 shadow-xl mb-12 backdrop-blur-sm">
          <View className="space-y-6">
            <View>
              <Text className="text-[#EAF6FB] font-semibold mb-2 ml-1">Correo Electrónico</Text>
              <View className="flex-row items-center bg-[#16366A] border border-[#4988C4] rounded-2xl px-4">
                <Ionicons name="mail-outline" size={20} color="#4988C4" />
                <TextInput
                  className="flex-1 py-4 px-3 text-[#EAF6FB] text-base"
                  placeholder="alumno@omniquest.com"
                  placeholderTextColor="#9FC7E2"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View>
              <Text className="text-[#EAF6FB] font-semibold mb-2 ml-1">Contraseña</Text>
              <View className="flex-row items-center bg-[#16366A] border border-[#4988C4] rounded-2xl px-4">
                <Ionicons name="lock-closed-outline" size={20} color="#4988C4" />
                <TextInput
                  className="flex-1 py-4 px-3 text-[#EAF6FB] text-base"
                  placeholder="••••••••"
                  placeholderTextColor="#9FC7E2"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} className="p-2">
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#9FC7E2" 
                  />
                </Pressable>
              </View>
            </View>

            <View className="flex-row items-center justify-between">
              <Pressable 
                onPress={() => setRememberMe(!rememberMe)}
                className="flex-row items-center gap-2"
              >
                <View className={`w-5 h-5 rounded border-2 ${rememberMe ? 'bg-[#4988C4] border-[#4988C4]' : 'border-[#4988C4]'} items-center justify-center`}>
                  {rememberMe && <Ionicons name="checkmark" size={16} color="#0F2854" />}
                </View>
                <Text className="text-[#EAF6FB] text-sm">Recordarme</Text>
              </Pressable>
              <Pressable
                onPress={() => Alert.alert('Próximamente', 'Función de recuperación de contraseña disponible pronto')}
              >
                <Text className="text-[#4988C4] text-sm">¿Olvidaste tu contraseña?</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={signInWithEmail}
              disabled={loading}
              className={`w-full rounded-2xl py-4 flex-row items-center justify-center gap-2 ${loading ? 'opacity-70' : 'bg-[#1C4D8D] active:bg-[#4988C4]'}`}
            >
              <Text className="text-[#F5FBFE] font-bold text-lg">
                {loading ? 'Entrando...' : 'Iniciar Sesión'}
              </Text>
              {!loading && <Ionicons name="arrow-forward" size={20} color="#F5FBFE" />}
            </Pressable>

            {statusMessage ? (
              <Text className="text-center text-sm text-[#BDE8F5]">{statusMessage}</Text>
            ) : null}

            <View className="flex-row justify-center items-center gap-1 pt-2">
              <Text className="text-[#9FC7E2] text-sm">¿No tienes cuenta?</Text>
              <Link href="/register" asChild>
                <Pressable>
                  <Text className="text-[#4988C4] font-semibold text-sm">Regístrate aquí.</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>

        <View className="space-y-4">
          <View className="flex-row gap-4">
            <View className="flex-1 bg-[#13315F]/50 border border-[#4988C4]/30 rounded-2xl p-5">
              <View className="bg-[#4988C4] w-10 h-10 rounded-full items-center justify-center mb-3">
                <Ionicons name="book-outline" size={20} color="#0F2854" />
              </View>
              <Text className="text-[#BDE8F5] font-semibold text-sm mb-1">Aprende a tu ritmo</Text>
              <Text className="text-[#9FC7E2] text-xs">Contenido diseñado para ti</Text>
            </View>

            <View className="flex-1 bg-[#13315F]/50 border border-[#4988C4]/30 rounded-2xl p-5">
              <View className="bg-[#4988C4] w-10 h-10 rounded-full items-center justify-center mb-3">
                <Ionicons name="star-outline" size={20} color="#0F2854" />
              </View>
              <Text className="text-[#BDE8F5] font-semibold text-sm mb-1">Alcanza tus metas</Text>
              <Text className="text-[#9FC7E2] text-xs">Supera tus límites cada día</Text>
            </View>

            <View className="flex-1 bg-[#13315F]/50 border border-[#4988C4]/30 rounded-2xl p-5">
              <View className="bg-[#4988C4] w-10 h-10 rounded-full items-center justify-center mb-3">
                <Ionicons name="trophy-outline" size={20} color="#0F2854" />
              </View>
              <Text className="text-[#BDE8F5] font-semibold text-sm mb-1">Logra más</Text>
              <Text className="text-[#9FC7E2] text-xs">Tu éxito es nuestra misión</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
