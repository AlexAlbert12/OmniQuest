import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function RegisterScreen() {
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function signUpWithEmail() {
    if (!alias || !email || !password) {
      Alert.alert('Error', 'Por favor, rellena todos los campos')
      return
    }

    setLoading(true)
    
    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          alias: alias,
          role_id: 'student', 
        },
      },
    })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('¡Éxito!', 'Cuenta creada correctamente.')
      router.replace('/(auth)/login' as any) 
    }
    setLoading(false)
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-slate-900">
      <View className="flex-1 justify-center px-6 py-12">
        <View className="items-center mb-10">
          <Text className="text-4xl font-bold text-white mb-2">OmniQuest</Text>
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

          <View className="flex-row justify-center mt-6">
            <Text className="text-slate-400">¿Ya tienes cuenta? </Text>
            <Link href="/(auth)/login" asChild>
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