import * as Linking from 'expo-linking'
import { Platform } from 'react-native'

type AuthErrorLike = {
  code?: string
  message?: string
}

export type PasswordStrengthResult = {
  hasValue: boolean
  score: number
  label: 'Muy débil' | 'Débil' | 'Casi segura' | 'Segura'
  color: string
  checks: Array<{ label: string; met: boolean }>
  isAcceptable: boolean
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)
}

export function getPasswordStrength(password: string): PasswordStrengthResult {
  const checks = [
    { label: '8 caracteres', met: password.length >= 8 },
    { label: 'Mayúscula y minúscula', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'Un número', met: /\d/.test(password) },
    { label: 'Un símbolo', met: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter((check) => check.met).length

  if (score <= 1) {
    return { hasValue: password.length > 0, score, label: 'Muy débil', color: '#FB7185', checks, isAcceptable: false }
  }
  if (score === 2) {
    return { hasValue: true, score, label: 'Débil', color: '#F59E0B', checks, isAcceptable: false }
  }
  if (score === 3) {
    return { hasValue: true, score, label: 'Casi segura', color: '#38BDF8', checks, isAcceptable: false }
  }
  return { hasValue: true, score, label: 'Segura', color: '#34D399', checks, isAcceptable: true }
}

export function isEmailVerificationError(error: AuthErrorLike | null | undefined) {
  const message = error?.message?.toLowerCase() || ''
  return error?.code === 'email_not_confirmed' || message.includes('email not confirmed') || message.includes('email_not_confirmed')
}

export function getEmailRedirectTo(path = '/login') {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }

  return Linking.createURL(path)
}

export function getPasswordRecoveryRedirectTo() {
  return getEmailRedirectTo('/update-password')
}

export function getAuthErrorMessage(error: AuthErrorLike, mode: 'signIn' | 'signUp' | 'resetPassword' | 'updatePassword') {
  switch (error.code) {
    case 'email_not_confirmed':
      return 'Debes confirmar tu correo antes de iniciar sesión.'
    case 'invalid_credentials':
      return 'El correo o la contraseña no son correctos.'
    case 'email_address_invalid':
      return 'El correo no es válido. Revisa la dirección e inténtalo de nuevo.'
    case 'user_already_exists':
      return 'Ya existe una cuenta con ese correo.'
    case 'weak_password':
      return 'La contraseña debe ser más segura.'
    case 'over_email_send_rate_limit':
      return 'Has solicitado demasiados correos. Espera unos minutos antes de volver a intentarlo.'
    default:
      if (mode === 'signUp' && error.message?.includes('User already registered')) {
        return 'Ya existe una cuenta con ese correo.'
      }

      return error.message || 'Ha ocurrido un error inesperado.'
  }
}
