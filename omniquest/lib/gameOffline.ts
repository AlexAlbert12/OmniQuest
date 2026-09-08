import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Network from 'expo-network'
import { Platform } from 'react-native'
import type { Json } from '../types/database.types'

const SNAPSHOT_PREFIX = 'omniquest:game-snapshot:'
const MAX_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1000

export type PendingGameAnswer = {
  submissionId: string
  questionIndex: number
  answerId?: number
  answerText?: string
  payload?: Json
  skipped?: boolean
  timedOut?: boolean
  questionUpdatedAt?: string | null
}

export type StoredGameSnapshot = {
  version: 1
  savedAt: number
  userId: string
  questions: unknown[]
  currentIndex: number
  score: number
  lives: number
  streak: number
  timeLeft: number
  attemptId: string | null
  hintUsed: boolean
  summary: unknown
  pendingAnswer: PendingGameAnswer | null
  hasAnswered: boolean
  selectedAnswerId: number | null
  correctAnswerId: number | null
  answerStatus: 'correct' | 'incorrect' | null
  feedback: unknown | null
  feedbackNextStatus: 'gameOver' | 'finished' | null
}

function storageKey(gameKey: string) {
  return `${SNAPSHOT_PREFIX}${gameKey}`
}

function webStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function buildGameSnapshotKey(parts: (string | number | boolean | null | undefined)[]) {
  return parts.map((part) => encodeURIComponent(String(part ?? 'none'))).join(':')
}

export function createSubmissionId() {
  const random = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${random()}${random()}-${random()}-4${random().slice(1)}-${((8 + Math.floor(Math.random() * 4)).toString(16))}${random().slice(1)}-${random()}${random()}${random()}`
}

export async function saveGameSnapshot(gameKey: string, snapshot: Omit<StoredGameSnapshot, 'version' | 'savedAt'>) {
  const value: StoredGameSnapshot = { ...snapshot, version: 1, savedAt: Date.now() }
  const serialized = JSON.stringify(value)
  if (Platform.OS === 'web') {
    webStorage()?.setItem(storageKey(gameKey), serialized)
    return
  }
  await AsyncStorage.setItem(storageKey(gameKey), serialized)
}

export async function loadGameSnapshot(gameKey: string): Promise<StoredGameSnapshot | null> {
  const serialized = Platform.OS === 'web'
    ? webStorage()?.getItem(storageKey(gameKey)) ?? null
    : await AsyncStorage.getItem(storageKey(gameKey))

  if (!serialized) return null

  try {
    const parsed = JSON.parse(serialized) as StoredGameSnapshot
    const valid = parsed?.version === 1
      && Array.isArray(parsed.questions)
      && typeof parsed.savedAt === 'number'
      && Date.now() - parsed.savedAt <= MAX_SNAPSHOT_AGE_MS
    if (valid) return parsed
  } catch {

  }

  await clearGameSnapshot(gameKey)
  return null
}

export async function clearGameSnapshot(gameKey: string) {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(storageKey(gameKey))
    return
  }
  await AsyncStorage.removeItem(storageKey(gameKey))
}

export async function clearGameSnapshotsForUser(userId: string | null) {
  if (!userId) return

  if (Platform.OS === 'web') {
    const storage = webStorage()
    if (!storage) return
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith(SNAPSHOT_PREFIX)))
    keys.forEach((key) => {
      try {
        const parsed = JSON.parse(storage.getItem(key) || '{}') as Partial<StoredGameSnapshot>
        if (parsed.userId === userId) storage.removeItem(key)
      } catch {
        storage.removeItem(key)
      }
    })
    return
  }

  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(SNAPSHOT_PREFIX))
  if (keys.length === 0) return
  const snapshots = await AsyncStorage.multiGet(keys)
  const matchingKeys = snapshots.flatMap(([key, value]) => {
    try {
      const parsed = JSON.parse(value || '{}') as Partial<StoredGameSnapshot>
      return parsed.userId === userId ? [key] : []
    } catch {
      return [key]
    }
  })
  if (matchingKeys.length > 0) await AsyncStorage.multiRemove(matchingKeys)
}

export async function getNetworkAvailability() {
  if (Platform.OS === 'web') {
    return typeof navigator === 'undefined' ? true : navigator.onLine
  }
  const state = await Network.getNetworkStateAsync()
  return Boolean(state.isConnected && state.isInternetReachable !== false)
}

export function subscribeToNetworkAvailability(onChange: (online: boolean) => void) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return () => undefined
    const online = () => onChange(true)
    const offline = () => onChange(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }

  const subscription = Network.addNetworkStateListener((state) => {
    onChange(Boolean(state.isConnected && state.isInternetReachable !== false))
  })
  return () => subscription.remove()
}
