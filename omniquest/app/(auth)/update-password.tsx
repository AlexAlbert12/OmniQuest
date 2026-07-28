import React, { useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { ScrollView, Text, useWindowDimensions, View } from 'react-native'
import AuthCard from '../../components/auth/AuthCard'
import AuthInput from '../../components/auth/AuthInput'
import AuthStatusBanner from '../../components/auth/AuthStatusBanner'
import AuthSubmitButton from '../../components/auth/AuthSubmitButton'
import PasswordStrength from '../../components/auth/PasswordStrength'
import BrandLogo from '../../components/BrandLogo'
import HomeVisualBackground from '../../components/HomeVisualBackground'
import OmniGuide from '../../components/OmniGuide'
import { getAuthErrorMessage, getPasswordStrength } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export default function UpdatePasswordScreen() {
  const { width, height } = useWindowDimensions()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [confirmationError, setConfirmationError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ variant: 'success' | 'error'; title?: string; message: string } | null>(null)

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const strength = useMemo(() => getPasswordStrength(password), [password])

  const validatePassword = (value = password) => {
    const result = getPasswordStrength(value)
    const error = result.isAcceptable ? undefined : 'Elige una contraseña más segura antes de continuar.'
    setPasswordError(error)
    return !error
  }
  const validateConfirmation = (value = confirmPassword, source = password) => {
    const error = !value ? 'Repite la contraseña.' : value !== source ? 'Las contraseñas no coinciden.' : undefined
    setConfirmationError(error)
    return !error
  }

  const updatePassword = async () => {
    if (!validatePassword() || !validateConfirmation()) return
    setLoading(true)
    setStatus(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setStatus({ variant: 'success', title: 'Contraseña actualizada', message: 'Ya puedes iniciar sesión con tu nueva contraseña.' })
      await supabase.auth.signOut({ scope: 'local' })
      setTimeout(() => router.replace('/login' as any), 900)
    } catch (error: any) {
      setStatus({ variant: 'error', title: 'No se pudo actualizar', message: getAuthErrorMessage(error, 'updatePassword') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView className="flex-1 bg-background-secondary" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View className="overflow-hidden bg-background-secondary" style={{ minHeight: Math.max(height, 720) }}>
        <HomeVisualBackground isDesktop={isDesktop} />
        <View className="z-10 flex-1 items-center justify-center" style={{ paddingHorizontal: isDesktop ? 32 : 22, paddingVertical: 34 }}>
          <BrandLogo center size={isDesktop ? 64 : 48} />
          <OmniGuide state={status?.variant === 'success' ? 'happy' : 'thinking'} size={isDesktop ? 86 : 72} style={{ marginTop: 12, marginBottom: 18 }} />

          <AuthCard
            accentColor="#7C5CFF"
            icon="lock-closed-outline"
            title="Nueva contraseña"
            subtitle="Crea una contraseña distinta y difícil de adivinar"
            isDesktop={isDesktop}
            maxWidth={isTablet ? 560 : 440}
          >
            <AuthInput
              label="Nueva contraseña"
              icon="lock-closed-outline"
              placeholder="Crea una contraseña segura"
              value={password}
              onChangeText={(value) => {
                setPassword(value)
                if (passwordError) validatePassword(value)
                if (confirmPassword) validateConfirmation(confirmPassword, value)
                setStatus(null)
              }}
              onBlur={() => validatePassword()}
              error={passwordError}
              autoComplete="new-password"
              secureTextEntry={!showPassword}
              secureVisible={showPassword}
              showSecureToggle
              textContentType="newPassword"
              onToggleSecureText={() => setShowPassword((current) => !current)}
            />
            <PasswordStrength result={strength} />
            <AuthInput
              label="Confirmar contraseña"
              icon="shield-checkmark-outline"
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value)
                if (confirmationError || value === password) validateConfirmation(value, password)
                setStatus(null)
              }}
              onBlur={() => validateConfirmation()}
              onSubmitEditing={() => void updatePassword()}
              error={confirmationError}
              valid={Boolean(confirmPassword) && confirmPassword === password && !confirmationError}
              autoComplete="new-password"
              secureTextEntry={!showConfirmPassword}
              secureVisible={showConfirmPassword}
              showSecureToggle
              textContentType="newPassword"
              returnKeyType="done"
              onToggleSecureText={() => setShowConfirmPassword((current) => !current)}
            />
            {status ? <AuthStatusBanner variant={status.variant} title={status.title} message={status.message} /> : null}
            <AuthSubmitButton
              label="Guardar nueva contraseña"
              loadingLabel="Actualizando…"
              loading={loading}
              disabled={!strength.isAcceptable}
              icon="checkmark"
              onPress={() => void updatePassword()}
            />
          </AuthCard>
        </View>
      </View>
    </ScrollView>
  )
}
