import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function signInWithEmail() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) Alert.alert('Error', error.message)
    setLoading(false)
  }

  return (
    <View className="flex-1 justify-center px-6 bg-slate-900">
      <View className="items-center mb-10">
        <Text className="text-4xl font-bold text-white mb-2">OmniQuest</Text>
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
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </Text>
        </Pressable>

        <View className="flex-row justify-center mt-6">
          <Text className="text-slate-400">¿No tienes cuenta? </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text className="text-indigo-400 font-semibold">Regístrate aquí.</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  )
}