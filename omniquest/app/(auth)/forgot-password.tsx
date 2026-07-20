import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AuthInput from '../../components/auth/AuthInput'
import BrandLogo from '../../components/BrandLogo'
import OmniGuide from '../../components/OmniGuide'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import { getAuthErrorMessage, getPasswordRecoveryRedirectTo, isValidEmail, normalizeEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { createShadowStyle } from '../../lib/platformShadow'

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
      showAlert('Error', 'Introduce un correo electrónico válido.')
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
      showAlert('Revisa tu correo', 'Te hemos enviado un enlace para crear una nueva contraseña.')
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudo enviar el correo de recuperación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-[#010611]"
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        className="overflow-hidden bg-[#010611]"
        style={{
          minHeight: isDesktop ? Math.max(height, 760) : Math.max(height, 760),
          borderRadius: isWeb ? 0 : 34,
        }}
      >
        <HomeVisualBackground isDesktop={isDesktop} />

        <View
          className="z-10 flex-1 items-center justify-center"
          style={{
            paddingHorizontal: isDesktop ? 32 : 22,
            paddingVertical: isDesktop ? 34 : 28,
          }}
        >
          <View className="items-center px-2">
            <BrandLogo center size={isDesktop ? 68 : 44} />
            <Text
              style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 21 : 16 }}
              className="mt-1 text-center text-[#4FB8FF]"
            >
              Recupera el acceso a tu aventura.
            </Text>

            <OmniGuide state="thinking" size={isDesktop ? 88 : 76} style={{ marginTop: 12 }} />
            <Text className="mb-5 mt-1 text-center text-[12px] text-[#AFC2DB]">Omni te ayuda a recuperar el acceso.</Text>
          </View>

          <LinearGradient
            colors={['rgba(56, 189, 248, 0.18)', 'rgba(18, 58, 92, 0.90)']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              borderColor: 'rgba(148, 163, 184, 0.18)',
              borderRadius: 32,
              borderWidth: 1,
              maxWidth: isTablet ? 560 : 430,
              overflow: 'hidden',
              width: '100%',
              ...createShadowStyle({
                color: '#38BDF8',
                opacity: 0.14,
                radius: 24,
                offsetY: 12,
                elevation: 10,
                web: '0 18px 34px rgba(56, 189, 248, 0.16)',
              }),
            }}
          >
            <View className="p-6" style={{ gap: 18 }}>
              <View className="items-center">
                <View
                  className="items-center justify-center"
                  style={{ backgroundColor: '#38BDF8', borderRadius: 22, height: 64, width: 64 }}
                >
                  <Ionicons name="key-outline" size={31} color="#FFFFFF" />
                </View>
                <Text className="mt-4 text-center text-[25px] font-extrabold text-white">¿Olvidaste tu contraseña?</Text>
                <Text className="mt-2 text-center text-[14px] font-semibold leading-6 text-[#B8C5E0]">
                  Escribe tu correo y te enviaremos un enlace para establecer una nueva contraseña.
                </Text>
              </View>

              <AuthInput
                label="Correo electrónico"
                icon="mail-outline"
                placeholder="tu@email.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />

              <Pressable
                onPress={sendRecoveryEmail}
                disabled={loading}
                style={({ pressed }) => ({ opacity: loading ? 0.7 : pressed ? 0.9 : 1 })}
              >
                <LinearGradient
                  colors={['#3479F4', '#8D63F7']}
                  start={{ x: 0, y: 0.15 }}
                  end={{ x: 1, y: 0.9 }}
                  style={{
                    alignItems: 'center',
                    borderRadius: 26,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    minHeight: 62,
                    paddingHorizontal: 22,
                  }}
                >
                  {loading ? <ActivityIndicator color="#F5FBFF" /> : null}
                  <Text className="ml-2 text-[17px] font-extrabold text-[#F5FBFF]">
                    {loading ? 'Enviando...' : sent ? 'Reenviar enlace' : 'Enviar enlace'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            <View
              className="border-t px-5 py-5"
              style={{
                backgroundColor: 'rgba(16, 42, 82, 0.42)',
                borderColor: 'rgba(99, 177, 235, 0.14)',
              }}
            >
              <Link href="/login" asChild>
                <Pressable className="flex-row items-center justify-center gap-2">
                  <Ionicons name="arrow-back" size={16} color="#42B9FF" />
                  <Text className="font-extrabold text-[#42B9FF]">Volver a iniciar sesión</Text>
                </Pressable>
              </Link>
            </View>
          </LinearGradient>
        </View>
      </View>
    </ScrollView>
  )
}