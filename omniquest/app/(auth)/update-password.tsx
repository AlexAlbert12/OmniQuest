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
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import SpaceBackground from '../../components/SpaceBackground'
import BrandLogo from '../../components/BrandLogo'
import { getAuthErrorMessage } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { createShadowStyle } from '../../lib/platformShadow'

export default function UpdatePasswordScreen() {
  const { width, height } = useWindowDimensions()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  const updatePassword = async () => {
    if (password.length < 6) {
      showAlert('Error', 'La contrasena debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      showAlert('Error', 'Las contrasenas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        showAlert('Error', getAuthErrorMessage(error, 'updatePassword'))
        return
      }

      showAlert('Contraseña actualizada', 'Ya puedes iniciar sesión con tu nueva contraseña.')
      await supabase.auth.signOut({ scope: 'local' })
      router.replace('/login' as any)
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudo actualizar la contrasena.')
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
          ...createShadowStyle({
            color: '#132C59',
            opacity: 0.35,
            radius: 28,
            offsetY: 18,
            elevation: 12,
            web: '0 18px 28px rgba(19, 44, 89, 0.25)',
          }),
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
          <BrandLogo center size={isDesktop ? 64 : 38} />

          <View
            className="mt-8 w-full overflow-hidden rounded-[20px] border border-[#3B6FA5] bg-[#081D3D]/92"
            style={{
              maxWidth: isTablet ? 560 : 430,
              ...createShadowStyle({
                color: '#1B75D8',
                opacity: 0.28,
                radius: 24,
                offsetY: 12,
                elevation: 10,
                web: '0 12px 24px rgba(27, 117, 216, 0.22)',
              }),
            }}
          >
            <View className="p-6" style={{ gap: 18 }}>
              <View className="items-center">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-[#123766]">
                  <Ionicons name="lock-closed-outline" size={30} color="#8CD5FF" />
                </View>
                <Text className="mt-4 text-center text-[24px] font-black text-white">Nueva contraseña</Text>
                <Text className="mt-2 text-center text-[14px] leading-6 text-[#AFCBE3]">
                  Introduce una contraseña nueva para recuperar tu cuenta.
                </Text>
              </View>

              <PasswordInput
                label="Nueva contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onToggleVisibility={() => setShowPassword((value) => !value)}
                visible={showPassword}
              />

              <PasswordInput
                label="Confirmar contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                onToggleVisibility={() => setShowPassword((value) => !value)}
                visible={showPassword}
              />

              <Pressable
                onPress={updatePassword}
                disabled={loading}
                className="w-full flex-row items-center justify-center rounded-xl bg-[#1C4D8D] px-5 py-4"
                style={({ pressed }) => ({ opacity: loading ? 0.7 : pressed ? 0.86 : 1 })}
              >
                {loading ? <ActivityIndicator color="#F5FBFF" /> : null}
                <Text className="ml-2 text-[16px] font-bold text-[#F5FBFF]">
                  {loading ? 'Actualizando...' : 'Guardar contraseña'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

function PasswordInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  onToggleVisibility,
  visible,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  secureTextEntry: boolean
  onToggleVisibility: () => void
  visible: boolean
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text className="ml-1 text-[13px] font-bold text-[#D9EEFF]">{label}</Text>
      <View className="flex-row items-center rounded-lg border border-[#35557C] bg-[#0B2145] px-4">
        <Ionicons className="mr-4" name="lock-closed-outline" size={18} color="#8AAED0" />
        <TextInput
          className="flex-1 px-3 py-4 text-[15px] text-[#F5FBFF]"
          placeholder="Minimo 6 caracteres"
          placeholderTextColor="#8AAED0"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
        />
        <Pressable onPress={onToggleVisibility} className="items-center justify-center rounded-full p-2">
          <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={18} color="#9FC7E2" />
        </Pressable>
      </View>
    </View>
  )
}
