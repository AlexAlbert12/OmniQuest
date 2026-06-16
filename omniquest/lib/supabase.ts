import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import type { Database } from '../types/database.types'

type AuthLock = <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => Promise<R>

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
  (process.env.EXPO_PUBLIC_SUPABASE_KEY as string | undefined)
const isWeb = Platform.OS === 'web'
const isBrowser = typeof window !== 'undefined'

if (!supabaseUrl) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is required.')
}

if (!supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_KEY is required.')
}

const webStorage = {
  getItem: async (key: string) => (isBrowser ? window.localStorage.getItem(key) : null),
  setItem: async (key: string, value: string) => {
    if (isBrowser) {
      window.localStorage.setItem(key, value)
    }
  },
  removeItem: async (key: string) => {
    if (isBrowser) {
      window.localStorage.removeItem(key)
    }
  },
}

const authLockQueues = new Map<string, Promise<unknown>>()

const authProcessLock: AuthLock = async (name, _acquireTimeout, fn) => {
  const previous = authLockQueues.get(name) || Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => {
    release = resolve
  })

  const queued = previous.then(() => current, () => current)
  authLockQueues.set(name, queued)

  try {
    await previous.catch(() => undefined)
    return await fn()
  } finally {
    release()
    if (authLockQueues.get(name) === queued) {
      authLockQueues.delete(name)
    }
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isWeb ? webStorage : AsyncStorage,
    lock: authProcessLock,
    autoRefreshToken: !isWeb || isBrowser,
    persistSession: !isWeb || isBrowser,
    detectSessionInUrl: isWeb,
  },
})
