import * as Linking from 'expo-linking'
import { Platform } from 'react-native'
import {
  getPasswordChecks,
  isValidEmail,
  normalizeEmail,
} from './authFormValidation'

type AuthErrorLike = {
  code?: string
  message?: string
  status?: number
}

type Translator = (key: string, params?: Record<string, string | number>) => string

export type PasswordStrengthResult = {
  hasValue: boolean
  score: number
  label: string
  color: string
  checks: Array<{ label: string; met: boolean }>
  isAcceptable: boolean
}

export { isValidEmail, normalizeEmail }

export function getPasswordStrength(password: string, t?: Translator): PasswordStrengthResult {
  const passwordChecks = getPasswordChecks(password)
  const checks = [
    { label: t?.('auth.password.rule.length') ?? '8 caracteres', met: passwordChecks.length },
    { label: t?.('auth.password.rule.case') ?? 'Mayúscula y minúscula', met: passwordChecks.mixedCase },
    { label: t?.('auth.password.rule.number') ?? 'Un número', met: passwordChecks.number },
    { label: t?.('auth.password.rule.symbol') ?? 'Un símbolo', met: passwordChecks.symbol },
  ]
  const score = checks.filter((check) => check.met).length

  if (score <= 1) {
    return {
      hasValue: password.length > 0,
      score,
      label: t?.('auth.password.strength.veryWeak') ?? 'Muy débil',
      color: '#FB7185',
      checks,
      isAcceptable: false,
    }
  }
  if (score === 2) {
    return {
      hasValue: true,
      score,
      label: t?.('auth.password.strength.weak') ?? 'Débil',
      color: '#F59E0B',
      checks,
      isAcceptable: false,
    }
  }
  if (score === 3) {
    return {
      hasValue: true,
      score,
      label: t?.('auth.password.strength.almost') ?? 'Casi segura',
      color: '#38BDF8',
      checks,
      isAcceptable: false,
    }
  }
  return {
    hasValue: true,
    score,
    label: t?.('auth.password.strength.strong') ?? 'Segura',
    color: '#34D399',
    checks,
    isAcceptable: true,
  }
}

export function isEmailVerificationError(error: AuthErrorLike | null | undefined) {
  const message = error?.message?.toLowerCase() || ''
  return error?.code === 'email_not_confirmed' || message.includes('email not confirmed') || message.includes('email_not_confirmed')
}

export function isRateLimitError(error: AuthErrorLike | null | undefined) {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()
  return error?.status === 429
    || code.includes('rate_limit')
    || code === 'too_many_requests'
    || message.includes('too many requests')
    || message.includes('rate limit')
}

export function isInvalidCredentialError(error: AuthErrorLike | null | undefined) {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()
  return code === 'invalid_credentials'
    || message.includes('invalid login credentials')
    || message.includes('invalid credentials')
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

export function getAuthErrorMessage(
  error: AuthErrorLike,
  mode: 'signIn' | 'signUp' | 'resetPassword' | 'updatePassword',
  t?: Translator,
) {
  const translate = (key: string, fallback: string) => t?.(key) ?? fallback

  if (isRateLimitError(error)) {
    return translate('auth.error.rateLimited', 'Has realizado demasiados intentos. Espera unos minutos antes de volver a intentarlo.')
  }

  switch (error.code) {
    case 'email_not_confirmed':
      return translate('auth.error.emailNotConfirmed', 'Debes confirmar tu correo antes de iniciar sesión.')
    case 'invalid_credentials':
      return translate('auth.error.invalidCredentials', 'El correo o la contraseña no son correctos.')
    case 'email_address_invalid':
      return translate('auth.error.invalidEmail', 'El correo no es válido. Revisa la dirección e inténtalo de nuevo.')
    case 'user_already_exists':
      return translate('auth.error.userExists', 'Ya existe una cuenta con ese correo.')
    case 'weak_password':
      return translate('auth.error.weakPassword', 'La contraseña debe ser más segura.')
    case 'over_email_send_rate_limit':
      return translate('auth.error.emailRateLimited', 'Has solicitado demasiados correos. Espera unos minutos antes de volver a intentarlo.')
    case 'signup_disabled':
      return translate('auth.error.signupDisabled', 'El registro público no está disponible en este momento.')
    case 'email_provider_disabled':
      return translate('auth.error.emailProviderDisabled', 'El acceso por correo no está disponible en este momento.')
    case 'captcha_failed':
      return translate('auth.error.captchaFailed', 'No se pudo validar la comprobación de seguridad. Vuelve a intentarlo.')
    default:
      if (mode === 'signUp' && error.message?.includes('User already registered')) {
        return translate('auth.error.userExists', 'Ya existe una cuenta con ese correo.')
      }

      return error.message || translate('auth.error.unexpected', 'Ha ocurrido un error inesperado.')
  }
}
