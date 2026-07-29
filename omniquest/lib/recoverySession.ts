import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const RECOVERY_SESSION_KEY = 'omniquest:password-recovery:v1'
const RECOVERY_SESSION_TTL_MS = 30 * 60 * 1000

type RecoveryMarker = {
  createdAt: number
  expiresAt: number
}

function browserStorage() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  return window.sessionStorage
}

export async function markPasswordRecoverySession() {
  const marker: RecoveryMarker = {
    createdAt: Date.now(),
    expiresAt: Date.now() + RECOVERY_SESSION_TTL_MS,
  }
  const value = JSON.stringify(marker)
  const storage = browserStorage()
  if (storage) {
    storage.setItem(RECOVERY_SESSION_KEY, value)
    return
  }
  await AsyncStorage.setItem(RECOVERY_SESSION_KEY, value)
}

export async function hasActivePasswordRecoverySession() {
  const storage = browserStorage()
  const raw = storage ? storage.getItem(RECOVERY_SESSION_KEY) : await AsyncStorage.getItem(RECOVERY_SESSION_KEY)
  if (!raw) return false
  try {
    const marker = JSON.parse(raw) as RecoveryMarker
    if (!Number.isFinite(marker.expiresAt) || marker.expiresAt <= Date.now()) {
      await clearPasswordRecoverySession()
      return false
    }
    return true
  } catch {
    await clearPasswordRecoverySession()
    return false
  }
}

export async function clearPasswordRecoverySession() {
  const storage = browserStorage()
  if (storage) {
    storage.removeItem(RECOVERY_SESSION_KEY)
    return
  }
  await AsyncStorage.removeItem(RECOVERY_SESSION_KEY)
}

export function recoveryLinkIsPresent() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  const query = `${window.location.search}${window.location.hash}`.toLowerCase()
  return query.includes('type=recovery') || query.includes('access_token=') || query.includes('code=')
}
