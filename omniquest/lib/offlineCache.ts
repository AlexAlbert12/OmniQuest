import AsyncStorage from '@react-native-async-storage/async-storage'
import { getNetworkAvailability } from './gameOffline'

const CACHE_PREFIX = 'omniquest:offline-cache:v1:'
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000

type CacheEnvelope<T> = {
  version: 1
  userId: string
  resource: string
  data: T
  savedAt: number
}

export type OfflineCacheMetadata = {
  source: 'cache' | 'network'
  savedAt: number
  stale: boolean
  fallback: boolean
}

export type OfflineCacheActivity = OfflineCacheMetadata & {
  userId: string
  resource: string
}

type ReadThroughOptions<T> = {
  userId: string
  resource: string
  fetcher: () => Promise<T>
  onData: (data: T, metadata: OfflineCacheMetadata) => void
  maxAgeMs?: number
  staleAfterMs?: number
}

const activityListeners = new Set<(activity: OfflineCacheActivity) => void>()

export class OfflineDataUnavailableError extends Error {
  constructor(message = 'No hay conexión ni datos guardados para esta pantalla.') {
    super(message)
    this.name = 'OfflineDataUnavailableError'
  }
}

export function subscribeOfflineCacheActivity(listener: (activity: OfflineCacheActivity) => void) {
  activityListeners.add(listener)
  return () => {
    activityListeners.delete(listener)
  }
}

export async function readThroughCache<T>({
  userId,
  resource,
  fetcher,
  onData,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
}: ReadThroughOptions<T>) {
  const cached = await readOfflineCache<T>(userId, resource, maxAgeMs)
  if (cached) {
    const metadata: OfflineCacheMetadata = {
      source: 'cache',
      savedAt: cached.savedAt,
      stale: Date.now() - cached.savedAt > staleAfterMs,
      fallback: false,
    }
    onData(cached.data, metadata)
    emitActivity({ userId, resource, ...metadata })
  }

  if (!await getNetworkAvailability()) {
    if (cached) {
      const metadata: OfflineCacheMetadata = {
        source: 'cache',
        savedAt: cached.savedAt,
        stale: true,
        fallback: true,
      }
      emitActivity({ userId, resource, ...metadata })
      return { data: cached.data, metadata }
    }
    throw new OfflineDataUnavailableError()
  }

  try {
    const freshData = await fetcher()
    const savedAt = Date.now()
    await writeOfflineCache(userId, resource, freshData, savedAt)
    const metadata: OfflineCacheMetadata = {
      source: 'network',
      savedAt,
      stale: false,
      fallback: false,
    }
    onData(freshData, metadata)
    emitActivity({ userId, resource, ...metadata })
    return { data: freshData, metadata }
  } catch (error) {
    if (cached) {
      const metadata: OfflineCacheMetadata = {
        source: 'cache',
        savedAt: cached.savedAt,
        stale: true,
        fallback: true,
      }
      emitActivity({ userId, resource, ...metadata })
      return { data: cached.data, metadata }
    }
    throw error
  }
}

export async function readOfflineCache<T>(userId: string, resource: string, maxAgeMs = DEFAULT_MAX_AGE_MS) {
  const serialized = await AsyncStorage.getItem(cacheKey(userId, resource))
  if (!serialized) return null

  try {
    const parsed = JSON.parse(serialized) as CacheEnvelope<T>
    const isValid = parsed?.version === 1
      && parsed.userId === userId
      && parsed.resource === resource
      && typeof parsed.savedAt === 'number'
      && Date.now() - parsed.savedAt <= maxAgeMs
    if (isValid) return { data: parsed.data, savedAt: parsed.savedAt }
  } catch {
    // Corrupt or obsolete entries are removed below.
  }

  await AsyncStorage.removeItem(cacheKey(userId, resource))
  return null
}

export async function writeOfflineCache<T>(userId: string, resource: string, data: T, savedAt = Date.now()) {
  const envelope: CacheEnvelope<T> = { version: 1, userId, resource, data, savedAt }
  await AsyncStorage.setItem(cacheKey(userId, resource), JSON.stringify(envelope))
  return savedAt
}

export async function updateOfflineCache<T>(
  userId: string,
  resource: string,
  updater: (current: T) => T,
) {
  const current = await readOfflineCache<T>(userId, resource)
  if (!current) return null
  const next = updater(current.data)
  await writeOfflineCache(userId, resource, next)
  return next
}

export async function clearOfflineCacheForUser(userId: string) {
  const keys = await AsyncStorage.getAllKeys()
  const prefix = `${CACHE_PREFIX}${encodeURIComponent(userId)}:`
  const userKeys = keys.filter((key) => key.startsWith(prefix))
  if (userKeys.length > 0) await AsyncStorage.multiRemove(userKeys)
}

function cacheKey(userId: string, resource: string) {
  return `${CACHE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(resource)}`
}

function emitActivity(activity: OfflineCacheActivity) {
  activityListeners.forEach((listener) => listener(activity))
}
