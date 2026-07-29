import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

export type AuthAttemptAction =
  | 'sign_in'
  | 'sign_up'
  | 'password_recovery'
  | 'resend_verification'
  | 'anonymous_sign_in'

export type AuthAttemptGate = {
  allowed: boolean
  retryAfterSeconds: number
  remaining?: number
  source: 'local' | 'edge' | 'fallback'
}

type LocalAttemptRecord = {
  failures: number
  firstFailureAt: number
  blockedUntil: number
}

const STORAGE_PREFIX = 'omniquest:auth-attempts:v1'
const FAILURE_WINDOW_MS = 15 * 60 * 1000
const LOCAL_BLOCK_MS = 15 * 60 * 1000
const MAX_LOCAL_FAILURES = 5

function fingerprint(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function storageKey(action: AuthAttemptAction, identifier: string) {
  return `${STORAGE_PREFIX}:${action}:${fingerprint(identifier.trim().toLowerCase() || 'anonymous')}`
}

async function readLocalRecord(action: AuthAttemptAction, identifier: string): Promise<LocalAttemptRecord | null> {
  const raw = await AsyncStorage.getItem(storageKey(action, identifier))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LocalAttemptRecord
    if (!Number.isFinite(parsed.failures) || !Number.isFinite(parsed.firstFailureAt) || !Number.isFinite(parsed.blockedUntil)) return null
    return parsed
  } catch {
    return null
  }
}

async function writeLocalRecord(action: AuthAttemptAction, identifier: string, record: LocalAttemptRecord | null) {
  const key = storageKey(action, identifier)
  if (!record) {
    await AsyncStorage.removeItem(key)
    return
  }
  await AsyncStorage.setItem(key, JSON.stringify(record))
}

export async function getLocalAuthAttemptGate(action: AuthAttemptAction, identifier: string): Promise<AuthAttemptGate> {
  const record = await readLocalRecord(action, identifier)
  const now = Date.now()
  if (!record) return { allowed: true, retryAfterSeconds: 0, source: 'local' }

  if (record.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((record.blockedUntil - now) / 1000)),
      source: 'local',
    }
  }

  if (now - record.firstFailureAt > FAILURE_WINDOW_MS) {
    await writeLocalRecord(action, identifier, null)
  }

  return { allowed: true, retryAfterSeconds: 0, source: 'local' }
}

export async function recordAuthFailure(action: AuthAttemptAction, identifier: string): Promise<AuthAttemptGate> {
  const now = Date.now()
  const current = await readLocalRecord(action, identifier)
  const insideWindow = current && now - current.firstFailureAt <= FAILURE_WINDOW_MS
  const failures = insideWindow ? current.failures + 1 : 1
  const blockedUntil = failures >= MAX_LOCAL_FAILURES ? now + LOCAL_BLOCK_MS : 0
  const next: LocalAttemptRecord = {
    failures,
    firstFailureAt: insideWindow ? current.firstFailureAt : now,
    blockedUntil,
  }
  await writeLocalRecord(action, identifier, next)
  return blockedUntil > now
    ? { allowed: false, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000), source: 'local' }
    : { allowed: true, retryAfterSeconds: 0, source: 'local' }
}

export async function clearAuthFailures(action: AuthAttemptAction, identifier: string) {
  await writeLocalRecord(action, identifier, null)
}

export async function checkAuthAttempt(action: AuthAttemptAction, identifier: string): Promise<AuthAttemptGate> {
  const localGate = await getLocalAuthAttemptGate(action, identifier)
  if (!localGate.allowed) return localGate

  try {
    const { data, error } = await supabase.functions.invoke('auth-attempt-guard', {
      body: {
        action,
        identifier: identifier.trim().toLowerCase().slice(0, 320),
      },
    })

    if (error) {
      console.warn('[auth-rate-limit] edge guard unavailable; Supabase native limits remain active', error)
      return { allowed: true, retryAfterSeconds: 0, source: 'fallback' }
    }

    const allowed = data?.allowed !== false
    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : Math.max(1, Number(data?.retryAfterSeconds || 60)),
      remaining: typeof data?.remaining === 'number' ? data.remaining : undefined,
      source: 'edge',
    }
  } catch (error) {
    console.warn('[auth-rate-limit] could not reach edge guard; Supabase native limits remain active', error)
    return { allowed: true, retryAfterSeconds: 0, source: 'fallback' }
  }
}

export function formatRetryDelay(seconds: number, locale: 'es-ES' | 'en-US' = 'es-ES') {
  const safeSeconds = Math.max(1, Math.ceil(seconds))
  if (safeSeconds < 60) return locale === 'en-US' ? `${safeSeconds} seconds` : `${safeSeconds} segundos`
  const minutes = Math.ceil(safeSeconds / 60)
  return locale === 'en-US'
    ? `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
    : `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
}

export function readCapsLockFromKeyEvent(event: unknown): boolean | null {
  const nativeEvent = (event as { nativeEvent?: unknown })?.nativeEvent as {
    getModifierState?: (key: string) => boolean
  } | undefined
  if (typeof nativeEvent?.getModifierState !== 'function') return null
  return nativeEvent.getModifierState('CapsLock')
}
