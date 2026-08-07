import { Platform } from 'react-native'
import { markPasswordRecoverySession } from './recoverySession'
import { supabase } from './supabase'

type RecoveryLinkParams = {
  accessToken: string | null
  refreshToken: string | null
  code: string | null
  type: string | null
}

function decodeValue(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

function parseParams(value: string) {
  const params = new Map<string, string>()
  value.split('&').forEach((entry) => {
    if (!entry) return
    const separator = entry.indexOf('=')
    const rawKey = separator >= 0 ? entry.slice(0, separator) : entry
    const rawValue = separator >= 0 ? entry.slice(separator + 1) : ''
    params.set(decodeValue(rawKey), decodeValue(rawValue))
  })
  return params
}

export function parsePasswordRecoveryLink(url: string): RecoveryLinkParams | null {
  if (!url || !url.toLowerCase().includes('update-password')) return null
  const queryIndex = url.indexOf('?')
  const hashIndex = url.indexOf('#')
  const queryEnd = hashIndex >= 0 ? hashIndex : url.length
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1, queryEnd) : ''
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : ''
  const params = new Map([...parseParams(query), ...parseParams(hash)])
  const type = params.get('type') || null
  const accessToken = params.get('access_token') || null
  const refreshToken = params.get('refresh_token') || null
  const code = params.get('code') || null
  if (type !== 'recovery' && !accessToken && !code) return null
  return { accessToken, refreshToken, code, type }
}

export async function applyPasswordRecoveryLink(url: string) {
  if (Platform.OS === 'web') return false
  const payload = parsePasswordRecoveryLink(url)
  if (!payload) return false

  if (payload.accessToken && payload.refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: payload.accessToken, refresh_token: payload.refreshToken })
    if (error) throw error
  } else if (payload.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(payload.code)
    if (error) throw error
  } else {
    throw new Error('El enlace de recuperación no contiene una sesión válida.')
  }

  await markPasswordRecoverySession()
  return true
}
