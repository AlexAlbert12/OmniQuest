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
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import SpaceBackground from '../../components/SpaceBackground'
import BrandLogo from '../../components/BrandLogo'
import { getAuthErrorMessage, getPasswordRecoveryRedirectTo, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export default function ForgotPasswordScreen() {
  const { width, height } = useWindowDimensions()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

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

  const sendRecoveryEmail = async () => {
    const normalizedEmail = normalizeEmail(email)

    if (!isValidEmail(normalizedEmail)) {
      showAlert('Error', 'Introduce un correo electronico valido.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getPasswordRecoveryRedirectTo(),
      })

      if (error) {
        showAlert('Error', getAuthErrorMessage(error, 'resetPassword'))
        return
      }

      setSent(true)
      showAlert('Revisa tu correo', 'Te hemos enviado un enlace para crear una nueva contrasena.')
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudo enviar el correo de recuperacion.')
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
          <BrandLogo center size={isDesktop ? 64 : 38} />
          <Text className="mt-2 text-center text-[#8CD5FF]">Recupera el acceso a tu aventura.</Text>

          <View
            className="mt-8 w-full overflow-hidden rounded-[20px] border border-[#3B6FA5] bg-[#081D3D]/92"
            style={{
              maxWidth: isTablet ? 560 : 430,
              shadowColor: '#1B75D8',
              shadowOpacity: isWeb ? 0 : 0.28,
              shadowRadius: isWeb ? 0 : 24,
              shadowOffset: { width: 0, height: isWeb ? 0 : 12 },
              elevation: isWeb ? 0 : 10,
            }}
          >
            <View className="p-6" style={{ gap: 18 }}>
              <View className="items-center">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-[#123766]">
                  <Ionicons name="key-outline" size={30} color="#8CD5FF" />
                </View>
                <Text className="mt-4 text-center text-[24px] font-black text-white">¿Olvidaste tu contraseña?</Text>
                <Text className="mt-2 text-center text-[14px] leading-6 text-[#AFCBE3]">
                  Escribe tu correo y te enviaremos un enlace para establecer una nueva contraseña.
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                <Text className="ml-1 text-[13px] font-bold text-[#D9EEFF]">Correo electrónico</Text>
                <View className="flex-row items-center rounded-lg border border-[#35557C] bg-[#0B2145]">
                  <Ionicons className="ml-4 mr-4" name="mail-outline" size={18} color="#8AAED0" />
                  <TextInput
                    className="flex-1 px-3 py-4 text-[15px] text-[#F5FBFF]"
                    placeholder="tu@email.com"
                    placeholderTextColor="#8AAED0"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <Pressable
                onPress={sendRecoveryEmail}
                disabled={loading}
                className="w-full flex-row items-center justify-center rounded-xl bg-[#1C4D8D] px-5 py-4"
                style={({ pressed }) => ({ opacity: loading ? 0.7 : pressed ? 0.86 : 1 })}
              >
                {loading ? <ActivityIndicator color="#F5FBFF" /> : null}
                <Text className="ml-2 text-[16px] font-bold text-[#F5FBFF]">
                  {loading ? 'Enviando...' : sent ? 'Reenviar enlace' : 'Enviar enlace'}
                </Text>
              </Pressable>
            </View>

            <View className="border-t border-[#17365F] bg-[#06162F] px-5 py-5">
              <Link href="/login" asChild>
                <Pressable className="flex-row items-center justify-center gap-2">
                  <Ionicons name="arrow-back" size={16} color="#4FB8FF" />
                  <Text className="font-bold text-[#4FB8FF]">Volver a iniciar sesión</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
