import * as Linking from 'expo-linking'
import { Platform } from 'react-native'

type AuthErrorLike = {
  code?: string
  message?: string
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email)
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
      return 'Debes confirmar tu correo antes de iniciar sesion.'
    case 'invalid_credentials':
      return 'Correo o contrasena incorrectos.'
    case 'email_address_invalid':
      return 'Supabase esta rechazando ese correo. Usa un email real y revisa la configuracion de Email Auth en Supabase.'
    case 'user_already_exists':
      return 'Ya existe una cuenta con ese correo.'
    case 'weak_password':
      return 'La contrasena debe ser mas segura.'
    default:
      if (mode === 'signUp' && error.message?.includes('User already registered')) {
        return 'Ya existe una cuenta con ese correo.'
      }

      return error.message || 'Ha ocurrido un error inesperado.'
  }
}
